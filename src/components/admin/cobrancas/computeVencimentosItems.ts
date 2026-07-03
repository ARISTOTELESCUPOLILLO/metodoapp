// Monta a lista de contratos vencendo/vencidos — irmã de computeCobrancasItems,
// mas olha `contrato_fim` (fim do contrato) em vez do ciclo mensal de cobrança.
// Função pura: recebe perfis + planos + admins e devolve só os slots que
// precisam de atenção (due_soon dentro de 30d ou overdue), ordenados por urgência.
import { computeCycleFromExpiry } from "@/lib/cycle";
import type { Plan, Row, SlotKey, VencimentoItem } from "./types";

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
      if (cycle.status !== "due_soon" && cycle.status !== "overdue") continue;
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
