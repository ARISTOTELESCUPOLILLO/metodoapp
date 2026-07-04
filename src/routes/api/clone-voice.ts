// Treino de voz via ElevenLabs Instant Voice Clone (API direta).
// Fluxo: validar áudio -> upload Supabase -> ElevenLabs clone -> TTS prévia -> salvar pendente_aprovacao.
// SEM debitar render aqui. O débito acontece em confirm-voice.ts quando o usuário aprova.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getUserIdFromRequest,
  checkBalance,
  checkRateLimit,
  balanceFailMessage,
} from "@/lib/usage.server";
import { probeAudio } from "@/lib/audioProbe.server";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

const VOICE_MIN_SECONDS = 30;
const VOICE_MAX_SECONDS = 180;
const VOICE_MAX_BYTES = 10 * 1024 * 1024;
const VOICE_PREVIEW_TEXT =
  "Olá! Essa é a minha voz, treinada para narrar os reels do meu avatar. Ouça com calma e, se gostar, é só aprovar.";

function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string } {
  const m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("sampleDataUrl inválido (esperado data URL base64).");
  const mime = (m[1] || "audio/webm").trim();
  const buf = Buffer.from(m[2], "base64");
  return { buf, mime };
}

function mimeToExt(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

// Clona voz via ElevenLabs IVC — retorna o voice_id gerado.
async function elevenLabsClone(
  audioBuffer: Buffer,
  mimeType: string,
  fileName: string,
  userId: string,
  elKey: string,
): Promise<string> {
  const form = new FormData();
  form.append("name", `metodo-op-${userId.slice(0, 8)}`);
  const ab = audioBuffer.buffer.slice(
    audioBuffer.byteOffset,
    audioBuffer.byteOffset + audioBuffer.byteLength,
  ) as ArrayBuffer;
  form.append("files", new Blob([ab], { type: mimeType }), fileName);
  const res = await fetch(`${ELEVENLABS_API}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": elKey },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ElevenLabs clone ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { voice_id?: string };
  if (!json.voice_id) throw new Error("ElevenLabs não retornou voice_id.");
  return json.voice_id;
}

// TTS via ElevenLabs — retorna bytes MP3.
async function elevenLabsTTS(text: string, voiceId: string, elKey: string): Promise<Buffer> {
  const res = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      language_code: "pt",
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS ${res.status}: ${err.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export const Route = createFileRoute("/api/clone-voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json(
              { code: "unauthorized", message: "Faça login para treinar sua voz." },
              { status: 401 },
            );
          }
          const rate = await checkRateLimit(userId);
          if (!rate.ok) {
            return Response.json(
              {
                code: "rate_limited",
                message: "Limite de 15 gerações por hora atingido. Aguarde antes de tentar novamente.",
              },
              { status: 429 },
            );
          }

          const elKey = process.env.ELEVENLABS_API_KEY;
          if (!elKey) {
            return Response.json(
              { code: "unknown", message: "Algo deu errado. Tente de novo." },
              { status: 500 },
            );
          }

          const body = await request.json();
          const sampleDataUrl = String(body?.sampleDataUrl || "");
          const avatarSlot = Number(body?.avatarSlot ?? 1) === 2 ? 2 : 1;

          if (!sampleDataUrl.startsWith("data:audio/")) {
            return Response.json(
              { code: "sample_missing", message: "Nenhum áudio recebido. Grave de novo." },
              { status: 400 },
            );
          }

          const { buf, mime } = dataUrlToBuffer(sampleDataUrl);
          if (buf.byteLength > VOICE_MAX_BYTES) {
            return Response.json(
              { code: "sample_too_big", message: "Áudio muito grande. Use um arquivo menor." },
              { status: 400 },
            );
          }

          // Validação real da duração no servidor — nunca confiar no cliente.
          let probedDuration = 0;
          try {
            const probe = probeAudio(buf, mime);
            probedDuration = probe.durationS;
          } catch {
            return Response.json(
              {
                code: "sample_bad_format",
                message:
                  "Não conseguimos entender este arquivo de áudio. Use mp3, m4a, wav ou webm.",
              },
              { status: 400 },
            );
          }

          if (probedDuration < VOICE_MIN_SECONDS) {
            return Response.json(
              {
                code: "sample_too_short",
                message: `Áudio muito curto (${Math.round(probedDuration)}s). Mínimo de ${VOICE_MIN_SECONDS}s.`,
              },
              { status: 400 },
            );
          }
          if (probedDuration > VOICE_MAX_SECONDS) {
            return Response.json(
              {
                code: "sample_too_long",
                message: `Áudio muito longo (${Math.round(probedDuration)}s). Máximo de ${Math.round(VOICE_MAX_SECONDS / 60)} min.`,
              },
              { status: 400 },
            );
          }
          // Sanity check: arquivos com bitrate absurdo (>256kbps p/ voz) costumam ter header mentindo.
          const bitsPerSec = (buf.byteLength * 8) / probedDuration;
          if (bitsPerSec > 320_000) {
            return Response.json(
              {
                code: "sample_bad_format",
                message: "Arquivo de áudio parece corrompido. Grave de novo ou use outro arquivo.",
              },
              { status: 400 },
            );
          }

          // Saldo: 1 render (treino = 1 cinemático) — checado agora pra avisar cedo.
          // Débito real só na aprovação (confirm-voice).
          const { ok, reason } = await checkBalance(userId, 0, 1);
          if (!ok) {
            return Response.json(
              { code: "no_balance", message: balanceFailMessage(reason) },
              { status: 402 },
            );
          }

          // Deleta vozes anteriores do ElevenLabs para este usuário (DB + órfãs pelo nome).
          try {
            // 1. Via DB (registro existente).
            const { data: prev } = await supabaseAdmin
              .from("voice_clones")
              .select("external_voice_id, provider")
              .eq("user_id", userId)
              .eq("avatar_slot", avatarSlot)
              .maybeSingle();
            const prevRow = prev;
            if (prevRow?.provider === "elevenlabs" && prevRow.external_voice_id) {
              await fetch(`https://api.elevenlabs.io/v1/voices/${prevRow.external_voice_id}`, {
                method: "DELETE",
                headers: { "xi-api-key": elKey },
              });
              console.log("[clone-voice] deleted db voice_id=%s", prevRow.external_voice_id);
            }

            // 2. Varredura: deleta vozes órfãs com nome metodo-op-{userId slice} (DB deletado antes).
            const voicePrefix = `metodo-op-${userId.slice(0, 8)}`;
            const listRes = await fetch("https://api.elevenlabs.io/v1/voices", {
              headers: { "xi-api-key": elKey },
            });
            if (listRes.ok) {
              const listJson = (await listRes.json()) as {
                voices?: Array<{ voice_id: string; name: string }>;
              };
              for (const v of listJson.voices ?? []) {
                if (v.name === voicePrefix) {
                  await fetch(`https://api.elevenlabs.io/v1/voices/${v.voice_id}`, {
                    method: "DELETE",
                    headers: { "xi-api-key": elKey },
                  });
                  console.log(
                    "[clone-voice] deleted orphan voice_id=%s name=%s",
                    v.voice_id,
                    v.name,
                  );
                }
              }
            }
          } catch (e) {
            console.warn("[clone-voice] delete old voice", (e as Error).message);
          }

          const ext = mimeToExt(mime);
          const samplePath = `${userId}/sample${avatarSlot === 2 ? "-2" : ""}.${ext}`;

          // Sobe amostra no bucket privado (backup permanente).
          const upload = await supabaseAdmin.storage
            .from("voice-samples")
            .upload(samplePath, buf, { contentType: mime, upsert: true });
          if (upload.error) {
            console.warn("[clone-voice] upload", upload.error.message);
            return Response.json(
              {
                code: "upload_failed",
                message: "Não conseguimos enviar sua amostra. Tente de novo.",
              },
              { status: 500 },
            );
          }

          // ElevenLabs IVC — cria o modelo de voz e obtém o voice_id.
          let externalVoiceId: string | undefined;
          try {
            externalVoiceId = await elevenLabsClone(
              buf,
              mime,
              `sample.${mimeToExt(mime)}`,
              userId,
              elKey,
            );
          } catch (e) {
            console.warn("[clone-voice] elevenlabs clone", (e as Error).message);
          }
          if (!externalVoiceId) {
            return Response.json(
              {
                code: "sample_rejected",
                message:
                  "Amostra recusada. Grave de novo num lugar mais silencioso e fale de forma natural.",
              },
              { status: 502 },
            );
          }
          console.log("[clone-voice] voice_id=%s", externalVoiceId);

          // ElevenLabs TTS — prévia com a voz clonada. Upload do áudio para URL acessível.
          let previewAudioUrl: string | undefined;
          try {
            const audioBytes = await elevenLabsTTS(VOICE_PREVIEW_TEXT, externalVoiceId, elKey);
            const previewPath = `${userId}/preview${avatarSlot === 2 ? "-2" : ""}.mp3`;
            const { error: prevErr } = await supabaseAdmin.storage
              .from("voice-samples")
              .upload(previewPath, audioBytes, { contentType: "audio/mpeg", upsert: true });
            if (!prevErr) {
              const { data: prevSigned } = await supabaseAdmin.storage
                .from("voice-samples")
                .createSignedUrl(previewPath, 60 * 60 * 2);
              previewAudioUrl = prevSigned?.signedUrl;
            }
          } catch (e) {
            console.warn("[clone-voice] preview tts", (e as Error).message);
          }
          if (!previewAudioUrl) {
            return Response.json(
              {
                code: "preview_failed",
                message: "A voz foi clonada mas não conseguimos gerar a prévia. Tente de novo.",
              },
              { status: 502 },
            );
          }

          // Upsert voice_clones como pendente_aprovacao (não cobra ainda).
          const row = {
            user_id: userId,
            avatar_slot: avatarSlot,
            external_voice_id: externalVoiceId,
            sample_path: samplePath,
            duration_s: probedDuration,
            provider: "elevenlabs",
            status: "pendente_aprovacao",
            updated_at: new Date().toISOString(),
          };
          const { data: saved, error: upsertErr } = await supabaseAdmin
            .from("voice_clones")
            .upsert(row, { onConflict: "user_id,avatar_slot" })
            .select("*")
            .single();
          if (upsertErr) {
            console.warn("[clone-voice] upsert", upsertErr.message);
            return Response.json(
              {
                code: "save_failed",
                message: "Sua voz foi processada mas não conseguimos guardar. Tente de novo.",
              },
              { status: 500 },
            );
          }

          return Response.json({ voice: saved, previewAudioUrl });
        } catch (e) {
          console.error("[clone-voice] fatal", e);
          return Response.json(
            { code: "unknown", message: "Algo deu errado. Tente de novo." },
            { status: 500 },
          );
        }
      },
    },
  },
});
