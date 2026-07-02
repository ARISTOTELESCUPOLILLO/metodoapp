// Cálculos derivados da aba Painel (Visão Geral) — extraído de
// VisaoGeralTab.tsx (Fase 9). Função pura: recebe perfis + planos + admins +
// configurações e devolve os totais já calculados para o render.
import { planMonthlyFalaiCost, planMonthlyOpenaiCost, planExtrasMonthlyCost } from "@/lib/costs";
import type { Plan, Profile, Settings } from "./types";

export function coverColor(cycles: number | null) {
  if (cycles === null) return "#64748b";
  if (cycles > 2) return "#15803d";
  if (cycles > 1) return "#d97706";
  return "#dc2626";
}
export function coverLabel(cycles: number | null) {
  if (cycles === null || cycles === Infinity) return "—";
  if (cycles > 20) return "> 20 ciclos";
  return `~${cycles.toFixed(1)} ciclo(s)`;
}
export function coverBg(cycles: number | null) {
  if (cycles === null) return "#64748b";
  if (cycles > 2) return "#dcfce7";
  if (cycles > 1) return "#fef3c7";
  return "#fee2e2";
}

export function computeVisaoGeralView(
  profiles: Profile[],
  plans: Plan[],
  adminIds: Set<string>,
  settings: Settings | null,
) {
  const admins = profiles.filter((p) => adminIds.has(p.id));
  const tests = profiles.filter((p) => p.is_test && !adminIds.has(p.id));
  const clients = profiles.filter((p) => !p.is_test && !adminIds.has(p.id));
  const activeClients = clients.filter((p) => p.status === "ativo").length;

  const planMap = new Map(plans.map((p) => [p.id, p]));
  const prices = {
    image_price_usd: settings?.image_price_usd ?? 0.08,
    render_price_usd: settings?.render_price_usd ?? 1.6,
    geracao_price_usd: settings?.geracao_price_usd ?? 0.013,
  };
  const rate = settings?.usd_brl_rate ?? 5.8;
  const falB = settings?.falai_balance_usd ?? 0;
  const oaiB = settings?.openai_balance_usd ?? 0;

  let totalSold = 0;
  let falaiCost = 0; // USD
  let openaiCost = 0; // USD

  for (const p of clients) {
    const slots = [
      { planId: p.plano1_id, preco: p.plano1_preco_brl },
      { planId: p.plano2_id, preco: p.plano2_preco_brl },
      { planId: p.bonus_id, preco: p.bonus_preco_brl },
    ];
    for (const s of slots) {
      if (!s.planId) continue;
      const plan = planMap.get(s.planId);
      if (!plan) continue;
      totalSold += s.preco ?? 0;
      falaiCost += planMonthlyFalaiCost(plan, prices);
      // Os 3 contadores de camada adicional (Gerar outro/Sugestão/Primeira
      // Geração) são todos custo OpenAI (gpt-4.1/gpt-4.1-mini) — somam no
      // openaiCost, não no falaiCost, pra "saldo cobre N ciclos" continuar
      // separando por provedor corretamente.
      openaiCost += planMonthlyOpenaiCost(plan, prices) + planExtrasMonthlyCost(plan);
    }
  }

  const totalCostBrl = (falaiCost + openaiCost) * rate;
  const lucro = totalSold - totalCostBrl;
  const margin = totalSold > 0 ? (lucro / totalSold) * 100 : null;

  const falaiCycles = falaiCost > 0 ? falB / falaiCost : null;
  const openaiCycles = openaiCost > 0 ? oaiB / openaiCost : null;
  const falaiBarPct = Math.min(100, ((falaiCycles ?? 0) / 3) * 100);
  const openaiBarPct = Math.min(100, ((openaiCycles ?? 0) / 3) * 100);

  return {
    admins,
    tests,
    clients,
    activeClients,
    totalSold,
    falaiCost,
    openaiCost,
    totalCostBrl,
    lucro,
    margin,
    falB,
    oaiB,
    falaiCycles,
    openaiCycles,
    falaiBarPct,
    openaiBarPct,
  };
}
