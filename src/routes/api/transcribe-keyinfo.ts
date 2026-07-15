// Transcrição por voz do campo Informação-chave (MOP + PU). Fluxo: Whisper
// (fala -> texto cru) -> limpeza por IA (remove vícios de fala/hesitação e
// extrai a essência) -> devolve texto pronto para o textarea. Diferente de
// /api/correct-text (só ortografia/gramática, preserva 100% a estrutura): aqui
// a transformação é mais profunda porque fala transcrita tem ruído que texto
// digitado não tem. Sem débito de plano — custo (Whisper + gpt-4.1-mini) é
// irrisório perto de uma geração de imagem, mesmo padrão de /api/correct-text.

import { createFileRoute } from "@tanstack/react-router";
import {
  getUserIdFromRequest,
  checkBalance,
  checkRateLimit,
  balanceFailMessage,
} from "@/lib/usage.server";
import { probeAudio } from "@/lib/audioProbe.server";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";

const DICTATION_MAX_SECONDS = 90;
const DICTATION_MAX_BYTES = 8 * 1024 * 1024;

function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string } {
  const m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("audioDataUrl inválido (esperado data URL base64).");
  const mime = (m[1] || "audio/webm").trim();
  const buf = Buffer.from(m[2], "base64");
  return { buf, mime };
}

function mimeToFileName(mime: string): string {
  if (mime.includes("webm")) return "audio.webm";
  if (mime.includes("mp4")) return "audio.m4a";
  if (mime.includes("ogg")) return "audio.ogg";
  if (mime.includes("wav")) return "audio.wav";
  if (mime.includes("mpeg")) return "audio.mp3";
  return "audio.webm";
}

async function whisperTranscribe(buf: Buffer, mime: string, apiKey: string): Promise<string> {
  const form = new FormData();
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  form.append("file", new Blob([ab], { type: mime }), mimeToFileName(mime));
  form.append("model", "whisper-1");
  form.append("language", "pt");
  form.append("response_format", "json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Whisper ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as { text?: string };
  return String(json.text || "").trim();
}

export const Route = createFileRoute("/api/transcribe-keyinfo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }

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
          // Exige login com plano atribuído (mesmo padrão de /api/correct-text),
          // sem consumir nenhum contador do plano.
          const balance = await checkBalance(userId, 0, 0, 0);
          if (!balance.ok) {
            return Response.json({ error: balanceFailMessage(balance.reason) }, { status: 402 });
          }

          const body = await request.json();
          const audioDataUrl = String(body?.audioDataUrl || "");
          if (!audioDataUrl.startsWith("data:audio/")) {
            return Response.json(
              { error: "Nenhum áudio recebido. Grave de novo." },
              { status: 400 },
            );
          }

          const { buf, mime } = dataUrlToBuffer(audioDataUrl);
          if (buf.byteLength === 0) {
            return Response.json({ error: "Áudio vazio. Grave de novo." }, { status: 400 });
          }
          if (buf.byteLength > DICTATION_MAX_BYTES) {
            return Response.json(
              { error: "Áudio muito grande. Grave um trecho mais curto." },
              { status: 400 },
            );
          }

          // Validação real da duração no servidor — nunca confiar no cliente.
          let durationS = 0;
          try {
            durationS = probeAudio(buf, mime).durationS;
          } catch {
            return Response.json(
              { error: "Não conseguimos entender este áudio. Grave de novo." },
              { status: 400 },
            );
          }
          if (durationS > DICTATION_MAX_SECONDS) {
            return Response.json(
              {
                error: `Áudio muito longo (${Math.round(durationS)}s). Grave no máximo ${DICTATION_MAX_SECONDS}s.`,
              },
              { status: 400 },
            );
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json(
              { error: "OPENAI_API_KEY_CONTENT não configurada" },
              { status: 500 },
            );
          }

          let raw: string;
          try {
            raw = await whisperTranscribe(buf, mime, apiKey);
          } catch (e) {
            console.warn("[transcribe-keyinfo] whisper", (e as Error).message);
            return Response.json(
              { error: "Não conseguimos transcrever o áudio. Tente de novo." },
              { status: 502 },
            );
          }
          if (!raw) {
            return Response.json(
              { error: "Não entendemos nenhuma fala no áudio. Tente de novo." },
              { status: 422 },
            );
          }

          // Limpeza: remove vícios de fala e extrai a essência da ideia. Falha
          // não é fatal — devolve o texto cru da transcrição em vez de quebrar
          // o fluxo do usuário.
          const cleanResult = await fetchOpenAIChat(apiKey, {
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "system",
                content:
                  'Você limpa transcrições de fala em português brasileiro para virar texto escrito. Remova hesitações, vícios de fala ("é", "tipo", "né", "então assim", repetições, autocorreções faladas) e capture apenas a ESSÊNCIA da ideia, em frase natural e bem formada, mantendo o sentido, o vocabulário e os números/valores citados literalmente. NÃO adicione informação nova, NÃO invente contexto, NÃO resuma a ponto de perder um dado concreto (preço, prazo, produto, nome). Se a transcrição já estiver limpa, devolva-a apenas com pontuação normalizada. Responda SEMPRE com JSON válido no formato { "clean": "texto limpo" }.',
              },
              { role: "user", content: raw },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
          });

          let text = raw;
          if (cleanResult.ok) {
            const content = cleanResult.data.choices?.[0]?.message?.content;
            if (content) {
              try {
                const parsed = JSON.parse(content) as { clean?: string };
                if (parsed.clean?.trim()) text = parsed.clean.trim();
              } catch {
                /* mantém o texto cru se a limpeza vier malformada */
              }
            }
          }

          return Response.json({ text });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
