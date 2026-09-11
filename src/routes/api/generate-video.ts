import { createFileRoute } from "@tanstack/react-router";
import { probeAudio } from "@/lib/audioProbe.server";
import {
  resolveEffectiveUser,
  checkBalance,
  checkRateLimit,
  debitUsage,
  balanceFailMessage,
} from "@/lib/usage.server";
import { COST_USD } from "@/lib/costs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Kling Avatar exige HTTP URL (não aceita base64). Faz upload temporário no bucket
// image-kits e gera uma signed URL de 1 hora para o fal.ai acessar.
async function uploadFrame(base64DataUrl: string, userId: string | null): Promise<string> {
  const m = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error("Frame inválido (esperado data URL base64).");
  const mime = m[1];
  const bytes = Buffer.from(m[2], "base64");
  const ext = mime.includes("png") ? "png" : "jpg";
  const path = `_temp_veo/${userId || "anon"}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("image-kits")
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upErr) throw new Error(`Upload frame falhou: ${upErr.message}`);
  const { data, error: signErr } = await supabaseAdmin.storage
    .from("image-kits")
    .createSignedUrl(path, 600); // 10 min — suficiente para FAL processar
  if (signErr || !data?.signedUrl) throw new Error("Não foi possível gerar URL do frame.");
  return data.signedUrl;
}

const FAL_QUEUE = "https://queue.fal.run";

// TTS voz nativa: ElevenLabs Multilingual v2 — alta qualidade em pt-BR com vozes preset.
const TTS_MODEL = "fal-ai/elevenlabs/tts/multilingual-v2";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

// Vídeo: Kling AI Avatar v2 Pro — animação mais natural, inclui gestos e movimento corporal.
const AVATAR_MODEL = "fal-ai/kling-video/ai-avatar/v2/pro";

// Fallback quando a detecção de gênero/idade falha.
const NATIVE_VOICE_FALLBACK = "Rachel";

// AJUSTE DA VOZ — revisto em 11/09/2026 para tirar a RESPIRAÇÃO AUDÍVEL.
//
// ⚠ REVERTE a aposta de 09/09 (stability 0.45 / style 0.35, "expressão com
// lastro") e a de 11/09 de manhã (pausa escrita em vez de velocidade). As duas
// foram na direção de mais expressão, e expressão no ElevenLabs vem junto com
// sopro e inspiração. O que se ouviu no filme real foi isso.
//
// O primeiro filme com pausas saiu com uma inspiração alta, que o Kling ainda
// animou na boca do personagem: aparecia e se ouvia. Três coisas mudaram juntas,
// porque a causa é somada:
//  · as marcas de pausa saíram do texto — pausa longa pedida ao modelo é
//    justamente onde ele decide tomar ar;
//  · `stability` subiu: entrega mais firme, menos variação expressiva, e
//    respiração é variação expressiva;
//  · `style` desceu: estilo alto é o que puxa suspiro, ênfase e sopro.
const VOICE_SETTINGS = {
  stability: 0.6,
  similarity_boost: 0.75,
  style: 0.15,
  use_speaker_boost: true,
};

/**
 * Velocidade da locução. Abaixo de 1, a fala desacelera por inteiro.
 *
 * ⚠ É ESTE o remédio da "fala corrida", não a pausa inserida. Pausa é silêncio
 * que o modelo preenche respirando; velocidade é a frase toda mais calma, do
 * começo ao fim, sem buraco no meio.
 */
const VOICE_SPEED = 0.92;

// Mapeamento gênero+faixa → voz ElevenLabs profissional em pt-BR.
const VOICE_MAP: Record<string, string> = {
  "male-young": "Adam", // masculino jovem (18–35) — articulado, moderno
  "male-adult": "George", // masculino adulto (36–60) — maduro, autoridade
  "male-senior": "George", // masculino sênior (60+)   — maduro, confiável
  "female-young": "Bella", // feminino jovem (18–35)   — calorosa, expressiva
  "female-adult": "Rachel", // feminino adulto (36–60)  — calma, profissional
  "female-senior": "Rachel", // feminino sênior (60+)    — calma, confiável
};

// Usa GPT-4o mini vision para detectar gênero e faixa etária do avatar na imagem.
// Resposta em texto simples ("male senior") — evita falhas de parse de JSON.
async function detectNativeVoice(imageBase64: string, openaiKey: string): Promise<string> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'Look at the person in this photo. Reply with exactly two words: their gender (male or female) and age group (young for 18-35, adult for 36-60, senior for 60+). Example: "male senior"',
              },
              { type: "image_url", image_url: { url: imageBase64, detail: "low" } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[generate-video] vision API error", res.status);
      return NATIVE_VOICE_FALLBACK;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = (data.choices?.[0]?.message?.content ?? "").toLowerCase();
    console.log('[generate-video] vision response: "%s"', content);

    // Extrai gênero e faixa etária via regex — robusto a qualquer formato de resposta.
    const isMale = /\bmale\b/.test(content) && !/\bfemale\b/.test(content);
    const age = /\bsenior\b/.test(content)
      ? "senior"
      : /\byoung\b/.test(content)
        ? "young"
        : "adult";
    const gender = isMale ? "male" : "female";

    const voice = VOICE_MAP[`${gender}-${age}`] ?? NATIVE_VOICE_FALLBACK;
    console.log("[generate-video] detected gender=%s age=%s → voice=%s", gender, age, voice);
    return voice;
  } catch (e) {
    console.warn("[generate-video] voice detection falhou:", (e as Error).message);
    return NATIVE_VOICE_FALLBACK;
  }
}

async function falSubmit(modelPath: string, falKey: string, payload: unknown) {
  const res = await fetch(`${FAL_QUEUE}/${modelPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[fal submit error]", modelPath, res.status, text.slice(0, 800));
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
  while (status !== "COMPLETED" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const pollRes = await fetch(submit.status_url, {
      headers: { Authorization: `Key ${falKey}` },
    });
    const txt = await pollRes.text();
    if (!pollRes.ok) {
      console.error("[fal poll error]", label, pollRes.status, txt.slice(0, 800));
      throw new Error(`fal polling ${label} ${pollRes.status}: ${txt.slice(0, 500)}`);
    }
    let pj: { status?: string };
    try {
      pj = JSON.parse(txt);
    } catch {
      pj = {};
    }
    status = pj.status;
    if (status === "FAILED" || status === "ERROR") {
      console.error("[fal result error]", label, txt.slice(0, 800));
      throw new Error(`fal ${label} falhou: ${txt.slice(0, 500)}`);
    }
  }
  if (status !== "COMPLETED") {
    throw new Error(
      `fal ${label} ainda em processamento (status=${status ?? "desconhecido"}). Tente novamente em alguns minutos.`,
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

export const Route = createFileRoute("/api/generate-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { script, imageBase64, videoMode: videoModeRaw } = await request.json();

          // Modos suportados. Modos legados são mapeados para os novos.
          type VideoMode = "portugues" | "kit-voz" | "sinalizacao";
          const legacyMap: Record<string, VideoMode> = {
            "omnihuman-native": "portugues",
            "omnihuman-cloned": "kit-voz",
          };
          const rawNormalized = legacyMap[videoModeRaw] ?? videoModeRaw;
          const videoMode: VideoMode = (["portugues", "kit-voz", "sinalizacao"] as const).includes(
            rawNormalized,
          )
            ? (rawNormalized as VideoMode)
            : "portugues";

          if (!script || typeof script !== "string") {
            return Response.json({ error: "script obrigatório" }, { status: 400 });
          }
          if (!imageBase64 || typeof imageBase64 !== "string") {
            return Response.json({ error: "imageBase64 obrigatório" }, { status: 400 });
          }
          const falKey = process.env.FAL_KEY;
          if (!falKey) {
            return Response.json({ error: "FAL_KEY não configurada" }, { status: 500 });
          }

          console.info("[generate-video] mode=%s image_bytes=%d", videoMode, imageBase64.length);

          // Autenticação obrigatória — sem usuário efetivo, não gera (evita
          // disparo do endpoint mais caro do sistema por requisição anônima).
          const effective = await resolveEffectiveUser(request).catch(() => null);
          if (!effective) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          const userId = effective.userId;
          const impersonatedBy = effective.impersonatedBy;

          if (!impersonatedBy) {
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
          }

          // Pré-checagem de saldo (1 render). Usa usuário efetivo (teste quando admin impersona).
          try {
            const { ok, reason } = await checkBalance(userId, 0, 1);
            if (!ok) {
              return Response.json({ error: balanceFailMessage(reason) }, { status: 402 });
            }
          } catch (e) {
            console.warn("[balance pre-check video]", (e as Error).message);
          }

          // Resolve voz clonada para o modo kit-voz.
          // provider='chatterbox': usa sample_path como referência de áudio (zero-shot).
          // provider legado: usa external_voice_id como voice name/ID do ElevenLabs.
          let clonedVoiceId: string | null = null;
          let clonedSamplePath: string | null = null;
          if (videoMode === "kit-voz" && userId) {
            try {
              const { data: vc } = await supabaseAdmin
                .from("voice_clones")
                .select("external_voice_id, sample_path, provider, status")
                .eq("user_id", userId)
                .maybeSingle();
              const row = vc;
              if (row?.status === "ready") {
                if (row.provider === "elevenlabs") {
                  // ElevenLabs: external_voice_id é o voice_id da conta → chamada direta à API.
                  clonedSamplePath = String(row.external_voice_id);
                } else if (row.provider === "chatterbox") {
                  // Legado Chatterbox: sample_path como referência de áudio.
                  clonedSamplePath = row.sample_path || row.external_voice_id;
                } else if (row.external_voice_id) {
                  // Legado MiniMax: voice_id vai via fal.ai (ElevenLabs preset path).
                  clonedVoiceId = String(row.external_voice_id);
                }
              }
            } catch (e) {
              console.warn("[generate-video] load voice", (e as Error).message);
            }
            if (!clonedSamplePath && !clonedVoiceId) {
              return Response.json(
                {
                  error:
                    "Nenhuma voz clonada disponível. Configure sua voz no Kit Imagem primeiro.",
                },
                { status: 400 },
              );
            }
          }

          // Upload do frame de referência para o Kling Avatar acessar via URL.
          console.log("[generate-video] step=upload_frame");
          const frameUrl = await uploadFrame(imageBase64, userId);

          // Garante que o script termina com pontuação limpa para evitar artefato ("soluço")
          // que o ElevenLabs adiciona quando o texto não tem um fim de frase definido.
          const scriptTts = script.trimEnd().replace(/[,;:\s]+$/, "") + ".";

          // ⚠ UMA LOCUÇÃO POR FRASE — conserto de 11/09/2026, à noite.
          //
          // O defeito, na palavra do Ari: "quando acabou a primeira oração sem
          // uma interpretação de fechamento, começou a outra oração com uma
          // respiração pra dentro". As duas queixas são o MESMO defeito, e ele
          // nasce de mandar as duas frases numa requisição só: para o modelo o
          // enunciado não terminou no ponto final, então ele não baixa a voz —
          // e toma ar para seguir. Essa inspiração é ÁUDIO GERADO, e o Kling
          // anima o que o áudio faz: ela aparecia na boca do personagem.
          //
          // Tirar a marcação de pausa não resolveu (tentado de manhã) nem
          // resolveria: o ar vem do PONTO FINAL, não da marcação. Gerando cada
          // frase sozinha, cada uma acaba como quem acaba, e não existe frase
          // seguinte para tomar fôlego.
          //
          // ⚠ Os pedaços são MP3 independentes e são emendados byte a byte.
          // Quadro de MP3 é autossuficiente, então emendar funciona — mas a
          // DURAÇÃO do arquivo emendado não se lê mais pelo cabeçalho do
          // primeiro. Por isso cada pedaço é medido antes, e os tempos se somam.
          const frasesDaFala = scriptTts
            .split(/(?<=[.!?])\s+/)
            .map((f) => f.trim())
            .filter(Boolean);

          // Como se gera UMA frase — muda com o caminho da voz, o resto é igual.
          let falarUmaFrase: (texto: string) => Promise<Buffer>;

          if (clonedSamplePath) {
            // Voz clonada: chamada direta à API do ElevenLabs com o voice_id.
            console.log(
              "[generate-video] step=tts provider=elevenlabs-cloned voice=%s frases=%d",
              clonedSamplePath.slice(0, 20),
              frasesDaFala.length,
            );
            const elKey = process.env.ELEVENLABS_API_KEY;
            if (!elKey) throw new Error("ELEVENLABS_API_KEY não configurada.");
            falarUmaFrase = async (texto: string) => {
              const ttsRes = await fetch(`${ELEVENLABS_API}/text-to-speech/${clonedSamplePath}`, {
                method: "POST",
                headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: texto,
                  model_id: "eleven_multilingual_v2",
                  language_code: "pt",
                  voice_settings: { ...VOICE_SETTINGS, speed: VOICE_SPEED },
                }),
              });
              if (!ttsRes.ok) {
                const err = await ttsRes.text();
                throw new Error(`ElevenLabs TTS clonada ${ttsRes.status}: ${err.slice(0, 200)}`);
              }
              return Buffer.from(await ttsRes.arrayBuffer());
            };
          } else {
            // Voz preset (nativa) ou voice_id legado, pela fila do fal.
            let ttsVoice: string;
            if (clonedVoiceId) {
              ttsVoice = clonedVoiceId;
            } else {
              const openaiKey = process.env.OPENAI_API_KEY_CONTENT;
              ttsVoice = openaiKey
                ? await detectNativeVoice(imageBase64, openaiKey)
                : NATIVE_VOICE_FALLBACK;
            }
            console.log(
              "[generate-video] step=tts provider=elevenlabs voice=%s frases=%d",
              ttsVoice.slice(0, 30),
              frasesDaFala.length,
            );
            falarUmaFrase = async (texto: string) => {
              const ttsSubmit = await falSubmit(TTS_MODEL, falKey, {
                text: texto,
                voice: ttsVoice,
                language_code: "pt",
                stability: VOICE_SETTINGS.stability,
                similarity_boost: VOICE_SETTINGS.similarity_boost,
                style: VOICE_SETTINGS.style,
                speed: VOICE_SPEED,
              });
              const tts = await falWaitResult<{ audio?: { url?: string } }>(
                ttsSubmit,
                falKey,
                90_000,
                "tts",
              );
              const url = tts?.audio?.url ?? "";
              if (!url) throw new Error("ElevenLabs TTS não retornou áudio.");
              const res = await fetch(url);
              if (!res.ok) throw new Error(`Download do áudio TTS falhou (${res.status}).`);
              return Buffer.from(await res.arrayBuffer());
            };
          }

          // As frases são poucas (duas) e independentes — vão juntas.
          const pedacos = await Promise.all(frasesDaFala.map((f) => falarUmaFrase(f)));

          // DURAÇÃO DA FALA — medida real 09/09/2026: um reels saiu com 7,20 s
          // de vídeo para 5,29 s de áudio. Quase 2 s (27% do clipe) de
          // personagem se mexendo em silêncio depois que a frase acabou.
          //
          // A doc do Kling afirma "output duration matches audio length"; a
          // medição diz o contrário, e nada no fluxo lia a duração de volta. Em
          // vez de confiar no modelo, medimos AQUI o áudio que nós mesmos
          // geramos e mandamos o número ao cliente, que apara o vídeo.
          //
          // Falha FECHADA de propósito: se a medição não der, `speechSeconds`
          // vai null e o cliente não apara nada — ninguém fica sem vídeo por
          // causa de um probe.
          let speechSeconds: number | null = null;
          try {
            let soma = 0;
            for (const pedaco of pedacos) {
              const probe = probeAudio(new Uint8Array(pedaco), "audio/mpeg");
              if (probe.durationS > 0) soma += probe.durationS;
            }
            if (soma > 0) speechSeconds = Number(soma.toFixed(3));
          } catch (e) {
            console.warn("[generate-video] probe do audio falhou:", (e as Error).message);
          }

          const audioBytes = Buffer.concat(pedacos);
          const audioPath = `_temp_veo/${userId || "anon"}/${Date.now()}.mp3`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("image-kits")
            .upload(audioPath, audioBytes, { contentType: "audio/mpeg", upsert: true });
          if (upErr) throw new Error(`Upload áudio TTS falhou: ${upErr.message}`);
          const { data: audioSigned, error: signErr } = await supabaseAdmin.storage
            .from("image-kits")
            .createSignedUrl(audioPath, 600); // 10 min — suficiente para o fal processar
          if (signErr || !audioSigned?.signedUrl)
            throw new Error("Não foi possível gerar URL do áudio TTS.");
          const audioUrl = audioSigned.signedUrl;

          // Palavras + segundos medidos = palavras por segundo REAL. A faixa do
          // roteiro (core/scriptValidation.ts) é calibrada por estimativa; é esta
          // linha que permite corrigi-la com número de verdade.
          const nPalavras = (script.trim().match(/\S+/g) || []).length;
          console.log(
            "[generate-video] fala palavras=%d frases=%d speechSeconds=%s speed=%s",
            nPalavras,
            frasesDaFala.length,
            speechSeconds ?? "desconhecido",
            VOICE_SPEED,
          );

          // Kling AI Avatar v2 Pro — imagem + áudio + prompt → vídeo lip-syncado com animação natural.
          // O prompt guia o modelo para movimentos expressivos além de boca/cabeça.
          // Duração do vídeo segue o áudio automaticamente.
          // Job assíncrono: backend retorna imediatamente, frontend faz polling via /api/fal-status.
          console.log("[generate-video] step=submit_avatar mode=%s", videoMode);
          const submit = await falSubmit(AVATAR_MODEL, falKey, {
            image_url: frameUrl,
            audio_url: audioUrl,
            // O prompt anterior mandava o personagem se mexer MENOS três vezes
            // ("subtle head movement", "minimal hand gestures", "steady and
            // composed") — e o Kling AI Avatar foi escolhido justamente por
            // fazer gesto e movimento de corpo. Com tudo amortecido, sobrava a
            // boca se mexendo sozinha num rosto congelado, que é a descrição do
            // "biquinho" relatado em 09/09/2026.
            //
            // O endpoint aceita só image_url, audio_url e prompt — não há
            // parâmetro de expressividade nem de intensidade de movimento
            // (verificado na doc da fal.ai). Este texto é a ÚNICA alavanca de
            // direção que temos, então ele passa a PEDIR movimento em vez de
            // proibir, e a nomear a articulação, que antes não era mencionada.
            // ⚠ AS DUAS METADES DESTE TEXTO VÊM DE DOIS DEFEITOS OPOSTOS, e por
            // isso ele não pode ser reescrito inteiro sem cuidado.
            //
            // A PRIMEIRA METADE (boca e rosto) nasceu em 09/09/2026: o prompt
            // anterior mandava se mexer MENOS em três lugares, o rosto congelava
            // e sobrava a boca sozinha — o "biquinho". A cláusula contra lábios
            // franzidos é o que resolveu, e ela FICA.
            //
            // A SEGUNDA METADE (mãos) é de 11/09/2026, e resolve o defeito
            // contrário: o Kling gesticula a cada palavra, e o resultado parece
            // robô acompanhando o texto. Repare que o prompt antigo não pedia
            // gesto de mão nenhum — o excesso é comportamento do próprio modelo,
            // e o jeito de contê-lo é dizer explicitamente onde as mãos ficam.
            //
            // ⚠ O Kling recebe UMA instrução para o clipe inteiro, sem linha do
            // tempo. Não dá para sincronizar gesto com pausa: o que se consegue
            // é inclinar o comportamento médio, não marcar o compasso.
            prompt:
              "A person speaking to camera in a natural, conversational way. Clear and relaxed mouth articulation that follows the speech, jaw moving naturally, no pursed or puckered lips. Natural blinking and small eyebrow movement that follows the meaning of the words. Gentle head motion and light shoulder movement while talking, as a real person does. Hands rest naturally most of the time; use only a few deliberate gestures for the important ideas, never gesturing on every word. Between phrases the body settles and the hands come back to rest. Expression carries the meaning more than the hands: subtle facial expression, steady eye contact with the camera, small natural head movements. Warm, engaged, confident presence, relaxed posture, unhurried.",
          });

          // Debita imediatamente após submit bem-sucedido.
          if (userId) {
            try {
              await debitUsage(userId, 0, 1, {
                evento: "video.generate",
                modulo: "metodo-op",
                payload: {
                  videoMode,
                  hasClonedVoice: !!(clonedVoiceId || clonedSamplePath),
                  requestId: submit.request_id,
                },
                custoUsd: COST_USD.video,
                impersonatedBy,
              });
            } catch (e) {
              console.warn("[debit_usage video]", (e as Error).message);
            }
          }

          return Response.json({
            phase: "pending",
            statusUrl: submit.status_url,
            responseUrl: submit.response_url,
            videoMode,
            speechSeconds,
            usedClonedVoice: videoMode === "kit-voz",
            requestedClonedVoice: videoMode === "kit-voz",
          });
        } catch (e) {
          console.error("[generate-video] fail:", (e as Error).message);
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
