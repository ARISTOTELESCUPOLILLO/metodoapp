// Extraído de UsersTab.tsx (Fase 9).
import { computeCycle, cycleLabel, cycleColor } from "@/lib/cycle";
import type { Row, SlotKey } from "./types";

export function SlotsConsumption({
  row,
  onRenew,
  onZerarConsumo,
}: {
  row: Row;
  onRenew?: (slot: SlotKey) => void;
  // Zera só os contadores de uso do ciclo atual (imagens, gerações, Gerar
  // outro, Sugestão, Primeira Geração) — mantém data de início, validade e
  // contrato intactos. "Colher de chá" pontual, sem contar como renovação.
  onZerarConsumo?: (slot: SlotKey) => void;
}) {
  const slots = [
    {
      label: "P1",
      key: "plano1" as SlotKey,
      planId: row.plano1_id,
      inicio: row.plano1_inicio,
      iu: row.plano1_imgs_usadas,
      il: row.plano1_imgs_limite,
      ru: row.plano1_renders_usados,
      rl: row.plano1_renders_limite,
    },
    {
      label: "P2",
      key: "plano2" as SlotKey,
      planId: row.plano2_id,
      inicio: row.plano2_inicio,
      iu: row.plano2_imgs_usadas,
      il: row.plano2_imgs_limite,
      ru: row.plano2_renders_usados,
      rl: row.plano2_renders_limite,
    },
    {
      label: "B",
      key: "bonus" as SlotKey,
      planId: row.bonus_id,
      inicio: row.bonus_inicio,
      iu: row.bonus_imgs_usadas,
      il: row.bonus_imgs_limite,
      ru: row.bonus_renders_usados,
      rl: row.bonus_renders_limite,
    },
  ].filter((s) => s.planId);
  if (!slots.length) {
    if (row.is_admin)
      return (
        <span style={{ color: "var(--brand-accent)", fontWeight: 600, fontSize: 12 }}>
          Ilimitado (admin)
        </span>
      );
    return <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>;
  }
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {slots.map((s, i) => {
        const pct = s.il > 0 ? Math.min(100, Math.round((s.iu / s.il) * 100)) : 0;
        const color = pct >= 100 ? "#dc2626" : pct >= 90 ? "#d97706" : "#2563eb";
        const cycle = computeCycle(s.inicio);
        const cColor = cycleColor(cycle);
        return (
          <div key={i}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#475569",
                gap: 4,
                alignItems: "center",
              }}
            >
              <span>
                <strong>{s.label}</strong> {s.iu}/{s.il}
                {s.rl > 0 ? ` · r ${s.ru}/${s.rl}` : ""}
              </span>
              <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {cColor && (
                  <span
                    style={{
                      background: cColor.bg,
                      color: cColor.fg,
                      padding: "1px 5px",
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {cycleLabel(cycle)}
                  </span>
                )}
                <span style={{ color: "#94a3b8" }}>
                  {s.inicio ? new Date(s.inicio).toLocaleDateString("pt-BR") : "—"}
                </span>
                {onZerarConsumo && (
                  <button
                    type="button"
                    onClick={() => onZerarConsumo(s.key)}
                    title="Zerar consumo do ciclo atual — mantém data de início e validade"
                    style={{
                      background: "#fff",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "lowercase",
                    }}
                  >
                    zerar
                  </button>
                )}
                {onRenew && (
                  <button
                    type="button"
                    onClick={() => onRenew(s.key)}
                    title="Atribuir plano / renovar ciclo"
                    style={{
                      background: "var(--brand-primary)",
                      color: "#fff",
                      border: "none",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "lowercase",
                    }}
                  >
                    renovar
                  </button>
                )}
              </span>
            </div>
            <div
              style={{ height: 4, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}
            >
              <div style={{ width: `${pct}%`, height: "100%", background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
