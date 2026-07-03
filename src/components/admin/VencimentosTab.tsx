import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useConfirm } from "@/hooks/useConfirm";
import { useIsMobile } from "@/hooks/use-mobile";
import { loadCobrancasData, renewContrato } from "@/lib/cobrancas.functions";
import {
  computeVencimentosItems,
  groupVencimentosItems,
} from "./cobrancas/computeVencimentosItems";
import { VencimentosTable } from "./cobrancas/VencimentosTable";
import type { Plan, Row, VencimentoItem } from "./cobrancas/types";

export function VencimentosTab() {
  const { confirm, dialog } = useConfirm();
  const isMobile = useIsMobile();
  const loadCobrancasDataFn = useServerFn(loadCobrancasData);
  const renewContratoFn = useServerFn(renewContrato);

  const [profiles, setProfiles] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

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
  const s = search.toLowerCase().trim();
  const filtered = s
    ? items.filter(
        (it) =>
          (it.user.nome || "").toLowerCase().includes(s) ||
          (it.user.email || "").toLowerCase().includes(s) ||
          (it.user.client_code || "").toLowerCase().includes(s),
      )
    : items;
  // Agrupa por cliente DEPOIS de filtrar; a paginação conta boxes/clientes.
  const groups = groupVencimentosItems(filtered);
  const visible = groups.slice(0, visibleCount);

  return (
    <div>
      {dialog}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 12,
        }}
      >
        <input
          placeholder="Buscar por nome, e-mail ou código"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(20);
          }}
          style={{
            padding: "8px 10px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 14,
            flex: 1,
            maxWidth: 320,
          }}
        />
        <span style={{ fontSize: 12, color: "#64748b" }}>{groups.length} cliente(s)</span>
      </div>

      {items.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>Nenhum contrato ativo encontrado.</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Nenhum contrato encontrado para “{search.trim()}”.
        </div>
      ) : (
        <>
          <VencimentosTable
            groups={visible}
            busy={busy}
            isMobile={isMobile}
            onRenewContrato={handleRenewContrato}
          />
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#64748b",
              fontSize: 13,
            }}
          >
            <span>
              Mostrando {visible.length} de {groups.length} cliente(s)
            </span>
            {groups.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((n) => n + 20)}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  background: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Mostrar mais 20
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
