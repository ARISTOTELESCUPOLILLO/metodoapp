import { createFileRoute } from "@tanstack/react-router";
import {
  resolveEffectiveUser,
  checkBalance,
  checkRateLimit,
  balanceFailMessage,
  debitUsage,
} from "@/lib/usage.server";
import { isAdmin as checkIsAdmin } from "@/repository/authz";
import { COST_USD } from "@/lib/costs";
import {
  generateSugestao,
  type SugestaoSegment,
  type SugestaoAudience,
} from "@/core/sugestaoEngine";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/suggest-keyinfo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Usuário efetivo (respeita impersonação) — assim o débito da
          // Sugestão vai para o usuário de teste quando o admin atua como ele,
          // igual generate-content.ts.
          const effective = await resolveEffectiveUser(request);
          if (!effective) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          const userId = effective.userId;
          const isAdminUser = await checkIsAdmin(effective.userId);

          if (!effective.impersonatedBy) {
            const rate = await checkRateLimit(userId);
            if (!rate.ok) {
              return Response.json(
                {
                  error:
                    "Limite de 15 gerações por hora atingido. Aguarde antes de tentar novamente.",
                },
                { status: 429 },
              );
            }
          }

          const body = await request.json();
          const preferredSlot = ["plano1", "plano2", "bonus"].includes(body.preferredSlot)
            ? (body.preferredSlot as "plano1" | "plano2" | "bonus")
            : undefined;

          // Cota real do contador sugestoes. O admin NÃO é travado por esse
          // contador novo (nem o debita); os limites gerais do plano continuam
          // valendo para ele. O débito acontece 1× por clique, depois do loop
          // de retry de qualidade (não 1 por tentativa interna).
          if (!isAdminUser) {
            const balance = await checkBalance(userId, 0, 0, 0, preferredSlot, { sugestoes: 1 });
            if (!balance.ok) {
              return Response.json({ error: balanceFailMessage(balance.reason) }, { status: 402 });
            }
          }

          const companyName = String(body.companyName || "").slice(0, 200);
          const mainActivity = String(body.mainActivity || "").slice(0, 300);
          const objetivo = String(body.objetivo || "promocao");
          const hint = String(body.hint || "")
            .slice(0, 1000)
            .trim();
          const mode = String(body.mode || "postunico") as "postunico" | "metodo";
          const attempt = Number(body.attempt || 0);
          // Semente fixada pelo CLIENTE no início da sessão de sugestões (ver
          // sessionSeedRef em ContentForm.tsx/PostUnicoForm.tsx) — sem ela, cada
          // clique em "Sugestão" é um request HTTP independente e um Math.random()
          // aqui seria re-sorteado a cada chamada, perdendo a garantia de que as
          // tentativas 0/1/2 da MESMA sessão caiam em lentes diferentes (ver uso
          // em lensIndex do motor). Fallback aleatório só para chamadas antigas sem o campo.
          const sessionSeedRaw = Number(body.sessionSeed);
          const sessionSeed =
            Number.isFinite(sessionSeedRaw) && body.sessionSeed !== undefined
              ? sessionSeedRaw
              : Math.floor(Math.random() * 1e9);

          // slice(-6): as MAIS RECENTES, não as 6 primeiras — o cliente monta o
          // array com o histórico entre sessões primeiro e o lote ATUAL depois
          // (ver allSessionSuggestionsRef em PostUnicoForm.tsx/KeyInfoSection.tsx),
          // então slice(0, 6) (bug corrigido 14/07/2026) descartava todo o lote
          // atual assim que o histórico acumulava 6+ itens — o motor ficava cego
          // pras próprias sugestões do pedido em andamento e só via histórico
          // antigo, às vezes de outra empresa (mesma chave de storage por
          // userId). Com SUGGEST_MAX=3 no cliente, slice(-6) garante que o lote
          // atual (sempre no fim do array) nunca fica de fora.
          const previousSugs: string[] = Array.isArray(body.previousSuggestions)
            ? body.previousSuggestions.slice(-6).map(String).filter(Boolean)
            : [];

          const SEGMENTS = ["VAREJO", "SERVIÇOS", "MARCA"] as const;
          const segment: SugestaoSegment = (SEGMENTS as readonly string[]).includes(body.segment)
            ? (body.segment as SugestaoSegment)
            : "SERVIÇOS";
          const isPersonalBrand = segment === "MARCA" && body.isPersonalBrand === true;

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json(
              { error: "OPENAI_API_KEY_CONTENT não configurada" },
              { status: 500 },
            );
          }

          const selectedProducts: string[] = Array.isArray(body.selectedProducts)
            ? body.selectedProducts
                .slice(0, 10)
                .map((s: unknown) => String(s).slice(0, 80))
                .filter(Boolean)
            : [];

          const AUDIENCES = ["B2C", "B2B"] as const;
          const audience: SugestaoAudience = (AUDIENCES as readonly string[]).includes(
            body.audience,
          )
            ? (body.audience as SugestaoAudience)
            : "B2C";

          const brandVoice = String(body.brandVoice || "").slice(0, 80);

          // Motor de geração puro (src/core/sugestaoEngine.ts) — extraído desta
          // rota em 06/07/2026 para ser testável fora do contexto de uma
          // request HTTP (ver scripts/ab-test-sugestao.ts). Ele lança (throw)
          // em vez de retornar Response em caso de falha da OpenAI, para não
          // depender de `Response` — o catch abaixo devolve o mesmo
          // status/mensagem que a rota devolvia antes da extração.
          let sugestao: string;
          try {
            const result = await generateSugestao(apiKey, {
              companyName,
              mainActivity,
              objetivo,
              hint,
              mode,
              attempt,
              sessionSeed,
              previousSuggestions: previousSugs,
              segment,
              isPersonalBrand,
              selectedProducts,
              audience,
              brandVoice,
            });
            sugestao = result.sugestao;

            // Observabilidade do juiz LLM (achado 13/07/2026 — ver memória
            // project-juiz-llm-veto-descartado-2026-07-13): grava cada
            // veredito real (aprovado/reprovado/fail-open técnico) pra medir
            // a taxa em produção. Non-fatal: falha aqui nunca invalida a
            // sugestão já gerada, só loga (mesmo padrão do debitUsage abaixo).
            if (result.judgeVerdicts.length > 0) {
              try {
                await supabaseAdmin.from("sugestao_judge_logs").insert(
                  result.judgeVerdicts.map((v) => ({
                    ok: v.ok,
                    fail_reason: v.failReason ?? null,
                    motivo: v.motivo ?? null,
                    segment,
                    mode,
                    pass: v.pass,
                    company_name: companyName || null,
                  })),
                );
              } catch (e) {
                console.warn("[suggest-keyinfo] judge log insert failed", (e as Error).message);
              }
            }
          } catch (e) {
            const status = (e as { status?: number }).status ?? 500;
            return Response.json({ error: (e as Error).message }, { status });
          }

          // Debita 1 clique de Sugestão (1 clique do usuário = 1 débito, fora do
          // loop de retry). Nunca para o admin. custoUsd = buffer que saiu de
          // content_* (COST_USD.sugestao). Falha no débito não invalida a
          // sugestão já gerada (só loga).
          if (!isAdminUser) {
            try {
              await debitUsage(userId, 0, 0, {
                evento: "suggest_keyinfo",
                modulo: mode,
                sugestoes: 1,
                custoUsd: COST_USD.sugestao,
                impersonatedBy: effective.impersonatedBy,
                preferredSlot,
              });
            } catch (e) {
              console.warn("[suggest-keyinfo] debit failed", (e as Error).message);
            }
          }

          return Response.json({ sugestao });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
