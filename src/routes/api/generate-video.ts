import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest, checkBalance, debitUsage } from '@/lib/usage.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// Veo3 exige HTTP URL (não aceita base64). Faz upload temporário no bucket
// image-kits e gera uma signed URL de 1 hora para o FAL acessar.
async function uploadFrameForVeo(base64DataUrl: string, userId: string | null): Promise<string> {
  const m = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Frame inválido (esperado data URL base64).');
  const mime = m[1];
  const bytes = Buffer.from(m[2], 'base64');
  const ext = mime.includes('png') ? 'png' : 'jpg';
  const path = `_temp_veo/${userId || 'anon'}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from('image-kits')
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upErr) throw new Error(`Upload frame falhou: ${upErr.message}`);
  const { data, error: signErr } = await supabaseAdmin.storage
    .from('image-kits')
    .createSignedUrl(path, 3600);
  if (signErr || !data?.signedUrl) throw new Error('Não foi possível gerar URL do frame para o Veo.');
  return data.signedUrl;
}

const FAL_QUEUE = 'https://queue.fal.run';

async function falSubmit(modelPath: string, falKey: string, payload: unknown) {
  const res = await fetch(`${FAL_QUEUE}/${modelPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('[fal submit error]', modelPath, res.status, text.slice(0, 800));
    throw new Error(`fal submit ${modelPath} ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as {
    request_id: string;
    status_url: string;
    response_url: string;
    status?: string;
  };
}

async function falWaitResult<T = unknown>(
  submit: { status_url: string; response_url: string; status?: string },
  falKey: string,
  timeoutMs: number,
  label: string,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let status = submit.status;
  while (status !== 'COMPLETED' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const pollRes = await fetch(submit.status_url, {
      headers: { Authorization: `Key ${falKey}` },
    });
    const txt = await pollRes.text();
    if (!pollRes.ok) {
      console.error('[fal poll error]', label, pollRes.status, txt.slice(0, 800));
      throw new Error(`fal polling ${label} ${pollRes.status}: ${txt.slice(0, 500)}`);
    }
    let pj: { status?: string };
    try { pj = JSON.parse(txt); } catch { pj = {}; }
    status = pj.status;
    if (status === 'FAILED' || status === 'ERROR') {
      console.error('[fal result error]', label, txt.slice(0, 800));
      throw new Error(`fal ${label} falhou: ${txt.slice(0, 500)}`);
    }
  }
  if (status !== 'COMPLETED') {
    throw new Error(
      `fal ${label} ainda em processamento (status=${status ?? 'desconhecido'}). A fila está demorando mais que o esperado — tente novamente em alguns minutos.`,
    );
  }
  const finalRes = await fetch(submit.response_url, {
    headers: { Authorization: `Key ${falKey}` },
  });
  const finalText = await finalRes.text();
  if (!finalRes.ok) {
    throw new Error(`fal result ${label} ${finalRes.status}: ${finalText.slice(0, 500)}`);
  }
  return JSON.parse(finalText) as T;
}

export const Route = createFileRoute('/api/generate-video')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // videoMode: 'portugues' | 'kit-voz' | 'sinalizacao'
          // Backward compat: se não informado, usa useClonedVoice para derivar o modo.
          const { script, imageBase64, useClonedVoice, videoMode: videoModeRaw } = await request.json();
          type VideoMode = 'portugues' | 'kit-voz' | 'sinalizacao';
          const videoMode: VideoMode = (['portugues', 'kit-voz', 'sinalizacao'] as const).includes(videoModeRaw)
            ? videoModeRaw as VideoMode
            : (useClonedVoice === true ? 'kit-voz' : 'portugues');

          if (!script || typeof script !== 'string') {
            return Response.json({ error: 'script obrigatório' }, { status: 400 });
          }
          if (!imageBase64 || typeof imageBase64 !== 'string') {
            return Response.json({ error: 'imageBase64 obrigatório' }, { status: 400 });
          }
          const falKey = process.env.FAL_KEY;
          if (!falKey) {
            return Response.json({ error: 'FAL_KEY não configurada' }, { status: 500 });
          }
          console.info('[generate-video] mode=%s image_bytes=%d', videoMode, imageBase64.length);

          // Pré-checagem de saldo (1 render).
          const userId = await getUserIdFromRequest(request).catch(() => null);
          if (userId) {
            try {
              const { ok } = await checkBalance(userId, 0, 1);
              if (!ok) {
                return Response.json(
                  { error: 'Limite de renders atingido em todos os seus planos.' },
                  { status: 402 },
                );
              }
            } catch (e) {
              console.warn('[balance pre-check video]', (e as Error).message);
            }
          }

          // Resolve voz clonada apenas no modo kit-voz.
          let clonedVoiceId: string | null = null;
          if (videoMode === 'kit-voz' && userId) {
            try {
              const { data: vc } = await supabaseAdmin
                .from('voice_clones' as any)
                .select('external_voice_id, status')
                .eq('user_id', userId)
                .maybeSingle();
              const row = vc as any;
              if (row?.status === 'ready' && row.external_voice_id) {
                clonedVoiceId = String(row.external_voice_id);
              }
            } catch (e) {
              console.warn('[generate-video] load voice', (e as Error).message);
            }
            if (!clonedVoiceId) {
              return Response.json(
                { error: 'Nenhuma voz clonada disponível. Configure sua voz no Kit Imagem primeiro.' },
                { status: 400 },
              );
            }
          }

          const willLipsync = videoMode === 'kit-voz' && !!clonedVoiceId;
          // Sinalizacao = vídeo silencioso (sem fala, sem áudio gerado pelo Veo).
          // O título visual é queimado no frontend com FFmpeg.
          const isSinalizacao = videoMode === 'sinalizacao';

          // Prompts por modo:
          // kit-voz  → silencioso pro lipsync (boca articulada mas sem fala)
          // sinalizacao → silencioso, olhar direto, sem articulação de fala
          // portugues   → com fala em pt-BR
          const promptParts = willLipsync
            ? [
                'Vertical 9:16 reels-style video. Professional business presentation.',
                'A single adult person in frame, medium close-up, making direct eye contact with the camera,',
                'speaking with natural, expressive mouth movements and a confident, professional demeanor.',
                'Static camera, soft professional lighting, background coherent with the reference image.',
                'Natural facial expressions matching an engaged, authoritative spoken delivery.',
              ]
            : isSinalizacao
            ? [
                'Vertical 9:16 reels-style video. Professional business content.',
                'A single adult person in frame, medium close-up, holding direct, confident eye contact with the camera.',
                'The person maintains a calm, composed professional expression. No speaking.',
                'Static camera, soft professional lighting, background coherent with the reference image.',
              ]
            : [
                'Vertical 9:16 reels-style video. Professional business presentation in Brazilian Portuguese.',
                'A single adult person in frame, medium close-up, speaking directly to the camera',
                'with clear, confident, natural Brazilian Portuguese delivery.',
                'Business content message: ' + script.slice(0, 300).replace(/["""]/g, ''),
                'Static camera, soft professional lighting, background coherent with the reference image.',
              ];

          // Gera áudio nativo do Veo apenas no modo 'portugues'.
          const generateAudio = videoMode === 'portugues';

          // Veo3 exige HTTP URL — converte base64 para URL assinada via Supabase.
          console.log('[generate-video] step=upload_frame');
          const frameUrl = await uploadFrameForVeo(imageBase64, userId);

          console.log('[generate-video] step=video mode=%s willLipsync=%s', videoMode, willLipsync);
          const veoPayload = {
            prompt: promptParts.join(' '),
            image_url: frameUrl,
            aspect_ratio: '9:16',
            duration: '8s',
            resolution: '720p',
            generate_audio: generateAudio,
          };

          // Veo3 pode falhar ocasionalmente na 1ª tentativa (fila, filtro de conteúdo).
          // Faz até 2 tentativas antes de retornar erro ao usuário.
          let videoUrl: string | undefined;
          let lastVeoError = '';
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              console.log(`[generate-video] veo attempt=${attempt}`);
              const submit = await falSubmit('fal-ai/veo3/fast/image-to-video', falKey, veoPayload);
              const result = await falWaitResult<{ video?: { url?: string } }>(
                submit, falKey, 600_000, 'video',
              );
              videoUrl = result?.video?.url;
              if (videoUrl) break;
              lastVeoError = 'Veo não retornou URL de vídeo';
            } catch (e) {
              lastVeoError = (e as Error).message;
              console.warn(`[generate-video] veo attempt=${attempt} failed:`, lastVeoError.slice(0, 200));
              if (attempt < 2) await new Promise((r) => setTimeout(r, 3000));
            }
          }

          if (!videoUrl) {
            return Response.json(
              { error: `Falha ao gerar vídeo (2 tentativas): ${lastVeoError.slice(0, 200)}` },
              { status: 502 },
            );
          }

          // Se temos voz clonada, gera TTS e faz lipsync.
          // lipsyncOk acompanha o resultado real: só fica true se TTS + lipsync
          // produzirem um vídeo com áudio dublado de fato.
          let lipsyncOk = false;
          if (willLipsync && clonedVoiceId) {
            try {
              console.log('[generate-video] step=tts');
              const ttsSubmit = await falSubmit('fal-ai/minimax/speech-02-hd', falKey, {
                text: script,
                voice_setting: { voice_id: clonedVoiceId, speed: 1, vol: 1, pitch: 0 },
                audio_setting: { sample_rate: 32000, format: 'mp3', bitrate: 128000, channel: 1 },
              });
              const tts = await falWaitResult<{ audio?: { url?: string } }>(
                ttsSubmit,
                falKey,
                180_000,
                'tts',
              );
              const audioUrl = tts?.audio?.url;
              if (!audioUrl) throw new Error('TTS vazio');

              console.log('[generate-video] step=lipsync');
              // sync-lipsync v1: preserva melhor o timbre da voz clonada (v2 reencodava
              // o áudio e mudava o timbre percebido — usuários relataram a voz "diferente").
              const lipsyncSubmit = await falSubmit('fal-ai/sync-lipsync', falKey, {
                video_url: videoUrl,
                audio_url: audioUrl,
              });
              const lip = await falWaitResult<{ video?: { url?: string } }>(
                lipsyncSubmit,
                falKey,
                600_000,
                'lipsync',
              );
              const finalUrl = lip?.video?.url;
              if (finalUrl) {
                videoUrl = finalUrl;
                lipsyncOk = true;
              } else {
                console.warn('[generate-video] lipsync vazio, retornando vídeo sem áudio');
              }
            } catch (e) {
              console.warn('[generate-video] lipsync falhou:', (e as Error).message);
              // segue com o vídeo silencioso — não bloqueia o usuário.
            }
          }

          // Debita 1 render do plano do usuário.
          if (userId) {
            try {
              await debitUsage(userId, 0, 1, {
                evento: 'video.generate',
                modulo: 'metodo-op',
                payload: { videoUrl: String(videoUrl).slice(0, 200), clonedVoice: lipsyncOk },
              });
            } catch (e) {
              console.warn('[debit_usage video]', (e as Error).message);
            }
          }

          // usedClonedVoice reflete o resultado REAL (não a intenção).
          // Se o usuário pediu voz clonada mas o lipsync falhou, devolve false.
          // videoMode permite ao frontend distinguir os 3 modos na UI.
          return Response.json({
            videoUrl,
            usedClonedVoice: lipsyncOk,
            requestedClonedVoice: willLipsync,
            videoMode,
          });
        } catch (e) {
          console.error('[generate-video] fail:', (e as Error).message);
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
