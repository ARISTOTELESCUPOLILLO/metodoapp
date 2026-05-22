// Treino de voz via fal.ai MiniMax Voice Clone.
// Fluxo: validar áudio server-side -> clonar -> gerar prévia -> salvar como pendente_aprovacao.
// SEM debitar render aqui. O débito acontece em confirm-voice.ts quando o usuário aprova.

import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { getUserIdFromRequest, checkBalance } from '@/lib/usage.server';
import { probeAudio } from '@/lib/audioProbe.server';

const FAL_QUEUE = 'https://queue.fal.run';

const VOICE_MIN_SECONDS = 30;
const VOICE_MAX_SECONDS = 180;
const VOICE_MAX_BYTES = 10 * 1024 * 1024;
const VOICE_PREVIEW_TEXT =
  'Olá! Essa é a minha voz, treinada para narrar os reels do meu avatar. Ouça com calma e, se gostar, é só aprovar.';

function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string } {
  const m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('sampleDataUrl inválido (esperado data URL base64).');
  const mime = (m[1] || 'audio/webm').trim();
  const buf = Buffer.from(m[2], 'base64');
  return { buf, mime };
}

function mimeToExt(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg')) return 'mp3';
  return 'webm';
}

async function falRun<T = unknown>(
  modelPath: string,
  falKey: string,
  payload: unknown,
  timeoutMs = 180_000,
): Promise<T> {
  const submitRes = await fetch(`${FAL_QUEUE}/${modelPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${falKey}` },
    body: JSON.stringify(payload),
  });
  const submitText = await submitRes.text();
  if (!submitRes.ok) throw new Error(`fal submit ${modelPath} ${submitRes.status}: ${submitText.slice(0, 400)}`);
  const submit = JSON.parse(submitText) as { status_url: string; response_url: string; status?: string };

  const deadline = Date.now() + timeoutMs;
  let status = submit.status;
  while (status !== 'COMPLETED' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(submit.status_url, { headers: { Authorization: `Key ${falKey}` } });
    const txt = await pollRes.text();
    if (!pollRes.ok) throw new Error(`fal poll ${pollRes.status}: ${txt.slice(0, 400)}`);
    let pj: { status?: string };
    try { pj = JSON.parse(txt); } catch { pj = {}; }
    status = pj.status;
    if (status === 'FAILED' || status === 'ERROR') throw new Error(`fal ${modelPath} falhou: ${txt.slice(0, 400)}`);
  }
  if (status !== 'COMPLETED') throw new Error(`fal ${modelPath} timeout (status=${status ?? '?'}).`);

  const finalRes = await fetch(submit.response_url, { headers: { Authorization: `Key ${falKey}` } });
  const finalText = await finalRes.text();
  if (!finalRes.ok) throw new Error(`fal result ${finalRes.status}: ${finalText.slice(0, 400)}`);
  return JSON.parse(finalText) as T;
}

export const Route = createFileRoute('/api/clone-voice')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json({ code: 'unauthorized', message: 'Faça login para treinar sua voz.' }, { status: 401 });
          }

          const falKey = process.env.FAL_KEY;
          if (!falKey) {
            return Response.json({ code: 'unknown', message: 'Algo deu errado. Tente de novo.' }, { status: 500 });
          }

          const body = await request.json();
          const sampleDataUrl = String(body?.sampleDataUrl || '');

          if (!sampleDataUrl.startsWith('data:audio/')) {
            return Response.json(
              { code: 'sample_missing', message: 'Nenhum áudio recebido. Grave de novo.' },
              { status: 400 },
            );
          }

          const { buf, mime } = dataUrlToBuffer(sampleDataUrl);
          if (buf.byteLength > VOICE_MAX_BYTES) {
            return Response.json(
              { code: 'sample_too_big', message: 'Áudio muito grande. Use um arquivo menor.' },
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
                code: 'sample_bad_format',
                message: 'Não conseguimos entender este arquivo de áudio. Use mp3, m4a, wav ou webm.',
              },
              { status: 400 },
            );
          }

          if (probedDuration < VOICE_MIN_SECONDS) {
            return Response.json(
              {
                code: 'sample_too_short',
                message: `Áudio muito curto (${Math.round(probedDuration)}s). Mínimo de ${VOICE_MIN_SECONDS}s.`,
              },
              { status: 400 },
            );
          }
          if (probedDuration > VOICE_MAX_SECONDS) {
            return Response.json(
              {
                code: 'sample_too_long',
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
                code: 'sample_bad_format',
                message: 'Arquivo de áudio parece corrompido. Grave de novo ou use outro arquivo.',
              },
              { status: 400 },
            );
          }

          // Saldo: 1 render (treino = 1 cinemático) — checado agora pra avisar cedo.
          // Débito real só na aprovação (confirm-voice).
          const { ok } = await checkBalance(userId, 0, 1);
          if (!ok) {
            return Response.json(
              { code: 'no_balance', message: 'Saldo insuficiente para treinar a voz agora.' },
              { status: 402 },
            );
          }

          const ext = mimeToExt(mime);
          const samplePath = `${userId}/sample.${ext}`;

          // Sobe amostra no bucket privado
          const upload = await supabaseAdmin.storage
            .from('voice-samples')
            .upload(samplePath, buf, { contentType: mime, upsert: true });
          if (upload.error) {
            console.warn('[clone-voice] upload', upload.error.message);
            return Response.json(
              { code: 'upload_failed', message: 'Não conseguimos enviar sua amostra. Tente de novo.' },
              { status: 500 },
            );
          }

          // Signed URL temporária pro fal baixar
          const signed = await supabaseAdmin.storage
            .from('voice-samples')
            .createSignedUrl(samplePath, 60 * 60);
          if (signed.error || !signed.data?.signedUrl) {
            console.warn('[clone-voice] signed url', signed.error?.message);
            return Response.json(
              { code: 'upload_failed', message: 'Não conseguimos enviar sua amostra. Tente de novo.' },
              { status: 500 },
            );
          }

          // fal.ai MiniMax voice clone
          let externalVoiceId: string | undefined;
          try {
            const result = await falRun<{ custom_voice_id?: string }>(
              'fal-ai/minimax/voice-clone',
              falKey,
              {
                audio_url: signed.data.signedUrl,
                noise_reduction: true,
                need_volume_normalization: true,
                accuracy: 0.95,
              },
            );
            externalVoiceId = result?.custom_voice_id;
          } catch (e) {
            console.warn('[clone-voice] fal', (e as Error).message);
          }
          if (!externalVoiceId) {
            return Response.json(
              {
                code: 'sample_rejected',
                message: 'Amostra recusada. Grave de novo num lugar mais silencioso e fale de forma natural.',
              },
              { status: 502 },
            );
          }

          // Gera a prévia ANTES de salvar — assim só persiste se MiniMax conseguir falar.
          let previewAudioUrl: string | undefined;
          try {
            const tts = await falRun<{ audio?: { url?: string } }>(
              'fal-ai/minimax/speech-02-hd',
              falKey,
              {
                text: VOICE_PREVIEW_TEXT,
                voice_setting: { voice_id: externalVoiceId, speed: 1, vol: 1, pitch: 0 },
                audio_setting: { sample_rate: 32000, format: 'mp3', bitrate: 128000, channel: 1 },
              },
              120_000,
            );
            previewAudioUrl = tts?.audio?.url;
          } catch (e) {
            console.warn('[clone-voice] preview tts', (e as Error).message);
          }
          if (!previewAudioUrl) {
            return Response.json(
              {
                code: 'preview_failed',
                message: 'A voz foi clonada mas não conseguimos gerar a prévia. Tente de novo.',
              },
              { status: 502 },
            );
          }

          // Upsert voice_clones como pendente_aprovacao (não cobra ainda).
          const row = {
            user_id: userId,
            external_voice_id: externalVoiceId,
            sample_path: samplePath,
            duration_s: probedDuration,
            provider: 'fal-minimax',
            status: 'pendente_aprovacao',
            updated_at: new Date().toISOString(),
          };
          const { data: saved, error: upsertErr } = await supabaseAdmin
            .from('voice_clones' as any)
            .upsert(row, { onConflict: 'user_id' })
            .select('*')
            .single();
          if (upsertErr) {
            console.warn('[clone-voice] upsert', upsertErr.message);
            return Response.json(
              { code: 'save_failed', message: 'Sua voz foi processada mas não conseguimos guardar. Tente de novo.' },
              { status: 500 },
            );
          }

          return Response.json({ voice: saved, previewAudioUrl });
        } catch (e) {
          console.error('[clone-voice] fatal', e);
          return Response.json(
            { code: 'unknown', message: 'Algo deu errado. Tente de novo.' },
            { status: 500 },
          );
        }
      },
    },
  },
});
