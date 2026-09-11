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
//  1. O ARQUIVO .js AGORA É NOSSO, E É O BUILD ESM. São 109 KB servidos junto
//     com o app, na mesma origem. ⚠ O build TEM que ser ESM: o worker da
//     biblioteca nasce como módulo, e worker de módulo não tem importScripts —
//     ela importa o núcleo e lê o export default, que só o ESM tem.
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
    wasm: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSAO}/dist/esm/ffmpeg-core.wasm`,
  },
  {
    nome: "proprio+unpkg",
    core: "/ffmpeg/ffmpeg-core.js",
    wasm: `https://unpkg.com/@ffmpeg/core@${VERSAO}/dist/esm/ffmpeg-core.wasm`,
  },
  {
    nome: "jsdelivr",
    core: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSAO}/dist/esm/ffmpeg-core.js`,
    wasm: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSAO}/dist/esm/ffmpeg-core.wasm`,
  },
  {
    nome: "unpkg",
    core: `https://unpkg.com/@ffmpeg/core@${VERSAO}/dist/esm/ffmpeg-core.js`,
    wasm: `https://unpkg.com/@ffmpeg/core@${VERSAO}/dist/esm/ffmpeg-core.wasm`,
  },
];

let instancia: FFmpeg | null = null;
let carregando: Promise<FFmpeg> | null = null;

/**
 * Descreve QUALQUER coisa que tenha sido lançada.
 *
 * ⚠ Nem tudo que se lança é um Error com mensagem. Na primeira tentativa do Ari,
 * as quatro fontes falharam e todas apareceram como "erro" — porque eu estava
 * lendo só `.message`, e o que vinha não tinha mensagem. Perder a identidade do
 * erro é perder a única pista que existe.
 */
function descrever(e: unknown): string {
  if (e == null) return "lançou nada (undefined/null)";
  if (typeof e === "string") return e;
  const err = e as { name?: string; message?: string; type?: string };
  const partes = [err.name, err.message, err.type].filter(Boolean);
  if (partes.length) return partes.join(": ");
  try {
    const j = JSON.stringify(e);
    if (j && j !== "{}") return j.slice(0, 200);
  } catch {
    /* objeto não serializável */
  }
  return Object.prototype.toString.call(e);
}

/**
 * AUTOEXAME — descobre QUAL capacidade do navegador está faltando.
 *
 * Quando as quatro fontes falham do mesmo jeito, o problema não é a rede: é algo
 * comum às quatro. Este exame separa os suspeitos um a um, para a próxima
 * resposta ser um diagnóstico e não outro palpite. Roda só quando tudo já falhou.
 */
export async function examinarAmbiente(): Promise<string[]> {
  const achados: string[] = [];
  const testar = async (nome: string, fn: () => Promise<unknown> | unknown) => {
    try {
      await fn();
      achados.push(`${nome}: ok`);
    } catch (e) {
      achados.push(`${nome}: FALHOU (${descrever(e)})`);
    }
  };

  achados.push(`navegador: ${navigator.userAgent.slice(0, 160)}`);
  achados.push(
    `isolamento: ${typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : "?"}`,
  );
  achados.push(`SharedArrayBuffer: ${typeof SharedArrayBuffer !== "undefined"}`);
  achados.push(`WebAssembly: ${typeof WebAssembly !== "undefined"}`);

  // 1. Criar um Worker a partir de blob — extensão de privacidade costuma barrar.
  await testar("worker de blob", async () => {
    const url = URL.createObjectURL(new Blob(["self.postMessage(1)"], { type: "text/javascript" }));
    const w = new Worker(url);
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error("sem resposta em 3 s")), 3000);
      w.onmessage = () => {
        clearTimeout(t);
        res();
      };
      w.onerror = (ev) => {
        clearTimeout(t);
        rej(new Error(ev.message || "erro no worker"));
      };
    });
    w.terminate();
    URL.revokeObjectURL(url);
  });

  // 2. Importar o núcleo DENTRO de um worker de MÓDULO — o passo exato da lib.
  //
  // ⚠ A primeira versão deste teste criava um worker CLÁSSICO e usava
  // `importScripts`. Ele dizia "ok" enquanto o caminho real falhava, porque em
  // worker clássico o UMD carrega sem problema. Um exame que não reproduz a
  // condição real é pior que exame nenhum: ele inocenta o culpado.
  await testar("importar núcleo em worker de módulo", async () => {
    const alvo = new URL("/ffmpeg/ffmpeg-core.js", location.origin).href;
    const codigo = `try{ const m = await import(${JSON.stringify(alvo)}); self.postMessage(typeof m.default); }catch(e){ self.postMessage("erro: "+(e&&e.message||e)); }`;
    const url = URL.createObjectURL(new Blob([codigo], { type: "text/javascript" }));
    const w = new Worker(url, { type: "module" });
    const r = await new Promise<string>((res, rej) => {
      const t = setTimeout(() => rej(new Error("sem resposta em 8 s")), 8000);
      w.onmessage = (ev) => {
        clearTimeout(t);
        res(String(ev.data));
      };
      w.onerror = (ev) => {
        clearTimeout(t);
        rej(new Error(ev.message || "erro no worker"));
      };
    });
    w.terminate();
    URL.revokeObjectURL(url);
    if (r !== "function") throw new Error(`o default do núcleo veio como "${r}"`);
  });

  // 3. Compilar um WebAssembly mínimo (módulo vazio válido).
  await testar("WebAssembly", async () => {
    const vazio = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
    await WebAssembly.instantiate(vazio);
  });

  // 4. Alcançar o núcleo próprio e o wasm do CDN.
  await testar("baixar núcleo próprio", async () => {
    const r = await fetch("/ffmpeg/ffmpeg-core.js");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const t = await r.text();
    if (!t.includes("createFFmpegCore")) throw new Error("conteúdo não é o núcleo");
  });
  await testar("alcançar o wasm (jsdelivr)", async () => {
    const r = await fetch(FONTES[0].wasm, { method: "GET", headers: { Range: "bytes=0-1023" } });
    if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status}`);
  });

  return achados;
}

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
  // ⚠ TEM QUE SER O BUILD ESM, E ESTA LINHA É A QUE GARANTE.
  // O worker da biblioteca é `type: "module"`, e em worker de módulo não existe
  // `importScripts`. Ela cai no plano B — `import()` — e lê o `.default`. O
  // build UMD não exporta nada como módulo: `import()` devolve `{}`, o default
  // vem `undefined` e sai "failed to import ffmpeg-core.js". Foi exatamente
  // isso que travou o Ari em 11/09/2026, nas quatro fontes de uma vez, porque
  // as quatro apontavam para /umd/.
  if (!/export\s+default/.test(texto)) {
    throw new Error("o núcleo baixado é UMD, e o worker de módulo precisa do build ESM");
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
        tentativas.push(`${fonte.nome}: ${descrever(e)}`);
        // Instância que falhou não se reaproveita: o worker dela já morreu.
        try {
          ff.terminate();
        } catch {
          /* nada a fazer */
        }
      }
    }
    carregando = null;
    // Tudo falhou: o autoexame diz QUAL capacidade está faltando, e o resultado
    // vai junto no erro para chegar ao diário sem depender do console.
    const exame = await examinarAmbiente().catch(() => ["autoexame falhou"]);
    console.error("[ffmpeg] autoexame do ambiente:", exame);
    throw new Error(
      `não foi possível carregar o processador de vídeo — ${tentativas.join(" | ")} :: EXAME ${exame.join(" | ")}`,
    );
  })();

  return carregando;
}
