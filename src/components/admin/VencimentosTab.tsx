import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useConfirm } from "@/hooks/useConfirm";
import { loadCobrancasData, renewContrato } from "@/lib/cobrancas.functions";
import { computeVencimentosItems } from "./cobrancas/computeVencimentosItems";
import { VencimentosTable } from "./cobrancas/VencimentosTable";
import type { Plan, Row, VencimentoItem } from "./cobrancas/types";

export function VencimentosTab() {
  const { confirm, dialog } = useConfirm();
  const loadCobrancasDataFn = useServerFn(loadCobrancasData);
  const renewContratoFn = useServerFn(renewContrato);

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

  async function handleRenewContrato(it: VencimentoItem) {
    if (
      !(await confirm(
        `Renovar contrato de ${it.label} (${it.user.nome || it.user.email}) por mais 3 meses?`,
      ))
    )
      return;
    setBusy(`${it.user.id}:${it.slot}`);
    await renewContratoFn({ data: { userId: it.user.id, slot: it.slot, mesesAdicionais: 3 } });
    await load();
    setBusy(null);
  }

  if (loading) return <p>Carregando vencimentos…</p>;

  const items = computeVencimentosItems(profiles, plans, adminIds);

  return (
    <div>
      {dialog}
      <div style={{ marginBottom: 12, color: "#64748b", fontSize: 13 }}>
        {items.length === 0
          ? "Nenhum contrato vencendo nos próximos 30 dias."
          : `${items.length} contrato(s) vencendo em até 30 dias ou já vencidos.`}
      </div>
      {items.length > 0 && (
        <VencimentosTable items={items} busy={busy} onRenewContrato={handleRenewContrato} />
      )}
    </div>
  );
}
