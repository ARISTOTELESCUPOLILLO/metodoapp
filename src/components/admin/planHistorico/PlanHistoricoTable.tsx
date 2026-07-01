// Tabela desktop da aba Histórico de Planos — extraído de PlanHistoricoTab.tsx (Fase 9.1).
import { Th, Td } from "./primitives";
import { brl, fmt, motivoLabel, slotLabel, type PurchaseRow } from "./types";

export function PlanHistoricoTable({ rows }: { rows: PurchaseRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <Th>Cliente</Th>
            <Th>Slot</Th>
            <Th>Plano</Th>
            <Th>Início</Th>
            <Th>Fim</Th>
            <Th style={{ textAlign: "right" }}>Imgs usadas</Th>
            <Th style={{ textAlign: "right" }}>Vídeos usados</Th>
            <Th style={{ textAlign: "right" }}>Preço</Th>
            <Th>Motivo</Th>
            <Th>Fechado por</Th>
            <Th>Registrado em</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const imgsPercent =
              r.imgs_limite > 0 ? Math.round((r.imgs_usadas_final / r.imgs_limite) * 100) : null;
            const rendersPercent =
              r.renders_limite > 0
                ? Math.round((r.renders_usados_final / r.renders_limite) * 100)
                : null;
            return (
              <tr key={r.id}>
                <Td>
                  <div style={{ fontWeight: 600 }}>{r.profiles?.nome || "—"}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>{r.profiles?.email}</div>
                </Td>
                <Td>
                  <span
                    style={{
                      background: r.slot === "bonus" ? "#fef3c7" : "#eff6ff",
                      color: r.slot === "bonus" ? "#92400e" : "#1e40af",
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    {slotLabel[r.slot] ?? r.slot}
                  </span>
                </Td>
                <Td>
                  <div style={{ fontWeight: 600 }}>{r.plan_codigo ?? "—"}</div>
                  <div style={{ color: "#64748b", fontSize: 11 }}>{r.plan_nome}</div>
                </Td>
                <Td style={{ color: "#475569" }}>{fmt(r.inicio)}</Td>
                <Td style={{ color: "#475569" }}>{fmt(r.expira_em)}</Td>
                <Td style={{ textAlign: "right" }}>
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
                </Td>
                <Td style={{ textAlign: "right" }}>
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
                </Td>
                <Td style={{ textAlign: "right", fontWeight: 600, color: "#15803d" }}>
                  {brl(r.preco_brl)}
                </Td>
                <Td>
                  <span
                    style={{
                      background: r.motivo_fechamento === "remocao" ? "#fee2e2" : "#f0fdf4",
                      color: r.motivo_fechamento === "remocao" ? "#b91c1c" : "#15803d",
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {r.motivo_fechamento ? motivoLabel[r.motivo_fechamento] : "—"}
                  </span>
                </Td>
                <Td style={{ color: "#475569", fontSize: 12 }}>{r.closer_nome || "—"}</Td>
                <Td style={{ color: "#94a3b8", fontSize: 12 }}>{fmt(r.created_at)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
