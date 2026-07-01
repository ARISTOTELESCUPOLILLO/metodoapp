// Card de cliente (cabeçalho + slots de plano) — extraído de ClientesFinanceiroTab.tsx (Fase 9).
import { fmtDate } from "./computeClientesFinanceiroView";
import { STATUS_BG, STATUS_COLOR, type ClientRow } from "./types";

function Stat({
  label,
  value,
  color,
  big,
}: {
  label: string;
  value: string;
  color?: string;
  big?: boolean;
}) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        style={{ fontSize: big ? 17 : 14, fontWeight: 800, color: color ?? "var(--brand-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

export function ClientCard({ client }: { client: ClientRow }) {
  const hasActive = client.slots.some((sl) => sl.status === "ativo");
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${hasActive ? "#e2e8f0" : "#f1f5f9"}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: hasActive ? "#f8fafc" : "#f4f4f5",
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: "var(--brand-primary)",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            {client.nome || "—"}
            <span
              style={{
                background: client.status === "ativo" ? "#dcfce7" : "#fee2e2",
                color: client.status === "ativo" ? "#15803d" : "#b91c1c",
                padding: "1px 8px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {client.status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{client.email}</div>
          {client.segmento && (
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{client.segmento}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <Stat label="Custo proj." value={`R$ ${client.totalCost.toFixed(2)}`} color="#b45309" />
          {client.totalSold > 0 && (
            <>
              <Stat label="Vendido" value={`R$ ${client.totalSold.toFixed(2)}`} color="#15803d" />
              <Stat
                label="Lucro"
                value={`R$ ${client.totalProfit.toFixed(2)}`}
                color={client.totalProfit >= 0 ? "#15803d" : "#dc2626"}
                big
              />
              <Stat
                label="Margem"
                value={`${((client.totalProfit / client.totalSold) * 100).toFixed(0)}%`}
                color={client.totalProfit >= 0 ? "#15803d" : "#dc2626"}
              />
            </>
          )}
        </div>
      </div>

      <div style={{ padding: "10px 14px", display: "grid", gap: 8 }}>
        {client.slots.map((sl, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #f1f5f9",
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
              opacity: sl.status === "concluido" ? 0.6 : 1,
            }}
          >
            <div style={{ minWidth: 160 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: "var(--brand-primary)" }}>
                  {sl.label}
                </span>
                <span
                  style={{
                    background: STATUS_BG[sl.status],
                    color: STATUS_COLOR[sl.status],
                    padding: "1px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {sl.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#475569" }}>
                <strong>{sl.plan.codigo}</strong> {sl.plan.nome}
              </div>
              {sl.inicio && (
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                  Início: {fmtDate(new Date(sl.inicio))}
                  {sl.endDate && (
                    <>
                      {" "}
                      → {fmtDate(sl.endDate)}{" "}
                      {sl.status === "concluido" && (
                        <span style={{ color: "#94a3b8" }}>(encerrado)</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", flex: 1 }}>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#94a3b8",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 2,
                  }}
                >
                  Custo proj.
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>
                  R$ {sl.costBrl.toFixed(2)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#94a3b8",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 2,
                  }}
                >
                  Vendido
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: sl.soldBrl > 0 ? "#0f172a" : "#94a3b8",
                  }}
                >
                  {sl.soldBrl > 0 ? `R$ ${sl.soldBrl.toFixed(2)}` : "sem preço"}
                </div>
              </div>
              {sl.soldBrl > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#94a3b8",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      marginBottom: 2,
                    }}
                  >
                    Lucro
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: sl.profitBrl >= 0 ? "#15803d" : "#dc2626",
                    }}
                  >
                    R$ {sl.profitBrl.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
