// Extraído de UsersTab.tsx (Fase 9).
import { planMonthlyCost } from "@/lib/costs";
import type { Costs, Plan, Row } from "./types";

export function FaturamentoCell({
  row,
  plans,
  costs,
  usdRate,
}: {
  row: Row;
  plans: Plan[];
  costs: Costs;
  usdRate: number;
}) {
  if (row.is_admin) return <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>;
  let totalMensal = 0;
  let hasWarning = false;
  const slots = [
    { planId: row.plano1_id, preco: row.plano1_preco_brl, meses: row.plano1_meses_contrato || 1 },
    { planId: row.plano2_id, preco: row.plano2_preco_brl, meses: row.plano2_meses_contrato || 1 },
    { planId: row.bonus_id, preco: row.bonus_preco_brl, meses: row.bonus_meses_contrato || 1 },
  ];
  // Meses máximos do contrato ativo (para mostrar total do contrato)
  const maxMeses = slots.filter((s) => s.planId).reduce((mx, s) => Math.max(mx, s.meses), 1);
  for (const s of slots) {
    if (!s.planId) continue;
    const plan = plans.find((p) => p.id === s.planId);
    if (!plan) continue;
    const cost = planMonthlyCost(plan, {
      image_price_usd: costs.imageRef,
      render_price_usd: costs.video,
      geracao_price_usd: costs.content,
    });
    const min = Math.ceil(cost * usdRate * 3);
    const preco = s.preco || 0;
    totalMensal += preco;
    if (preco > 0 && preco < min) hasWarning = true;
  }
  if (totalMensal === 0) return <span style={{ color: "#94a3b8", fontSize: 11 }}>sem preço</span>;
  const totalContrato = totalMensal * maxMeses;
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13, color: hasWarning ? "#dc2626" : "#15803d" }}>
        {hasWarning && "⚠ "}
        {maxMeses > 1 && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginRight: 4 }}>
            {maxMeses} meses ·
          </span>
        )}
        R$ {maxMeses > 1 ? totalContrato.toFixed(0) : totalMensal.toFixed(0)}
        <span style={{ fontSize: 10, fontWeight: 400, color: "#64748b" }}>
          {maxMeses > 1 ? " total" : "/mês"}
        </span>
      </div>
      {maxMeses > 1 && (
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
          R$ {totalMensal.toFixed(0)}/mês
        </div>
      )}
    </div>
  );
}
