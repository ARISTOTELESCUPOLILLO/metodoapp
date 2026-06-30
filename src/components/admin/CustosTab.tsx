import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { planMonthlyFalaiCost, planMonthlyOpenaiCost } from "@/lib/costs";

interface Log {
  user_id: string | null;
  evento: string;
  qtd_imagens: number;
  qtd_renders: number;
  qtd_geracoes: number;
  custo_usd: number;
  created_at: string;
}

interface Plan {
  id: string;
  codigo: string;
  nome: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  preco_maximo_brl: number;
  ativo: boolean;
}

interface Profile {
  id: string;
  email: string;
  nome: string;
  is_test: boolean;
  plano1_id: string | null;
  plano2_id: string | null;
  bonus_id: string | null;
  plano1_preco_brl: number | null;
  plano2_preco_brl: number | null;
  bonus_preco_brl: number | null;
}

interface AppSettings {
  usd_brl_rate: number;
  falai_balance_usd: number;
  openai_balance_usd: number;
  image_base_price_usd: number;
  image_price_usd: number;
  render_price_usd: number;
  geracao_price_usd: number;
}

export function CustosTab() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [allTimeLogs, setAllTimeLogs] = useState<
    { evento: string; custo_usd: number; user_id: string | null }[]
  >([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<AppSettings>({
    usd_brl_rate: 5.8,
    falai_balance_usd: 0,
    openai_balance_usd: 0,
    image_base_price_usd: 0.046,
    image_price_usd: 0.058,
    render_price_usd: 1.6,
    geracao_price_usd: 0.013,
  });
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [editMax, setEditMax] = useState<Record<string, string>>({});
  const [savingMax, setSavingMax] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [
      { data: ls },
      { data: ps },
      { data: profs },
      { data: cfg },
      { data: roles },
      { data: allLogs },
    ] = await Promise.all([
      supabase
        .from("usage_logs")
        .select("user_id,evento,qtd_imagens,qtd_renders,qtd_geracoes,custo_usd,created_at")
        .gte("created_at", since),
      supabase
        .from("plans")
        .select(
          "id,codigo,nome,limite_imagens,limite_renders,limite_geracoes,preco_maximo_brl,ativo",
        ),
      supabase
        .from("profiles")
        .select(
          "id,email,nome,is_test,plano1_id,plano2_id,bonus_id,plano1_preco_brl,plano2_preco_brl,bonus_preco_brl",
        ),
      supabase
        .from("app_settings")
        .select(
          "usd_brl_rate,falai_balance_usd,openai_balance_usd,image_base_price_usd,image_price_usd,render_price_usd,geracao_price_usd",
        )
        .eq("id", true)
        .maybeSingle(),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
      supabase
        .from("usage_logs")
        .select("evento,custo_usd,user_id")
        .in("evento", ["image.generate", "video.generate", "gerar_conteudo_mop"]),
    ]);
    setLogs((ls as Log[]) || []);
    setAllTimeLogs(
      (allLogs as { evento: string; custo_usd: number; user_id: string | null }[]) || [],
    );
    setPlans((ps as unknown as Plan[]) || []);
    setProfiles((profs as unknown as Profile[]) || []);
    if (cfg) {
      setSettings({
        usd_brl_rate: Number(cfg.usd_brl_rate) || 5.8,
        falai_balance_usd: Number(cfg.falai_balance_usd) || 0,
        openai_balance_usd: Number(cfg.openai_balance_usd) || 0,
        image_base_price_usd: Number(cfg.image_base_price_usd) || 0.046,
        image_price_usd: Number(cfg.image_price_usd) || 0.058,
        render_price_usd: Number(cfg.render_price_usd) || 1.6,
        geracao_price_usd: Number(cfg.geracao_price_usd) || 0.013,
      });
    }
    const aids = new Set<string>((roles || []).map((r) => r.user_id));
    setAdminIds(aids);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const rate = settings.usd_brl_rate;
  const brl = (usd: number) => `R$ ${(usd * rate).toFixed(2)}`;
  const usdFmt = (v: number) => `$${v.toFixed(3)}`;

  // ── Totais gerais (período) ──
  const totalUsd = logs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const totalImgs = logs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
  const totalRenders = logs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
  const totalGeracoes = logs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);

  // ── Breakdown por tipo ──
  const isEdit = (l: Log) =>
    l.evento === "image.generate" && Number(l.custo_usd) > settings.image_base_price_usd + 0.001;
  const custoImgBase = logs
    .filter((l) => l.evento === "image.generate" && !isEdit(l))
    .reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoImgEdit = logs
    .filter((l) => isEdit(l))
    .reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoVideo = logs
    .filter((l) => l.evento === "video.generate")
    .reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoConteudo = logs
    .filter((l) => l.evento === "gerar_conteudo_mop")
    .reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoFalai = custoImgBase + custoImgEdit + custoVideo;
  const custoOpenai = custoConteudo;

  // ── Saldo restante — somente clientes reais (exclui admin e testes) ──
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const isRealClient = (uid: string | null) =>
    uid && !adminIds.has(uid) && !profileMap.get(uid)?.is_test;

  const allTimeCustoFalai = allTimeLogs
    .filter(
      (l) =>
        (l.evento === "image.generate" || l.evento === "video.generate") && isRealClient(l.user_id),
    )
    .reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const allTimeCustoOpenai = allTimeLogs
    .filter((l) => l.evento === "gerar_conteudo_mop" && isRealClient(l.user_id))
    .reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const saldoFalai = Math.max(0, settings.falai_balance_usd - allTimeCustoFalai);
  const saldoOpenai = Math.max(0, settings.openai_balance_usd - allTimeCustoOpenai);

  // ── Por cliente (usuários reais, não-teste, não-admin) ──
  const emailMap: Record<string, string> = {};
  profiles.forEach((p) => {
    emailMap[p.id] = p.email;
  });

  const activePlans = plans.filter((p) => p.ativo);

  const realProfiles = profiles.filter((p) => !p.is_test && !adminIds.has(p.id));

  // ── Por plano: clientes, consumo projetado, custo real do período e preços ──
  // (fusão de "Previsão de consumo" + "Planos ativos" — eram duas tabelas
  // quase idênticas, uma com volume/custo projetado, outra com custo real e
  // preços; juntas evitam mostrar a mesma contagem de clientes duas vezes.)
  const planRows = activePlans
    .map((p) => {
      const users = realProfiles.filter(
        (u) => u.plano1_id === p.id || u.plano2_id === p.id || u.bonus_id === p.id,
      );
      const userIds = new Set(users.map((u) => u.id));
      const totalClientes = users.length;
      const imgs = totalClientes * p.limite_imagens;
      const renders = totalClientes * p.limite_renders;
      const geracoes = totalClientes * p.limite_geracoes;
      const custoFalaiPrev = imgs * settings.image_price_usd + renders * settings.render_price_usd;
      const custoOpenaiPrev = totalClientes * planMonthlyOpenaiCost(p, settings);

      const planLogs = logs.filter((l) => l.user_id && userIds.has(l.user_id));
      const custoReal = planLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
      const projecao = planMonthlyFalaiCost(p, settings) + planMonthlyOpenaiCost(p, settings);
      // precoMin = tabela de preços: custo projetado em R$ × 3 (piso comercial)
      const precoMin = projecao * rate * 3;
      // precoMed = média dos preços efetivamente cobrados nos perfis dos clientes deste plano
      const realPrices = users
        .flatMap((u) => [
          u.plano1_id === p.id ? Number(u.plano1_preco_brl || 0) : 0,
          u.plano2_id === p.id ? Number(u.plano2_preco_brl || 0) : 0,
          u.bonus_id === p.id ? Number(u.bonus_preco_brl || 0) : 0,
        ])
        .filter((v) => v > 0);
      const precoMed =
        realPrices.length > 0 ? realPrices.reduce((a, b) => a + b, 0) / realPrices.length : null;
      const precoMax = Number(p.preco_maximo_brl || 0);
      const margemMin = precoMin > 0 ? ((precoMin - projecao * rate) / precoMin) * 100 : null;
      const margemMax = precoMax > 0 ? ((precoMax - projecao * rate) / precoMax) * 100 : null;
      return {
        planId: p.id,
        codigo: p.codigo,
        nome: p.nome,
        totalClientes,
        imgs,
        renders,
        geracoes,
        custoFalaiPrev,
        custoOpenaiPrev,
        custoRealUsd: custoReal,
        projecaoUsd: projecao,
        precoMin,
        precoMed,
        precoMax,
        margemMin,
        margemMax,
      };
    })
    .filter((r) => r.totalClientes > 0 || r.custoRealUsd > 0);

  const prevTotalFalai = planRows.reduce((s, r) => s + r.custoFalaiPrev, 0);
  const prevTotalOpenai = planRows.reduce((s, r) => s + r.custoOpenaiPrev, 0);
  const mesesFalai =
    prevTotalFalai > 0 ? (settings.falai_balance_usd / prevTotalFalai).toFixed(1) : "∞";
  const mesesOpenai =
    prevTotalOpenai > 0 ? (settings.openai_balance_usd / prevTotalOpenai).toFixed(1) : "∞";

  // ── Consumo de testes ──
  const testProfiles = profiles.filter((p) => p.is_test);
  const testRows = testProfiles
    .map((p) => {
      const pLogs = logs.filter((l) => l.user_id === p.id);
      const imgs = pLogs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
      const renders = pLogs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
      const geracoes = pLogs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);
      const custoUsd = pLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
      return { id: p.id, nome: p.nome || p.email, imgs, renders, geracoes, custoUsd };
    })
    .filter((r) => r.imgs + r.renders + r.geracoes > 0);

  // ── Consumo de admins (a partir de hoje) ──
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const adminLogs = logs.filter(
    (l) => l.user_id && adminIds.has(l.user_id) && new Date(l.created_at) >= todayStart,
  );
  const adminRows = Array.from(adminIds)
    .map((aid) => {
      const aLogs = adminLogs.filter((l) => l.user_id === aid);
      if (!aLogs.length) return null;
      const email = emailMap[aid] || aid.slice(0, 8);
      const imgs = aLogs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
      const renders = aLogs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
      const geracoes = aLogs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);
      const custoUsd = aLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
      return { aid, email, imgs, renders, geracoes, custoUsd };
    })
    .filter(Boolean) as {
    aid: string;
    email: string;
    imgs: number;
    renders: number;
    geracoes: number;
    custoUsd: number;
  }[];

  async function zerarConsumo() {
    if (
      !confirm(
        "ATENÇÃO: Isso vai deletar TODOS os logs de consumo e zerar os contadores de uso de todos os perfis. Esta ação não pode ser desfeita. Continuar?",
      )
    )
      return;
    await supabase.rpc("reset_all_usage");
    load();
  }

  async function saveMax(planId: string) {
    const val = parseFloat(editMax[planId] ?? "");
    if (isNaN(val)) return;
    setSavingMax(planId);
    await supabase.from("plans").update({ preco_maximo_brl: val }).eq("id", planId);
    setSavingMax(null);
    setEditMax((m) => {
      const n = { ...m };
      delete n[planId];
      return n;
    });
    await load();
  }

  const margemColor = (m: number | null) =>
    m === null ? "#94a3b8" : m >= 50 ? "#16a34a" : m >= 0 ? "#d97706" : "#dc2626";

  return (
    <div>
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
        <span style={{ fontSize: 11, color: "#94a3b8" }}>US$ 1 = R$ {rate.toFixed(2)}</span>
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
          {/* ── Saldos disponíveis ── */}
          <Section title="Saldo disponível nas APIs">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <SummaryCard
                label="fal.ai — saldo inicial"
                value={`$${settings.falai_balance_usd.toFixed(2)}`}
                sub={brl(settings.falai_balance_usd)}
                description="Valor total que você depositou na fal.ai. Defina em Ajustes de custo."
              />
              <SummaryCard
                label="fal.ai — consumido (clientes)"
                value={`-$${allTimeCustoFalai.toFixed(3)}`}
                sub={brl(allTimeCustoFalai)}
                warn
                description="Gasto dos clientes reais em imagens e vídeos. Admin e testes não entram neste cálculo."
              />
              <SummaryCard
                label="fal.ai — restante"
                value={`$${saldoFalai.toFixed(2)}`}
                sub={brl(saldoFalai)}
                highlight={saldoFalai < settings.falai_balance_usd * 0.3}
                description={
                  saldoFalai < settings.falai_balance_usd * 0.3
                    ? `Saldo informado menos consumo dos clientes reais. Abaixo de 30% — considere recarregar o fal.ai.`
                    : `Saldo informado menos consumo dos clientes reais. Admin e testes não afetam este valor.`
                }
              />
              <SummaryCard
                label="OpenAI — saldo inicial"
                value={`$${settings.openai_balance_usd.toFixed(2)}`}
                sub={brl(settings.openai_balance_usd)}
                description="Valor disponível na sua conta OpenAI. Defina em Ajustes de custo."
              />
              <SummaryCard
                label="OpenAI — consumido (clientes)"
                value={`-$${allTimeCustoOpenai.toFixed(3)}`}
                sub={brl(allTimeCustoOpenai)}
                warn
                description="Gasto dos clientes reais em gerações de conteúdo. Admin e testes não entram neste cálculo."
              />
              <SummaryCard
                label="OpenAI — restante"
                value={`$${saldoOpenai.toFixed(2)}`}
                sub={brl(saldoOpenai)}
                highlight={saldoOpenai < settings.openai_balance_usd * 0.3}
                description={
                  saldoOpenai < settings.openai_balance_usd * 0.3
                    ? `Saldo informado menos consumo dos clientes reais. Abaixo de 30% — considere recarregar o OpenAI.`
                    : `Saldo informado menos consumo dos clientes reais. Admin e testes não afetam este valor.`
                }
              />
            </div>
          </Section>

          {/* ── Cards gerais ── */}
          <Section title="Resumo do período">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 10,
              }}
            >
              <SummaryCard label="Custo total" value={usdFmt(totalUsd)} sub={brl(totalUsd)} dark />
              <SummaryCard
                label="Imagens"
                value={String(totalImgs)}
                sub={usdFmt(custoImgBase + custoImgEdit)}
              />
              <SummaryCard
                label="Vídeos + render"
                value={String(totalRenders)}
                sub={usdFmt(custoVideo)}
              />
              <SummaryCard
                label="Conteúdos"
                value={String(totalGeracoes)}
                sub={usdFmt(custoConteudo)}
              />
            </div>
          </Section>

          {/* ── Previsão de consumo por plano ativo ── */}
          {/* ── Breakdown por tipo ── */}
          <Section title="Breakdown por tipo de operação">
            <div style={tblWrap}>
              <table style={tbl}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <Th>Tipo</Th>
                    <Th>Qtd</Th>
                    <Th>Custo unit.</Th>
                    <Th>USD</Th>
                    <Th>R$</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={tRow}>
                    <Td>
                      <b>fal.ai</b> — Imagem base
                    </Td>
                    <Td>
                      {logs
                        .filter((l) => l.evento === "image.generate" && !isEdit(l))
                        .reduce((s, l) => s + l.qtd_imagens, 0)}
                    </Td>
                    <Td>${settings.image_base_price_usd.toFixed(4)}</Td>
                    <Td>{usdFmt(custoImgBase)}</Td>
                    <Td>{brl(custoImgBase)}</Td>
                  </tr>
                  <tr style={tRow}>
                    <Td>
                      <b>fal.ai</b> — Imagem c/ refs
                    </Td>
                    <Td>{logs.filter((l) => isEdit(l)).reduce((s, l) => s + l.qtd_imagens, 0)}</Td>
                    <Td>${settings.image_price_usd.toFixed(4)}</Td>
                    <Td>{usdFmt(custoImgEdit)}</Td>
                    <Td>{brl(custoImgEdit)}</Td>
                  </tr>
                  <tr style={tRow}>
                    <Td>
                      <b>fal.ai</b> — Vídeo + render
                    </Td>
                    <Td>{totalRenders}</Td>
                    <Td>${settings.render_price_usd.toFixed(3)}</Td>
                    <Td>{usdFmt(custoVideo)}</Td>
                    <Td>{brl(custoVideo)}</Td>
                  </tr>
                  <tr style={tRow}>
                    <Td>
                      <b>OpenAI</b> — Conteúdo
                    </Td>
                    <Td>{totalGeracoes}</Td>
                    <Td>${settings.geracao_price_usd.toFixed(4)}</Td>
                    <Td>{usdFmt(custoConteudo)}</Td>
                    <Td>{brl(custoConteudo)}</Td>
                  </tr>
                  <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                    <Td>TOTAL</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>{usdFmt(totalUsd)}</Td>
                    <Td>{brl(totalUsd)}</Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── Por plano (preço mínimo/máximo) ── */}
          <Section title="Planos ativos — consumo, custo e preços">
            <div style={tblWrap}>
              <table style={tbl}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <Th>Plano</Th>
                    <Th>Clientes</Th>
                    <Th>Imgs</Th>
                    <Th>Vídeos</Th>
                    <Th>Conteúdos</Th>
                    <Th>fal.ai R$</Th>
                    <Th>OpenAI R$</Th>
                    <Th>Custo real R$</Th>
                    <Th>Custo proj. R$</Th>
                    <Th>
                      Preço mín. R$ <span style={{ fontWeight: 400, fontSize: 10 }}>(custo×3)</span>
                    </Th>
                    <Th>
                      Preço méd. real{" "}
                      <span style={{ fontWeight: 400, fontSize: 10 }}>(média cobrada)</span>
                    </Th>
                    <Th>Preço máx. R$</Th>
                    <Th>Marg. mín.</Th>
                    <Th>Marg. máx.</Th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((r) => (
                    <tr key={r.planId} style={tRow}>
                      <Td>
                        <b>{r.codigo}</b>{" "}
                        <span style={{ color: "#94a3b8", fontSize: 11 }}>{r.nome}</span>
                      </Td>
                      <Td>{r.totalClientes}</Td>
                      <Td>{r.imgs}</Td>
                      <Td>{r.renders}</Td>
                      <Td>{r.geracoes}</Td>
                      <Td>{brl(r.custoFalaiPrev)}</Td>
                      <Td>{brl(r.custoOpenaiPrev)}</Td>
                      <Td>{brl(r.custoRealUsd)}</Td>
                      <Td style={{ color: "#64748b" }}>{brl(r.projecaoUsd)}</Td>
                      <Td style={{ color: "#15803d", fontWeight: 600 }}>
                        R$ {r.precoMin.toFixed(2)}
                      </Td>
                      <Td style={{ color: "#0f172a" }}>
                        {r.precoMed !== null ? (
                          `R$ ${r.precoMed.toFixed(2)}`
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </Td>
                      <Td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editMax[r.planId] ?? (r.precoMax ? String(r.precoMax) : "")}
                          onChange={(e) =>
                            setEditMax((m) => ({ ...m, [r.planId]: e.target.value }))
                          }
                          onBlur={() => editMax[r.planId] !== undefined && saveMax(r.planId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveMax(r.planId);
                          }}
                          disabled={savingMax === r.planId}
                          style={{
                            width: 70,
                            padding: "2px 4px",
                            fontSize: 12,
                            fontWeight: 600,
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                          }}
                        />
                      </Td>
                      <Td>
                        <span style={{ color: margemColor(r.margemMin), fontWeight: 700 }}>
                          {r.margemMin !== null ? `${r.margemMin.toFixed(0)}%` : "—"}
                        </span>
                      </Td>
                      <Td>
                        <span style={{ color: margemColor(r.margemMax), fontWeight: 700 }}>
                          {r.margemMax !== null ? `${r.margemMax.toFixed(0)}%` : "—"}
                        </span>
                      </Td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                    <Td>TOTAL</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>{brl(prevTotalFalai)}</Td>
                    <Td>{brl(prevTotalOpenai)}</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>—</Td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
              Preço mín. = custo projetado R$ × 3 (automático). Preço méd. = média dos preços
              cobrados nos perfis dos clientes (automático). Preço máx. é editável aqui — clique e
              digite. Margem calculada sobre projeção de 100% de uso. Saldo cobre aprox.{" "}
              <b>{mesesFalai} ciclos</b> fal.ai · <b>{mesesOpenai} ciclos</b> OpenAI.
            </p>
          </Section>

          {/* ── Consumo de testes ── */}
          {testRows.length > 0 && (
            <Section title="Consumo de contas de teste">
              <div style={tblWrap}>
                <table style={tbl}>
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>
                      <Th>Nome teste</Th>
                      <Th>Imgs</Th>
                      <Th>Vídeos</Th>
                      <Th>Conteúdos</Th>
                      <Th>USD</Th>
                      <Th>R$</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {testRows.map((r) => (
                      <tr key={r.id} style={tRow}>
                        <Td>{r.nome}</Td>
                        <Td>{r.imgs}</Td>
                        <Td>{r.renders}</Td>
                        <Td>{r.geracoes}</Td>
                        <Td>{usdFmt(r.custoUsd)}</Td>
                        <Td>{brl(r.custoUsd)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── Consumo de admins (hoje) ── */}
          {adminRows.length > 0 && (
            <Section title="Consumo de admins — hoje">
              <div style={tblWrap}>
                <table style={tbl}>
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>
                      <Th>Admin</Th>
                      <Th>Imgs</Th>
                      <Th>Vídeos</Th>
                      <Th>Conteúdos</Th>
                      <Th>USD</Th>
                      <Th>R$</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminRows.map((r) => (
                      <tr key={r.aid} style={tRow}>
                        <Td>{r.email}</Td>
                        <Td>{r.imgs}</Td>
                        <Td>{r.renders}</Td>
                        <Td>{r.geracoes}</Td>
                        <Td>{usdFmt(r.custoUsd)}</Td>
                        <Td>{brl(r.custoUsd)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  description,
  dark,
  warn,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  description?: string;
  dark?: boolean;
  warn?: boolean;
  highlight?: boolean;
}) {
  const bg = dark ? "var(--brand-primary)" : highlight ? "#fef2f2" : warn ? "#fffbeb" : "#f1f5f9";
  const col = dark ? "#fff" : "#0f172a";
  const subCol = dark ? "rgba(255,255,255,.5)" : warn ? "#92400e" : "#94a3b8";
  return (
    <div style={{ background: bg, padding: "12px 14px", borderRadius: 10 }}>
      <div
        style={{ fontSize: 11, color: dark ? "rgba(255,255,255,.6)" : "#64748b", marginBottom: 2 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subCol, marginTop: 1 }}>{sub}</div>}
      {description && (
        <div
          style={{
            fontSize: 10,
            color: dark ? "rgba(255,255,255,.4)" : "#94a3b8",
            marginTop: 6,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
}

const tblWrap: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  overflowX: "auto",
};
const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const tRow: React.CSSProperties = { borderTop: "1px solid #e2e8f0" };
const Th = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <th
    style={{
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 12,
      color: "#475569",
      fontWeight: 600,
      ...style,
    }}
  >
    {children}
  </th>
);
const Td = ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{ padding: "8px 10px", ...style }}>{children}</td>
);
