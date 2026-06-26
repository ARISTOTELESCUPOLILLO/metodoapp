import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/usage.server";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";

const SAFE_DATA = /^data:image\/(jpeg|png|webp);base64,/i;
const MAX_DATA_LEN = 8_000_000; // 8 MB — imagem preparada (1024px JPEG) cabe com folga

export const Route = createFileRoute("/api/judge-logo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) return Response.json({ fiel: true }); // fail open

          const body = await request.json();
          const geradaDataUrl = String(body.geradaDataUrl || "");
          const logoDataUrl = String(body.logoDataUrl || "");

          if (
            !SAFE_DATA.test(geradaDataUrl) ||
            !SAFE_DATA.test(logoDataUrl) ||
            geradaDataUrl.length > MAX_DATA_LEN ||
            logoDataUrl.length > MAX_DATA_LEN
          ) {
            return Response.json({ fiel: true }); // fail open, não bloqueia o usuário
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) return Response.json({ fiel: true });

          const result = await fetchOpenAIChat(
            apiKey,
            {
              model: "gpt-4.1-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "Você é um auditor visual de fidelidade de marca. Compare logomarcas em imagens e aponte divergências reais. Seja criterioso mas razoável: variações de escala, perspectiva e efeito de bordado são normais e aceitáveis. Responda sempre com JSON válido.",
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text:
                        "IMAGEM 1 = LOGOMARCA OFICIAL DE REFERÊNCIA (original do kit de marca da empresa).\n" +
                        "IMAGEM 2 = FOTO GERADA POR IA com personagem vestindo uniforme com a logomarca bordada/estampada.\n\n" +
                        "Compare a logomarca visível no vestuário do personagem (IMAGEM 2) com a IMAGEM 1.\n\n" +
                        "ACEITÁVEL (não reprove): redução de escala, perspectiva leve, efeito de bordado, variação de iluminação.\n" +
                        "PROBLEMA REAL (reprove): cor errada (ex.: azul em vez de vermelho), símbolo diferente, texto da marca errado ou ausente, elemento faltando.\n\n" +
                        "Responda EXATAMENTE neste formato JSON, sem texto fora do JSON:\n" +
                        '{ "fiel": true, "divergencia": null }\n' +
                        "ou\n" +
                        '{ "fiel": false, "divergencia": "descrição concisa e específica do problema" }',
                    },
                    {
                      type: "image_url",
                      image_url: { url: logoDataUrl, detail: "low" },
                    },
                    {
                      type: "image_url",
                      image_url: { url: geradaDataUrl, detail: "low" },
                    },
                  ],
                },
              ],
              temperature: 0.1,
              response_format: { type: "json_object" },
              max_tokens: 150,
            },
            12_000,
          );

          if (!result.ok) return Response.json({ fiel: true });

          const content = result.data.choices?.[0]?.message?.content;
          if (!content) return Response.json({ fiel: true });

          let parsed: { fiel?: unknown; divergencia?: unknown };
          try {
            parsed = JSON.parse(content);
          } catch {
            return Response.json({ fiel: true });
          }

          const isFiel = parsed.fiel !== false;
          return Response.json({
            fiel: isFiel,
            divergencia:
              !isFiel && typeof parsed.divergencia === "string"
                ? parsed.divergencia.slice(0, 300)
                : null,
          });
        } catch {
          return Response.json({ fiel: true }); // fail open — juiz nunca bloqueia o usuário
        }
      },
    },
  },
});
