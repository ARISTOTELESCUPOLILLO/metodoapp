import { createFileRoute } from "@tanstack/react-router";
import {
  truncateWords,
  validateTitulo,
  validateTexto,
  validateLegenda,
  normalizeLegenda,
  enforceLegendaLimits,
  correctPortugueseSpelling,
  LEGENDA_CORPO_MAX_WORDS,
  LEGENDA_CTA_MAX_WORDS,
  LEGENDA_HASHTAGS,
  TITULO_MAX_WORDS,
  TECNICISMO_RULE,
} from "@/core/textValidation";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import {
  resolveEffectiveUser,
  checkBalance,
  checkRateLimit,
  balanceFailMessage,
  debitUsage,
} from "@/lib/usage.server";
import { isAdmin as checkIsAdmin } from "@/repository/authz";
import { COST_USD } from "@/lib/costs";

type Kind = "titulo" | "texto" | "legenda";

function getRule(kind: Kind, formato: string): { label: string; rule: string; max: number } {
  const f = (formato || "").toLowerCase();
  const isCarrossel = f.startsWith("carrossel");
  const isReels = f.startsWith("reels");

  if (kind === "legenda") {
    return {
      label: "legenda do post",
      rule: `Estrutura OBRIGATÓRIA em exatamente 3 parágrafos, separados por LINHA EM BRANCO (uma quebra de linha dupla):
1) Corpo: até ${LEGENDA_CORPO_MAX_WORDS} palavras, retomando o conceito central do título/imagem — sem repetir o título inteiro, sem abrir assunto novo, sem texto explicativo longo — terminando com PONTO FINAL. PROIBIDO terminar o corpo com frase no imperativo dirigida ao leitor (ex.: "Compartilhe...", "Salve...", "Acesse...") — isso é função EXCLUSIVA do parágrafo 2.
2) CTA: EXATAMENTE 1 frase curta (máx. ${LEGENDA_CTA_MAX_WORDS} palavras), terminando com PONTO FINAL — varie, ex.: "Salve este post.", "Comente o que achou.", "Compartilhe com quem precisa ver.". PROIBIDO incluir uma 2ª frase ou CTA indireto (ex.: "Acesse a bio...", "Acesse o site...") no mesmo parágrafo ou em parágrafo extra.
3) Hashtags: EXATAMENTE ${LEGENDA_HASHTAGS}, todas em letra MINÚSCULA, sem acento e sem caracteres especiais, separadas por espaço (ex.: #marketing #comunicacao #estrategia), coerentes com o segmento — nunca genéricas demais.
Formato final exato: "{corpo}\\n\\n{CTA}\\n\\n#hash1 #hash2 #hash3". Nunca emojis nas hashtags, nunca emojis exagerados no corpo ou no CTA.
A NOVA VERSÃO PRECISA SER REALMENTE DIFERENTE DA VERSÃO ATUAL: não repita a abertura/primeira frase do corpo, nem o CTA, nem as hashtags da versão atual.`,
      max: LEGENDA_CORPO_MAX_WORDS,
    };
  }

  if (kind === "titulo") {
    const max = TITULO_MAX_WORDS; // mesma fonte de verdade de validateTitulo — evita gerar título que o D1 reprova de cara
    return {
      label: "título",
      rule: `MÁXIMO ${max} palavras, cada palavra com NO MÁXIMO 4 sílabas (ex.: "resultado" ✓, "comunicação" ✗ → use "mensagem"). NUNCA exceda esses limites — conte as palavras e as sílabas antes de responder. Direto, com tensão ou benefício claro. Sem emoji, sem hashtag, sem aspas. Sem ponto final — EXCETO se o título for uma pergunta (direta ou retórica): nesse caso o "?" é OBRIGATÓRIO. Ex. corretos: "Por que isso acontece?" / "O que está faltando?" — Ex. errados: "Por que isso acontece" / "O que está faltando."
A NOVA VERSÃO PRECISA SER REALMENTE DIFERENTE DA VERSÃO ATUAL: troque o sujeito OU a estrutura da frase, não só o verbo ou um adjetivo isolado. Reescrever trocando apenas 1 palavra mantendo sujeito, conjunção e complemento idênticos é REPROVADO.`,
      max,
    };
  }

  // kind === 'texto'
  // Estático, Estático Final e Carrossel = 12 palavras (regra do método)
  // Reels (script) = 25 palavras
  // PostUnico = 14 palavras
  const isPostUnico = f.startsWith("postunico");
  const max = isReels ? 25 : isPostUnico ? 14 : 12;
  return {
    label: "texto de apoio",
    rule: `MÁXIMO ${max} palavras. NUNCA exceda esse limite — conte mentalmente as palavras antes de responder. Frase curta que sustente o título. Sem emoji, sem hashtag, sem aspas.
A NOVA VERSÃO PRECISA SER REALMENTE DIFERENTE DA VERSÃO ATUAL: troque o sujeito OU a estrutura da frase, não só o verbo ou um adjetivo isolado. Reescrever trocando apenas 1 palavra mantendo sujeito, conjunção e complemento idênticos é REPROVADO.`,
    max,
  };
}

export const Route = createFileRoute("/api/regenerate-block")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Endpoint pago (chama gpt-4.1). Gate: usuário efetivo (respeita
          // impersonação) + cota real do contador regen_texto ("Gerar outro").
          // O admin NÃO é travado por esse contador novo (nem o debita) — mas
          // os limites gerais de imagem/render/geração continuam valendo para
          // ele (bypass geral permanece removido, ver debit_usage).
          const effective = await resolveEffectiveUser(request);
          if (!effective) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          const body = await request.json();
          const preferredSlot = ["plano1", "plano2", "bonus"].includes(body.preferredSlot)
            ? (body.preferredSlot as "plano1" | "plano2" | "bonus")
            : undefined;
          const isAdminUser = await checkIsAdmin(effective.userId);

          if (!effective.impersonatedBy) {
            const rate = await checkRateLimit(effective.userId);
            if (!rate.ok) {
              return Response.json(
                { error: "Limite de 15 gerações por hora atingido. Aguarde antes de tentar novamente." },
                { status: 429 },
              );
            }
          }

          if (!isAdminUser) {
            const balance = await checkBalance(effective.userId, 0, 0, 0, preferredSlot, {
              regenTexto: 1,
            });
            if (!balance.ok) {
              return Response.json({ error: balanceFailMessage(balance.reason) }, { status: 402 });
            }
          }

          const kind = String(body.kind || "") as Kind;
          if (kind !== "titulo" && kind !== "texto" && kind !== "legenda") {
            return Response.json({ error: "kind inválido" }, { status: 400 });
          }
          const companyName = String(body.companyName || "").slice(0, 200);
          const mainActivity = String(body.mainActivity || "").slice(0, 300);
          const keyInfo = String(body.keyInfo || "").slice(0, 1000);
          const tituloAtual = String(body.tituloAtual || "").slice(0, 300);
          const textoAtual = String(body.textoAtual || "").slice(0, 800);
          const legendaAtual = String(body.legendaAtual || "").slice(0, 1500);
          const formato = String(body.formato || "").slice(0, 60);
          const motivoReprovacao = String(body.motivoReprovacao || "").slice(0, 300);

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json(
              { error: "OPENAI_API_KEY_CONTENT não configurada" },
              { status: 500 },
            );
          }

          const rule = getRule(kind, formato);

          const userPrompt = `Reescreva APENAS o ${rule.label} de uma peça de Instagram em português brasileiro, mantendo a intenção original mas trazendo uma alternativa realmente diferente.

EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
FORMATO DA PEÇA: ${formato || "feed"}
INFORMAÇÃO-CHAVE: ${keyInfo || "(não informada)"}

VERSÃO ATUAL:
- Título: ${tituloAtual || "(vazio)"}
- Texto: ${textoAtual || "(vazio)"}
- Legenda: ${legendaAtual || "(vazia)"}
${motivoReprovacao ? `\nMOTIVO DA REJEIÇÃO DA VERSÃO ATUAL: ${motivoReprovacao}\nA nova versão NÃO PODE repetir esse defeito específico.\n` : ""}
REGRA DO ${rule.label.toUpperCase()}: ${rule.rule}

PROIBIDO ABSOLUTO usar as palavras: "clareza", "claro", "claras", "claros", "impacto", "impactos", "impactar", "impactante", "instante", "instantes", "instantâneo", "fragmento", "fragmentos", "fragmentado", "desvio", "desvios", "desviar", "silêncio", "silêncios", "silencioso", "silenciosa", "silenciar", "OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06", "mood". São códigos internos do sistema. Use sinônimos/perífrases.
PROIBIDO repetir a mesma palavra OU qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue — todas proibidas juntas no mesmo texto) em frases próximas ou consecutivas. Use sinônimos ou reformule completamente. Ex. a evitar: "O digital traz mais alcance. Quer mais? Venha saber mais." — correto: "O digital amplia seu alcance. Quer crescer? Conheça nossa solução."
${TECNICISMO_RULE}

Retorne JSON EXATAMENTE assim:
{ "value": "novo ${rule.label} aqui, sem aspas externas" }`;

          const result = await fetchOpenAIChat(apiKey, {
            model: "gpt-4.1",
            messages: [
              {
                role: "system",
                content:
                  "Você é redator publicitário brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido.",
              },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.95,
            response_format: { type: "json_object" },
          });

          if (!result.ok) {
            return Response.json({ error: result.error }, { status: result.status });
          }
          const content = result.data.choices?.[0]?.message?.content;
          if (!content) return Response.json({ error: "Resposta vazia" }, { status: 502 });

          let parsed: { value?: string };
          try {
            parsed = JSON.parse(content);
          } catch {
            return Response.json({ error: "JSON inválido" }, { status: 502 });
          }

          let value = correctPortugueseSpelling(
            String(parsed.value || "")
              .trim()
              .replace(/^"|"$/g, ""),
          );
          if (!value) return Response.json({ error: "Valor vazio" }, { status: 502 });

          // Enforcement: para texto, garante que nunca volta acima do limite
          // do método (corte mecânico aceitável em corpo de texto). Título
          // NÃO é cortado aqui — cortar geraria fragmento; validateTitulo
          // abaixo flags fora da faixa de TITULO_MIN_WORDS-TITULO_MAX_WORDS
          // e o cliente (E3) tenta de novo ou aplica a limpeza determinística (E4).
          if (kind === "texto") {
            value = truncateWords(value, rule.max);
          } else if (kind === "legenda") {
            value = enforceLegendaLimits(normalizeLegenda(value));
          }

          // D1 — heurísticas pós-geração: não bloqueiam a resposta, mas
          // sinalizam para a orquestração de regeneração no cliente (E3).
          const motivos =
            kind === "titulo"
              ? validateTitulo(value)
              : kind === "texto"
                ? validateTexto(value)
                : validateLegenda(value);

          // Debita 1 do contador regen_texto após o sucesso da geração — nunca
          // para o admin (isento do contador novo). custoUsd = proxy do "Gerar
          // outro" (mesmo valor de content_pu antes da remoção do buffer). Falha
          // no débito não invalida a resposta já gerada (só loga).
          if (!isAdminUser) {
            try {
              await debitUsage(effective.userId, 0, 0, {
                evento: "regenerate_block",
                modulo: kind,
                regenTexto: 1,
                custoUsd: COST_USD.regen_bloco,
                impersonatedBy: effective.impersonatedBy,
                preferredSlot,
              });
            } catch (e) {
              console.warn("[regenerate-block] debit failed", (e as Error).message);
            }
          }

          return Response.json({ value, ...(motivos.length > 0 ? { flags: motivos } : {}) });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
