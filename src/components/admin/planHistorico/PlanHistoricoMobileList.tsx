// Lista mobile (accordion) da aba Histórico de Planos — extraído de PlanHistoricoTab.tsx (Fase 9.1).
import { brl, fmt, motivoLabel, slotLabel, type PurchaseRow } from "./types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 600,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export function PlanHistoricoMobileList({
  rows,
  openId,
  onToggle,
}: {
  rows: PurchaseRow[];
  openId: string | null;
  onToggle: (id: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => {
        const isOpen = openId === r.id;
        const imgsPercent =
          r.imgs_limite > 0 ? Math.round((r.imgs_usadas_final / r.imgs_limite) * 100) : null;
        const rendersPercent =
          r.renders_limite > 0
            ? Math.round((r.renders_usados_final / r.renders_limite) * 100)
            : null;
        return (
          <div
            key={r.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <button
              onClick={() => onToggle(isOpen ? null : r.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.profiles?.nome || "—"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.profiles?.email}
                </div>
              </div>
              <span
                style={{
                  background: r.slot === "bonus" ? "#fef3c7" : "#eff6ff",
                  color: r.slot === "bonus" ? "#92400e" : "#1e40af",
                  padding: "2px 7px",
                  borderRadius: 4,
                  fontWeight: 700,
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                {slotLabel[r.slot] ?? r.slot}
              </span>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: "#0f172a" }}>
                  {r.plan_codigo ?? "—"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{r.plan_nome}</div>
              </div>
              <span
                style={{
                  background: r.motivo_fechamento === "remocao" ? "#fee2e2" : "#f0fdf4",
                  color: r.motivo_fechamento === "remocao" ? "#b91c1c" : "#15803d",
                  padding: "2px 7px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {r.motivo_fechamento ? motivoLabel[r.motivo_fechamento] : "—"}
              </span>
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2.5}
                style={{
                  flexShrink: 0,
                  transition: "transform 0.2s ease",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <div
              style={{
                maxHeight: isOpen ? 400 : 0,
                overflow: "hidden",
                transition: "max-height 0.2s ease",
              }}
            >
              <div
                style={{
                  padding: "8px 12px 12px",
                  borderTop: "1px solid #f1f5f9",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px 12px",
                }}
              >
                <Field label="Período">
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    {fmt(r.inicio)} → {fmt(r.expira_em)}
                  </div>
                </Field>
                <div style={{ textAlign: "right" }}>
                  <Field label="Preço">
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>
                      {brl(r.preco_brl)}
                    </div>
                  </Field>
                </div>
                <Field label="Imgs usadas">
                  <div style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{r.imgs_usadas_final}</span>
                    <span style={{ color: "#94a3b8" }}>/{r.imgs_limite}</span>
                    {imgsPercent != null && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 11,
                          color: imgsPercent >= 90 ? "#ef4444" : "#94a3b8",
                        }}
                      >
                        {imgsPercent}%
                      </span>
                    )}
                  </div>
                </Field>
                <Field label="Vídeos usados">
                  <div style={{ fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{r.renders_usados_final}</span>
                    <span style={{ color: "#94a3b8" }}>/{r.renders_limite}</span>
                    {rendersPercent != null && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 11,
                          color: rendersPercent >= 90 ? "#ef4444" : "#94a3b8",
                        }}
                      >
                        {rendersPercent}%
                      </span>
                    )}
                  </div>
                </Field>
                <Field label="Fechado por">
                  <div style={{ fontSize: 12, color: "#475569" }}>{r.closer_nome || "—"}</div>
                </Field>
                <Field label="Registrado em">
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{fmt(r.created_at)}</div>
                </Field>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
