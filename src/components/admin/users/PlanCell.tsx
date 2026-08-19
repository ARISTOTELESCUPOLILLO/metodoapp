// Extraído de UsersTab.tsx (Fase 9).
import { planPeriodo } from "./planPeriodo";
import type { Plan } from "./types";

export function PlanCell({
  planId,
  inicio,
  mesesContrato,
  contratoFim,
  cicloAte,
  options,
  onAssign,
  onRemove,
}: {
  planId: string | null;
  inicio: string | null;
  mesesContrato?: number;
  contratoFim?: string | null;
  cicloAte?: string | null;
  options: Plan[];
  onAssign: () => void;
  onRemove: () => void;
}) {
  const plan = options.find((p) => p.id === planId);
  const periodo = plan
    ? planPeriodo(inicio, plan.tipo, mesesContrato, contratoFim, cicloAte)
    : { contrato: "", ciclo: "" };
  return (
    <div>
      {plan ? (
        <>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button
              onClick={onAssign}
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
                color: "var(--brand-primary)",
                fontWeight: 600,
              }}
            >
              {plan.codigo}
            </button>
            <button
              onClick={onRemove}
              title="Remover plano"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: 12,
                padding: "0 2px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          {periodo.contrato && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, lineHeight: 1.3 }}>
              {periodo.contrato}
            </div>
          )}
          {periodo.ciclo && (
            <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.3 }}>{periodo.ciclo}</div>
          )}
        </>
      ) : (
        <button
          onClick={onAssign}
          style={{
            fontSize: 11,
            color: "#2563eb",
            background: "none",
            border: "1px dashed #cbd5e1",
            padding: "2px 8px",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          + Atribuir
        </button>
      )}
    </div>
  );
}
