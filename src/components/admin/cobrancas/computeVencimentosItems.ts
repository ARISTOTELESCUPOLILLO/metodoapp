// Monta a lista de contratos — irmã de computeCobrancasItems,
// mas olha `contrato_fim` (fim do contrato) em vez do ciclo mensal de cobrança.
// Função pura: recebe perfis + planos + admins e devolve TODOS os slots ativos
// (com planId e contratoFim), ordenados por urgência (crescente por daysLeft),
// cobrindo vencidos, vencendo e tranquilos numa lista só. Admins são excluídos.
import { computeCycleFromExpiry } from "@/lib/cycle";
import type { Plan, Row, SlotKey, VencimentoGroup, VencimentoItem } from "./types";

const CONTRATO_DUE_SOON_DAYS = 30;

export function computeVencimentosItems(
  profiles: Row[],
  plans: Plan[],
  adminIds: Set<string>,
): VencimentoItem[] {
  const planMap: Record<string, string> = Object.fromEntries(plans.map((p) => [p.id, p.codigo]));
  const all: VencimentoItem[] = [];

  for (const r of profiles) {
    if (adminIds.has(r.id)) continue;
    const slots: Array<{
      key: SlotKey;
      label: "P1" | "P2" | "B";
      planId: string | null;
      contratoFim: string | null;
      mesesContrato: number | null;
    }> = [
      {
        key: "plano1",
        label: "P1",
        planId: r.plano1_id,
        contratoFim: r.plano1_contrato_fim,
        mesesContrato: r.plano1_meses_contrato,
      },
      {
        key: "plano2",
        label: "P2",
        planId: r.plano2_id,
        contratoFim: r.plano2_contrato_fim,
        mesesContrato: r.plano2_meses_contrato,
      },
      {
        key: "bonus",
        label: "B",
        planId: r.bonus_id,
        contratoFim: r.bonus_contrato_fim,
        mesesContrato: r.bonus_meses_contrato,
      },
    ];
    for (const s of slots) {
      if (!s.planId || !s.contratoFim) continue;
      const cycle = computeCycleFromExpiry(s.contratoFim, new Date(), CONTRATO_DUE_SOON_DAYS);
      all.push({
        user: r,
        slot: s.key,
        label: s.label,
        planCodigo: planMap[s.planId] || "?",
        contratoFim: s.contratoFim,
        mesesContrato: s.mesesContrato ?? 1,
        cycle,
      });
    }
  }
  all.sort((a, b) => a.cycle.daysLeft - b.cycle.daysLeft);
  return all;
}

// Ordem de slot fixa dentro de cada box (plano principal primeiro).
const SLOT_ORDER: Record<SlotKey, number> = { plano1: 0, plano2: 1, bonus: 2 };

/**
 * Agrupa os itens achatados (um por slot) em um box por cliente.
 * - Dentro de cada grupo, mantém os slots na ordem P1 → P2 → Bônus.
 * - `minDaysLeft` = menor daysLeft entre os slots do grupo.
 * - Ordena os grupos por `minDaysLeft` crescente (cliente mais urgente primeiro).
 */
export function groupVencimentosItems(items: VencimentoItem[]): VencimentoGroup[] {
  const byUser = new Map<string, VencimentoGroup>();
  for (const it of items) {
    const existing = byUser.get(it.user.id);
    if (existing) {
      existing.items.push(it);
      if (it.cycle.daysLeft < existing.minDaysLeft) existing.minDaysLeft = it.cycle.daysLeft;
    } else {
      byUser.set(it.user.id, {
        user: it.user,
        items: [it],
        minDaysLeft: it.cycle.daysLeft,
      });
    }
  }

  const groups = Array.from(byUser.values());
  for (const g of groups) {
    g.items.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  }
  groups.sort((a, b) => a.minDaysLeft - b.minDaysLeft);
  return groups;
}
