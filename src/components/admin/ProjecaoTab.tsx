import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { mopMonthlyCost, mopSequenceSize } from "@/lib/costs";

interface Settings {
  usd_brl_rate: number;
  falai_balance_usd: number;
  openai_balance_usd: number;
  image_price_usd: number;
  render_price_usd: number;
  geracao_price_usd: number;
}

interface Plan {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
}

interface Profile {
  id: string;
  nome: string | null;
  email: string;
  is_test: boolean;
  plano1_id: string | null;
  plano1_inicio: string | null;
  plano1_imgs_usadas: number;
  plano1_imgs_limite: number;
  plano1_renders_usados: number;
  plano1_renders_limite: number;
  plano1_geracoes_usadas: number;
  plano1_geracoes_limite: number;
  plano2_id: string | null;
  plano2_inicio: string | null;
  plano2_imgs_usadas: number;
  plano2_imgs_limite: number;
  plano2_renders_usados: number;
  plano2_renders_limite: number;
  plano2_geracoes_usadas: number;
  plano2_geracoes_limite: number;
  bonus_id: string | null;
  bonus_inicio: string | null;
  bonus_imgs_usadas: number;
  bonus_imgs_limite: number;
  bonus_renders_usados: number;
  bonus_renders_limite: number;
  bonus_geracoes_usadas: number;
  bonus_geracoes_limite: number;
}

type Bucket = "0-30" | "31-60" | "61-90" | "90+" | "sem_venc";

interface SlotProj {
  userName: string;
  userEmail: string;
  isTest: boolean;
  isAdmin: boolean;
  slot: string;
  planCodigo: string;
  endDate: Date | null;
  daysLeft: number | null;
  bucket: Bucket;
  remImgs: number;
  remRenders: number;
  remGeracoes: number;
  falCost: number;
  openaiCost: number;
  revenueBrl: number;
}

interface BucketTotals {
  fal: number;
  openai: number;
  revenue: number;
  slots: number;
}

const BUCKETS: Bucket[] = ["0-30", "31-60", "61-90", "90+", "sem_venc"];
const BUCKET_LABEL: Record<Bucket, string> = {
  "0-30": "Vence em ≤ 30 dias",
  "31-60": "31 – 60 dias",
  "61-90": "61 – 90 dias",
  "90+": "Mais de 90 dias",
  sem_venc: "Sem vencimento",
};

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

function toBucket(daysLeft: number | null): Bucket {
  if (daysLeft === null) return "sem_venc";
  if (daysLeft <= 30) return "0-30";
  if (daysLeft <= 60) return "31-60";
  if (daysLeft <= 90) return "61-90";
  return "90+";
}

function buildProjections(
  profiles: Profile[],
  plans: Plan[],
  adminIds: Set<string>,
  s: Settings,
): SlotProj[] {
  const planMap = new Map(plans.map((p) => [p.id, p]));
  const now = new Date();
  const out: SlotProj[] = [];

  for (const prof of profiles) {
    const isTest = prof.is_test;
    const isAdmin = adminIds.has(prof.id);
    const slots = [
      {
        key: "Plano 1",
        planId: prof.plano1_id,
        inicio: prof.plano1_inicio,
        iu: prof.plano1_imgs_usadas,
        il: prof.plano1_imgs_limite,
        ru: prof.plano1_renders_usados,
        rl: prof.plano1_renders_limite,
        gu: prof.plano1_geracoes_usadas,
        gl: prof.plano1_geracoes_limite,
        preco: (prof as any).plano1_preco_brl || 0,
      },
      {
        key: "Plano 2",
        planId: prof.plano2_id,
        inicio: prof.plano2_inicio,
        iu: prof.plano2_imgs_usadas,
        il: prof.plano2_imgs_limite,
        ru: prof.plano2_renders_usados,
        rl: prof.plano2_renders_limite,
        gu: prof.plano2_geracoes_usadas,
        gl: prof.plano2_geracoes_limite,
        preco: (prof as any).plano2_preco_brl || 0,
      },
      {
        key: "Bônus",
        planId: prof.bonus_id,
        inicio: prof.bonus_inicio,
        iu: prof.bonus_imgs_usadas,
        il: prof.bonus_imgs_limite,
        ru: prof.bonus_renders_usados,
        rl: prof.bonus_renders_limite,
        gu: prof.bonus_geracoes_usadas,
        gl: prof.bonus_geracoes_limite,
        preco: (prof as any).bonus_preco_brl || 0,
      },
    ];
    for (const slot of slots) {
      if (!slot.planId) continue;
      const plan = planMap.get(slot.planId);
      if (!plan) continue;
      const remImgs = Math.max(0, slot.il - slot.iu);
      const remRenders = Math.max(0, slot.rl - slot.ru);
      const remGeracoes = Math.max(0, slot.gl - slot.gu);
      // Planos de Sequência (S3/S6/S9) guardam limite_geracoes=0 (convenção
      // "ilimitado por ciclo") — remGeracoes fica sempre 0 pra eles, então o
      // custo OpenAI real (ciclos MOP) usa mopMonthlyCost em vez do contador.
      const seqSize = mopSequenceSize(plan.codigo);
      const openaiCost = seqSize ? mopMonthlyCost(seqSize) : remGeracoes * s.geracao_price_usd;
      if (remImgs === 0 && remRenders === 0 && openaiCost === 0) continue;
      const endDate = calcEndDate(slot.inicio, plan.tipo);
      const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / 86400000) : null;
      const falCost = remImgs * s.image_price_usd + remRenders * s.render_price_usd;
      const revenueBrl = isTest || isAdmin ? 0 : slot.preco;
      out.push({
        userName: prof.nome || prof.email,
        userEmail: prof.email,
        isTest,
        isAdmin,
        slot: slot.key,
        planCodigo: plan.codigo,
        endDate,
        daysLeft,
        bucket: toBucket(daysLeft),
        remImgs,
        remRenders,
        remGeracoes,
        falCost,
        openaiCost,
        revenueBrl,
      });
    }
  }
  return out;
}

function aggregate(projs: SlotProj[]): Record<Bucket, BucketTotals> {
  const init = (): BucketTotals => ({ fal: 0, openai: 0, revenue: 0, slots: 0 });
  const agg = Object.fromEntries(BUCKETS.map((b) => [b, init()])) as Record<Bucket, BucketTotals>;
  for (const p of projs) {
    agg[p.bucket].fal += p.falCost;
    agg[p.bucket].openai += p.openaiCost;
    agg[p.bucket].revenue += p.revenueBrl;
    agg[p.bucket].slots += 1;
  }
  return agg;
}

const usd = (v: number) => `US$ ${v.toFixed(2)}`;
const fmt = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function ProjecaoTab() {
  const [settings, setSettings] = useState<Settings>({
    usd_brl_rate: 5.8,
    falai_balance_usd: 0,
    openai_balance_usd: 0,
    image_price_usd: 0.058,
    render_price_usd: 1.6,
    geracao_price_usd: 0.013,
  });
  const [projs, setProjs] = useState<SlotProj[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [recharge, setRecharge] = useState<{ falai: string; openai: string }>({
    falai: "",
    openai: "",
  });
  const [saving, setSaving] = useState<"falai" | "openai" | null>(null);

  async function addBalance(supplier: "falai" | "openai") {
    const val = parseFloat(supplier === "falai" ? recharge.falai : recharge.openai);
    if (isNaN(val) || val <= 0) return;
    setSaving(supplier);
    const col = supplier === "falai" ? "falai_balance_usd" : "openai_balance_usd";
    await supabase
      .from("app_settings")
      .update({ [col]: val } as any)
      .eq("id", true);
    setRecharge((r) => ({ ...r, [supplier]: "" }));
    setSaving(null);
    await load();
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: profs }, { data: pls }, { data: roles }] = await Promise.all([
      supabase
        .from("app_settings")
        .select(
          "usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd,falai_balance_usd,openai_balance_usd",
        )
        .eq("id", true)
        .maybeSingle(),
      supabase.from("profiles").select("*"),
      supabase.from("plans").select("id,codigo,nome,tipo").eq("ativo", true),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const cfg: Settings = {
      usd_brl_rate: Number(s?.usd_brl_rate ?? 5.8),
      falai_balance_usd: Number(s?.falai_balance_usd ?? 0),
      openai_balance_usd: Number(s?.openai_balance_usd ?? 0),
      image_price_usd: Number(s?.image_price_usd ?? 0.058),
      render_price_usd: Number(s?.render_price_usd ?? 1.6),
      geracao_price_usd: Number(s?.geracao_price_usd ?? 0.013),
    };
    setSettings(cfg);
    const adminIds = new Set((roles || []).filter((r) => r.role === "admin").map((r) => r.user_id));
    const p = buildProjections((profs || []) as Profile[], (pls || []) as Plan[], adminIds, cfg);
    setProjs(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isMobile = useIsMobile();
  const agg = aggregate(projs);

  // Acumulados para janelas de compra
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
  const brl = (v: number) => `R$ ${v.toFixed(2)}`;

  if (loading) return <p style={{ color: "#64748b", padding: 20 }}>Calculando projeção…</p>;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* ── Saldos atuais ── */}
      <section>
        <SectionTitle>Saldos atuais</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 12,
          }}
        >
          <BalanceCard
            supplier="fal.ai"
            desc="Imagens + Renders"
            balance={settings.falai_balance_usd}
            rate={settings.usd_brl_rate}
            color="#6d28d9"
            rechargeVal={recharge.falai}
            onRechargeChange={(v) => setRecharge((r) => ({ ...r, falai: v }))}
            onRechargeConfirm={() => addBalance("falai")}
            saving={saving === "falai"}
          />
          <BalanceCard
            supplier="OpenAI"
            desc="Conteúdo (texto)"
            balance={settings.openai_balance_usd}
            rate={settings.usd_brl_rate}
            color="#0369a1"
            rechargeVal={recharge.openai}
            onRechargeChange={(v) => setRecharge((r) => ({ ...r, openai: v }))}
            onRechargeConfirm={() => addBalance("openai")}
            saving={saving === "openai"}
          />
        </div>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
          Informe o saldo exato que aparece no painel do fal.ai ou OpenAI. O valor digitado
          substitui o saldo atual.
        </p>
      </section>

      {/* ── Projeção por janela ── */}
      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <SectionTitle style={{ margin: 0 }}>
            Gastos previstos — por vencimento de plano
          </SectionTitle>
          <button
            onClick={load}
            style={{
              fontSize: 12,
              background: "none",
              border: "1px solid #cbd5e1",
              padding: "4px 10px",
              borderRadius: 4,
              cursor: "pointer",
              color: "#475569",
            }}
          >
            ↻ Atualizar
          </button>
        </div>
        {isMobile ? (
          <div style={{ display: "grid", gap: 10 }}>
            {BUCKETS.map((b) => {
              const t = agg[b];
              if (t.slots === 0) return null;
              const tot = t.fal + t.openai;
              const custoBrl = tot * settings.usd_brl_rate;
              const lucro = t.revenue - custoBrl;
              return (
                <div
                  key={b}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                    {BUCKET_LABEL[b]}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <ProjCell label="fal.ai" value={usd(t.fal)} color="#6d28d9" />
                    <ProjCell label="OpenAI" value={usd(t.openai)} color="#0369a1" />
                    <ProjCell label="Custo R$" value={brl(custoBrl)} />
                    <ProjCell
                      label="Receita R$"
                      value={t.revenue > 0 ? brl(t.revenue) : "—"}
                      color="#15803d"
                    />
                    <ProjCell
                      label="Lucro R$"
                      value={t.revenue > 0 ? brl(lucro) : "—"}
                      color={lucro >= 0 ? "#15803d" : "#dc2626"}
                    />
                    <ProjCell label="Planos" value={String(t.slots)} />
                  </div>
                </div>
              );
            })}
            <div
              style={{
                background: "#f8fafc",
                border: "2px solid #e2e8f0",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, color: "#0f213f", marginBottom: 10 }}>
                TOTAL PREVISTO
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <ProjCell label="fal.ai" value={usd(totalFal)} color="#6d28d9" />
                <ProjCell label="OpenAI" value={usd(totalOai)} color="#0369a1" />
                <ProjCell
                  label="Custo R$"
                  value={brl((totalFal + totalOai) * settings.usd_brl_rate)}
                />
                <ProjCell
                  label="Receita R$"
                  value={totalRev > 0 ? brl(totalRev) : "—"}
                  color="#15803d"
                />
                <ProjCell
                  label="Lucro R$"
                  value={
                    totalRev > 0
                      ? brl(totalRev - (totalFal + totalOai) * settings.usd_brl_rate)
                      : "—"
                  }
                  color={
                    totalRev - (totalFal + totalOai) * settings.usd_brl_rate >= 0
                      ? "#15803d"
                      : "#dc2626"
                  }
                />
                <ProjCell label="Planos" value={String(projs.length)} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <Th>Janela de vencimento</Th>
                  <Th style={{ color: "#6d28d9" }}>fal.ai (imgs + renders)</Th>
                  <Th style={{ color: "#0369a1" }}>OpenAI (conteúdo)</Th>
                  <Th>Custo USD</Th>
                  <Th>Custo R$</Th>
                  <Th style={{ color: "#15803d" }}>Receita R$</Th>
                  <Th style={{ color: "#0f213f" }}>Lucro R$</Th>
                  <Th style={{ fontSize: 11, color: "#94a3b8" }}>Planos</Th>
                </tr>
              </thead>
              <tbody>
                {BUCKETS.map((b) => {
                  const t = agg[b];
                  const tot = t.fal + t.openai;
                  const custoBrl = tot * settings.usd_brl_rate;
                  const lucro = t.revenue - custoBrl;
                  if (t.slots === 0) return null;
                  return (
                    <tr key={b} style={{ borderTop: "1px solid #e2e8f0" }}>
                      <Td style={{ fontWeight: 600 }}>{BUCKET_LABEL[b]}</Td>
                      <Td style={{ color: "#6d28d9", fontWeight: 600 }}>{usd(t.fal)}</Td>
                      <Td style={{ color: "#0369a1", fontWeight: 600 }}>{usd(t.openai)}</Td>
                      <Td style={{ fontWeight: 700 }}>{usd(tot)}</Td>
                      <Td style={{ color: "#64748b" }}>{brl(custoBrl)}</Td>
                      <Td style={{ color: "#15803d", fontWeight: 600 }}>
                        {t.revenue > 0 ? brl(t.revenue) : "—"}
                      </Td>
                      <Td style={{ fontWeight: 700, color: lucro >= 0 ? "#15803d" : "#dc2626" }}>
                        {t.revenue > 0 ? brl(lucro) : "—"}
                      </Td>
                      <Td style={{ color: "#94a3b8", fontSize: 11 }}>{t.slots}</Td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                <tr>
                  <Td style={{ fontWeight: 700, color: "#0f213f" }}>TOTAL PREVISTO</Td>
                  <Td style={{ fontWeight: 700, color: "#6d28d9" }}>{usd(totalFal)}</Td>
                  <Td style={{ fontWeight: 700, color: "#0369a1" }}>{usd(totalOai)}</Td>
                  <Td style={{ fontWeight: 700 }}>{usd(totalFal + totalOai)}</Td>
                  <Td style={{ fontWeight: 600, color: "#64748b" }}>
                    {brl((totalFal + totalOai) * settings.usd_brl_rate)}
                  </Td>
                  <Td style={{ fontWeight: 700, color: "#15803d" }}>
                    {totalRev > 0 ? brl(totalRev) : "—"}
                  </Td>
                  <Td
                    style={{
                      fontWeight: 700,
                      color:
                        totalRev - (totalFal + totalOai) * settings.usd_brl_rate >= 0
                          ? "#15803d"
                          : "#dc2626",
                    }}
                  >
                    {totalRev > 0
                      ? brl(totalRev - (totalFal + totalOai) * settings.usd_brl_rate)
                      : "—"}
                  </Td>
                  <Td style={{ color: "#94a3b8", fontSize: 11 }}>{projs.length}</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ── Compras necessárias ── */}
      <section>
        <SectionTitle>Compras necessárias (previsto − saldo atual)</SectionTitle>
        {isMobile ? (
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { label: "Próximos 30 dias", fal: buy30fal, oai: buy30oai },
              { label: "Próximos 60 dias", fal: buy60fal, oai: buy60oai },
              { label: "Próximos 90 dias", fal: buy90fal, oai: buy90oai },
            ].map(({ label, fal, oai }) => {
              const tot = fal + oai;
              const ok = tot === 0;
              return (
                <div
                  key={label}
                  style={{
                    background: ok ? "#f0fdf4" : "#fff",
                    border: `1px solid ${ok ? "#bbf7d0" : "#e2e8f0"}`,
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      marginBottom: ok ? 6 : 10,
                      color: ok ? "#15803d" : "#0f213f",
                    }}
                  >
                    {label}
                  </div>
                  {ok ? (
                    <div style={{ color: "#15803d", fontWeight: 700, fontSize: 13 }}>
                      ✓ coberto pelo saldo atual
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <ProjCell
                        label="fal.ai"
                        value={fal === 0 ? "✓ coberto" : usd(fal)}
                        color={fal === 0 ? "#15803d" : "#dc2626"}
                      />
                      <ProjCell
                        label="OpenAI"
                        value={oai === 0 ? "✓ coberto" : usd(oai)}
                        color={oai === 0 ? "#15803d" : "#dc2626"}
                      />
                      <ProjCell label="Total USD" value={usd(tot)} color="#dc2626" />
                      <ProjCell
                        label="Total R$"
                        value={`R$ ${(tot * settings.usd_brl_rate).toFixed(2)}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <Th>Horizonte de cobertura</Th>
                  <Th style={{ color: "#6d28d9" }}>fal.ai a comprar</Th>
                  <Th style={{ color: "#0369a1" }}>OpenAI a comprar</Th>
                  <Th>Total USD</Th>
                  <Th>Total R$</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Cobrir próximos 30 dias", fal: buy30fal, oai: buy30oai },
                  { label: "Cobrir próximos 60 dias", fal: buy60fal, oai: buy60oai },
                  { label: "Cobrir próximos 90 dias", fal: buy90fal, oai: buy90oai },
                ].map(({ label, fal, oai }) => {
                  const tot = fal + oai;
                  const ok = tot === 0;
                  return (
                    <tr
                      key={label}
                      style={{
                        borderTop: "1px solid #e2e8f0",
                        background: ok ? "#f0fdf4" : undefined,
                      }}
                    >
                      <Td style={{ fontWeight: 600 }}>{label}</Td>
                      <Td style={{ color: fal === 0 ? "#15803d" : "#dc2626", fontWeight: 700 }}>
                        {fal === 0 ? "✓ coberto" : usd(fal)}
                      </Td>
                      <Td style={{ color: oai === 0 ? "#15803d" : "#dc2626", fontWeight: 700 }}>
                        {oai === 0 ? "✓ coberto" : usd(oai)}
                      </Td>
                      <Td style={{ fontWeight: 700, color: ok ? "#15803d" : "#dc2626" }}>
                        {ok ? "✓ coberto" : usd(tot)}
                      </Td>
                      <Td style={{ color: "#64748b" }}>
                        {ok ? "—" : `R$ ${(tot * settings.usd_brl_rate).toFixed(2)}`}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <SupplierLink
            href="https://fal.ai/dashboard/billing"
            color="#6d28d9"
            label="Recarregar fal.ai ↗"
          />
          <SupplierLink
            href="https://platform.openai.com/settings/organization/billing"
            color="#0369a1"
            label="Recarregar OpenAI ↗"
          />
        </div>
      </section>

      {/* ── Detalhe por usuário ── */}
      <section>
        <button
          onClick={() => setShowDetail((v) => !v)}
          style={{
            fontSize: 13,
            fontWeight: 600,
            background: "none",
            border: "1px solid #cbd5e1",
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
            color: "#0f213f",
            marginBottom: 10,
          }}
        >
          {showDetail ? "▲ Ocultar detalhe" : "▼ Ver detalhe por usuário / plano"}
        </button>
        {showDetail && (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <Th>Usuário</Th>
                  <Th>Slot</Th>
                  <Th>Plano</Th>
                  <Th>Vence em</Th>
                  <Th>Dias</Th>
                  <Th>Imgs rem.</Th>
                  <Th>Renders rem.</Th>
                  <Th>Ger. rem.</Th>
                  <Th style={{ color: "#6d28d9" }}>fal.ai</Th>
                  <Th style={{ color: "#0369a1" }}>OpenAI</Th>
                  <Th>Custo USD</Th>
                  <Th style={{ color: "#15803d" }}>Receita R$</Th>
                  <Th>Lucro R$</Th>
                </tr>
              </thead>
              <tbody>
                {[...projs]
                  .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
                  .map((p, i) => {
                    const custoBrl = (p.falCost + p.openaiCost) * settings.usd_brl_rate;
                    const lucro = p.revenueBrl - custoBrl;
                    return (
                      <tr
                        key={i}
                        style={{
                          borderTop: "1px solid #f1f5f9",
                          background: p.isTest ? "#fffbeb" : p.isAdmin ? "#f0f9ff" : undefined,
                        }}
                      >
                        <Td>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>{p.userName}</span>
                            {p.isTest && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  background: "#d97706",
                                  color: "#fff",
                                  padding: "1px 4px",
                                  borderRadius: 3,
                                }}
                              >
                                TEST
                              </span>
                            )}
                            {p.isAdmin && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  background: "#0369a1",
                                  color: "#fff",
                                  padding: "1px 4px",
                                  borderRadius: 3,
                                }}
                              >
                                ADM
                              </span>
                            )}
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 11 }}>{p.userEmail}</div>
                        </Td>
                        <Td style={{ color: "#64748b" }}>{p.slot}</Td>
                        <Td style={{ fontWeight: 600 }}>{p.planCodigo}</Td>
                        <Td>{p.endDate ? fmt(p.endDate) : "—"}</Td>
                        <Td
                          style={{
                            fontWeight: 700,
                            color:
                              p.daysLeft !== null && p.daysLeft <= 30
                                ? "#dc2626"
                                : p.daysLeft !== null && p.daysLeft <= 60
                                  ? "#d97706"
                                  : "#15803d",
                          }}
                        >
                          {p.daysLeft !== null ? p.daysLeft : "—"}
                        </Td>
                        <Td>{p.remImgs}</Td>
                        <Td>{p.remRenders}</Td>
                        <Td>{p.remGeracoes}</Td>
                        <Td style={{ color: "#6d28d9", fontWeight: 600 }}>{usd(p.falCost)}</Td>
                        <Td style={{ color: "#0369a1", fontWeight: 600 }}>{usd(p.openaiCost)}</Td>
                        <Td style={{ fontWeight: 700 }}>{usd(p.falCost + p.openaiCost)}</Td>
                        <Td style={{ color: "#15803d", fontWeight: 600 }}>
                          {p.revenueBrl > 0 ? brl(p.revenueBrl) : "—"}
                        </Td>
                        <Td
                          style={{
                            fontWeight: 700,
                            color:
                              p.revenueBrl > 0 ? (lucro >= 0 ? "#15803d" : "#dc2626") : "#94a3b8",
                          }}
                        >
                          {p.revenueBrl > 0 ? brl(lucro) : "—"}
                        </Td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-componentes ──

function BalanceCard({
  supplier,
  desc,
  balance,
  rate,
  color,
  rechargeVal,
  onRechargeChange,
  onRechargeConfirm,
  saving,
}: {
  supplier: string;
  desc: string;
  balance: number;
  rate: number;
  color: string;
  rechargeVal: string;
  onRechargeChange: (v: string) => void;
  onRechargeConfirm: () => void;
  saving: boolean;
}) {
  const val = parseFloat(rechargeVal);
  const preview = !isNaN(val) && val > 0 ? val : null;
  return (
    <div
      style={{
        border: `2px solid ${color}20`,
        borderRadius: 10,
        padding: 16,
        background: `${color}08`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {supplier}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{usd(balance)}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, marginBottom: 12 }}>
        R$ {(balance * rate).toFixed(2)} · {desc}
      </div>

      <div style={{ borderTop: `1px solid ${color}20`, paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
          Saldo atual nas APIs (USD)
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={rechargeVal}
            onChange={(e) => onRechargeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRechargeConfirm();
            }}
            style={{
              flex: 1,
              padding: "6px 8px",
              border: `1px solid ${color}40`,
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color,
              background: "#fff",
              outline: "none",
            }}
          />
          <button
            onClick={onRechargeConfirm}
            disabled={saving || isNaN(val) || val <= 0}
            style={{
              padding: "6px 12px",
              background: color,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              opacity: saving || isNaN(val) || val <= 0 ? 0.5 : 1,
            }}
          >
            {saving ? "…" : "Salvar"}
          </button>
        </div>
        {preview !== null && (
          <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>
            Saldo será: {usd(preview)} · R$ {(preview * rate).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

function SupplierLink({ href, color, label }: { href: string; color: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        fontSize: 12,
        fontWeight: 700,
        color,
        border: `1px solid ${color}40`,
        padding: "6px 14px",
        borderRadius: 6,
        textDecoration: "none",
        background: `${color}08`,
      }}
    >
      {label}
    </a>
  );
}

function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f213f", marginBottom: 10, ...style }}>
      {children}
    </h3>
  );
}

const Th = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <th
    style={{
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 12,
      color: "#475569",
      fontWeight: 600,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </th>
);
const Td = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{ padding: "8px 10px", verticalAlign: "middle", ...style }}>{children}</td>
);
function ProjCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px" }}>
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color ?? "#111827" }}>{value}</div>
    </div>
  );
}
