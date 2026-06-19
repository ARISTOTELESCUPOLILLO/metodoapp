// Gravação e validação de amostras de áudio para clonagem de voz.
// Tudo client-side, sem dependência externa.

export const VOICE_MIN_SECONDS = 30;
export const VOICE_MAX_SECONDS = 180;
export const VOICE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const VOICE_SAMPLE_SCRIPT = `Olá, meu nome é [seu nome] e essa é a minha voz natural,
falando em português brasileiro. Estou gravando esta amostra para que o sistema
possa aprender o meu jeito de falar — o ritmo, a entonação e o timbre da minha
voz. Falo do meu trabalho com clareza e confiança, sempre buscando estar próximo
do meu cliente. Quando explico alguma coisa, gosto de usar exemplos do dia a dia,
porque acredito que as melhores ideias são as que cabem dentro da nossa rotina.
Hoje é um bom dia para começar algo novo, dar o próximo passo, conversar com
quem importa. Eu acredito em fazer o simples bem feito, com atenção aos
detalhes, sem pressa, sem atalho. Obrigado por ouvir até aqui — espero que
em breve a gente possa criar coisas incríveis juntos.`;

export interface AudioValidation {
  ok: boolean;
  durationS: number;
  rms: number;
  reason?: string;
}

export async function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Falha ao ler o arquivo de áudio."));
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(blob);
  });
}

export async function validateAudioBlob(blob: Blob): Promise<AudioValidation> {
  if (blob.size > VOICE_MAX_BYTES) {
    return {
      ok: false,
      durationS: 0,
      rms: 0,
      reason: `Arquivo grande demais (>${Math.round(VOICE_MAX_BYTES / 1024 / 1024)} MB).`,
    };
  }
  const arrBuf = await blob.arrayBuffer();
  const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC)
    return { ok: false, durationS: 0, rms: 0, reason: "Navegador sem suporte a Web Audio API." };
  const ctx = new AC();
  let audioBuf: AudioBuffer;
  try {
    audioBuf = await ctx.decodeAudioData(arrBuf.slice(0));
  } catch {
    try {
      await ctx.close();
    } catch {}
    return {
      ok: false,
      durationS: 0,
      rms: 0,
      reason: "Formato de áudio não suportado. Use mp3, m4a, wav ou webm.",
    };
  }
  const durationS = audioBuf.duration;
  // RMS no primeiro canal
  const ch = audioBuf.getChannelData(0);
  let sumSq = 0;
  const stride = Math.max(1, Math.floor(ch.length / 200_000));
  let n = 0;
  for (let i = 0; i < ch.length; i += stride) {
    sumSq += ch[i] * ch[i];
    n++;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, n));
  try {
    await ctx.close();
  } catch {}

  if (durationS < VOICE_MIN_SECONDS) {
    return {
      ok: false,
      durationS,
      rms,
      reason: `Áudio muito curto (${Math.round(durationS)}s). Mínimo de ${VOICE_MIN_SECONDS}s.`,
    };
  }
  if (durationS > VOICE_MAX_SECONDS) {
    return {
      ok: false,
      durationS,
      rms,
      reason: `Áudio muito longo (${Math.round(durationS)}s). Máximo de ${VOICE_MAX_SECONDS}s.`,
    };
  }
  if (rms < 0.005) {
    return {
      ok: false,
      durationS,
      rms,
      reason: "Áudio com volume muito baixo ou silencioso. Grave mais próximo do microfone.",
    };
  }
  return { ok: true, durationS, rms };
}

export interface RecorderHandle {
  stop: () => Promise<Blob>;
  cancel: () => void;
  stream: MediaStream;
}

export async function startRecorder(mimeHint?: string): Promise<RecorderHandle> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Gravação não suportada neste navegador.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const candidates = [
    mimeHint,
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ].filter(Boolean) as string[];
  let chosen = "";
  for (const m of candidates) {
    if ((window as any).MediaRecorder && (MediaRecorder as any).isTypeSupported?.(m)) {
      chosen = m;
      break;
    }
  }
  const rec = chosen ? new MediaRecorder(stream, { mimeType: chosen }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  rec.start();

  return {
    stream,
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          for (const t of stream.getTracks()) t.stop();
          resolve(blob);
        };
        rec.stop();
      }),
    cancel: () => {
      try {
        rec.stop();
      } catch {}
      for (const t of stream.getTracks()) t.stop();
    },
  };
}

export function blobMimeToExt(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}
