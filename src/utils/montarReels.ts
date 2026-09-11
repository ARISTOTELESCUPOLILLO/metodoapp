// MONTAGEM DO REELS — a passagem de FFmpeg que junta tudo.
//
// Capa parada + filme com legendas + fade cruzado + assinatura em fundo preto,
// com locução e trilha mixadas. Roda no NAVEGADOR, no mesmo FFmpeg WASM que já
// queima o título da Sinalização e apara a sobra da fala. Custo de API: zero.
//
// ⚠ UMA PASSAGEM SÓ, E ISSO É DE PROPÓSITO. Cada chamada ao FFmpeg recodifica o
// vídeo inteiro: fazer capa, legendas e assinatura em três passagens custaria
// três recodificações e três perdas de qualidade sobre a mesma peça. Todo o
// grafo abaixo é montado para rodar de uma vez.
//
// ⚠ NADA DE FILTRO EXÓTICO. O núcleo do FFmpeg vem de CDN e eu não tenho como
// inspecionar quais filtros foram compilados nele. Por isso o grafo usa só o que
// existe em qualquer compilação: scale, fps, tpad, concat, overlay, adelay,
// volume, afade e amix. O fade cruzado, que pediria `xfade`, foi resolvido ANTES
// — desenhando os primeiros quadros da assinatura com opacidade crescente (ver
// utils/montagemFrames.ts). Não há dependência a verificar.

import { getAuthHeaders } from "../services/authHeaders";
import { fetchFile } from "@ffmpeg/util";
import { obterFfmpeg, diagnosticoDaCarga } from "./ffmpegLoader";
import {
  ALTURA,
  FPS,
  LARGURA,
  TRILHA_FADE_OUT_S,
  curvaDaTrilha,
  montarLegendas,
  planejarMontagem,
  type Legenda,
} from "../core/montagemReels";
import { desenharAssinatura, desenharLegendas } from "./montagemFrames";

/**
 * Manda o que aconteceu para o servidor, para eu poder ler sem pedir console ao
 * usuário. Best-effort de verdade: se isto falhar, ninguém fica sabendo e o
 * fluxo segue igual.
 */
async function enviarDiario(dados: {
  onde: string;
  mensagem: string;
  log?: string[];
  filtros?: string;
  plano?: string;
}): Promise<void> {
  try {
    const auth = await getAuthHeaders();
    await fetch("/api/log-montagem", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(dados),
    });
  } catch {
    /* diário que atrapalha não serve para nada */
  }
}

async function bytes(url: string, oQue: string): Promise<Uint8Array> {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 256) throw new Error(`arquivo muito pequeno (${buf.byteLength} bytes)`);
    return new Uint8Array(buf);
  } catch (e) {
    const u = await fetchFile(url);
    if (!u || u.byteLength < 256)
      throw new Error(`não foi possível baixar ${oQue}: ${(e as Error)?.message || "erro"}`);
    return u;
  }
}

/**
 * Mede a duração REAL do clipe que vai entrar na montagem.
 *
 * ⚠ POR QUE MEDIR EM VEZ DE CALCULAR: a primeira versão deduzia a duração de
 * `speechSeconds + sobra`, o número usado para APARAR o vídeo. Parece a mesma
 * coisa e não é, em dois casos que acontecem de verdade:
 *  · se o corte falhar (ele falha ABERTO), o vídeo que segue para a montagem é
 *    o ORIGINAL, mais longo — e a assinatura entraria por cima do personagem
 *    ainda falando;
 *  · se `speechSeconds` vier nulo, a conta dava ZERO e o filme inteiro seria
 *    cortado em 2,4 s.
 * O roteiro tem tamanho variável, então a duração varia a cada peça: deduzir é
 * justamente o que não se pode fazer aqui. O navegador entrega o número exato
 * de graça.
 */
async function duracaoDoVideo(url: string): Promise<number> {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const limpar = () => {
      v.removeAttribute("src");
      v.load();
    };
    v.onloadedmetadata = () => {
      const d = v.duration;
      limpar();
      if (!isFinite(d) || d <= 0) rej(new Error("duração do vídeo indisponível"));
      else res(d);
    };
    v.onerror = () => {
      limpar();
      rej(new Error("não foi possível ler a duração do vídeo"));
    };
    v.src = url;
  });
}

export interface MontagemInput {
  /** Vídeo base — o clipe JÁ APARADO na fala. A duração é MEDIDA, não informada. */
  videoUrl: string;
  /** Capa gerada pelo app (data URL ou http). */
  capaUrl: string;
  /** Roteiro falado — vira legenda queimada. */
  script: string;
  /** Duração medida da locução (servidor). Sem ela, não há legenda. */
  falaS: number | null;
  /** Trilha instrumental. Sem ela, o filme sai só com a locução. */
  trilhaUrl?: string;
  /** Logo do Kit para a assinatura. */
  logoDataUrl?: string;
  /** Contato exibido na assinatura. */
  contato: string;
  fontFamily?: string;
}

/**
 * Monta o filme final e devolve o MP4.
 *
 * Falha ABERTA por contrato de chamada: quem chama deve manter o vídeo original
 * se isto lançar. A geração já foi paga, e nenhum pós-processamento pode custar
 * a peça ao usuário — mesma regra do corte da sobra e do burn da Sinalização.
 */
export async function montarReels(
  input: MontagemInput,
  onProgress?: (msg: string) => void,
): Promise<Blob> {
  try {
    return await montarReelsInterno(input, onProgress);
  } catch (e) {
    // O ramo do FFmpeg já mandou o diário com o log; aqui pega o resto — capa
    // que não baixa, duração ilegível, canvas, trilha. Sem isto, metade dos
    // motivos possíveis continuaria invisível para mim.
    const msg = (e as Error)?.message || String(e);
    if (!/ffmpeg/i.test(msg)) await enviarDiario({ onde: "montagem", mensagem: msg });
    throw e;
  }
}

async function montarReelsInterno(
  input: MontagemInput,
  onProgress?: (msg: string) => void,
): Promise<Blob> {
  const videoS = await duracaoDoVideo(input.videoUrl);
  const plano = planejarMontagem(videoS);
  // A legenda acompanha a LOCUÇÃO, não o clipe: sobra de imagem depois da fala
  // não é legenda no ar. E a fala nunca pode passar do clipe — se `speechSeconds`
  // vier maior (medição do MP3 contra um vídeo já aparado), a última legenda
  // ficaria além do fim do filme.
  const falaS = input.falaS && input.falaS > 0 ? Math.min(input.falaS, videoS) : 0;
  const legendas: Legenda[] = falaS > 0 ? montarLegendas(input.script, falaS) : [];

  onProgress?.("Preparando a montagem…");
  const ff = await obterFfmpeg(onProgress);

  const [videoBytes, capaBytes] = await Promise.all([
    bytes(input.videoUrl, "o vídeo"),
    bytes(input.capaUrl, "a capa"),
  ]);
  await ff.writeFile("filme.mp4", videoBytes);
  await ff.writeFile("capa.png", capaBytes);

  let temTrilha = false;
  if (input.trilhaUrl) {
    try {
      await ff.writeFile("trilha.mp3", await bytes(input.trilhaUrl, "a trilha"));
      temTrilha = true;
    } catch (e) {
      // Trilha é enfeite: sem ela o filme sai igual, só sem música.
      console.warn("[montarReels] trilha não carregou:", (e as Error).message);
    }
  }

  onProgress?.("Desenhando a assinatura…");
  const quadros = await desenharAssinatura(plano.quadrosAssinatura, {
    logoDataUrl: input.logoDataUrl,
    contato: input.contato,
    fontFamily: input.fontFamily,
  });
  for (let i = 0; i < quadros.length; i++) {
    await ff.writeFile(`sig${String(i).padStart(4, "0")}.png`, quadros[i]);
  }

  onProgress?.("Escrevendo as legendas…");
  const pngLegendas = legendas.length
    ? await desenharLegendas(legendas, { fontFamily: input.fontFamily })
    : [];
  for (let i = 0; i < pngLegendas.length; i++) {
    await ff.writeFile(`leg${String(i).padStart(2, "0")}.png`, pngLegendas[i]);
  }

  // ── Entradas, na ordem em que o grafo as referencia ──────────────────────
  const args: string[] = [];
  args.push("-loop", "1", "-t", plano.capa.fim.toFixed(3), "-i", "capa.png"); // 0
  args.push("-i", "filme.mp4"); // 1
  args.push("-framerate", String(FPS), "-i", "sig%04d.png"); // 2
  let idx = 3;
  const idxTrilha = temTrilha ? idx++ : -1;
  if (temTrilha) args.push("-i", "trilha.mp3");
  const idxLegendas: number[] = [];
  for (let i = 0; i < pngLegendas.length; i++) {
    idxLegendas.push(idx++);
    args.push("-i", `leg${String(i).padStart(2, "0")}.png`);
  }

  // ── Vídeo ────────────────────────────────────────────────────────────────
  // O clipe do Kling sai 1072x1920; a peça é 1080x1920. `scale` sozinho
  // distorceria 8 px — pouco, mas em rosto humano aparece. Por isso escala
  // preservando proporção e completa com preto (`pad`).
  const escala = `scale=${LARGURA}:${ALTURA}:force_original_aspect_ratio=decrease,pad=${LARGURA}:${ALTURA}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${FPS}`;
  const f: string[] = [];
  f.push(`[0:v]${escala},format=yuv420p[capa]`);
  // `tpad` congela o último quadro pelo tempo da assinatura: é o que sustenta a
  // imagem por baixo durante o fade cruzado.
  f.push(
    `[1:v]${escala},tpad=stop_mode=clone:stop_duration=${(plano.assinatura.fim - plano.filme.fim).toFixed(3)},format=yuv420p[filme]`,
  );
  f.push(`[capa][filme]concat=n=2:v=1:a=0[base]`);

  let vAtual = "base";
  legendas.forEach((l, i) => {
    const prox = `v${i}`;
    f.push(
      `[${vAtual}][${idxLegendas[i]}:v]overlay=0:0:enable='between(t,${l.inicio.toFixed(3)},${l.fim.toFixed(3)})'[${prox}]`,
    );
    vAtual = prox;
  });

  // A assinatura entra deslocada no tempo — `setpts` empurra a sequência de
  // PNGs para o instante em que o fade deve começar.
  f.push(`[2:v]format=rgba,setpts=PTS-STARTPTS+${plano.assinatura.inicio.toFixed(3)}/TB[sig]`);
  f.push(`[${vAtual}][sig]overlay=0:0:eof_action=pass:format=auto,format=yuv420p[vout]`);

  // ── Áudio ────────────────────────────────────────────────────────────────
  const atrasoMs = Math.round(plano.filme.inicio * 1000);
  f.push(`[1:a]adelay=${atrasoMs}|${atrasoMs},apad[loc]`);
  let aOut = "loc";
  if (temTrilha) {
    const fadeInicio = Math.max(0, plano.totalS - TRILHA_FADE_OUT_S).toFixed(3);
    f.push(
      `[${idxTrilha}:a]volume='${curvaDaTrilha(plano)}':eval=frame,afade=t=out:st=${fadeInicio}:d=${TRILHA_FADE_OUT_S}[mus]`,
    );
    // `normalize=0` mantém os volumes que a curva definiu — sem isso o amix
    // divide tudo pelo número de entradas e a mixagem inteira perde sentido.
    f.push(`[loc][mus]amix=inputs=2:duration=longest:normalize=0[aout]`);
    aOut = "aout";
  }

  args.push("-filter_complex", f.join(";"));
  args.push("-map", "[vout]", "-map", `[${aOut}]`);
  args.push("-t", plano.totalS.toFixed(3));
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "26", "-pix_fmt", "yuv420p");
  args.push("-c:a", "aac", "-b:a", "160k", "-ar", "48000");
  args.push("-movflags", "+faststart", "-threads", "0", "final.mp4");

  onProgress?.("Montando o filme…");
  const aoProgresso = ({ progress }: { progress: number }) => {
    const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
    onProgress?.(`Montando o filme… ${pct}%`);
  };
  // ⚠ O MOTIVO REAL DA FALHA VIVE NO LOG DO FFMPEG, NÃO NA EXCEÇÃO.
  // Na primeira tentativa do Ari (10/09) a tela mostrou "erro desconhecido":
  // quando o grafo de filtros não fecha, o ffmpeg.wasm rejeita sem mensagem
  // útil, enquanto o motivo ("Invalid argument", nome de stream que não existe,
  // filtro ausente) já passou pelo log. Sem guardar essas linhas, cada tentativa
  // custa uma ida e volta com o usuário para descobrir o óbvio.
  const ultimasLinhas: string[] = [];
  const aoLog = ({ message }: { message: string }) => {
    ultimasLinhas.push(message);
    if (ultimasLinhas.length > 40) ultimasLinhas.shift();
  };
  ff.on("progress", aoProgresso);
  ff.on("log", aoLog);
  try {
    await ff.exec(args);
  } catch (e) {
    const pista = ultimasLinhas.filter((l) => /error|invalid|no such|unable|failed/i.test(l));
    console.error("[montarReels] FFmpeg falhou. Últimas linhas do log:", ultimasLinhas);
    console.error("[montarReels] grafo de filtros:", f.join(";\n"));
    const detalhe = pista.length ? pista.slice(-3).join(" | ") : (e as Error)?.message;
    // Manda o diário para o servidor — quem usa o app não precisa abrir console
    // nem saber o que é console (ver routes/api/log-montagem.ts).
    await enviarDiario({
      onde: "ffmpeg",
      mensagem: detalhe || String(e),
      log: ultimasLinhas,
      filtros: f.join(";\n"),
      plano: `clipe ${videoS.toFixed(2)}s · total ${plano.totalS.toFixed(2)}s · legendas ${legendas.length} · trilha ${temTrilha ? "sim" : "nao"} · quadros ${quadros.length} · nucleo ${diagnosticoDaCarga()?.fonte || "?"}`,
    });
    throw new Error(detalhe || "o FFmpeg não explicou o motivo");
  } finally {
    ff.off("progress", aoProgresso);
    ff.off("log", aoLog);
  }

  const saida = (await ff.readFile("final.mp4")) as Uint8Array;
  if (!saida || saida.byteLength < 1024) throw new Error("a montagem saiu vazia");

  // Limpeza do sistema de arquivos virtual — sem isto, uma segunda montagem na
  // mesma sessão herda os PNGs da anterior (a sequência sig%04d é lida por
  // padrão de nome, não por lista).
  const limpar = ["filme.mp4", "capa.png", "final.mp4", ...(temTrilha ? ["trilha.mp3"] : [])];
  for (let i = 0; i < quadros.length; i++) limpar.push(`sig${String(i).padStart(4, "0")}.png`);
  for (let i = 0; i < pngLegendas.length; i++) limpar.push(`leg${String(i).padStart(2, "0")}.png`);
  for (const nome of limpar) {
    try {
      await ff.deleteFile(nome);
    } catch {
      /* arquivo já não existe — sem consequência */
    }
  }

  // Cópia para ArrayBuffer comum: o Uint8Array do FFmpeg pode vir apoiado em
  // SharedArrayBuffer, que o construtor de Blob não aceita. Mesmo tratamento já
  // usado em burnTitleIntoVideo.
  const buf = new ArrayBuffer(saida.byteLength);
  new Uint8Array(buf).set(saida);
  return new Blob([buf], { type: "video/mp4" });
}
