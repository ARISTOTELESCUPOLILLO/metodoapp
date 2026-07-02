// Cálculos derivados da aba Custos — extraído de CustosTab.tsx (Fase 9).
// Função pura: recebe os dados brutos (logs, planos, perfis, admins,
// configurações) e devolve todas as visões já processadas para o render.
import { planExtrasMonthlyCost, planMonthlyFalaiCost, planMonthlyOpenaiCost } from "@/lib/costs";
import type {
  AdminRow,
  AllTimeLog,
  AppSettings,
  Log,
  Plan,
  PlanRow,
  Profile,
  TestRow,
} from "./types";

export function computeCustosView(
  logs: Log[],
  allTimeLogs: AllTimeLog[],
  plans: Plan[],
  profiles: Profile[],
  adminIds: string[],
  settings: AppSettings,
) {
  const rate = settings.usd_brl_rate;
  const adminIdSet = new Set(adminIds);

  // ── Totais gerais (período) ──
  const totalUsd = logs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const totalImgs = logs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
  const totalRenders = logs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
  const totalGeracoes = logs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);

  // ── Breakdown por tipo ──
  const isEdit = (l: Log) =>
    l.evento === "image.generate" && Number(l.custo_usd) > settings.image_base_price_usd + 0.001;
  const imgBaseLogs = logs.filter((l) => l.evento === "image.generate" && !isEdit(l));
  const imgEditLogs = logs.filter((l) => isEdit(l));
  const custoImgBase = imgBaseLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoImgEdit = imgEditLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoVideo = logs
    .filter((l) => l.evento === "video.generate")
    .reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoConteudo = logs
    .filter((l) => l.evento === "gerar_conteudo_mop")
    .reduce((s, l) => s + Number(l.custo_usd || 0), 0);

  // ── Saldo restante — somente clientes reais (exclui admin e testes) ──
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const isRealClient = (uid: string | null) =>
    uid && !adminIdSet.has(uid) && !profileMap.get(uid)?.is_test;

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
  const realProfiles = profiles.filter((p) => !p.is_test && !adminIdSet.has(p.id));

  // ── Por plano: clientes, consumo projetado, custo real do período e preços ──
  const planRows: PlanRow[] = activePlans
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
      // Quantidade projetada dos 3 contadores de camada adicional ("Gerar
      // outro" + "Sugestão" + "Primeira Geração") — custo projetado (em USD)
      // vem da FONTE ÚNICA planExtrasMonthlyCost em costs.ts (mesma fórmula
      // da aba Planos), já inclui os 3.
      const regenTextoTotal = totalClientes * p.limite_regen_texto;
      const sugestoesTotal = totalClientes * p.limite_sugestoes;
      const primeiraGeracaoTotal = totalClientes * p.limite_primeira_geracao;
      const custoExtrasPrev = totalClientes * planExtrasMonthlyCost(p);

      const planLogs = logs.filter((l) => l.user_id && userIds.has(l.user_id));
      const custoReal = planLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
      const projecao =
        planMonthlyFalaiCost(p, settings) +
        planMonthlyOpenaiCost(p, settings) +
        planExtrasMonthlyCost(p);
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
        regenTextoTotal,
        sugestoesTotal,
        primeiraGeracaoTotal,
        custoFalaiPrev,
        custoOpenaiPrev,
        custoExtrasPrev,
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
  const prevTotalExtras = planRows.reduce((s, r) => s + r.custoExtrasPrev, 0);
  const mesesFalai =
    prevTotalFalai > 0 ? (settings.falai_balance_usd / prevTotalFalai).toFixed(1) : "∞";
  const mesesOpenai =
    prevTotalOpenai > 0 ? (settings.openai_balance_usd / prevTotalOpenai).toFixed(1) : "∞";

  // ── Consumo de testes ──
  const testRows: TestRow[] = profiles
    .filter((p) => p.is_test)
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
    (l) => l.user_id && adminIdSet.has(l.user_id) && new Date(l.created_at) >= todayStart,
  );
  const adminRows: AdminRow[] = Array.from(adminIdSet)
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
    .filter((r): r is AdminRow => r !== null);

  return {
    rate,
    totalUsd,
    totalImgs,
    totalRenders,
    totalGeracoes,
    imgBaseCount: imgBaseLogs.reduce((s, l) => s + l.qtd_imagens, 0),
    imgEditCount: imgEditLogs.reduce((s, l) => s + l.qtd_imagens, 0),
    custoImgBase,
    custoImgEdit,
    custoVideo,
    custoConteudo,
    allTimeCustoFalai,
    allTimeCustoOpenai,
    saldoFalai,
    saldoOpenai,
    planRows,
    prevTotalFalai,
    prevTotalOpenai,
    prevTotalExtras,
    mesesFalai,
    mesesOpenai,
    testRows,
    adminRows,
  };
}

export type CustosView = ReturnType<typeof computeCustosView>;
