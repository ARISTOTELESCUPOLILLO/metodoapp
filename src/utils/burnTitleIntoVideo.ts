import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

async function getFfmpeg(onProgress?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ff = new FFmpeg();
    if (onProgress) onProgress("Carregando processador de vídeo...");
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();

  return loadingPromise;
}

// Baixa o vídeo de forma robusta. fetchFile do ffmpeg.wasm engole erros de CORS,
// então tentamos primeiro um fetch normal pra capturar problemas claros.
async function loadVideoBytes(url: string): Promise<Uint8Array> {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error(`HTTP ${r.status} ao baixar vídeo`);
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 1024) throw new Error(`Vídeo muito pequeno (${buf.byteLength} bytes)`);
    return new Uint8Array(buf);
  } catch (e) {
    // Fallback pro fetchFile (suporta data URLs etc.)
    const u = await fetchFile(url);
    if (!u || u.byteLength < 1024) {
      throw new Error(
        `Não foi possível baixar o vídeo: ${(e as Error)?.message || "erro desconhecido"}`,
      );
    }
    return u;
  }
}

/**
 * Queima o PNG do título no vídeo apenas durante os primeiros `durationSec` segundos.
 * Re-encoda o áudio em AAC pra evitar falhas com streams incompatíveis do OmniHuman.
 */
export async function burnTitleIntoVideo(
  videoUrl: string,
  titlePng: Blob,
  durationSec = 0.4,
  onProgress?: (msg: string) => void,
): Promise<Blob> {
  const t0 = performance.now();
  const ff = await getFfmpeg(onProgress);

  // Captura logs do ffmpeg pra diagnóstico se algo quebrar.
  const logBuffer: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    logBuffer.push(message);
    if (logBuffer.length > 200) logBuffer.shift();
  };
  ff.on("log", logHandler);

  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(`Aplicando título ${Math.min(99, Math.round(progress * 100))}%`);
  };
  ff.on("progress", progressHandler);

  try {
    if (onProgress) onProgress("Baixando vídeo...");
    const videoBytes = await loadVideoBytes(videoUrl);
    const pngBytes = new Uint8Array(await titlePng.arrayBuffer());
    console.log(
      "[burnTitle] input mp4:",
      videoBytes.byteLength,
      "bytes; png:",
      pngBytes.byteLength,
      "bytes",
    );

    await ff.writeFile("in.mp4", videoBytes);
    await ff.writeFile("title.png", pngBytes);

    if (onProgress) onProgress("Aplicando título 0%");
    await ff.exec([
      "-i",
      "in.mp4",
      "-i",
      "title.png",
      "-filter_complex",
      `[0:v][1:v]overlay=0:0:enable='lt(t,${durationSec})'[v]`,
      "-map",
      "[v]",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-crf",
      "28",
      "-pix_fmt",
      "yuv420p",
      "-threads",
      "0",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-shortest",
      "-movflags",
      "+faststart",
      "out.mp4",
    ]);

    const data = await ff.readFile("out.mp4");
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : (data as Uint8Array);

    if (!bytes || bytes.byteLength < 1024) {
      console.error("[burnTitle] ffmpeg log tail:\n" + logBuffer.slice(-30).join("\n"));
      throw new Error(`Saída do ffmpeg vazia (${bytes?.byteLength ?? 0} bytes)`);
    }

    console.log(
      "[burnTitle] output mp4:",
      bytes.byteLength,
      "bytes em",
      Math.round(performance.now() - t0),
      "ms",
    );

    // Cleanup do FS virtual
    try {
      await ff.deleteFile("in.mp4");
      await ff.deleteFile("title.png");
      await ff.deleteFile("out.mp4");
    } catch {
      /* noop */
    }

    const buf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buf).set(bytes);
    return new Blob([buf], { type: "video/mp4" });
  } catch (e) {
    console.error("[burnTitle] FALHOU:", e);
    console.error("[burnTitle] ffmpeg log tail:\n" + logBuffer.slice(-40).join("\n"));
    const msg = (e as Error)?.message || String(e) || "erro desconhecido";
    throw new Error(`Falha ao queimar título: ${msg}`);
  } finally {
    ff.off("progress", progressHandler);
    ff.off("log", logHandler);
  }
}
