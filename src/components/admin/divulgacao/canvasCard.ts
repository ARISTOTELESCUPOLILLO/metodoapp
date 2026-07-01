// Geração do card PNG 1080×1080 — extraído de DivulgacaoTab.tsx (Fase 9.1).
import { BRAND_PRIMARY } from "@/data/brandColors";
import { CARD_INFO, type Plan } from "./types";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line !== "") {
      ctx.fillText(line.trim(), x, cy);
      line = word + " ";
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, cy);
  return cy;
}

export async function generateCard(plan: Plan, heroDesktopUrl: string): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = heroDesktopUrl;
  });

  // Full navy background
  ctx.fillStyle = BRAND_PRIMARY;
  ctx.fillRect(0, 0, 1080, 1080);

  // Draw hero image at TOP (scaled to width 1080, show first portion)
  const aspect = img.naturalWidth / img.naturalHeight;
  const scaledH = 1080 / aspect;
  const imgH = Math.min(400, scaledH);
  const srcH = imgH * (img.naturalHeight / scaledH);
  ctx.drawImage(img, 0, 0, img.naturalWidth, srcH, 0, 0, 1080, imgH);

  // Gradient: transparent → solid navy at bottom of image
  const gradTop = Math.max(0, imgH - 110);
  const grad = ctx.createLinearGradient(0, gradTop, 0, imgH + 70);
  grad.addColorStop(0, "rgba(15,33,63,0)");
  grad.addColorStop(1, BRAND_PRIMARY);
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradTop, 1080, imgH + 70 - gradTop);

  // Text area starts after image + gradient
  const t = imgH + 70;
  const info = CARD_INFO[plan.codigo];
  const titulo = info?.titulo ?? plan.nome.toUpperCase();
  const subtitulo =
    info?.subtitulo ?? "geração de imagem e conteúdo para sua comunicação nas redes sociais.";

  // Orange decorative line
  ctx.fillStyle = "#f97316";
  ctx.fillRect(80, t + 12, 48, 4);

  // Plan code — small, right side
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  ctx.font = 'bold 28px "Inter", Arial, sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(plan.codigo, 1000, t + 40);
  ctx.textAlign = "left";

  // Title — bold, wrapped
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 52px "Inter", Arial, sans-serif';
  const titleEndY = wrapText(ctx, titulo, 80, t + 80, 880, 64);

  // Thin separator
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(80, titleEndY + 24, 920, 1);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = '28px "Inter", Arial, sans-serif';
  const subEndY = wrapText(ctx, subtitulo, 80, titleEndY + 60, 920, 44);

  // Price line
  const priceY = Math.max(subEndY + 60, t + 355);
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 40px "Inter", Arial, sans-serif';
  const priceVal = plan.preco_maximo_brl > 0 ? `R$ ${plan.preco_maximo_brl.toFixed(0)}` : "___";
  ctx.fillText(`Plano Mensal: ${priceVal}`, 80, priceY);

  // Detail
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = '24px "Inter", Arial, sans-serif';
  ctx.fillText("c/ desconto especial para 3 meses", 80, priceY + 50);

  // Trigger download
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `card-${plan.codigo}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
