// CARREGADOR DO FFMPEG — uma instância só, e com plano B.
//
// ⚠ POR QUE ISTO EXISTE (11/09/2026): a montagem do Ari falhou com
// "failed to import ffmpeg-core.js". Testado daqui, o CDN respondia 200 — o
// bloqueio era no navegador dele. Bloqueador de anúncio, antivírus, proxy ou
// DNS corporativo derrubam unpkg com frequência, e o app inteiro dependia
// desse único endereço para QUALQUER operação de vídeo: o corte da sobra da
// fala, a queima do título da Sinalização e a montagem do filme. Um domínio de
// terceiro fora do ar = três recursos mortos, sem explicação na tela.
//
// Duas mudanças:
//
//  1. O ARQUIVO .js AGORA É NOSSO. São 109 KB servidos junto com o app, na
//     mesma origem — sem CORS, sem CDN, sem bloqueador no caminho. É justamente
//     o arquivo que falhou.
//  2. O .wasm CONTINUA VINDO DE FORA, com dois endereços em cadeia. Ele tem
//     30,7 MB descompactados e o limite de arquivo estático do Cloudflare é
//     25 MiB — não cabe. Então: jsdelivr primeiro, unpkg depois.
//
// E UMA INSTÂNCIA SÓ para o app inteiro: antes, o corte e a montagem tinham
// cada um a sua, o que significava baixar 30 MB duas vezes na mesma sessão.

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const VERSAO = "0.12.10";

/**
 * Fontes em ordem de preferência. A primeira usa o nosso próprio arquivo para o
 * núcleo; as seguintes existem para o caso de alguém apagar o asset ou de um
 * deploy sair sem ele.
 */
const FONTES = [
  {
    nome: "proprio+jsdelivr",
    core: "/ffmpeg/ffmpeg-core.js",
    wasm: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSAO}/dist/umd/ffmpeg-core.wasm`,
  },
  {
    nome: "proprio+unpkg",
    core: "/ffmpeg/ffmpeg-core.js",
    wasm: `https://unpkg.com/@ffmpeg/core@${VERSAO}/dist/umd/ffmpeg-core.wasm`,
  },
  {
    nome: "jsdelivr",
    core: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSAO}/dist/umd/ffmpeg-core.js`,
    wasm: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSAO}/dist/umd/ffmpeg-core.wasm`,
  },
  {
    nome: "unpkg",
    core: `https://unpkg.com/@ffmpeg/core@${VERSAO}/dist/umd/ffmpeg-core.js`,
    wasm: `https://unpkg.com/@ffmpeg/core@${VERSAO}/dist/umd/ffmpeg-core.wasm`,
  },
];

let instancia: FFmpeg | null = null;
let carregando: Promise<FFmpeg> | null = null;

/**
 * Busca o núcleo e CONFERE que é mesmo ele.
 *
 * ⚠ A conferência não é preciosismo: quando um proxy, um portal de wi-fi ou um
 * bloqueador intercepta a requisição, a resposta volta com status 200 e um HTML
 * no corpo. O blob então tem o tamanho certo, o import "funciona", e o erro só
 * aparece adiante como "createFFmpegCore is not defined" — bem longe da causa.
 */
async function buscarNucleo(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const texto = await r.text();
  if (!texto.includes("createFFmpegCore")) {
    throw new Error("o arquivo baixado não é o núcleo do FFmpeg (resposta interceptada?)");
  }
  return URL.createObjectURL(new Blob([texto], { type: "text/javascript" }));
}

export interface ResultadoCarga {
  ff: FFmpeg;
  /** Qual fonte funcionou — vai para o diário quando algo dá errado depois. */
  fonte: string;
  /** O que falhou antes de dar certo, se falhou. */
  tentativas: string[];
}

let ultimaCarga: ResultadoCarga | null = null;

/** Como o núcleo foi carregado nesta sessão — só para diagnóstico. */
export function diagnosticoDaCarga(): { fonte: string; tentativas: string[] } | null {
  return ultimaCarga ? { fonte: ultimaCarga.fonte, tentativas: ultimaCarga.tentativas } : null;
}

/**
 * Devolve o FFmpeg pronto. Compartilhado por todo o app — corte da sobra,
 * queima de título e montagem usam a MESMA instância.
 */
export async function obterFfmpeg(onProgress?: (msg: string) => void): Promise<FFmpeg> {
  if (instancia) return instancia;
  if (carregando) return carregando;

  carregando = (async () => {
    const tentativas: string[] = [];
    for (const fonte of FONTES) {
      const ff = new FFmpeg();
      try {
        onProgress?.("Carregando processador de vídeo…");
        const coreURL = await buscarNucleo(fonte.core);
        const wasmURL = await toBlobURL(fonte.wasm, "application/wasm");
        await ff.load({ coreURL, wasmURL });
        instancia = ff;
        ultimaCarga = { ff, fonte: fonte.nome, tentativas };
        if (tentativas.length) {
          console.warn("[ffmpeg] carregou por", fonte.nome, "— falhas antes:", tentativas);
        }
        return ff;
      } catch (e) {
        tentativas.push(`${fonte.nome}: ${(e as Error)?.message || "erro"}`);
        // Instância que falhou não se reaproveita: o worker dela já morreu.
        try {
          ff.terminate();
        } catch {
          /* nada a fazer */
        }
      }
    }
    carregando = null;
    throw new Error(`não foi possível carregar o processador de vídeo — ${tentativas.join(" | ")}`);
  })();

  return carregando;
}
