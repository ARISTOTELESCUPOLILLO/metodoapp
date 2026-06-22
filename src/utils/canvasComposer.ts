import JSZip from "jszip";
import { BrandKit, CarouselCard, FeedItem, MoodCode } from "../types";

// Saída final 1080x1350 (feed Instagram 4:5) com 110px de respiro uniforme.
// A imagem original 1024x1536 do gpt-image-1 é recortada via cover; o prompt
// já instrui o modelo a manter título/texto na zona segura central.
const FEED_W = 1080;
const FEED_H = 1350;
const PAD = 110;
const LOGO_MAX_W = 288;
const LOGO_MAX_H = 108;

// Reels 9:16 (1080x1920) — respiro maior (150px) para a logo no canto inferior direito.
const REELS_W = 1080;
const REELS_H = 1920;
const REELS_PAD = 150;
const REELS_LOGO_MAX_W = 336;
const REELS_LOGO_MAX_H = 132;

// Calcula luminância relativa WCAG (0..1) a partir de hex #rrggbb.
function relativeLuminance(hex: string): number {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

// Contraste WCAG entre cor e preto puro (fundo da faixa central do reels).
function contrastVsBlack(hex: string): number {
  const L = relativeLuminance(hex);
  return (L + 0.05) / 0.05;
}

// Escolhe a cor do kit que mais "salta" sobre fundo escuro.
// Prioridade em empate: accent > primary > secondary.
// Retorna { color, useOutline } — outline ativa fallback branco-com-contorno
// quando nenhuma cor do kit atinge contraste mínimo legível (4.5).
function pickStandoutColor(kit: BrandKit): { color: string; outline?: string } {
  const candidates = [
    { hex: kit.accentColor, prio: 3 },
    { hex: kit.primaryColor, prio: 2 },
    { hex: kit.secondaryColor, prio: 1 },
  ].filter((c): c is { hex: string; prio: number } => !!c.hex && /^#?[a-f0-9]{6}$/i.test(c.hex));

  let best: { hex: string; contrast: number; prio: number } | null = null;
  for (const c of candidates) {
    const contrast = contrastVsBlack(c.hex);
    if (
      !best ||
      contrast > best.contrast + 0.001 ||
      (Math.abs(contrast - best.contrast) <= 0.001 && c.prio > best.prio)
    ) {
      best = { hex: c.hex, contrast, prio: c.prio };
    }
  }

  if (!best || best.contrast < 4.5) {
    return { color: "#ffffff", outline: kit.primaryColor || undefined };
  }
  return { color: best.hex.startsWith("#") ? best.hex : `#${best.hex}` };
}

// Posicionamento do título no overlay canvas por mood (para burnTitleIntoVideo).
// Alinha e desloca verticalmente conforme a gramática visual de cada mood.
interface MoodTypographyConfig {
  align: CanvasTextAlign;
  xOffset: (w: number, pad: number) => number;
  verticalBias: number; // fração da altura total — positivo desce, negativo sobe
}

const MOOD_TYPOGRAPHY: Record<string, MoodTypographyConfig> = {
  "OP-01": { align: "left", xOffset: (_, p) => p, verticalBias: 0.08 },
  "OP-02": { align: "center", xOffset: (w) => w / 2, verticalBias: -0.1 },
  "OP-03": { align: "left", xOffset: (_, p) => p, verticalBias: 0.12 },
  "OP-04": { align: "left", xOffset: (_, p) => p, verticalBias: 0.06 },
  "OP-05": { align: "right", xOffset: (w, p) => w - p, verticalBias: 0.1 },
  "OP-06": { align: "center", xOffset: (w) => w / 2, verticalBias: -0.06 },
};

function getMoodTypographyConfig(mood?: MoodCode): MoodTypographyConfig {
  return (
    (mood && MOOD_TYPOGRAPHY[mood]) || {
      align: "center",
      xOffset: (w) => w / 2,
      verticalBias: 0.07,
    }
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fillCanvas(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = img.width * scale;
  const sh = img.height * scale;
  ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
}

// Calcula a coordenada (x, y) para desenhar a logo conforme a posição escolhida no kit.
// Posições disponíveis: 'bottom-right' (padrão), 'top-center', 'bottom-center'.
function logoCoords(
  position: BrandKit["logoPosition"],
  w: number,
  h: number,
  pad: number,
  lw: number,
  lh: number,
): { x: number; y: number } {
  const pos = position || "bottom-right";
  if (pos === "top-center") return { x: (w - lw) / 2, y: pad };
  if (pos === "bottom-center") return { x: (w - lw) / 2, y: h - pad - lh };
  return { x: w - pad - lw, y: h - pad - lh };
}

// Aplica APENAS a logomarca, respeitando posição escolhida no Kit de Marca e o respiro.
async function drawLogoOnly(
  ctx: CanvasRenderingContext2D,
  kit: BrandKit,
  w: number,
  h: number,
  pad: number,
  maxW = LOGO_MAX_W,
  maxH = LOGO_MAX_H,
) {
  if (!kit.logoDataUrl) return;
  try {
    const logo = await loadImage(kit.logoDataUrl);
    const scale = Math.min(maxW / logo.width, maxH / logo.height);
    const lw = logo.width * scale;
    const lh = logo.height * scale;
    const { x, y } = logoCoords(kit.logoPosition, w, h, pad, lw, lh);
    ctx.drawImage(logo, x, y, lw, lh);
  } catch {
    // logo indisponível: deixa a imagem limpa
  }
}

export async function composeFeedPng(
  kit: BrandKit,
  _item: FeedItem,
  baseImage?: string,
  opts?: { skipLogo?: boolean },
): Promise<string> {
  const w = FEED_W;
  const h = FEED_H;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = kit.primaryColor || "#123a63";
  ctx.fillRect(0, 0, w, h);

  if (baseImage) {
    try {
      const img = await loadImage(baseImage);
      fillCanvas(ctx, img, w, h);
    } catch (e) {
      console.error("composeFeedPng: falha ao carregar imagem base, usando fundo sólido", e);
    }
  }

  if (!opts?.skipLogo) await drawLogoOnly(ctx, kit, w, h, PAD);
  return canvas.toDataURL("image/png");
}

export async function composeFinalPng(
  kit: BrandKit,
  _item: FeedItem,
  baseImage?: string,
): Promise<string> {
  const w = FEED_W;
  const h = FEED_H;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = kit.primaryColor || "#123a63";
  ctx.fillRect(0, 0, w, h);

  if (baseImage) {
    try {
      const img = await loadImage(baseImage);
      fillCanvas(ctx, img, w, h);
    } catch (e) {
      console.error("composeFinalPng: falha ao carregar imagem base, usando fundo sólido", e);
    }
  }

  await drawLogoOnly(ctx, kit, w, h, PAD);
  return canvas.toDataURL("image/png");
}

export async function composeReelsPng(kit: BrandKit, baseImage?: string): Promise<string> {
  const w = REELS_W;
  const h = REELS_H;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = kit.primaryColor || "#123a63";
  ctx.fillRect(0, 0, w, h);

  if (baseImage) {
    try {
      const img = await loadImage(baseImage);
      fillCanvas(ctx, img, w, h);
    } catch (e) {
      console.error("composeReelsPng: falha ao carregar imagem base, usando fundo sólido", e);
    }
  }

  // Logo na posição escolhida no Kit (default: canto inferior direito) com respiro de 150px.
  await drawLogoOnly(ctx, kit, w, h, REELS_PAD, REELS_LOGO_MAX_W, REELS_LOGO_MAX_H);

  return canvas.toDataURL("image/png");
}

// Gera PNG 1080x1920 TRANSPARENTE com o título do reels centralizado.
// Usado como overlay nos primeiros 0,4s do vídeo (capa do reels no Instagram).
// Fonte = kit.fontPair (helvética ou serifada conforme a escolha do kit).
// Texto branco com sombra preta forte → legível sobre qualquer foto.
// Respiro lateral de 150px, quebra de linha automática, no máximo 4 linhas.
export async function composeReelsTitlePng(
  kit: BrandKit,
  title: string,
  baseImage?: string,
  mood?: MoodCode,
): Promise<Blob> {
  const w = REELS_W;
  const h = REELS_H;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Fundo: imagem do reels full-bleed (mesma vibe da capa final).
  ctx.fillStyle = kit.primaryColor || "#123a63";
  ctx.fillRect(0, 0, w, h);
  if (baseImage) {
    try {
      const img = await loadImage(baseImage);
      fillCanvas(ctx, img, w, h);
    } catch (e) {
      console.error("composeReelsTitlePng: falha ao carregar imagem base, usando fundo sólido", e);
    }
  }
  // Faixa escura translúcida — desce 1 linha abaixo do centro pra acompanhar
  // o título (que também desce). Usa lineHeight aproximado pra deslocar.
  const approxLineHeight = Math.round(126 * 1.15);
  const bandH = Math.round(h * 0.45);
  const bandY = Math.round((h - bandH) / 2 + approxLineHeight);
  const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.5, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY, w, bandH);

  const maxTextWidth = w - REELS_PAD * 2;
  const fontFamily = kit.fontPair || "Inter";

  // Encontra o maior tamanho de fonte que cabe em até 4 linhas dentro do respiro.
  const wrap = (size: number): string[] => {
    ctx.font = `700 ${size}px "${fontFamily}", sans-serif`;
    const words = title.trim().split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const tentative = current ? current + " " + word : word;
      if (ctx.measureText(tentative).width <= maxTextWidth) {
        current = tentative;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  // Lettering 10% menor que antes (140→126, mín 48→44).
  let fontSize = 126;
  let lines = wrap(fontSize);
  while (
    (lines.length > 4 || lines.some((l) => ctx.measureText(l).width > maxTextWidth)) &&
    fontSize > 44
  ) {
    fontSize -= 6;
    lines = wrap(fontSize);
  }

  const moodCfg = getMoodTypographyConfig(mood);
  const textX = moodCfg.xOffset(w, REELS_PAD);

  const lineHeight = fontSize * 1.15;
  const totalHeight = lineHeight * lines.length;
  // Posição vertical: cada mood tem um bias próprio (fração da altura).
  // O bias 0.07 (default) corresponde ao comportamento anterior (1 lineHeight abaixo do centro).
  const startY = (h - totalHeight) / 2 + fontSize * 0.85 + h * moodCfg.verticalBias;

  // Cor do título vinda do kit (a que mais contrasta com fundo escuro).
  const { color: titleColor, outline } = pickStandoutColor(kit);

  ctx.font = `700 ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textAlign = moodCfg.align;
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    if (outline) {
      // Fallback: branco com contorno fino na primaryColor pra assinar a marca.
      ctx.lineWidth = Math.max(2, fontSize * 0.04);
      ctx.strokeStyle = outline;
      ctx.strokeText(line, textX, y);
    }
    ctx.fillStyle = titleColor;
    ctx.fillText(line, textX, y);
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))), "image/png");
  });
}

export async function composeCarouselZip(
  kit: BrandKit,
  cards: CarouselCard[],
  baseImages: string[] = [],
): Promise<Blob> {
  const zip = new JSZip();
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const item: FeedItem = {
      dia: i + 1,
      formato: "Carrossel",
      titulo: card?.titulo || `Card ${i + 1}`,
      texto: card?.texto || "",
      legenda: "",
      imagem: card?.imagePrompt || "",
    };
    const dataUrl = await composeFeedPng(kit, item, baseImages[i]);
    const base64 = dataUrl.split(",")[1];
    zip.file(`card-${i + 1}.png`, base64, { base64: true });
  }
  return zip.generateAsync({ type: "blob" });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
