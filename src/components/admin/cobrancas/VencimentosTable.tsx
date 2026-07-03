// Tabela de vencimentos de contrato — irmã de CobrancasTable.tsx.
import { cycleColor, cycleLabel } from "@/lib/cycle";
import { Th, Td, actionBtn } from "./primitives";
import type { VencimentoItem } from "./types";

export function VencimentosTable({
  items,
  busy,
  onRenewContrato,
}: {
  items: VencimentoItem[];
  busy: string | null;
  onRenewContrato: (it: VencimentoItem) => void;
}) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "#f8fafc" }}>
          <tr>
            <Th>Cliente</Th>
            <Th>Slot</Th>
            <Th>Plano</Th>
            <Th>Meses contratados</Th>
            <Th>Fim do contrato</Th>
            <Th>Status</Th>
            <Th>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const c = cycleColor(it.cycle);
            const busyKey = `${it.user.id}:${it.slot}`;
            return (
              <tr
                key={busyKey}
                style={{ borderTop: "1px solid #e2e8f0", opacity: busy === busyKey ? 0.5 : 1 }}
              >
                <Td>
                  <div style={{ fontWeight: 600 }}>{it.user.nome || "—"}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{it.user.email}</div>
                  {it.user.client_code && (
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: 11,
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {it.user.client_code}
                    </div>
                  )}
                </Td>
                <Td>
                  <strong>{it.label}</strong>
                </Td>
                <Td>{it.planCodigo}</Td>
                <Td>{it.mesesContrato}</Td>
                <Td>{new Date(it.contratoFim).toLocaleDateString("pt-BR")}</Td>
                <Td>
                  {c && (
                    <span
                      style={{
                        background: c.bg,
                        color: c.fg,
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {cycleLabel(it.cycle)}
                    </span>
                  )}
                </Td>
                <Td>
                  <button onClick={() => onRenewContrato(it)} style={actionBtn}>
                    Renovar +3 meses
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
