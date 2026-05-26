// TTS usando a voz clonada do usuário.
// provider='chatterbox': zero-shot com áudio de referência. Legado: MiniMax.
// Não debita renders (o débito acontece no treino e/ou no cinemático que usa a voz).

import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { getUserIdFromRequest } from '@/lib/usage.server';

const FAL_QUEUE = 'https://queue.fal.run';
const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

async function falRun<T = unknown>(modelPath: string, falKey: string, payload: unknown, timeoutMs = 180_000): Promise<T> {
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
    await new Promise((r) => setTimeout(r, 1500));
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

export const Route = createFileRoute('/api/tts-voice')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

          const falKey = process.env.FAL_KEY;
          if (!falKey) return Response.json({ error: 'FAL_KEY não configurada.' }, { status: 500 });

          const body = await request.json();
          const text = String(body?.text || '').trim();
          if (!text || text.length > 2000) {
            return Response.json({ error: 'text obrigatório (até 2000 chars).' }, { status: 400 });
          }
          const avatarSlot = Number(body?.avatarSlot ?? 1) === 2 ? 2 : 1;
          const { data: vc } = await supabaseAdmin
            .from('voice_clones' as any)
            .select('external_voice_id, sample_path, provider, status')
            .eq('user_id', userId)
            .eq('avatar_slot', avatarSlot)
            .maybeSingle();

          const row = vc as any;
          if (!row || row.status !== 'ready') {
            return Response.json({ error: 'Voz do avatar ainda não foi treinada.' }, { status: 400 });
          }

          let audioUrl: string | undefined;

          if (row.provider === 'elevenlabs') {
            const elKey = process.env.ELEVENLABS_API_KEY;
            if (!elKey) return Response.json({ error: 'ELEVENLABS_API_KEY não configurada.' }, { status: 500 });
            const voiceId: string = row.external_voice_id;
            const ttsRes = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}`, {
              method: 'POST',
              headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                language_code: 'pt',
                voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0 },
              }),
            });
            if (!ttsRes.ok) {
              const err = await ttsRes.text();
              return Response.json({ error: `ElevenLabs TTS ${ttsRes.status}: ${err.slice(0, 200)}` }, { status: 502 });
            }
            const audioBytes = Buffer.from(await ttsRes.arrayBuffer());
            const previewPath = `${userId}/tts-test.mp3`;
            const { error: upErr } = await supabaseAdmin.storage
              .from('voice-samples')
              .upload(previewPath, audioBytes, { contentType: 'audio/mpeg', upsert: true });
            if (!upErr) {
              const { data: s } = await supabaseAdmin.storage
                .from('voice-samples')
                .createSignedUrl(previewPath, 3600);
              audioUrl = s?.signedUrl;
            }
          } else if (row.provider === 'chatterbox') {
            return Response.json({ error: 'Voz Chatterbox não suportada. Reconfigure no Kit Imagem.' }, { status: 400 });
          } else {
            // Legado MiniMax
            const voiceId = row.external_voice_id as string;
            const result = await falRun<{ audio?: { url?: string } }>(
              'fal-ai/minimax/speech-02-hd',
              falKey,
              {
                text,
                voice_setting: { voice_id: voiceId, speed: 1, vol: 1, pitch: 0 },
                audio_setting: { sample_rate: 32000, format: 'mp3', bitrate: 128000, channel: 1 },
              },
            );
            audioUrl = result?.audio?.url;
          }

          if (!audioUrl) return Response.json({ error: 'fal não retornou áudio.' }, { status: 502 });

          // Marca último uso (não bloqueia)
          try {
            await supabaseAdmin
              .from('voice_clones' as any)
              .update({ last_used_at: new Date().toISOString() })
              .eq('user_id', userId);
          } catch {}

          return Response.json({ audioUrl });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
