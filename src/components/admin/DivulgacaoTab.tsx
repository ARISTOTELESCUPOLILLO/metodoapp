import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroDesktopUrl from "@/assets/lp-hero-desktop.png";

interface Plan {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  preco_maximo_brl: number;
}

const CARD_INFO: Record<string, { titulo: string; subtitulo: string }> = {
  EX01: {
    titulo: "CONHEÇA O MÉTODO OP - 3 POSTAGENS",
    subtitulo: "Criação de uma sequência com conteúdo e imagem pronta para postar no Instagram.",
  },
  PU2: {
    titulo: "DUAS POSTAGENS PARA VOCÊ TESTAR",
    subtitulo: "Passo a passo que traz facilidade e qualidade.",
  },
  PU4: {
    titulo: "QUATRO IDEIAS PARA MOVIMENTAR O FEED",
    subtitulo:
      "Conteúdos rápidos para variar temas, reforçar presença e manter sua marca em circulação.",
  },
  PU8: {
    titulo: "OITO POSTAGENS PARA DAR CORPO À PRESENÇA",
    subtitulo:
      "Mais fôlego para testar abordagens, organizar mensagens e deixar o Instagram mais vivo.",
  },
  S3V: {
    titulo: "TRÊS SEQUÊNCIAS VISUAIS COM COMEÇO, MEIO E AÇÃO",
    subtitulo:
      "Conteúdos conectados para apresentar ideias, fortalecer confiança e conduzir o público.",
  },
  S3C: {
    titulo: "TRÊS SEQUÊNCIAS COM MOVIMENTO E RITMO",
    subtitulo:
      "Posts, carrosséis e reels para transformar uma ideia em experiência mais envolvente.",
  },
  S6V: {
    titulo: "SEIS SEQUÊNCIAS PARA ORGANIZAR A COMUNICAÇÃO",
    subtitulo:
      "Um percurso visual mais completo para trabalhar clareza, confiança, autoridade e ação.",
  },
  S6C: {
    titulo: "SEIS SEQUÊNCIAS COM FORÇA DE CAMPANHA",
    subtitulo: "Conteúdo visual e reels para ampliar percepção, ritmo e impacto da comunicação.",
  },
  S9V: {
    titulo: "NOVE PASSOS VISUAIS PARA CONSTRUIR DECISÃO",
    subtitulo:
      "Uma jornada de conteúdo para educar, aproximar, reforçar valor e estimular o próximo passo.",
  },
  S9C: {
    titulo: "NOVE PASSOS COM IMAGEM, MOVIMENTO E INTENÇÃO",
    subtitulo: "Uma experiência completa para transformar atenção em interesse, confiança e ação.",
  },
};

const USO_NORMAL: Record<string, { imgs: number; renders: number }> = {
  EX01: { imgs: 7, renders: 0 },
  PU2: { imgs: 2, renders: 0 },
  PU4: { imgs: 4, renders: 0 },
  PU8: { imgs: 8, renders: 0 },
  S3V: { imgs: 28, renders: 0 },
  S3C: { imgs: 32, renders: 4 },
  S6V: { imgs: 56, renders: 0 },
  S6C: { imgs: 64, renders: 8 },
  S9V: { imgs: 42, renders: 0 },
  S9C: { imgs: 48, renders: 6 },
};

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

async function generateCard(plan: Plan): Promise<void> {
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
  ctx.fillStyle = "#0f213f";
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
  grad.addColorStop(1, "#0f213f");
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

export function DivulgacaoTab() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("plans")
      .select("id,codigo,nome,tipo,ativo,preco_maximo_brl")
      .order("codigo")
      .then(({ data }) => {
        setPlans((data as unknown as Plan[]) || []);
        setLoading(false);
      });
  }, []);

  async function handleDownload(plan: Plan) {
    setDownloading(plan.id);
    try {
      await generateCard(plan);
    } catch (e) {
      console.error("card error", e);
    }
    setDownloading(null);
  }

  async function handleDownloadAll() {
    for (const plan of plans.filter((p) => p.ativo)) {
      setDownloading(plan.id);
      try {
        await generateCard(plan);
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) {
        console.error("card error", e);
      }
    }
    setDownloading(null);
  }

  if (loading) return <p style={{ color: "#64748b" }}>Carregando…</p>;

  const active = plans.filter((p) => p.ativo);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Cards de Divulgação</h2>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 0 }}>
            Cards 1080×1080 px para cada plano ativo. Defina o <strong>Preço máx</strong> em{" "}
            <em>Tabela de Preços</em> antes de baixar.
          </p>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={downloading !== null}
          style={{
            background: "#0f213f",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            whiteSpace: "nowrap",
            opacity: downloading !== null ? 0.6 : 1,
          }}
        >
          ↓ Baixar todos ({active.length})
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {active.map((plan) => {
          const uso = USO_NORMAL[plan.codigo];
          const info = CARD_INFO[plan.codigo];
          const isDown = downloading === plan.id;
          return (
            <div
              key={plan.id}
              style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}
            >
              {/* Hero image at top of preview */}
              <div style={{ position: "relative", height: 76, overflow: "hidden" }}>
                <img
                  src={heroDesktopUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    display: "block",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 32,
                    background: "linear-gradient(to bottom, rgba(15,33,63,0), #0f213f)",
                  }}
                />
              </div>
              {/* Text preview */}
              <div
                style={{
                  background: "#0f213f",
                  padding: "10px 18px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 3,
                        background: "#f97316",
                        borderRadius: 2,
                        marginTop: 4,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.28)",
                        letterSpacing: 1,
                      }}
                    >
                      {plan.codigo}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#fff",
                      lineHeight: 1.3,
                      marginBottom: 6,
                    }}
                  >
                    {info?.titulo ?? plan.nome.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
                    {info?.subtitulo ??
                      "geração de imagem e conteúdo para sua comunicação nas redes sociais."}
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    Plano Mensal:{" "}
                    {plan.preco_maximo_brl > 0 ? (
                      `R$ ${plan.preco_maximo_brl.toFixed(0)}`
                    ) : (
                      <span style={{ color: "rgba(255,255,255,0.28)" }}>R$ ___</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
                    c/ desconto especial para 3 meses
                  </div>
                </div>
              </div>
              {/* Footer */}
              <div
                style={{
                  padding: "10px 14px",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                    {plan.nome}
                  </span>
                  {uso && (
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>
                      {uso.imgs} imgs{uso.renders > 0 ? ` · ${uso.renders} renders` : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDownload(plan)}
                  disabled={downloading !== null}
                  style={{
                    background: isDown ? "#64748b" : "#0f213f",
                    color: "#fff",
                    border: "none",
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {isDown ? "…" : "↓ PNG"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
        Canvas 1080×1080 px · imagem da capa desktop no topo · fonte Inter. Defina os preços em{" "}
        <em>Tabela de Preços</em> e baixe novamente.
      </p>
    </div>
  );
}
