import { createFileRoute } from "@tanstack/react-router";
import {
  resolveEffectiveUser,
  checkBalance,
  debitUsage,
  balanceFailMessage,
} from "@/lib/usage.server";
import { COST_USD } from "@/lib/costs";

// Provedor: FAL (queue API).
// Modelos:
//  - openai/gpt-image-2        (sem referências — text-to-image)
//  - openai/gpt-image-2/edit   (com referências do Kit Imagem / logo)

const FAL_QUEUE = "https://queue.fal.run";

type StartBody = {
  action?: "start";
  prompt: string;
  format?: "post" | "reels";
  logoDataUrl?: string;
  referenceImages?: string[];
  preferredSlot?: string;
};

type StatusBody = {
  action: "status" | "result";
  statusUrl?: string;
  responseUrl?: string;
  requestId?: string;
  modelPath?: string;
  modulo?: string;
  preferredSlot?: string;
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
            const { statusUrl } = body as StatusBody;
            if (!statusUrl) {
              return Response.json({ error: "statusUrl obrigatório" }, { status: 400 });
            }
            const res = await fetch(statusUrl, {
              headers: { Authorization: `Key ${falKey}` },
            });
            const txt = await res.text();
            if (!res.ok) {
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
            const { responseUrl } = body as StatusBody;
            if (!responseUrl) {
              return Response.json({ error: "responseUrl obrigatório" }, { status: 400 });
            }
            const res = await fetch(responseUrl, {
              headers: { Authorization: `Key ${falKey}` },
            });
            const txt = await res.text();
            if (!res.ok) {
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

            // Debita 1 imagem — effective já foi validado no início do handler.
            try {
              const statusBody = body as StatusBody;
              const isEdit = statusBody.modelPath?.includes("/edit") ?? false;
              const moduloReq = statusBody.modulo || "metodo-op";
              const slotPref =
                (statusBody.preferredSlot as "plano1" | "plano2" | "bonus" | undefined) ??
                undefined;
              await debitUsage(effective.userId, 1, 0, {
                evento: "image.generate",
                modulo: moduloReq,
                payload: { provider: "fal" },
                custoUsd: isEdit ? COST_USD.image_edit : COST_USD.image_base,
                impersonatedBy: effective.impersonatedBy,
                preferredSlot: slotPref,
              });
            } catch (e) {
              console.warn("[debit_usage image]", (e as Error).message);
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
          } = body as StartBody;
          if (!prompt) {
            return Response.json({ error: "prompt obrigatório" }, { status: 400 });
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
          const modelPath = useEdit ? "openai/gpt-image-2/edit" : "openai/gpt-image-2";

          const submitBody: Record<string, unknown> = {
            prompt,
            image_size: imageSizeFor(format),
            num_images: 1,
            quality: "medium",
          };
          if (useEdit) submitBody.image_urls = allRefs;

          console.info("[generate-image] start fal", {
            model: modelPath,
            refs: allRefs.length,
            promptChars: prompt.length,
          });

          const res = await fetch(`${FAL_QUEUE}/${modelPath}`, {
            method: "POST",
            headers: falHeaders(falKey),
            body: JSON.stringify(submitBody),
          });
          const txt = await res.text();
          if (!res.ok) {
            console.error("[generate-image] fal submit error", res.status, txt.slice(0, 300));
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
          if (!submit.request_id || !submit.status_url || !submit.response_url) {
            return Response.json(
              { error: "Resposta do FAL sem request_id/status_url/response_url." },
              { status: 502 },
            );
          }

          return Response.json({
            requestId: submit.request_id,
            modelPath: `fal:${modelPath}`,
            statusUrl: submit.status_url,
            responseUrl: submit.response_url,
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
