import { PlanCard } from "./PlanCard";
import type { SlotInfo } from "../../hooks/useProfile";

interface Props {
  profileLoading: boolean;
  slots: SlotInfo[];
  effectiveAdmin: boolean;
}

export function PlanSlotsBar({ profileLoading, slots, effectiveAdmin }: Props) {
  if (profileLoading) return null;
  return (
    <div style={{ marginTop: 10 }}>
      {slots.length > 0 ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {effectiveAdmin && (
            <span
              style={{
                background: "#f4b000",
                color: "#0f213f",
                padding: "3px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Admin
            </span>
          )}
          {slots.map((s) => (
            <PlanCard key={s.key} slot={s} isAdmin={effectiveAdmin} />
          ))}
        </div>
      ) : effectiveAdmin ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              background: "#f4b000",
              color: "#0f213f",
              padding: "3px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Admin
          </span>
          <span
            style={{
              background: "#1e293b",
              color: "#94a3b8",
              padding: "3px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Sem plano
          </span>
        </div>
      ) : (
        <span
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "3px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Sem plano ativo — fale com o admin
        </span>
      )}
    </div>
  );
}
