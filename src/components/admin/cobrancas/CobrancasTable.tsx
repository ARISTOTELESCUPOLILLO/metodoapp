// Tabela de cobranças — extraído de CobrancasTab.tsx (Fase 9).
import { cycleColor, cycleLabel } from "@/lib/cycle";
import { Th, Td, actionBtn } from "./primitives";
import type { Item } from "./types";

export function CobrancasTable({
  items,
  busy,
  onMarkCharged,
  onRenewCycle,
}: {
  items: Item[];
  busy: string | null;
  onMarkCharged: (it: Item) => void;
  onRenewCycle: (it: Item) => void;
}) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "#f8fafc" }}>
          <tr>
            <Th>Cliente</Th>
            <Th>Slot</Th>
            <Th>Plano</Th>
            <Th>Início</Th>
            <Th>Vencimento</Th>
            <Th>Status</Th>
            <Th>Última cobrança</Th>
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
                <Td>{new Date(it.inicio).toLocaleDateString("pt-BR")}</Td>
                <Td>{it.cycle.dueAt?.toLocaleDateString("pt-BR") || "—"}</Td>
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
                <Td style={{ fontSize: 12, color: "#64748b" }}>
                  {it.lastChargedAt ? new Date(it.lastChargedAt).toLocaleDateString("pt-BR") : "—"}
                </Td>
                <Td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <button onClick={() => onMarkCharged(it)} style={actionBtn}>
                      Marcar cobrado
                    </button>
                    <button onClick={() => onRenewCycle(it)} style={actionBtn}>
                      Renovar ciclo
                    </button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
