import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  valor_plano: number;
  custo_total_usd: number;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  preco_maximo_brl: number;
}

interface Profile {
  id: string;
  email: string;
  nome: string;
  is_test: boolean;
  plano1_id: string | null;
  plano2_id: string | null;
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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<AppSettings>({
    usd_brl_rate: 5.5, falai_balance_usd: 0, openai_balance_usd: 0,
    image_base_price_usd: 0.046, image_price_usd: 0.058, render_price_usd: 1.50, geracao_price_usd: 0.003,
  });
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  // Preço máximo editável inline por plano
  const [precoMaxEdit, setPrecoMaxEdit] = useState<Record<string, string>>({});
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
    ] = await Promise.all([
      supabase.from('usage_logs').select('user_id,evento,qtd_imagens,qtd_renders,qtd_geracoes,custo_usd,created_at').gte('created_at', since),
      supabase.from('plans').select('id,codigo,nome,valor_plano,custo_total_usd,limite_imagens,limite_renders,limite_geracoes,preco_maximo_brl').eq('ativo', true),
      supabase.from('profiles').select('id,email,nome,is_test,plano1_id,plano2_id'),
      supabase.from('app_settings').select('usd_brl_rate,falai_balance_usd,openai_balance_usd,image_base_price_usd,image_price_usd,render_price_usd,geracao_price_usd').eq('id', true).maybeSingle(),
      supabase.from('user_roles').select('user_id').eq('role', 'admin'),
    ]);
    setLogs((ls as Log[]) || []);
    setPlans((ps as unknown as Plan[]) || []);
    setProfiles((profs as Profile[]) || []);
    if (cfg) {
      setSettings({
        usd_brl_rate: Number(cfg.usd_brl_rate) || 5.5,
        falai_balance_usd: Number((cfg as any).falai_balance_usd) || 0,
        openai_balance_usd: Number((cfg as any).openai_balance_usd) || 0,
        image_base_price_usd: Number((cfg as any).image_base_price_usd) || 0.046,
        image_price_usd: Number((cfg as any).image_price_usd) || 0.058,
        render_price_usd: Number((cfg as any).render_price_usd) || 1.50,
        geracao_price_usd: Number((cfg as any).geracao_price_usd) || 0.003,
      });
    }
    const aids = new Set<string>((roles || []).map((r: any) => r.user_id as string));
    setAdminIds(aids);
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const rate = settings.usd_brl_rate;
  const brl = (usd: number) => `R$ ${(usd * rate).toFixed(2)}`;
  const usdFmt = (v: number) => `$${v.toFixed(3)}`;

  // ── Totais gerais (período) ──
  const totalUsd = logs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const totalImgs = logs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
  const totalRenders = logs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
  const totalGeracoes = logs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);

  // ── Breakdown por tipo ──
  const isEdit = (l: Log) => l.evento === 'image.generate' && Number(l.custo_usd) > settings.image_base_price_usd + 0.001;
  const custoImgBase = logs.filter(l => l.evento === 'image.generate' && !isEdit(l)).reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoImgEdit = logs.filter(l => isEdit(l)).reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoVideo = logs.filter(l => l.evento === 'video.generate').reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoConteudo = logs.filter(l => l.evento === 'gerar_conteudo_mop').reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoFalai = custoImgBase + custoImgEdit + custoVideo;
  const custoOpenai = custoConteudo;

  // ── Saldo restante ──
  const saldoFalai = Math.max(0, settings.falai_balance_usd - custoFalai);
  const saldoOpenai = Math.max(0, settings.openai_balance_usd - custoOpenai);

  // ── Por cliente (usuários reais, não-teste, não-admin) ──
  const emailMap: Record<string, string> = {};
  profiles.forEach(p => { emailMap[p.id] = p.email; });

  const planMap: Record<string, Plan> = {};
  plans.forEach(p => { planMap[p.id] = p; });

  const realProfiles = profiles.filter(p => !p.is_test && !adminIds.has(p.id));

  // ── Consumo por cliente ──
  const clientMap: Record<string, { email: string; imgs: number; renders: number; geracoes: number; custoUsd: number }> = {};
  logs.forEach(l => {
    if (!l.user_id || adminIds.has(l.user_id)) return;
    const prof = profiles.find(p => p.id === l.user_id);
    if (prof?.is_test) return;
    if (!clientMap[l.user_id]) clientMap[l.user_id] = { email: emailMap[l.user_id] || l.user_id.slice(0, 8), imgs: 0, renders: 0, geracoes: 0, custoUsd: 0 };
    clientMap[l.user_id].imgs += l.qtd_imagens || 0;
    clientMap[l.user_id].renders += l.qtd_renders || 0;
    clientMap[l.user_id].geracoes += l.qtd_geracoes || 0;
    clientMap[l.user_id].custoUsd += Number(l.custo_usd || 0);
  });

  // ── Financeiro por cliente (com planos e preço máximo) ──
  const clienteFinanceiro = realProfiles.map(p => {
    const p1 = p.plano1_id ? planMap[p.plano1_id] : null;
    const p2 = p.plano2_id ? planMap[p.plano2_id] : null;
    const custoProj1 = p1 ? (p1.limite_imagens * settings.image_price_usd + p1.limite_renders * settings.render_price_usd + p1.limite_geracoes * settings.geracao_price_usd) : 0;
    const custoProj2 = p2 ? (p2.limite_imagens * settings.image_price_usd + p2.limite_renders * settings.render_price_usd + p2.limite_geracoes * settings.geracao_price_usd) : 0;
    const custoProjTotal = (custoProj1 + custoProj2) * rate;
    const precoMax1 = p1 ? Number(p1.preco_maximo_brl || 0) : 0;
    const precoMax2 = p2 ? Number(p2.preco_maximo_brl || 0) : 0;
    const totalVenda = precoMax1 + precoMax2;
    const margem = totalVenda > 0 ? ((totalVenda - custoProjTotal) / totalVenda) * 100 : null;
    return { id: p.id, email: p.email, nome: p.nome, p1, p2, precoMax1, precoMax2, totalVenda, custoProjTotal, margem };
  }).filter(r => r.p1 || r.p2);

  const totalVendaGeral = clienteFinanceiro.reduce((s, r) => s + r.totalVenda, 0);
  const totalCustoProjGeral = clienteFinanceiro.reduce((s, r) => s + r.custoProjTotal, 0);
  const margemGeral = totalVendaGeral > 0 ? ((totalVendaGeral - totalCustoProjGeral) / totalVendaGeral) * 100 : null;

  // ── Previsão de consumo por plano ativo ──
  const previsao = plans.map(p => {
    const users1 = profiles.filter(u => u.plano1_id === p.id);
    const users2 = profiles.filter(u => u.plano2_id === p.id);
    const totalClientes = new Set([...users1.map(u => u.id), ...users2.map(u => u.id)]).size;
    const imgs = totalClientes * p.limite_imagens;
    const renders = totalClientes * p.limite_renders;
    const geracoes = totalClientes * p.limite_geracoes;
    const custoFalaiPrev = (imgs * settings.image_price_usd + renders * settings.render_price_usd);
    const custoOpenaiPrev = geracoes * settings.geracao_price_usd;
    const totalUsdPrev = custoFalaiPrev + custoOpenaiPrev;
    return { planId: p.id, codigo: p.codigo, nome: p.nome, totalClientes, imgs, renders, geracoes, custoFalaiPrev, custoOpenaiPrev, totalUsdPrev };
  }).filter(r => r.totalClientes > 0);

  const prevTotalFalai = previsao.reduce((s, r) => s + r.custoFalaiPrev, 0);
  const prevTotalOpenai = previsao.reduce((s, r) => s + r.custoOpenaiPrev, 0);
  const prevTotal = prevTotalFalai + prevTotalOpenai;
  const mesesFalai = prevTotalFalai > 0 ? (settings.falai_balance_usd / prevTotalFalai).toFixed(1) : '∞';
  const mesesOpenai = prevTotalOpenai > 0 ? (settings.openai_balance_usd / prevTotalOpenai).toFixed(1) : '∞';

  // ── Por plano (custo real + projeção + preços) ──
  const planRows = plans.map(p => {
    const users = profiles.filter(u => u.plano1_id === p.id || u.plano2_id === p.id);
    const userIds = new Set(users.map(u => u.id));
    const planLogs = logs.filter(l => l.user_id && userIds.has(l.user_id));
    const custoReal = planLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
    const projecao = p.limite_imagens * settings.image_price_usd + p.limite_renders * settings.render_price_usd + p.limite_geracoes * settings.geracao_price_usd;
    const precoMin = projecao * rate * 4;
    const precoMax = Number(p.preco_maximo_brl || 0);
    const margemMin = precoMin > 0 ? ((precoMin - projecao * rate) / precoMin) * 100 : null;
    const margemMax = precoMax > 0 ? ((precoMax - projecao * rate) / precoMax) * 100 : null;
    return { planId: p.id, codigo: p.codigo, nome: p.nome, usuarios: users.length, custoRealUsd: custoReal, projecaoUsd: projecao, precoMin, precoMax, margemMin, margemMax };
  }).filter(r => r.usuarios > 0 || r.custoRealUsd > 0);

  // ── Consumo de testes ──
  const testProfiles = profiles.filter(p => p.is_test);
  const testRows = testProfiles.map(p => {
    const pLogs = logs.filter(l => l.user_id === p.id);
    const imgs = pLogs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
    const renders = pLogs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
    const geracoes = pLogs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);
    const custoUsd = pLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
    return { id: p.id, nome: p.nome || p.email, imgs, renders, geracoes, custoUsd };
  }).filter(r => r.imgs + r.renders + r.geracoes > 0);

  // ── Consumo de admins (a partir de hoje) ──
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const adminLogs = logs.filter(l => l.user_id && adminIds.has(l.user_id) && new Date(l.created_at) >= todayStart);
  const adminRows = Array.from(adminIds).map(aid => {
    const aLogs = adminLogs.filter(l => l.user_id === aid);
    if (!aLogs.length) return null;
    const email = emailMap[aid] || aid.slice(0, 8);
    const imgs = aLogs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
    const renders = aLogs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
    const geracoes = aLogs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);
    const custoUsd = aLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
    return { aid, email, imgs, renders, geracoes, custoUsd };
  }).filter(Boolean) as { aid: string; email: string; imgs: number; renders: number; geracoes: number; custoUsd: number }[];

  async function savePrecoMax(planId: string) {
    const val = Number(precoMaxEdit[planId]);
    if (isNaN(val)) return;
    setSavingMax(planId);
    await supabase.from('plans').update({ preco_maximo_brl: val } as any).eq('id', planId);
    setSavingMax(null);
    setPrecoMaxEdit(prev => { const n = { ...prev }; delete n[planId]; return n; });
    load();
  }

  const margemColor = (m: number | null) => m === null ? '#94a3b8' : m >= 50 ? '#16a34a' : m >= 0 ? '#d97706' : '#dc2626';

  return (
    <div>
      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Gestão de Custos e Consumo</h2>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>US$ 1 = R$ {rate.toFixed(2)}</span>
        <button onClick={load} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
          ↻ Atualizar
        </button>
      </div>

      {loading ? <p style={{ color: '#64748b' }}>Carregando…</p> : (
        <>
          {/* ── Saldos disponíveis ── */}
          <Section title="Saldo disponível nas APIs">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
              <SummaryCard label="fal.ai — saldo inicial" value={`$${settings.falai_balance_usd.toFixed(2)}`} sub={brl(settings.falai_balance_usd)} />
              <SummaryCard label="fal.ai — consumido" value={`-$${custoFalai.toFixed(3)}`} sub={brl(custoFalai)} warn />
              <SummaryCard label="fal.ai — restante" value={`$${saldoFalai.toFixed(2)}`} sub={brl(saldoFalai)} highlight={saldoFalai < settings.falai_balance_usd * 0.3} />
              <SummaryCard label="OpenAI — saldo inicial" value={`$${settings.openai_balance_usd.toFixed(2)}`} sub={brl(settings.openai_balance_usd)} />
              <SummaryCard label="OpenAI — consumido" value={`-$${custoOpenai.toFixed(3)}`} sub={brl(custoOpenai)} warn />
              <SummaryCard label="OpenAI — restante" value={`$${saldoOpenai.toFixed(2)}`} sub={brl(saldoOpenai)} highlight={saldoOpenai < settings.openai_balance_usd * 0.3} />
            </div>
          </Section>

          {/* ── Cards gerais ── */}
          <Section title="Resumo do período">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <SummaryCard label="Custo total" value={usdFmt(totalUsd)} sub={brl(totalUsd)} dark />
              <SummaryCard label="Imagens" value={String(totalImgs)} sub={usdFmt(custoImgBase + custoImgEdit)} />
              <SummaryCard label="Vídeos + render" value={String(totalRenders)} sub={usdFmt(custoVideo)} />
              <SummaryCard label="Conteúdos" value={String(totalGeracoes)} sub={usdFmt(custoConteudo)} />
            </div>
          </Section>

          {/* ── Previsão de consumo por plano ativo ── */}
          <Section title="Previsão de consumo — planos ativos (1 ciclo)">
            <div style={tblWrap}><table style={tbl}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <Th>Plano</Th><Th>Clientes</Th><Th>Imgs</Th><Th>Vídeos</Th><Th>Conteúdos</Th>
                  <Th>fal.ai USD</Th><Th>fal.ai R$</Th><Th>OpenAI USD</Th><Th>OpenAI R$</Th><Th>Total R$</Th>
                </tr>
              </thead>
              <tbody>
                {previsao.map(r => (
                  <tr key={r.planId} style={tRow}>
                    <Td><b>{r.codigo}</b> <span style={{ color: '#94a3b8', fontSize: 11 }}>{r.nome}</span></Td>
                    <Td>{r.totalClientes}</Td>
                    <Td>{r.imgs}</Td>
                    <Td>{r.renders}</Td>
                    <Td>{r.geracoes}</Td>
                    <Td>{usdFmt(r.custoFalaiPrev)}</Td>
                    <Td>{brl(r.custoFalaiPrev)}</Td>
                    <Td>{usdFmt(r.custoOpenaiPrev)}</Td>
                    <Td>{brl(r.custoOpenaiPrev)}</Td>
                    <Td style={{ fontWeight: 700 }}>{brl(r.totalUsdPrev)}</Td>
                  </tr>
                ))}
                <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                  <Td>TOTAL</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td>
                  <Td>{usdFmt(prevTotalFalai)}</Td>
                  <Td>{brl(prevTotalFalai)}</Td>
                  <Td>{usdFmt(prevTotalOpenai)}</Td>
                  <Td>{brl(prevTotalOpenai)}</Td>
                  <Td>{brl(prevTotal)}</Td>
                </tr>
              </tbody>
            </table></div>
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
              Saldo cobre aprox. <b>{mesesFalai} ciclos</b> fal.ai · <b>{mesesOpenai} ciclos</b> OpenAI (assumindo 100% de uso por ciclo).
            </p>
          </Section>

          {/* ── Breakdown por tipo ── */}
          <Section title="Breakdown por tipo de operação">
            <div style={tblWrap}><table style={tbl}>
              <thead style={{ background: '#f8fafc' }}>
                <tr><Th>Tipo</Th><Th>Qtd</Th><Th>Custo unit.</Th><Th>USD</Th><Th>R$</Th></tr>
              </thead>
              <tbody>
                <tr style={tRow}>
                  <Td><b>fal.ai</b> — Imagem base</Td>
                  <Td>{logs.filter(l => l.evento === 'image.generate' && !isEdit(l)).reduce((s, l) => s + l.qtd_imagens, 0)}</Td>
                  <Td>${settings.image_base_price_usd.toFixed(4)}</Td><Td>{usdFmt(custoImgBase)}</Td><Td>{brl(custoImgBase)}</Td>
                </tr>
                <tr style={tRow}>
                  <Td><b>fal.ai</b> — Imagem c/ refs</Td>
                  <Td>{logs.filter(l => isEdit(l)).reduce((s, l) => s + l.qtd_imagens, 0)}</Td>
                  <Td>${settings.image_price_usd.toFixed(4)}</Td><Td>{usdFmt(custoImgEdit)}</Td><Td>{brl(custoImgEdit)}</Td>
                </tr>
                <tr style={tRow}>
                  <Td><b>fal.ai</b> — Vídeo + render</Td>
                  <Td>{totalRenders}</Td>
                  <Td>${settings.render_price_usd.toFixed(3)}</Td><Td>{usdFmt(custoVideo)}</Td><Td>{brl(custoVideo)}</Td>
                </tr>
                <tr style={tRow}>
                  <Td><b>OpenAI</b> — Conteúdo</Td>
                  <Td>{totalGeracoes}</Td>
                  <Td>${settings.geracao_price_usd.toFixed(4)}</Td><Td>{usdFmt(custoConteudo)}</Td><Td>{brl(custoConteudo)}</Td>
                </tr>
                <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                  <Td>TOTAL</Td><Td>—</Td><Td>—</Td><Td>{usdFmt(totalUsd)}</Td><Td>{brl(totalUsd)}</Td>
                </tr>
              </tbody>
            </table></div>
          </Section>

          {/* ── Por plano (preço mínimo/máximo) ── */}
          <Section title="Planos ativos — custo e preços">
            <div style={tblWrap}><table style={tbl}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <Th>Plano</Th><Th>Clientes</Th>
                  <Th>Custo real R$</Th><Th>Custo proj. R$</Th>
                  <Th>Preço mín. R$</Th>
                  <Th>Preço máx. R$ <span style={{ fontWeight: 400, fontSize: 10 }}>(editável)</span></Th>
                  <Th>Marg. mín.</Th><Th>Marg. máx.</Th>
                </tr>
              </thead>
              <tbody>
                {planRows.map(r => (
                  <tr key={r.planId} style={tRow}>
                    <Td><b>{r.codigo}</b> <span style={{ color: '#94a3b8', fontSize: 11 }}>{r.nome}</span></Td>
                    <Td>{r.usuarios}</Td>
                    <Td>{brl(r.custoRealUsd)}</Td>
                    <Td style={{ color: '#64748b' }}>{brl(r.projecaoUsd)}</Td>
                    <Td style={{ color: '#0f172a', fontWeight: 600 }}>R$ {r.precoMin.toFixed(2)}</Td>
                    <Td>
                      {precoMaxEdit[r.planId] !== undefined ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            type="number"
                            value={precoMaxEdit[r.planId]}
                            onChange={e => setPrecoMaxEdit(prev => ({ ...prev, [r.planId]: e.target.value }))}
                            style={{ width: 80, padding: '3px 6px', borderRadius: 6, border: '1px solid #0891b2', fontSize: 12 }}
                          />
                          <button onClick={() => savePrecoMax(r.planId)} disabled={savingMax === r.planId}
                            style={{ padding: '3px 8px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}>
                            {savingMax === r.planId ? '…' : '✓'}
                          </button>
                          <button onClick={() => setPrecoMaxEdit(prev => { const n = { ...prev }; delete n[r.planId]; return n; })}
                            style={{ padding: '3px 6px', borderRadius: 6, background: '#fff', border: '1px solid #cbd5e1', fontSize: 12, cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <span
                          onClick={() => setPrecoMaxEdit(prev => ({ ...prev, [r.planId]: String(r.precoMax || '') }))}
                          style={{ cursor: 'pointer', color: r.precoMax ? '#0f172a' : '#94a3b8', fontWeight: r.precoMax ? 600 : 400 }}
                          title="Clique para editar"
                        >
                          {r.precoMax ? `R$ ${r.precoMax.toFixed(2)}` : '— definir'}
                        </span>
                      )}
                    </Td>
                    <Td><span style={{ color: margemColor(r.margemMin), fontWeight: 700 }}>{r.margemMin !== null ? `${r.margemMin.toFixed(0)}%` : '—'}</span></Td>
                    <Td><span style={{ color: margemColor(r.margemMax), fontWeight: 700 }}>{r.margemMax !== null ? `${r.margemMax.toFixed(0)}%` : '—'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              Preço mín. = custo projetado × câmbio × 4. Margem calculada sobre projeção de 100% de uso.
            </p>
          </Section>

          {/* ── Financeiro por cliente ── */}
          <Section title="Financeiro por cliente">
            {clienteFinanceiro.length === 0
              ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Sem clientes ativos.</p>
              : (
                <div style={tblWrap}><table style={tbl}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <Th>Cliente</Th>
                      <Th>Plano 1</Th><Th>Preço P1</Th>
                      <Th>Plano 2</Th><Th>Preço P2</Th>
                      <Th>Total venda</Th><Th>Custo proj. R$</Th><Th>Margem</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {clienteFinanceiro.map(r => (
                      <tr key={r.id} style={tRow}>
                        <Td><div style={{ fontWeight: 600, fontSize: 12 }}>{r.nome || r.email}</div><div style={{ color: '#94a3b8', fontSize: 10 }}>{r.email}</div></Td>
                        <Td>{r.p1 ? <b>{r.p1.codigo}</b> : <span style={{ color: '#94a3b8' }}>—</span>}</Td>
                        <Td>{r.precoMax1 ? `R$ ${r.precoMax1.toFixed(2)}` : <span style={{ color: '#94a3b8' }}>—</span>}</Td>
                        <Td>{r.p2 ? <b>{r.p2.codigo}</b> : <span style={{ color: '#94a3b8' }}>—</span>}</Td>
                        <Td>{r.precoMax2 ? `R$ ${r.precoMax2.toFixed(2)}` : <span style={{ color: '#94a3b8' }}>—</span>}</Td>
                        <Td style={{ fontWeight: 700 }}>{r.totalVenda ? `R$ ${r.totalVenda.toFixed(2)}` : <span style={{ color: '#94a3b8' }}>—</span>}</Td>
                        <Td style={{ color: '#64748b' }}>R$ {r.custoProjTotal.toFixed(2)}</Td>
                        <Td><span style={{ fontWeight: 700, color: margemColor(r.margem) }}>{r.margem !== null ? `${r.margem.toFixed(0)}%` : '—'}</span></Td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                      <Td>TOTAL GERAL</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td>
                      <Td>R$ {totalVendaGeral.toFixed(2)}</Td>
                      <Td>R$ {totalCustoProjGeral.toFixed(2)}</Td>
                      <Td><span style={{ color: margemColor(margemGeral) }}>{margemGeral !== null ? `${margemGeral.toFixed(0)}%` : '—'}</span></Td>
                    </tr>
                  </tbody>
                </table></div>
              )}
          </Section>

          {/* ── Consumo de testes ── */}
          {testRows.length > 0 && (
            <Section title="Consumo de contas de teste">
              <div style={tblWrap}><table style={tbl}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr><Th>Nome teste</Th><Th>Imgs</Th><Th>Vídeos</Th><Th>Conteúdos</Th><Th>USD</Th><Th>R$</Th></tr>
                </thead>
                <tbody>
                  {testRows.map(r => (
                    <tr key={r.id} style={tRow}>
                      <Td>{r.nome}</Td><Td>{r.imgs}</Td><Td>{r.renders}</Td><Td>{r.geracoes}</Td>
                      <Td>{usdFmt(r.custoUsd)}</Td><Td>{brl(r.custoUsd)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Section>
          )}

          {/* ── Consumo de admins (hoje) ── */}
          {adminRows.length > 0 && (
            <Section title="Consumo de admins — hoje">
              <div style={tblWrap}><table style={tbl}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr><Th>Admin</Th><Th>Imgs</Th><Th>Vídeos</Th><Th>Conteúdos</Th><Th>USD</Th><Th>R$</Th></tr>
                </thead>
                <tbody>
                  {adminRows.map(r => (
                    <tr key={r.aid} style={tRow}>
                      <Td>{r.email}</Td><Td>{r.imgs}</Td><Td>{r.renders}</Td><Td>{r.geracoes}</Td>
                      <Td>{usdFmt(r.custoUsd)}</Td><Td>{brl(r.custoUsd)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Section>
          )}

          {/* ── Preços unitários ── */}
          <Section title="Preços unitários configurados">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Imagem base', value: settings.image_base_price_usd },
                { label: 'Imagem c/ refs', value: settings.image_price_usd },
                { label: 'Vídeo + render', value: settings.render_price_usd },
                { label: 'Conteúdo texto', value: settings.geracao_price_usd },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#f1f5f9', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                  <div style={{ color: '#64748b', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>${value.toFixed(4)} / un</div>
                  <div style={{ color: '#94a3b8' }}>{brl(value)} / un</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Altere em <strong>Ajustes de custo</strong> — os valores refletem aqui em tempo real.</p>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #e2e8f0' }}>{title}</h3>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, sub, dark, warn, highlight }: { label: string; value: string; sub?: string; dark?: boolean; warn?: boolean; highlight?: boolean }) {
  const bg = dark ? '#0f213f' : highlight ? '#fef2f2' : warn ? '#fffbeb' : '#f1f5f9';
  const col = dark ? '#fff' : '#0f172a';
  const subCol = dark ? 'rgba(255,255,255,.5)' : warn ? '#92400e' : '#94a3b8';
  return (
    <div style={{ background: bg, padding: '12px 14px', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,.6)' : '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subCol, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

const tblWrap: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto' };
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const tRow: React.CSSProperties = { borderTop: '1px solid #e2e8f0' };
const Th = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) =>
  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600, ...style }}>{children}</th>;
const Td = ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) =>
  <td style={{ padding: '8px 10px', ...style }}>{children}</td>;
