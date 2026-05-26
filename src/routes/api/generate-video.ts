import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest, checkBalance, debitUsage } from '@/lib/usage.server';
import { COST_USD } from '@/lib/costs';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// Kling Avatar exige HTTP URL (não aceita base64). Faz upload temporário no bucket
// image-kits e gera uma signed URL de 1 hora para o fal.ai acessar.
async function uploadFrame(base64DataUrl: string, userId: string | null): Promise<string> {
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
  if (signErr || !data?.signedUrl) throw new Error('Não foi possível gerar URL do frame.');
  return data.signedUrl;
}

const FAL_QUEUE = 'https://queue.fal.run';

// TTS voz nativa: ElevenLabs Multilingual v2 — alta qualidade em pt-BR com vozes preset.
const TTS_MODEL = 'fal-ai/elevenlabs/tts/multilingual-v2';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

// Vídeo: Kling AI Avatar v2 Pro — animação mais natural, inclui gestos e movimento corporal.
const AVATAR_MODEL = 'fal-ai/kling-video/ai-avatar/v2/pro';

// Fallback quando a detecção de gênero/idade falha.
const NATIVE_VOICE_FALLBACK = 'Rachel';

// Mapeamento gênero+faixa → voz ElevenLabs profissional em pt-BR.
const VOICE_MAP: Record<string, string> = {
  'male-young':   'Adam',    // masculino jovem (18–35) — articulado, moderno
  'male-adult':   'George',  // masculino adulto (36–60) — maduro, autoridade
  'male-senior':  'George',  // masculino sênior (60+)   — maduro, confiável
  'female-young': 'Bella',   // feminino jovem (18–35)   — calorosa, expressiva
  'female-adult': 'Rachel',  // feminino adulto (36–60)  — calma, profissional
  'female-senior':'Rachel',  // feminino sênior (60+)    — calma, confiável
};

// Usa GPT-4o mini vision para detectar gênero e faixa etária do avatar na imagem.
// Resposta em texto simples ("male senior") — evita falhas de parse de JSON.
async function detectNativeVoice(imageBase64: string, openaiKey: string): Promise<string> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Look at the person in this photo. Reply with exactly two words: their gender (male or female) and age group (young for 18-35, adult for 36-60, senior for 60+). Example: "male senior"',
            },
            { type: 'image_url', image_url: { url: imageBase64, detail: 'low' } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.warn('[generate-video] vision API error', res.status);
      return NATIVE_VOICE_FALLBACK;
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = (data.choices?.[0]?.message?.content ?? '').toLowerCase();
    console.log('[generate-video] vision response: "%s"', content);

    // Extrai gênero e faixa etária via regex — robusto a qualquer formato de resposta.
    const isMale = /\bmale\b/.test(content) && !/\bfemale\b/.test(content);
    const age = /\bsenior\b/.test(content) ? 'senior' : /\byoung\b/.test(content) ? 'young' : 'adult';
    const gender = isMale ? 'male' : 'female';

    const voice = VOICE_MAP[`${gender}-${age}`] ?? NATIVE_VOICE_FALLBACK;
    console.log('[generate-video] detected gender=%s age=%s → voice=%s', gender, age, voice);
    return voice;
  } catch (e) {
    console.warn('[generate-video] voice detection falhou:', (e as Error).message);
    return NATIVE_VOICE_FALLBACK;
  }
}

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
      `fal ${label} ainda em processamento (status=${status ?? 'desconhecido'}). Tente novamente em alguns minutos.`,
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
          const { script, imageBase64, videoMode: videoModeRaw } = await request.json();

          // Modos suportados. Modos legados são mapeados para os novos.
          type VideoMode = 'portugues' | 'kit-voz' | 'sinalizacao';
          const legacyMap: Record<string, VideoMode> = {
            'omnihuman-native': 'portugues',
            'omnihuman-cloned': 'kit-voz',
          };
          const rawNormalized = legacyMap[videoModeRaw] ?? videoModeRaw;
          const videoMode: VideoMode = (['portugues', 'kit-voz', 'sinalizacao'] as const).includes(rawNormalized)
            ? rawNormalized as VideoMode
            : 'portugues';

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

          // Resolve voz clonada para o modo kit-voz.
          // provider='chatterbox': usa sample_path como referência de áudio (zero-shot).
          // provider legado: usa external_voice_id como voice name/ID do ElevenLabs.
          let clonedVoiceId: string | null = null;
          let clonedSamplePath: string | null = null;
          if (videoMode === 'kit-voz' && userId) {
            try {
              const { data: vc } = await supabaseAdmin
                .from('voice_clones' as any)
                .select('external_voice_id, sample_path, provider, status')
                .eq('user_id', userId)
                .maybeSingle();
              const row = vc as any;
              if (row?.status === 'ready') {
                if (row.provider === 'elevenlabs') {
                  // ElevenLabs: external_voice_id é o voice_id da conta → chamada direta à API.
                  clonedSamplePath = String(row.external_voice_id);
                } else if (row.provider === 'chatterbox') {
                  // Legado Chatterbox: sample_path como referência de áudio.
                  clonedSamplePath = row.sample_path || row.external_voice_id;
                } else if (row.external_voice_id) {
                  // Legado MiniMax: voice_id vai via fal.ai (ElevenLabs preset path).
                  clonedVoiceId = String(row.external_voice_id);
                }
              }
            } catch (e) {
              console.warn('[generate-video] load voice', (e as Error).message);
            }
            if (!clonedSamplePath && !clonedVoiceId) {
              return Response.json(
                { error: 'Nenhuma voz clonada disponível. Configure sua voz no Kit Imagem primeiro.' },
                { status: 400 },
              );
            }
          }

          // Upload do frame de referência para o Kling Avatar acessar via URL.
          console.log('[generate-video] step=upload_frame');
          const frameUrl = await uploadFrame(imageBase64, userId);

          // TTS — ramifica conforme modo e provider da voz clonada.
          // kit-voz + chatterbox → Chatterbox com áudio de referência do usuário (zero-shot)
          // kit-voz + legado     → ElevenLabs com voice_id armazenado no DB
          // portugues/sinalizacao → ElevenLabs com voz preset detectada por visão
          let audioUrl: string;

          // Garante que o script termina com pontuação limpa para evitar artefato ("soluço")
          // que o ElevenLabs adiciona quando o texto não tem um fim de frase definido.
          const scriptTts = script.trimEnd().replace(/[,;:\s]+$/, '') + '.';

          if (clonedSamplePath) {
            // ElevenLabs TTS direto com voice_id clonado — gera bytes e faz upload para URL acessível pelo Kling.
            console.log('[generate-video] step=tts provider=elevenlabs-cloned voice=%s', clonedSamplePath.slice(0, 20));
            const elKey = process.env.ELEVENLABS_API_KEY;
            if (!elKey) throw new Error('ELEVENLABS_API_KEY não configurada.');
            const ttsRes = await fetch(`${ELEVENLABS_API}/text-to-speech/${clonedSamplePath}`, {
              method: 'POST',
              headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: scriptTts,
                model_id: 'eleven_multilingual_v2',
                language_code: 'pt',
                voice_settings: { stability: 0.70, similarity_boost: 0.75, style: 0 },
              }),
            });
            if (!ttsRes.ok) {
              const err = await ttsRes.text();
              throw new Error(`ElevenLabs TTS clonada ${ttsRes.status}: ${err.slice(0, 200)}`);
            }
            const audioBytes = Buffer.from(await ttsRes.arrayBuffer());
            const audioPath = `_temp_veo/${userId || 'anon'}/${Date.now()}.mp3`;
            const { error: upErr } = await supabaseAdmin.storage
              .from('image-kits')
              .upload(audioPath, audioBytes, { contentType: 'audio/mpeg', upsert: true });
            if (upErr) throw new Error(`Upload áudio TTS falhou: ${upErr.message}`);
            const { data: audioSigned, error: signErr } = await supabaseAdmin.storage
              .from('image-kits')
              .createSignedUrl(audioPath, 3600);
            if (signErr || !audioSigned?.signedUrl) throw new Error('Não foi possível gerar URL do áudio TTS.');
            audioUrl = audioSigned.signedUrl;
            console.log('[generate-video] elevenlabs cloned tts ok');
          } else {
            // ElevenLabs TTS — voz preset (nativa) ou voice_id legado (clonada antiga).
            let ttsVoice: string;
            if (clonedVoiceId) {
              ttsVoice = clonedVoiceId;
            } else {
              const openaiKey = process.env.OPENAI_API_KEY_CONTENT;
              ttsVoice = openaiKey
                ? await detectNativeVoice(imageBase64, openaiKey)
                : NATIVE_VOICE_FALLBACK;
            }
            console.log('[generate-video] step=tts provider=elevenlabs voice=%s', ttsVoice.slice(0, 30));
            const ttsSubmit = await falSubmit(TTS_MODEL, falKey, {
              text: scriptTts,
              voice: ttsVoice,
              language_code: 'pt',
              stability: 0.70,
              similarity_boost: 0.75,
              speed: 1.0,
            });
            const tts = await falWaitResult<{ audio?: { url?: string } }>(ttsSubmit, falKey, 90_000, 'tts');
            audioUrl = tts?.audio?.url ?? '';
            if (!audioUrl) throw new Error('ElevenLabs TTS não retornou áudio.');
            console.log('[generate-video] elevenlabs tts ok audio_url=%s', audioUrl.slice(0, 60));
          }

          // Kling AI Avatar v2 Pro — imagem + áudio + prompt → vídeo lip-syncado com animação natural.
          // O prompt guia o modelo para movimentos expressivos além de boca/cabeça.
          // Duração do vídeo segue o áudio automaticamente.
          // Job assíncrono: backend retorna imediatamente, frontend faz polling via /api/fal-status.
          console.log('[generate-video] step=submit_avatar mode=%s', videoMode);
          const submit = await falSubmit(AVATAR_MODEL, falKey, {
            image_url: frameUrl,
            audio_url: audioUrl,
            prompt: 'Professional speaker talking naturally, subtle head movement, calm and confident posture, minimal hand gestures, steady and composed.',
          });

          // Debita imediatamente após submit bem-sucedido.
          const impersonatedBy = request.headers.get('x-impersonate-user-id') || undefined;
          if (userId) {
            try {
              await debitUsage(userId, 0, 1, {
                evento: 'video.generate',
                modulo: 'metodo-op',
                payload: { videoMode, hasClonedVoice: !!(clonedVoiceId || clonedSamplePath), requestId: submit.request_id },
                custoUsd: COST_USD.video,
                impersonatedBy,
              });
            } catch (e) {
              console.warn('[debit_usage video]', (e as Error).message);
            }
          }

          return Response.json({
            phase: 'pending',
            statusUrl: submit.status_url,
            responseUrl: submit.response_url,
            videoMode,
            usedClonedVoice: videoMode === 'kit-voz',
            requestedClonedVoice: videoMode === 'kit-voz',
          });

        } catch (e) {
          console.error('[generate-video] fail:', (e as Error).message);
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
