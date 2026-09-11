import { fetchFile } from "@ffmpeg/util";
import { obterFfmpeg } from "./ffmpegLoader";

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
  const ff = await obterFfmpeg(onProgress);

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

// Margem depois do fim da fala: sem ela o corte fica colado no último fonema e
// soa amputado; com muito mais que isto volta o silencio que estamos tirando.
export const TAIL_APOS_FALA_S = 0.35;

/**
 * Apara o video no fim da FALA.
 *
 * POR QUE EXISTE (medicao real 09/09/2026): o Kling entregou 7,20 s de video
 * para 5,29 s de audio — 1,91 s (27% do clipe) de personagem se mexendo em
 * silencio depois da frase acabar. A doc do modelo afirma que a duracao
 * acompanha o audio; a medicao diz o contrario, e nada no fluxo lia isso de
 * volta. Quem mede a fala e o servidor (probeAudio sobre o MP3 que ele mesmo
 * gerou) e manda em `speechSeconds`.
 *
 * RE-ENCODA em vez de usar `-c copy`: com stream copy o corte cai no keyframe
 * mais proximo e pode sobrar quase um segundo — justamente o que se quer tirar.
 * Num clipe de ~7 s com preset ultrafast o custo e baixo.
 *
 * Reusa o mesmo FFmpeg do burn (getFfmpeg e memoizado): o core de ~30 MB e
 * carregado uma vez so por sessao.
 */
export async function trimVideoToSpeech(
  videoUrl: string,
  speechSeconds: number,
  onProgress?: (msg: string) => void,
): Promise<Blob> {
  const t0 = performance.now();
  const cutAt = Math.max(1, speechSeconds + TAIL_APOS_FALA_S);
  const ff = await obterFfmpeg(onProgress);

  const logBuffer: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    logBuffer.push(message);
    if (logBuffer.length > 200) logBuffer.shift();
  };
  ff.on("log", logHandler);

  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress)
      onProgress(`Ajustando o fim do video ${Math.min(99, Math.round(progress * 100))}%`);
  };
  ff.on("progress", progressHandler);

  try {
    if (onProgress) onProgress("Baixando video...");
    const videoBytes = await loadVideoBytes(videoUrl);
    await ff.writeFile("trim_in.mp4", videoBytes);

    if (onProgress) onProgress("Ajustando o fim do video 0%");
    await ff.exec([
      "-i",
      "trim_in.mp4",
      "-t",
      cutAt.toFixed(2),
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
      "-movflags",
      "+faststart",
      "trim_out.mp4",
    ]);

    const data = await ff.readFile("trim_out.mp4");
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : (data as Uint8Array);
    if (!bytes || bytes.byteLength < 1024) {
      console.error("[trimVideo] ffmpeg log tail:\n" + logBuffer.slice(-30).join("\n"));
      throw new Error(`Saida do ffmpeg vazia (${bytes?.byteLength ?? 0} bytes)`);
    }

    console.log(
      "[trimVideo] cortado em %ss (fala %ss) — %s bytes em %sms",
      cutAt.toFixed(2),
      speechSeconds.toFixed(2),
      bytes.byteLength,
      Math.round(performance.now() - t0),
    );

    try {
      await ff.deleteFile("trim_in.mp4");
      await ff.deleteFile("trim_out.mp4");
    } catch {
      /* noop */
    }

    const buf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buf).set(bytes);
    return new Blob([buf], { type: "video/mp4" });
  } catch (e) {
    console.error("[trimVideo] FALHOU:", e);
    console.error("[trimVideo] ffmpeg log tail:\n" + logBuffer.slice(-40).join("\n"));
    throw new Error(`Falha ao aparar o video: ${(e as Error)?.message || "erro desconhecido"}`);
  } finally {
    ff.off("progress", progressHandler);
    ff.off("log", logHandler);
  }
}
