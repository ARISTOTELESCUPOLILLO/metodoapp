// Os PIXELS da montagem do reels — assinatura e legendas, desenhados no canvas
// e entregues como PNG para o FFmpeg sobrepor.
//
// ⚠ POR QUE CANVAS E NÃO drawtext DO FFMPEG: o FFmpeg do navegador precisaria de
// uma fonte embutida no sistema de arquivos virtual, não tem as fontes do Kit e
// trata acento mal. Desenhar aqui é a MESMA técnica já em produção no título da
// Sinalização (composeReelsTitlePng), e por isso já sabemos que funciona.
//
// ⚠ E O FADE VEM DE DENTRO DO PNG: a transição não usa filtro de
// transição do FFmpeg (que depende de como o núcleo foi compilado e eu não
// tenho como verificar offline). Em vez disso, os primeiros quadros da
// assinatura são desenhados com opacidade crescente — o fade fica assado na
// própria imagem. Uma sobreposição simples basta, e uma sobreposição simples
// existe em qualquer compilação.

import {
  ALTURA,
  FPS,
  LARGURA,
  LOGO_ENTRADA_S,
  RESPIRO_LOGO_TEXTO_PX,
  TEXTO_ATRASO_S,
  TEXTO_ENTRADA_S,
  TRANSICAO_S,
  type Legenda,
} from "../core/montagemReels";

/** Suavização de entrada — rápido no começo, assentando no fim. */
function easeOut(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return 1 - Math.pow(1 - t, 3);
}

function novoCanvas(): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = LARGURA;
  c.height = ALTURA;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas 2d indisponível");
  return { c, ctx };
}

async function paraPngBytes(c: HTMLCanvasElement): Promise<Uint8Array> {
  const blob: Blob = await new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob vazio"))), "image/png"),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("falha ao carregar imagem da montagem"));
    img.src = src;
  });
}

/**
 * Ícone do WhatsApp desenhado à mão — balão com o fone dentro.
 *
 * ⚠ NÃO é o arquivo oficial da marca: é a nossa aproximação da silhueta, feita
 * para não depender de um asset que o app não tem. Reconhecível pelo formato, e
 * trocável por um SVG oficial numa linha quando o Ari mandar o arquivo.
 */
function desenharIconeWhatsapp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  cor: string,
) {
  ctx.save();
  ctx.fillStyle = cor;
  // Balão: círculo com a "ponta" no canto inferior esquerdo.
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.5, false);
  ctx.lineTo(cx - r * 1.15, cy + r * 1.15);
  ctx.closePath();
  ctx.fill();
  // Fone estilizado, vazado no balão.
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = r * 0.26;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.34, cy - r * 0.38);
  ctx.quadraticCurveTo(cx - r * 0.5, cy - r * 0.02, cx - r * 0.18, cy + r * 0.24);
  ctx.quadraticCurveTo(cx + r * 0.12, cy + r * 0.5, cx + r * 0.42, cy + r * 0.34);
  ctx.stroke();
  ctx.restore();
}

export interface AssinaturaOpts {
  /** Logo do Kit (data URL). Sem ela a assinatura fica só com o contato. */
  logoDataUrl?: string;
  /** Texto do contato — ex.: "(66) 99988-1627". */
  contato: string;
  /** Cor do texto e do ícone sobre o preto. */
  cor?: string;
  fontFamily?: string;
}

/**
 * Desenha a assinatura quadro a quadro.
 *
 * Devolve `quadros` PNGs, na ordem. Os primeiros TRANSICAO_S segundos vêm com
 * opacidade crescente (o fade cruzado); depois a arte fica cheia.
 *
 * Movimento, decidido com o Ari:
 *  · a MARCA chega por APROXIMAÇÃO SUAVE e assenta em 0,7 s — nada se mexe
 *    depois disso, porque movimento até o último quadro dá sensação de loop, e
 *    loop faz o vídeo parecer que não terminou;
 *  · o CONTATO desliza de baixo para cima, começando 0,2 s DEPOIS que a marca
 *    assentou.
 */
export async function desenharAssinatura(
  quadros: number,
  opts: AssinaturaOpts,
): Promise<Uint8Array[]> {
  const cor = opts.cor || "#ffffff";
  const fonte = opts.fontFamily || "Inter";
  const logo = opts.logoDataUrl ? await carregarImagem(opts.logoDataUrl).catch(() => null) : null;

  // ⚠ A LOGO CABE NUMA CAIXA, NÃO NUMA LARGURA (11/09/2026, Ari).
  //
  // A primeira versão dimensionava só pela LARGURA: 46% do quadro. Isso serve a
  // logomarca deitada, mas numa QUADRADA — e redonda conta como quadrada — a
  // mesma largura vira a mesma altura, e a marca fica enorme no vertical. O Ari
  // viu exatamente isso no filme montado.
  //
  // Agora ela é encaixada numa caixa com teto de largura E teto de altura, e
  // quem manda é o lado que apertar primeiro:
  //   · deitada  → o teto de LARGURA manda, a altura sobra;
  //   · quadrada → o teto de ALTURA manda, e ela encolhe sozinha.
  // Os 41% já são os 46% de antes com a redução de 10% que ele pediu.
  const maxLarg = LARGURA * 0.41;
  const maxAlt = ALTURA * 0.19;
  const proporcao = logo ? logo.naturalWidth / logo.naturalHeight : 1;
  const escalaCaixa = Math.min(maxLarg, maxAlt * proporcao);
  const logoLarg = Math.round(escalaCaixa);
  const logoAlt = logo ? Math.round(logoLarg / proporcao) : 0;

  const fonteContato = Math.round(LARGURA * 0.052);
  const raioIcone = fonteContato * 0.55;

  // ⚠ O RESPIRO É MEDIDO ATÉ O TOPO DO ELEMENTO MAIS ALTO, não até a linha das
  // letras. No primeiro filme montado o contato saiu colado na marca mesmo com
  // 30 px declarados: o ÍCONE sobe acima das letras e comia o respiro sozinho.
  // Quem olha vê a distância até o ícone, não até o "(" do telefone.
  const alturaAcimaDaLinha = Math.max(raioIcone + fonteContato * 0.3, fonteContato * 0.75);
  const alturaBloco = logoAlt + RESPIRO_LOGO_TEXTO_PX + alturaAcimaDaLinha + fonteContato * 0.25;
  const topoLogo = Math.round((ALTURA - alturaBloco) / 2);
  const baseTexto = topoLogo + logoAlt + RESPIRO_LOGO_TEXTO_PX + alturaAcimaDaLinha;

  const saida: Uint8Array[] = [];
  for (let i = 0; i < quadros; i++) {
    const t = i / FPS;
    const { c, ctx } = novoCanvas();

    // Opacidade geral: é ela que faz o fade cruzado com o fim do filme.
    const opacidade = TRANSICAO_S > 0 ? Math.min(1, t / TRANSICAO_S) : 1;
    ctx.globalAlpha = opacidade;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    // Tempo contado a partir do momento em que a assinatura fica opaca — é
    // quando o filme sumiu e o movimento passa a ser visto de fato.
    const tCena = t - TRANSICAO_S;

    if (logo) {
      // Aproximação: entra levemente menor e cresce até o tamanho final.
      const p = easeOut(tCena / LOGO_ENTRADA_S);
      const escala = 0.88 + 0.12 * p;
      const larg = logoLarg * escala;
      const alt = logoAlt * escala;
      ctx.save();
      ctx.globalAlpha = opacidade * Math.min(1, Math.max(0, p * 1.4));
      ctx.drawImage(logo, (LARGURA - larg) / 2, topoLogo + (logoAlt - alt) / 2, larg, alt);
      ctx.restore();
    }

    if (opts.contato) {
      const tTexto = tCena - LOGO_ENTRADA_S - TEXTO_ATRASO_S;
      const p = easeOut(tTexto / TEXTO_ENTRADA_S);
      if (p > 0) {
        const desloc = (1 - p) * fonteContato * 1.2; // desliza de baixo
        ctx.save();
        ctx.globalAlpha = opacidade * p;
        ctx.font = `600 ${fonteContato}px ${fonte}, system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        const larguraTexto = ctx.measureText(opts.contato).width;
        const espacoIcone = raioIcone * 2 + fonteContato * 0.35;
        const xInicio = (LARGURA - (larguraTexto + espacoIcone)) / 2;
        desenharIconeWhatsapp(
          ctx,
          xInicio + raioIcone,
          baseTexto + desloc - fonteContato * 0.3,
          raioIcone,
          cor,
        );
        ctx.fillStyle = cor;
        ctx.fillText(opts.contato, xInicio + espacoIcone, baseTexto + desloc);
        ctx.restore();
      }
    }

    saida.push(await paraPngBytes(c));
  }
  return saida;
}

/**
 * Desenha uma legenda por quadro-imagem, transparente e do tamanho da peça.
 *
 * Sai em PNG de tela cheia de propósito: assim o FFmpeg sobrepõe em 0:0 e não
 * precisa fazer conta de posição — a posição já está no desenho. Legenda com
 * tarja atrás para sobreviver a qualquer fundo de vídeo.
 */
export async function desenharLegendas(
  legendas: Legenda[],
  opts?: { fontFamily?: string; cor?: string },
): Promise<Uint8Array[]> {
  const fonte = opts?.fontFamily || "Inter";
  const cor = opts?.cor || "#ffffff";
  const corpo = Math.round(LARGURA * 0.05);
  // Rodapé alto o bastante para não cair na área de botões do Instagram.
  const baseY = Math.round(ALTURA * 0.82);
  const maxLarg = Math.round(LARGURA * 0.82);

  const saida: Uint8Array[] = [];
  for (const l of legendas) {
    const { c, ctx } = novoCanvas();
    ctx.font = `600 ${corpo}px ${fonte}, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // Quebra em linhas dentro da largura útil.
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of l.texto.split(/\s+/)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (ctx.measureText(tentativa).width > maxLarg && atual) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = tentativa;
      }
    }
    if (atual) linhas.push(atual);

    const alturaLinha = corpo * 1.32;
    const alturaBloco = linhas.length * alturaLinha;
    const topo = baseY - alturaBloco;

    // Tarja: mantém a legenda legível sobre qualquer cena.
    // Caixa justa: com a legenda repartida em UMA linha, ela so precisa dar
    // contraste ao texto — nao ser um painel no meio da tela.
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    const pad = corpo * 0.34;
    let maiorLinha = 0;
    for (const linha of linhas) maiorLinha = Math.max(maiorLinha, ctx.measureText(linha).width);
    const tarjaLarg = Math.min(LARGURA - 40, maiorLinha + pad * 2);
    ctx.beginPath();
    const x0 = (LARGURA - tarjaLarg) / 2;
    const y0 = topo - pad * 0.7;
    const h = alturaBloco + pad * 1.2;
    const r = corpo * 0.32;
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + tarjaLarg, y0, x0 + tarjaLarg, y0 + h, r);
    ctx.arcTo(x0 + tarjaLarg, y0 + h, x0, y0 + h, r);
    ctx.arcTo(x0, y0 + h, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + tarjaLarg, y0, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = cor;
    linhas.forEach((linha, i) => {
      ctx.fillText(linha, LARGURA / 2, topo + alturaLinha * (i + 0.8));
    });

    saida.push(await paraPngBytes(c));
  }
  return saida;
}
