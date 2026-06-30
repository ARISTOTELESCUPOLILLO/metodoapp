import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { planMonthlyCost } from "@/lib/costs";

interface Plan {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
}

interface Profile {
  id: string;
  nome: string | null;
  email: string;
  status: string;
  is_test: boolean;
  segmento: string | null;
  plano1_id: string | null;
  plano1_inicio: string | null;
  plano1_preco_brl: number | null;
  plano2_id: string | null;
  plano2_inicio: string | null;
  plano2_preco_brl: number | null;
  bonus_id: string | null;
  bonus_inicio: string | null;
  bonus_preco_brl: number | null;
}

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

const fmtDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

type SlotStatus = "ativo" | "bloqueado" | "concluido";
const STATUS_ORDER: Record<SlotStatus, number> = { ativo: 0, bloqueado: 1, concluido: 2 };
const STATUS_COLOR: Record<SlotStatus, string> = {
  ativo: "#15803d",
  bloqueado: "#b91c1c",
  concluido: "#94a3b8",
};
const STATUS_BG: Record<SlotStatus, string> = {
  ativo: "#dcfce7",
  bloqueado: "#fee2e2",
  concluido: "#f1f5f9",
};

export function ClientesFinanceiroTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [usdRate, setUsdRate] = useState(5.8);
  const [imgRef, setImgRef] = useState(0.058);
  const [renderPrice, setRenderPrice] = useState(1.6);
  const [geracaoPrice, setGeracaoPrice] = useState(0.013);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: pls }, { data: roles }, { data: s }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,nome,email,status,is_test,segmento," +
            "plano1_id,plano1_inicio,plano1_preco_brl," +
            "plano2_id,plano2_inicio,plano2_preco_brl," +
            "bonus_id,bonus_inicio,bonus_preco_brl",
        )
        .eq("is_test", false),
      supabase
        .from("plans")
        .select("id,codigo,nome,tipo,limite_imagens,limite_renders,limite_geracoes")
        .eq("ativo", true),
      supabase.from("user_roles").select("user_id,role"),
      supabase
        .from("app_settings")
        .select("usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd")
        .eq("id", true)
        .maybeSingle(),
    ]);
    setProfiles((profs || []) as unknown as Profile[]);
    setPlans((pls || []) as Plan[]);
    const aids = new Set<string>(
      (roles || []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );
    setAdminIds(aids);
    if (s) {
      setUsdRate(Number(s.usd_brl_rate) || 5.8);
      setImgRef(Number(s.image_price_usd) || 0.058);
      setRenderPrice(Number(s.render_price_usd) || 1.6);
      setGeracaoPrice(Number(s.geracao_price_usd) || 0.013);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const planMap = new Map(plans.map((p) => [p.id, p]));

  type SlotData = {
    label: string;
    plan: Plan;
    inicio: string | null;
    endDate: Date | null;
    status: SlotStatus;
    costBrl: number;
    soldBrl: number;
    profitBrl: number;
  };

  function buildSlots(prof: Profile): SlotData[] {
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
          image_price_usd: imgRef,
          render_price_usd: renderPrice,
          geracao_price_usd: geracaoPrice,
        });
        const costBrl = costUsd * usdRate;
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
      .filter(Boolean) as SlotData[];
  }

  const q = search.toLowerCase().trim();
  const clients = profiles
    .filter((p) => !adminIds.has(p.id))
    .filter(
      (p) => !q || (p.nome || "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    )
    .map((p) => {
      const slots = buildSlots(p).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      const totalSold = slots.reduce((s, sl) => s + sl.soldBrl, 0);
      const totalCost = slots.reduce((s, sl) => s + sl.costBrl, 0);
      return { ...p, slots, totalSold, totalCost, totalProfit: totalSold - totalCost };
    })
    .filter((p) => p.slots.length > 0)
    .sort((a, b) =>
      (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR", { sensitivity: "base" }),
    );

  if (loading) return <p style={{ color: "#64748b" }}>Carregando clientes…</p>;

  return (
    <div>
      {/* Totais gerais (Total vendido/Custo/Lucro/Margem) já estão no Painel —
          aqui só a contagem, que serve de cabeçalho da lista filtrável abaixo. */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <MiniCard label="Clientes" value={String(clients.length)} />
      </div>

      {/* Busca */}
      <input
        placeholder="Buscar por nome ou e-mail"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: "8px 12px",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          fontSize: 14,
          width: "100%",
          maxWidth: 360,
          marginBottom: 16,
          display: "block",
        }}
      />

      {clients.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Nenhum cliente encontrado.</p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {clients.map((client) => {
            const hasActive = client.slots.some((sl) => sl.status === "ativo");
            return (
              <div
                key={client.id}
                style={{
                  background: "#fff",
                  border: `1px solid ${hasActive ? "#e2e8f0" : "#f1f5f9"}`,
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {/* Cabeçalho do cliente */}
                <div
                  style={{
                    background: hasActive ? "#f8fafc" : "#f4f4f5",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--brand-primary)",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      {client.nome || "—"}
                      <span
                        style={{
                          background: client.status === "ativo" ? "#dcfce7" : "#fee2e2",
                          color: client.status === "ativo" ? "#15803d" : "#b91c1c",
                          padding: "1px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {client.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{client.email}</div>
                    {client.segmento && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                        {client.segmento}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <Stat
                      label="Custo proj."
                      value={`R$ ${client.totalCost.toFixed(2)}`}
                      color="#b45309"
                    />
                    {client.totalSold > 0 && (
                      <>
                        <Stat
                          label="Vendido"
                          value={`R$ ${client.totalSold.toFixed(2)}`}
                          color="#15803d"
                        />
                        <Stat
                          label="Lucro"
                          value={`R$ ${client.totalProfit.toFixed(2)}`}
                          color={client.totalProfit >= 0 ? "#15803d" : "#dc2626"}
                          big
                        />
                        <Stat
                          label="Margem"
                          value={`${((client.totalProfit / client.totalSold) * 100).toFixed(0)}%`}
                          color={client.totalProfit >= 0 ? "#15803d" : "#dc2626"}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Planos do cliente */}
                <div style={{ padding: "10px 14px", display: "grid", gap: 8 }}>
                  {client.slots.map((sl, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #f1f5f9",
                        borderRadius: 8,
                        padding: "10px 12px",
                        display: "flex",
                        gap: 16,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        opacity: sl.status === "concluido" ? 0.6 : 1,
                      }}
                    >
                      {/* Info do plano */}
                      <div style={{ minWidth: 160 }}>
                        <div
                          style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}
                        >
                          <span style={{ fontWeight: 700, fontSize: 12, color: "var(--brand-primary)" }}>
                            {sl.label}
                          </span>
                          <span
                            style={{
                              background: STATUS_BG[sl.status],
                              color: STATUS_COLOR[sl.status],
                              padding: "1px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {sl.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#475569" }}>
                          <strong>{sl.plan.codigo}</strong> {sl.plan.nome}
                        </div>
                        {sl.inicio && (
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                            Início: {fmtDate(new Date(sl.inicio))}
                            {sl.endDate && (
                              <>
                                {" "}
                                → {fmtDate(sl.endDate)}{" "}
                                {sl.status === "concluido" && (
                                  <span style={{ color: "#94a3b8" }}>(encerrado)</span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Financeiro do slot */}
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", flex: 1 }}>
                        <div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#94a3b8",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              marginBottom: 2,
                            }}
                          >
                            Custo proj.
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>
                            R$ {sl.costBrl.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#94a3b8",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              marginBottom: 2,
                            }}
                          >
                            Vendido
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: sl.soldBrl > 0 ? "#0f172a" : "#94a3b8",
                            }}
                          >
                            {sl.soldBrl > 0 ? `R$ ${sl.soldBrl.toFixed(2)}` : "sem preço"}
                          </div>
                        </div>
                        {sl.soldBrl > 0 && (
                          <div>
                            <div
                              style={{
                                fontSize: 10,
                                color: "#94a3b8",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                marginBottom: 2,
                              }}
                            >
                              Lucro
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: sl.profitBrl >= 0 ? "#15803d" : "#dc2626",
                              }}
                            >
                              R$ {sl.profitBrl.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 16 }}>
        "Vendido" = valor cobrado do cliente (campo R$ na aba Clientes/Usuários). "Custo proj." =
        custo projetado com 100% de uso × câmbio. "Lucro" = Vendido − Custo proj.
      </p>
    </div>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "10px 16px",
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: color ?? "var(--brand-primary)" }}>{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  big,
}: {
  label: string;
  value: string;
  color?: string;
  big?: boolean;
}) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 17 : 14, fontWeight: 800, color: color ?? "var(--brand-primary)" }}>
        {value}
      </div>
    </div>
  );
}
