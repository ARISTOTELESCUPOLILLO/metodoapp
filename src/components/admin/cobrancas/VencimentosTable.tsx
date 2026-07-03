// Lista de vencimentos de contrato — irmã de CobrancasTable.tsx.
// Renderiza um box por cliente, com uma linha por slot (P1/P2/Bônus) dentro dele.
// Dois layouts: desktop (linhas horizontais) e mobile (empilhado label:valor).
import { cycleColor, cycleLabel } from "@/lib/cycle";
import { mCard, Row, actionBtn } from "./primitives";
import type { VencimentoGroup, VencimentoItem } from "./types";

// Cabeçalho do box: nome / e-mail / código do cliente.
function ClienteHeader({ user }: { user: VencimentoItem["user"] }) {
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{user.nome || "—"}</div>
      <div style={{ color: "#64748b", fontSize: 12 }}>{user.email}</div>
      {user.client_code && (
        <div
          style={{
            color: "#94a3b8",
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {user.client_code}
        </div>
      )}
    </div>
  );
}

// Campo rotulado do layout desktop (label pequeno + valor).
function DesktopField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, color: "#94a3b8" }}>{label}</span>
      <span style={{ fontSize: 13 }}>{children}</span>
    </div>
  );
}

function StatusBadge({ it }: { it: VencimentoItem }) {
  const c = cycleColor(it.cycle);
  return (
    <span
      style={{
        background: c?.bg,
        color: c?.fg ?? "#64748b",
        padding: c ? "2px 8px" : 0,
        borderRadius: 4,
        fontSize: c ? 11 : 12,
        fontWeight: c ? 700 : 400,
      }}
    >
      {cycleLabel(it.cycle)}
    </span>
  );
}

export function VencimentosTable({
  groups,
  busy,
  isMobile,
  onRenewContrato,
}: {
  groups: VencimentoGroup[];
  busy: string | null;
  isMobile: boolean;
  onRenewContrato: (it: VencimentoItem) => void;
}) {
  if (isMobile) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {groups.map((g) => (
          <div key={g.user.id} style={mCard}>
            <ClienteHeader user={g.user} />
            {g.items.map((it) => {
              const busyKey = `${it.user.id}:${it.slot}`;
              const c = cycleColor(it.cycle);
              return (
                <div
                  key={busyKey}
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid #e2e8f0",
                    opacity: busy === busyKey ? 0.5 : 1,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                    Slot {it.label}
                  </div>
                  <Row k="Plano" v={it.planCodigo} />
                  <Row k="Meses contratados" v={String(it.mesesContrato)} />
                  <Row
                    k="Fim do contrato"
                    v={new Date(it.contratoFim).toLocaleDateString("pt-BR")}
                  />
                  <Row k="Status" v={cycleLabel(it.cycle) || "—"} vColor={c?.fg} />
                  <button
                    onClick={() => onRenewContrato(it)}
                    style={{ ...actionBtn, width: "100%", marginTop: 10 }}
                  >
                    Renovar +3 meses
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {groups.map((g) => (
        <div key={g.user.id} style={mCard}>
          <ClienteHeader user={g.user} />
          {g.items.map((it) => {
            const busyKey = `${it.user.id}:${it.slot}`;
            return (
              <div
                key={busyKey}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 20,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid #f1f5f9",
                  opacity: busy === busyKey ? 0.5 : 1,
                }}
              >
                <DesktopField label="Slot">
                  <strong>{it.label}</strong>
                </DesktopField>
                <DesktopField label="Plano">{it.planCodigo}</DesktopField>
                <DesktopField label="Meses contratados">{it.mesesContrato}</DesktopField>
                <DesktopField label="Fim do contrato">
                  {new Date(it.contratoFim).toLocaleDateString("pt-BR")}
                </DesktopField>
                <DesktopField label="Status">
                  <StatusBadge it={it} />
                </DesktopField>
                <button
                  onClick={() => onRenewContrato(it)}
                  style={{ ...actionBtn, marginLeft: "auto" }}
                >
                  Renovar +3 meses
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
