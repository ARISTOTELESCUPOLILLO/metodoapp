// Extraído de UsersTab.tsx (Fase 9).
import { useEffect, useState } from "react";
import { planMonthlyCost } from "@/lib/costs";
import type { Costs, Plan } from "./types";

export function PlanPriceField({
  planId,
  plans,
  costs,
  usdRate,
  value,
  onChange,
}: {
  planId: string | null;
  plans: Plan[];
  costs: Costs;
  usdRate: number;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [inp2, setInp2] = useState(value != null ? String(value) : "");
  useEffect(() => {
    setInp2(value != null ? String(value) : "");
  }, [value]);
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;
  const costUsd = planMonthlyCost(plan, {
    image_price_usd: costs.imageRef,
    render_price_usd: costs.video,
    geracao_price_usd: costs.content,
  });
  // Arredonda pra cima — o mínimo exibido nunca pode ficar abaixo do piso
  // real de custo (senão um preço que bate com o número mostrado ainda
  // aparece como "abaixo do mínimo").
  const minBrl = Math.ceil(costUsd * usdRate * 3);
  const maxBrl = plan.preco_maximo_brl || 0;
  const applied = parseFloat(inp2);
  const belowMin = !isNaN(applied) && applied > 0 && applied < minBrl;
  function commit() {
    const v = parseFloat(inp2);
    onChange(isNaN(v) || inp2.trim() === "" ? null : v);
  }
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>R$</span>
        <input
          type="number"
          min="0"
          step="1"
          value={inp2}
          onChange={(e) => setInp2(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          placeholder={String(minBrl)}
          style={{
            width: 60,
            padding: "2px 4px",
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${belowMin ? "#dc2626" : "#cbd5e1"}`,
            borderRadius: 4,
            color: belowMin ? "#dc2626" : "#0f172a",
            background: belowMin ? "#fef2f2" : "#fff",
          }}
        />
        {belowMin && (
          <span
            title={`Abaixo do mínimo (R$ ${minBrl})`}
            style={{ color: "#dc2626", fontSize: 12, fontWeight: 800 }}
          >
            ⚠
          </span>
        )}
      </div>
      <div style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1.3, marginTop: 1 }}>
        mín R$ {minBrl}
        {maxBrl > 0 ? ` · máx R$ ${maxBrl.toFixed(0)}` : ""}
      </div>
    </div>
  );
}
