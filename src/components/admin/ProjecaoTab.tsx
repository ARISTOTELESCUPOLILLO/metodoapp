import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { loadProjecaoData, updateSupplierBalance } from "@/lib/projecao.functions";
import { buildProjections, aggregate } from "./projecao/computeProjecaoView";
import { BalancesSection } from "./projecao/BalancesSection";
import { WindowProjectionSection } from "./projecao/WindowProjectionSection";
import { PurchaseSection } from "./projecao/PurchaseSection";
import { DetailSection } from "./projecao/DetailSection";
import {
  BUCKETS,
  type Bucket,
  type Plan,
  type Profile,
  type SlotProj,
  type Settings,
} from "./projecao/types";

const DEFAULT_SETTINGS: Settings = {
  usd_brl_rate: 5.8,
  falai_balance_usd: 0,
  openai_balance_usd: 0,
  image_price_usd: 0.08,
  render_price_usd: 1.6,
  geracao_price_usd: 0.013,
};

export function ProjecaoTab() {
  const loadProjecaoDataFn = useServerFn(loadProjecaoData);
  const updateSupplierBalanceFn = useServerFn(updateSupplierBalance);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [recharge, setRecharge] = useState<{ falai: string; openai: string }>({
    falai: "",
    openai: "",
  });
  const [saving, setSaving] = useState<"falai" | "openai" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadProjecaoDataFn({ data: undefined });
    setSettings(data.settings);
    setProfiles(data.profiles);
    setPlans(data.plans);
    setAdminIds(data.adminIds);
    setLoading(false);
  }, [loadProjecaoDataFn]);

  useEffect(() => {
    load();
  }, [load]);

  async function addBalance(supplier: "falai" | "openai") {
    const val = parseFloat(supplier === "falai" ? recharge.falai : recharge.openai);
    if (isNaN(val) || val <= 0) return;
    setSaving(supplier);
    await updateSupplierBalanceFn({ data: { supplier, val } });
    setRecharge((r) => ({ ...r, [supplier]: "" }));
    setSaving(null);
    await load();
  }

  const isMobile = useIsMobile();

  if (loading) return <p style={{ color: "#64748b", padding: 20 }}>Calculando projeção…</p>;

  const adminIdSet = new Set(adminIds);
  const projs: SlotProj[] = buildProjections(profiles, plans, adminIdSet, settings);
  const agg = aggregate(projs);

  const cumFal = (b: Bucket[]) => b.reduce((s, k) => s + agg[k].fal, 0);
  const cumOai = (b: Bucket[]) => b.reduce((s, k) => s + agg[k].openai, 0);
  const cumRev = (b: Bucket[]) => b.reduce((s, k) => s + agg[k].revenue, 0);
  const buy30fal = Math.max(0, cumFal(["0-30"]) - settings.falai_balance_usd);
  const buy60fal = Math.max(0, cumFal(["0-30", "31-60"]) - settings.falai_balance_usd);
  const buy90fal = Math.max(0, cumFal(["0-30", "31-60", "61-90"]) - settings.falai_balance_usd);
  const buy30oai = Math.max(0, cumOai(["0-30"]) - settings.openai_balance_usd);
  const buy60oai = Math.max(0, cumOai(["0-30", "31-60"]) - settings.openai_balance_usd);
  const buy90oai = Math.max(0, cumOai(["0-30", "31-60", "61-90"]) - settings.openai_balance_usd);
  const totalFal = cumFal(BUCKETS);
  const totalOai = cumOai(BUCKETS);
  const totalRev = cumRev(BUCKETS);

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <BalancesSection
        falaiBalance={settings.falai_balance_usd}
        openaiBalance={settings.openai_balance_usd}
        rate={settings.usd_brl_rate}
        recharge={recharge}
        onRechargeChange={(supplier, v) => setRecharge((r) => ({ ...r, [supplier]: v }))}
        onRechargeConfirm={addBalance}
        saving={saving}
      />
      <WindowProjectionSection
        agg={agg}
        totalFal={totalFal}
        totalOai={totalOai}
        totalRev={totalRev}
        totalSlots={projs.length}
        usdBrlRate={settings.usd_brl_rate}
        isMobile={isMobile}
        onRefresh={load}
      />
      <PurchaseSection
        buy30fal={buy30fal}
        buy60fal={buy60fal}
        buy90fal={buy90fal}
        buy30oai={buy30oai}
        buy60oai={buy60oai}
        buy90oai={buy90oai}
        usdBrlRate={settings.usd_brl_rate}
        isMobile={isMobile}
      />
      <DetailSection
        projs={projs}
        usdBrlRate={settings.usd_brl_rate}
        showDetail={showDetail}
        onToggle={() => setShowDetail((v) => !v)}
      />
    </div>
  );
}
