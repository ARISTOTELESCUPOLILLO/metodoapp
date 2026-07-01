import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useConfirm } from "@/hooks/useConfirm";
import { loadCobrancasData, markCharged, renewCycle } from "@/lib/cobrancas.functions";
import { computeCobrancasItems } from "./cobrancas/computeCobrancasItems";
import { CobrancasTable } from "./cobrancas/CobrancasTable";
import type { Item, Plan, Row } from "./cobrancas/types";

export function CobrancasTab() {
  const { confirm, dialog } = useConfirm();
  const loadCobrancasDataFn = useServerFn(loadCobrancasData);
  const markChargedFn = useServerFn(markCharged);
  const renewCycleFn = useServerFn(renewCycle);

  const [profiles, setProfiles] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadCobrancasDataFn({ data: undefined });
    setProfiles(data.profiles);
    setPlans(data.plans);
    setAdminIds(new Set(data.adminIds));
    setLoading(false);
  }, [loadCobrancasDataFn]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkCharged(it: Item) {
    setBusy(`${it.user.id}:${it.slot}`);
    await markChargedFn({ data: { userId: it.user.id, slot: it.slot } });
    await load();
    setBusy(null);
  }
  async function handleRenewCycle(it: Item) {
    if (
      !(await confirm(
        `Renovar ciclo de ${it.label} (${it.user.nome || it.user.email})? Isso atualiza apenas a data de início — contadores não são alterados.`,
      ))
    )
      return;
    setBusy(`${it.user.id}:${it.slot}`);
    await renewCycleFn({ data: { userId: it.user.id, slot: it.slot } });
    await load();
    setBusy(null);
  }

  if (loading) return <p>Carregando cobranças…</p>;

  const items = computeCobrancasItems(profiles, plans, adminIds);

  return (
    <div>
      {dialog}
      <div style={{ marginBottom: 12, color: "#64748b", fontSize: 13 }}>
        {items.length === 0
          ? "Nenhum slot vencendo ou vencido no momento."
          : `${items.length} slot(s) vencendo ou vencidos.`}
      </div>
      {items.length > 0 && (
        <CobrancasTable
          items={items}
          busy={busy}
          onMarkCharged={handleMarkCharged}
          onRenewCycle={handleRenewCycle}
        />
      )}
    </div>
  );
}
