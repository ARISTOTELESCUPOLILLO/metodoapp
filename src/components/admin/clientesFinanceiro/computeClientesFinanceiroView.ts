// Cálculos derivados da aba Clientes (Financeiro) — extraído de
// ClientesFinanceiroTab.tsx (Fase 9). Função pura: recebe perfis + planos +
// admins + preços e devolve a lista de clientes já com slots calculados.
import { planMonthlyCost } from "@/lib/costs";
import {
  STATUS_ORDER,
  type ClientRow,
  type Plan,
  type Profile,
  type SlotData,
  type SlotStatus,
} from "./types";

function calcEndDate(inicio: string | null, tipo: string): Date | null {
  if (!inicio) return null;
  const d = new Date(inicio);
  if (tipo === "mensal") {
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  if (tipo === "anual") {
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  return null;
}

interface Prices {
  usdRate: number;
  imgRef: number;
  renderPrice: number;
  geracaoPrice: number;
}

function buildSlots(prof: Profile, planMap: Map<string, Plan>, prices: Prices): SlotData[] {
  const now = new Date();
  const raw = [
    {
      label: "Plano 1",
      planId: prof.plano1_id,
      inicio: prof.plano1_inicio,
      preco: prof.plano1_preco_brl,
    },
    {
      label: "Plano 2",
      planId: prof.plano2_id,
      inicio: prof.plano2_inicio,
      preco: prof.plano2_preco_brl,
    },
    {
      label: "Bônus",
      planId: prof.bonus_id,
      inicio: prof.bonus_inicio,
      preco: prof.bonus_preco_brl,
    },
  ];
  return raw
    .filter((s) => s.planId)
    .map((s) => {
      const plan = planMap.get(s.planId!);
      if (!plan) return null;
      const endDate = calcEndDate(s.inicio, plan.tipo);
      const slotStatus: SlotStatus =
        prof.status === "bloqueado"
          ? "bloqueado"
          : endDate && endDate < now
            ? "concluido"
            : "ativo";
      const costUsd = planMonthlyCost(plan, {
        image_price_usd: prices.imgRef,
        render_price_usd: prices.renderPrice,
        geracao_price_usd: prices.geracaoPrice,
      });
      const costBrl = costUsd * prices.usdRate;
      const soldBrl = s.preco || 0;
      return {
        label: s.label,
        plan,
        inicio: s.inicio,
        endDate,
        status: slotStatus,
        costBrl,
        soldBrl,
        profitBrl: soldBrl - costBrl,
      };
    })
    .filter((s): s is SlotData => s !== null);
}

export function computeClientesFinanceiroView(
  profiles: Profile[],
  plans: Plan[],
  adminIds: Set<string>,
  prices: Prices,
  search: string,
): ClientRow[] {
  const planMap = new Map(plans.map((p) => [p.id, p]));
  const q = search.toLowerCase().trim();

  return profiles
    .filter((p) => !adminIds.has(p.id))
    .filter(
      (p) => !q || (p.nome || "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    )
    .map((p) => {
      const slots = buildSlots(p, planMap, prices).sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
      );
      const totalSold = slots.reduce((s, sl) => s + sl.soldBrl, 0);
      const totalCost = slots.reduce((s, sl) => s + sl.costBrl, 0);
      return { ...p, slots, totalSold, totalCost, totalProfit: totalSold - totalCost };
    })
    .filter((p) => p.slots.length > 0)
    .sort((a, b) =>
      (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR", { sensitivity: "base" }),
    );
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
