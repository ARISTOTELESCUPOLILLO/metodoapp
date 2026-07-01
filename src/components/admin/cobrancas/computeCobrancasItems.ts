// Monta a lista de slots vencendo/vencidos — extraído de CobrancasTab.tsx (Fase 9).
// Função pura: recebe perfis + planos + admins e devolve só os slots que
// precisam de atenção (due_soon ou overdue), ordenados por urgência.
import { computeCycle } from "@/lib/cycle";
import type { Item, Plan, Row, SlotKey } from "./types";

export function computeCobrancasItems(
  profiles: Row[],
  plans: Plan[],
  adminIds: Set<string>,
): Item[] {
  const planMap: Record<string, string> = Object.fromEntries(plans.map((p) => [p.id, p.codigo]));
  const all: Item[] = [];

  for (const r of profiles) {
    if (adminIds.has(r.id)) continue;
    const slots: Array<{
      key: SlotKey;
      label: "P1" | "P2" | "B";
      planId: string | null;
      inicio: string | null;
      charged: string | null;
    }> = [
      {
        key: "plano1",
        label: "P1",
        planId: r.plano1_id,
        inicio: r.plano1_inicio,
        charged: r.plano1_last_charged_at,
      },
      {
        key: "plano2",
        label: "P2",
        planId: r.plano2_id,
        inicio: r.plano2_inicio,
        charged: r.plano2_last_charged_at,
      },
      {
        key: "bonus",
        label: "B",
        planId: r.bonus_id,
        inicio: r.bonus_inicio,
        charged: r.bonus_last_charged_at,
      },
    ];
    for (const s of slots) {
      if (!s.planId || !s.inicio) continue;
      const cycle = computeCycle(s.inicio);
      if (cycle.status !== "due_soon" && cycle.status !== "overdue") continue;
      all.push({
        user: r,
        slot: s.key,
        label: s.label,
        planCodigo: planMap[s.planId] || "?",
        inicio: s.inicio,
        lastChargedAt: s.charged,
        cycle,
      });
    }
  }
  all.sort((a, b) => a.cycle.daysLeft - b.cycle.daysLeft);
  return all;
}
