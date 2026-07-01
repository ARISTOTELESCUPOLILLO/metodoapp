// Seção "Detalhe por usuário / plano" da aba Projeção — extraído de ProjecaoTab.tsx (Fase 9).
import type { SlotProj } from "./types";
import { Th, Td, usd, fmt } from "./primitives";

export function DetailSection({
  projs,
  usdBrlRate,
  showDetail,
  onToggle,
}: {
  projs: SlotProj[];
  usdBrlRate: number;
  showDetail: boolean;
  onToggle: () => void;
}) {
  const brl = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <section>
      <button
        onClick={onToggle}
        style={{
          fontSize: 13,
          fontWeight: 600,
          background: "none",
          border: "1px solid #cbd5e1",
          padding: "6px 14px",
          borderRadius: 6,
          cursor: "pointer",
          color: "var(--brand-primary)",
          marginBottom: 10,
        }}
      >
        {showDetail ? "▲ Ocultar detalhe" : "▼ Ver detalhe por usuário / plano"}
      </button>
      {showDetail && (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Usuário</Th>
                <Th>Slot</Th>
                <Th>Plano</Th>
                <Th>Vence em</Th>
                <Th>Dias</Th>
                <Th>Imgs rem.</Th>
                <Th>Renders rem.</Th>
                <Th>Ger. rem.</Th>
                <Th style={{ color: "#6d28d9" }}>fal.ai</Th>
                <Th style={{ color: "#0369a1" }}>OpenAI</Th>
                <Th>Custo USD</Th>
                <Th style={{ color: "#15803d" }}>Receita R$</Th>
                <Th>Lucro R$</Th>
              </tr>
            </thead>
            <tbody>
              {[...projs]
                .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
                .map((p, i) => {
                  const custoBrl = (p.falCost + p.openaiCost) * usdBrlRate;
                  const lucro = p.revenueBrl - custoBrl;
                  return (
                    <tr
                      key={i}
                      style={{
                        borderTop: "1px solid #f1f5f9",
                        background: p.isTest ? "#fffbeb" : p.isAdmin ? "#f0f9ff" : undefined,
                      }}
                    >
                      <Td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontWeight: 600 }}>{p.userName}</span>
                          {p.isTest && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                background: "#d97706",
                                color: "#fff",
                                padding: "1px 4px",
                                borderRadius: 3,
                              }}
                            >
                              TEST
                            </span>
                          )}
                          {p.isAdmin && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                background: "#0369a1",
                                color: "#fff",
                                padding: "1px 4px",
                                borderRadius: 3,
                              }}
                            >
                              ADM
                            </span>
                          )}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 11 }}>{p.userEmail}</div>
                      </Td>
                      <Td style={{ color: "#64748b" }}>{p.slot}</Td>
                      <Td style={{ fontWeight: 600 }}>{p.planCodigo}</Td>
                      <Td>{p.endDate ? fmt(p.endDate) : "—"}</Td>
                      <Td
                        style={{
                          fontWeight: 700,
                          color:
                            p.daysLeft !== null && p.daysLeft <= 30
                              ? "#dc2626"
                              : p.daysLeft !== null && p.daysLeft <= 60
                                ? "#d97706"
                                : "#15803d",
                        }}
                      >
                        {p.daysLeft !== null ? p.daysLeft : "—"}
                      </Td>
                      <Td>{p.remImgs}</Td>
                      <Td>{p.remRenders}</Td>
                      <Td>{p.remGeracoes}</Td>
                      <Td style={{ color: "#6d28d9", fontWeight: 600 }}>{usd(p.falCost)}</Td>
                      <Td style={{ color: "#0369a1", fontWeight: 600 }}>{usd(p.openaiCost)}</Td>
                      <Td style={{ fontWeight: 700 }}>{usd(p.falCost + p.openaiCost)}</Td>
                      <Td style={{ color: "#15803d", fontWeight: 600 }}>
                        {p.revenueBrl > 0 ? brl(p.revenueBrl) : "—"}
                      </Td>
                      <Td
                        style={{
                          fontWeight: 700,
                          color:
                            p.revenueBrl > 0 ? (lucro >= 0 ? "#15803d" : "#dc2626") : "#94a3b8",
                        }}
                      >
                        {p.revenueBrl > 0 ? brl(lucro) : "—"}
                      </Td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
