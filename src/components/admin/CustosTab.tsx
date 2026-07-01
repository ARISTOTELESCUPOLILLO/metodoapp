import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useConfirm } from "@/hooks/useConfirm";
import { loadCustosData, resetAllUsage, updatePlanPrecoMaximo } from "@/lib/custos.functions";
import { computeCustosView } from "./custos/computeCustosView";
import { BalancesSection } from "./custos/BalancesSection";
import { SummarySection } from "./custos/SummarySection";
import { BreakdownSection } from "./custos/BreakdownSection";
import { PlansSection } from "./custos/PlansSection";
import { TestConsumptionSection } from "./custos/TestConsumptionSection";
import { AdminConsumptionSection } from "./custos/AdminConsumptionSection";
import type { AppSettings, Log, AllTimeLog, Plan, Profile } from "./custos/types";

const DEFAULT_SETTINGS: AppSettings = {
  usd_brl_rate: 5.8,
  falai_balance_usd: 0,
  openai_balance_usd: 0,
  image_base_price_usd: 0.046,
  image_price_usd: 0.058,
  render_price_usd: 1.6,
  geracao_price_usd: 0.013,
};

export function CustosTab() {
  const loadCustosDataFn = useServerFn(loadCustosData);
  const resetAllUsageFn = useServerFn(resetAllUsage);
  const updatePlanPrecoMaximoFn = useServerFn(updatePlanPrecoMaximo);
  const { confirm, dialog } = useConfirm();

  const [logs, setLogs] = useState<Log[]>([]);
  const [allTimeLogs, setAllTimeLogs] = useState<AllTimeLog[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [editMax, setEditMax] = useState<Record<string, string>>({});
  const [savingMax, setSavingMax] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadCustosDataFn({ data: { days } });
      setLogs(data.logs);
      setAllTimeLogs(data.allTimeLogs);
      setPlans(data.plans);
      setProfiles(data.profiles);
      setAdminIds(data.adminIds);
      setSettings(data.settings);
    } catch (e) {
      toast.error(`Erro ao carregar custos: ${(e as Error).message}`);
    }
    setLoading(false);
  }, [loadCustosDataFn, days]);

  useEffect(() => {
    load();
  }, [load]);

  const view = computeCustosView(logs, allTimeLogs, plans, profiles, adminIds, settings);
  const brl = (usd: number) => `R$ ${(usd * view.rate).toFixed(2)}`;
  const usdFmt = (v: number) => `$${v.toFixed(3)}`;

  async function zerarConsumo() {
    if (
      !(await confirm(
        "ATENÇÃO: Isso vai deletar TODOS os logs de consumo e zerar os contadores de uso de todos os perfis. Esta ação não pode ser desfeita. Continuar?",
      ))
    )
      return;
    try {
      await resetAllUsageFn({ data: undefined });
    } catch (e) {
      toast.error(`Erro ao zerar consumo: ${(e as Error).message}`);
    }
    await load();
  }

  async function saveMax(planId: string) {
    const val = parseFloat(editMax[planId] ?? "");
    if (isNaN(val)) return;
    setSavingMax(planId);
    try {
      await updatePlanPrecoMaximoFn({ data: { planId, val } });
    } catch (e) {
      toast.error(`Erro ao salvar preço: ${(e as Error).message}`);
    }
    setSavingMax(null);
    setEditMax((m) => {
      const n = { ...m };
      delete n[planId];
      return n;
    });
    await load();
  }

  return (
    <div>
      {dialog}
      {/* ── Cabeçalho ── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Gestão de Custos e Consumo</h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            fontSize: 13,
          }}
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>US$ 1 = R$ {view.rate.toFixed(2)}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={load}
            style={{
              background: "transparent",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ↻ Atualizar
          </button>
          <button
            onClick={zerarConsumo}
            style={{
              background: "#fff1f2",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              cursor: "pointer",
              color: "#b91c1c",
              fontWeight: 600,
            }}
          >
            Zerar Consumo
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>Carregando…</p>
      ) : (
        <>
          <BalancesSection
            settings={settings}
            allTimeCustoFalai={view.allTimeCustoFalai}
            allTimeCustoOpenai={view.allTimeCustoOpenai}
            saldoFalai={view.saldoFalai}
            saldoOpenai={view.saldoOpenai}
            brl={brl}
          />
          <SummarySection
            totalUsd={view.totalUsd}
            totalImgs={view.totalImgs}
            totalRenders={view.totalRenders}
            totalGeracoes={view.totalGeracoes}
            custoImgBase={view.custoImgBase}
            custoImgEdit={view.custoImgEdit}
            custoVideo={view.custoVideo}
            custoConteudo={view.custoConteudo}
            brl={brl}
            usdFmt={usdFmt}
          />
          <BreakdownSection
            settings={settings}
            imgBaseCount={view.imgBaseCount}
            imgEditCount={view.imgEditCount}
            totalRenders={view.totalRenders}
            totalGeracoes={view.totalGeracoes}
            totalUsd={view.totalUsd}
            custoImgBase={view.custoImgBase}
            custoImgEdit={view.custoImgEdit}
            custoVideo={view.custoVideo}
            custoConteudo={view.custoConteudo}
            brl={brl}
            usdFmt={usdFmt}
          />
          <PlansSection
            planRows={view.planRows}
            prevTotalFalai={view.prevTotalFalai}
            prevTotalOpenai={view.prevTotalOpenai}
            mesesFalai={view.mesesFalai}
            mesesOpenai={view.mesesOpenai}
            editMax={editMax}
            savingMax={savingMax}
            onEditMaxChange={(planId, val) => setEditMax((m) => ({ ...m, [planId]: val }))}
            onSaveMax={saveMax}
            brl={brl}
          />
          <TestConsumptionSection testRows={view.testRows} brl={brl} usdFmt={usdFmt} />
          <AdminConsumptionSection adminRows={view.adminRows} brl={brl} usdFmt={usdFmt} />
        </>
      )}
    </div>
  );
}
