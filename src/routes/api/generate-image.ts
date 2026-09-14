import { createFileRoute } from "@tanstack/react-router";
import {
  resolveEffectiveUser,
  checkBalance,
  checkRateLimit,
  debitUsage,
  balanceFailMessage,
} from "@/lib/usage.server";
import { COST_USD } from "@/lib/costs";
import { sanitizarVariacaoTelemetria } from "@/core/variacaoTelemetria";
import { getEmailFromJwt } from "@/lib/meta.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isFalQueueUrl, signFalTicket, verifyFalTicket } from "@/lib/falTicket.server";

// Provedor: FAL (queue API).
// Modelos:
//  - openai/gpt-image-2        (sem referências — text-to-image)
//  - openai/gpt-image-2/edit   (com referências do Kit Imagem / logo)

const FAL_QUEUE = "https://queue.fal.run";

// fal.ai rejeita com 422 "string_too_long" acima de 32000 caracteres no campo
// "prompt" — sem essa margem, um prompt real (MOP ou PU) que combine várias
// referências do Kit Imagem verbosas (ex.: produto com tela informativa,
// que sozinho já adiciona ~8000 caracteres de regras) pode passar do limite
// e derrubar a geração inteira. Este é o ÚNICO ponto de envio ao fal.ai
// (MOP e PU compartilham este endpoint) — corta aqui em vez de em cada
// prompt-builder, que não sabe o limite real de terceiros.
const FAL_PROMPT_MAX_CHARS = 31000;
// Aviso antecipado (bem abaixo do limite real) — sinal de monitoramento pra
// detectar prompts crescendo em direção ao limite antes que algum realmente
// precise ser truncado (auditoria Opus 4.8 + Fable 5, 2026-07-07).
const FAL_PROMPT_WARN_CHARS = 28000;
// Reserva do FIM do prompt que NUNCA é cortada: tanto o buildPuPrompt.ts (PU)
// quanto o buildImagePrompt.ts (MOP) terminam com as REGRAS finais (proibição
// de escrever o nome da empresa/a informação-chave como texto na peça) e,
// por último, FORBIDDEN_MOOD_WORDS (proíbe "CLAREZA"/"OP-01" etc. virarem
// lettering). Um truncamento ingênuo pelo fim descartava exatamente essas
// proibições — a parte mais recente do prompt, à qual os modelos de imagem
// dão mais peso (mesmo princípio já documentado em puReferencesBlock.ts) —
// e preservava o bloco que causou o estouro (que costuma ficar no início,
// ex. buildDeviceRule). Corrigido após revisão cruzada Opus 4.8 + Fable 5.
const PROTECTED_TAIL_CHARS = 2500;

function truncatePromptSafe(text: string, max: number): string {
  if (text.length <= max) return text;
  const tailStart = Math.max(0, text.length - PROTECTED_TAIL_CHARS);
  const protectedTail = text.slice(tailStart).trim();
  const separator = "\n\n";
  const headBudget = max - protectedTail.length - separator.length;
  if (headBudget <= 0) return protectedTail.slice(-max);
  // Corta a CABEÇA (onde mora o bloco verboso que estourou o limite), no
  // limite de parágrafo mais próximo do fim do orçamento — nunca no meio de
  // uma instrução — e reanexa a cauda protegida na íntegra.
  const headSlice = text.slice(0, headBudget);
  const lastBreak = headSlice.lastIndexOf("\n\n");
  const head = (lastBreak > headBudget * 0.5 ? headSlice.slice(0, lastBreak) : headSlice).trim();
  return `${head}${separator}${protectedTail}`;
}

/**
 * TESTE DO GPT IMAGE 2.5 FLARE — só a conta do Ari, só a trilha PU (14/09/2026).
 *
 * ⚠ É UM TESTE, NÃO UMA TROCA. Todo cliente continua no gpt-image-2, e o próprio
 * Ari também continua nele no MOP e quando atua como outra conta. O motor de
 * imagem foi afinado por meses para o gpt-image-2 (título literal, zona da logo,
 * física da tela, câmera dos moods) — nada disso foi revalidado no Flare.
 *
 * O que o teste precisa responder, e por quê:
 *  · a fal descreve o edit do Flare como "muda só o que foi pedido, mantém pessoa,
 *    composição e fundo". Na PU o edit é usado para CRIAR cena nova a partir das
 *    fotos do Kit — se ele for conservador demais, devolve a foto do Kit quase
 *    igual em vez de compor a peça. É o risco principal;
 *  · "medium" não é o mesmo degrau nos dois modelos: no preço, o medium do Flare
 *    custa um quinto do medium do gpt-image-2 (US$ 0,010 × US$ 0,054 em
 *    1024x1536). O Ari escolheu medium mesmo assim.
 *
 * Os campos de entrada e o formato da resposta são iguais aos do gpt-image-2
 * (conferidos na documentação da fal em 14/09), por isso só o caminho muda.
 * Para DESLIGAR o teste: esvaziar CONTAS_TESTE_FLARE.
 */
// DESLIGADO em 14/09/2026, à tarde: a edição do Flare copiou a pose, a roupa e o
// enquadramento da foto do avatar e ignorou câmera, luz do mood e a posição do
// título (IMPACTO saiu com o título em coluna à direita). Desligado para o Ari
// gerar a MESMA PU no gpt-image-2 e confirmar que a causa é o modelo.
// Para religar: recolocar "acupolillo1@gmail.com" no conjunto.
const CONTAS_TESTE_FLARE = new Set<string>([]);
const MODULOS_TESTE_FLARE = new Set(["pu"]);

function usaFlare(
  request: Request,
  effective: { impersonatedBy?: string },
  modulo: string | undefined,
): boolean {
  // Atuando como outra conta, a peça é DO CLIENTE — fica no modelo de produção.
  if (effective.impersonatedBy) return false;
  if (!modulo || !MODULOS_TESTE_FLARE.has(modulo)) return false;
  const email = getEmailFromJwt(request);
  return !!email && CONTAS_TESTE_FLARE.has(email);
}

type StartBody = {
  action?: "start";
  prompt: string;
  format?: "post" | "reels";
  logoDataUrl?: string;
  referenceImages?: string[];
  preferredSlot?: string;
  /** Slot a debitar no RESULT (preferido ou o ativo na tela). Vai para o ticket. */
  debitSlot?: string;
  modulo?: string;
};

type StatusBody = {
  action: "status" | "result";
  /** Ticket assinado devolvido pelo START — única fonte de URL/modelo/slot. */
  ticket?: string;
  /** Telemetria da variação visual desta peça — mood, posição na fila, avatar e
   *  os eixos de câmera sorteados. Montada no cliente, SANEADA aqui antes de
   *  virar linha no banco (ver sanitizarVariacaoTelemetria). */
  variacao?: unknown;
};

type AnyBody = StartBody | StatusBody;

// Aceita data:image/* (jpeg/png/webp/gif) e http(s) com extensão raster.
const SAFE_DATA = /^data:image\/(jpeg|png|webp|gif);base64,/i;
const SAFE_URL_EXT = /\.(jpe?g|png|webp|gif)(\?|$)/i;
function isSafeRef(u: unknown): u is string {
  if (typeof u !== "string" || !u) return false;
  if (u.startsWith("data:")) return SAFE_DATA.test(u);
  if (/^https?:\/\//i.test(u)) return SAFE_URL_EXT.test(u);
  return false;
}

// Post/feed/carrossel/estático final fecham em 1080x1350 (4:5) — 'portrait_4_3' (3:4)
// devolvia raster em proporção diferente do canvas final, forçando crop posterior.
// 1088x1360 mantém 4:5, é múltiplo de 16 nos dois lados e cabe nos limites da FAL,
// permitindo que o canvas apenas reduza a imagem (sem cortar conteúdo).
function imageSizeFor(
  format?: "post" | "reels",
): "portrait_16_9" | { width: number; height: number } {
  return format === "reels" ? "portrait_16_9" : { width: 1088, height: 1360 };
}

function falHeaders(falKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Key ${falKey}`,
  };
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const effective = await resolveEffectiveUser(request);
          if (!effective) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }

          const body = (await request.json()) as AnyBody;
          const action = (body as StatusBody).action || "start";

          const falKey = process.env.FAL_KEY;
          if (!falKey) {
            return Response.json({ error: "FAL_KEY não configurada" }, { status: 500 });
          }

          // === STATUS ===
          if (action === "status") {
            // URL, modelo e slot vêm do ticket assinado no START — nunca do
            // navegador (ver lib/falTicket.server.ts).
            const ticket = await verifyFalTicket((body as StatusBody).ticket, effective.userId);
            if (!ticket) {
              return Response.json(
                { error: "Geração inválida ou expirada. Atualize a página e gere de novo." },
                { status: 400 },
              );
            }
            const res = await fetch(ticket.statusUrl, {
              headers: { Authorization: `Key ${falKey}` },
            });
            const txt = await res.text();
            if (!res.ok) {
              // Corpo completo no log do servidor (não truncar) — a resposta ao
              // cliente continua curta. Achado real 2026-07-16: um erro de
              // downstream (fal.ai/OpenAI) só ficou diagnosticável olhando o
              // corpo inteiro, que o truncamento em 300 chars escondia.
              console.error("[generate-image] fal status error", res.status, txt);
              return Response.json(
                { error: `fal status ${res.status}: ${txt.slice(0, 300)}` },
                { status: 502 },
              );
            }
            let pj: { status?: string } = {};
            try {
              pj = JSON.parse(txt);
            } catch {
              /* keep default */
            }
            return Response.json({ status: pj.status || "IN_PROGRESS" });
          }

          // === RESULT ===
          if (action === "result") {
            const ticket = await verifyFalTicket((body as StatusBody).ticket, effective.userId);
            if (!ticket) {
              return Response.json(
                { error: "Geração inválida ou expirada. Atualize a página e gere de novo." },
                { status: 400 },
              );
            }
            const res = await fetch(ticket.responseUrl, {
              headers: { Authorization: `Key ${falKey}` },
            });
            const txt = await res.text();
            if (!res.ok) {
              // Corpo completo no log do servidor — ver comentário equivalente
              // no bloco STATUS acima.
              console.error("[generate-image] fal result error", res.status, txt);
              return Response.json(
                { error: `fal result ${res.status}: ${txt.slice(0, 300)}` },
                { status: 502 },
              );
            }
            let payload: { images?: Array<{ url?: string; content_type?: string }> } = {};
            try {
              payload = JSON.parse(txt);
            } catch {
              /* keep default */
            }
            const imgUrl = payload.images?.[0]?.url;
            const contentType = payload.images?.[0]?.content_type || "image/png";
            if (!imgUrl) {
              return Response.json(
                { error: "Imagem ausente na resposta do FAL." },
                { status: 502 },
              );
            }

            // O mesmo job só é debitado UMA vez: buscar o resultado de novo
            // (retry do navegador, F5) devolve a imagem sem cobrar outra vez.
            // ⚠ `slot <> 'sem-plano'`: debitUsage grava o log MESMO quando a RPC
            // recusa o débito (slot='sem-plano'). Sem esse filtro, a 2ª chamada
            // acharia essa linha e entregaria a imagem de graça.
            const { data: jaDebitado, error: idemErr } = await supabaseAdmin
              .from("usage_logs")
              .select("id")
              .eq("user_id", ticket.uid)
              .eq("evento", "image.generate")
              .eq("payload->>request_id", ticket.requestId)
              .neq("slot", "sem-plano")
              .limit(1);
            if (idemErr) {
              console.error("[generate-image] checagem de débito repetido falhou", idemErr.message);
              return Response.json(
                { error: "Não foi possível confirmar o débito. Tente novamente." },
                { status: 503 },
              );
            }
            if (jaDebitado && jaDebitado.length > 0) {
              return Response.json({ dataUrl: imgUrl, imageUrl: imgUrl, contentType });
            }

            // Debita 1 imagem — tudo o que decide o débito (usuário, modelo/custo,
            // slot, módulo) vem do ticket assinado. Se o débito falhar, a imagem
            // NÃO é entregue (antes o erro virava console.warn e a peça saía de graça).
            try {
              const statusBody = body as StatusBody;
              const isEdit = ticket.modelPath.includes("/edit");
              const moduloReq = ticket.modulo;
              const slotPref = ticket.slot;
              // O que o rodízio sorteou nesta imagem — mood, posição na fila,
              // avatar e eixos de câmera. Sem isso, "as peças estão repetitivas"
              // é impressão sobre um punhado de imagens vistas, e nenhuma
              // correção de rodízio pode ser confirmada no uso real. Vai no
              // `payload` de usage_logs, que já existe e recebe uma linha por
              // imagem gerada (ver core/variacaoTelemetria.ts para por que aqui
              // e não em user_generations).
              const variacao = sanitizarVariacaoTelemetria(statusBody.variacao);
              await debitUsage(effective.userId, 1, 0, {
                evento: "image.generate",
                modulo: moduloReq,
                // `modelo` separa as imagens do teste do Flare das do gpt-image-2
                // na hora de comparar (ver CONTAS_TESTE_FLARE).
                payload: {
                  provider: "fal",
                  request_id: ticket.requestId,
                  modelo: ticket.modelPath,
                  ...(variacao ? { variacao } : {}),
                },
                custoUsd: isEdit ? COST_USD.image_edit : COST_USD.image_base,
                impersonatedBy: effective.impersonatedBy,
                preferredSlot: slotPref,
              });
            } catch (e) {
              console.error("[debit_usage image] débito recusado", (e as Error).message);
              return Response.json(
                { error: balanceFailMessage("limit_exceeded") },
                { status: 402 },
              );
            }

            // Retorna a URL CDN diretamente — o browser faz o download e converte
            // para data URL. Evita bufferizar imagem de 1-3 MB no Worker.
            // dataUrl contém a URL HTTPS (não um data: URL) para compat com clientes antigos.
            return Response.json({ dataUrl: imgUrl, imageUrl: imgUrl, contentType });
          }

          // === START ===
          const {
            prompt,
            format,
            logoDataUrl,
            referenceImages,
            preferredSlot: startSlot,
            modulo: startModulo,
          } = body as StartBody;
          if (!prompt) {
            return Response.json({ error: "prompt obrigatório" }, { status: 400 });
          }

          if (!effective.impersonatedBy) {
            const rate = await checkRateLimit(effective.userId);
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

          // Pré-checagem de saldo — verifica apenas o slot preferido (sem fallback entre planos).
          const { ok: balOk, reason: balReason } = await checkBalance(
            effective.userId,
            1,
            0,
            0,
            startSlot as "plano1" | "plano2" | "bonus" | undefined,
          );
          if (!balOk) {
            return Response.json({ error: balanceFailMessage(balReason) }, { status: 402 });
          }

          const refsRaw: string[] = Array.isArray(referenceImages)
            ? referenceImages.filter(isSafeRef)
            : [];
          const safeLogo = isSafeRef(logoDataUrl) ? (logoDataUrl as string) : null;
          const allRefs = [...refsRaw, ...(safeLogo ? [safeLogo] : [])].slice(0, 16);

          const useEdit = allRefs.length > 0;
          const flare = usaFlare(request, effective, startModulo);
          const modelPath = flare
            ? useEdit
              ? "openai/gpt-image-2.5/flare/edit"
              : "openai/gpt-image-2.5/flare/text-to-image"
            : useEdit
              ? "openai/gpt-image-2/edit"
              : "openai/gpt-image-2";

          const safePrompt = truncatePromptSafe(prompt, FAL_PROMPT_MAX_CHARS);
          if (safePrompt.length !== prompt.length) {
            console.warn("[generate-image] prompt truncado para caber no limite do fal.ai", {
              original: prompt.length,
              final: safePrompt.length,
            });
          } else if (prompt.length > FAL_PROMPT_WARN_CHARS) {
            console.warn("[generate-image] prompt se aproximando do limite do fal.ai", {
              length: prompt.length,
            });
          }

          const submitBody: Record<string, unknown> = {
            prompt: safePrompt,
            image_size: imageSizeFor(format),
            num_images: 1,
            quality: "medium",
          };
          if (useEdit) submitBody.image_urls = allRefs;

          console.info("[generate-image] start fal", {
            model: modelPath,
            refs: allRefs.length,
            promptChars: safePrompt.length,
          });

          const res = await fetch(`${FAL_QUEUE}/${modelPath}`, {
            method: "POST",
            headers: falHeaders(falKey),
            body: JSON.stringify(submitBody),
          });
          const txt = await res.text();
          if (!res.ok) {
            console.error("[generate-image] fal submit error", res.status, txt);
            return Response.json(
              { error: `fal submit ${res.status}: ${txt.slice(0, 300)}` },
              { status: 502 },
            );
          }
          let submit: {
            request_id?: string;
            status_url?: string;
            response_url?: string;
          } = {};
          try {
            submit = JSON.parse(txt);
          } catch {
            /* keep default */
          }
          if (
            !submit.request_id ||
            !isFalQueueUrl(submit.status_url) ||
            !isFalQueueUrl(submit.response_url)
          ) {
            return Response.json(
              { error: "Resposta do FAL sem request_id/status_url/response_url." },
              { status: 502 },
            );
          }

          // O slot do débito é o que o navegador usaria no RESULT (preferido ou,
          // na falta dele, o slot ativo na tela) — mas fica gravado AQUI, assinado.
          const debitSlotRaw = (body as StartBody).debitSlot ?? startSlot;
          const debitSlot =
            debitSlotRaw === "plano1" || debitSlotRaw === "plano2" || debitSlotRaw === "bonus"
              ? debitSlotRaw
              : undefined;
          const ticket = await signFalTicket({
            uid: effective.userId,
            requestId: submit.request_id,
            modelPath: `fal:${modelPath}`,
            statusUrl: submit.status_url,
            responseUrl: submit.response_url,
            ...(debitSlot ? { slot: debitSlot } : {}),
            modulo: startModulo || "metodo-op",
          });

          return Response.json({
            requestId: submit.request_id,
            modelPath: `fal:${modelPath}`,
            ticket,
          });
        } catch (e) {
          const msg = (e as Error).message || "Erro inesperado.";
          console.error("[generate-image]", msg);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
