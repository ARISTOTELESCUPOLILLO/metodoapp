// Card de preview (1 plano) — extraído de DivulgacaoTab.tsx (Fase 9.1).
import heroDesktopUrl from "@/assets/lp-hero-desktop.png";
import { CARD_INFO, USO_NORMAL, type Plan } from "./types";

export function PlanCardPreview({
  plan,
  downloading,
  onDownload,
}: {
  plan: Plan;
  downloading: string | null;
  onDownload: (plan: Plan) => void;
}) {
  const uso = USO_NORMAL[plan.codigo];
  const info = CARD_INFO[plan.codigo];
  const isDown = downloading === plan.id;

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
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
            background: "linear-gradient(to bottom, rgba(15,33,63,0), var(--brand-primary))",
          }}
        />
      </div>
      <div
        style={{
          background: "var(--brand-primary)",
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
              style={{ width: 28, height: 3, background: "#f97316", borderRadius: 2, marginTop: 4 }}
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
          <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{plan.nome}</span>
          {uso && (
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>
              {uso.imgs} imgs{uso.renders > 0 ? ` · ${uso.renders} renders` : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => onDownload(plan)}
          disabled={downloading !== null}
          style={{
            background: isDown ? "#64748b" : "var(--brand-primary)",
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
}
