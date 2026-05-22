import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { COST_USD } from '@/lib/costs';

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
}

interface Profile {
  id: string;
  email: string;
  plano1_id: string | null;
  plano2_id: string | null;
}

interface ClientRow {
  userId: string;
  email: string;
  imgs: number;
  renders: number;
  geracoes: number;
  custoUsd: number;
}

interface PlanRow {
  planId: string;
  codigo: string;
  nome: string;
  precoVendaUsd: number;
  custoEstimadoUsd: number;
  custoRealUsd: number;
  usuarios: number;
  receitaUsd: number;
  margemPct: number | null;
  projecaoUsd: number;
}

export function CustosTab() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [usdRate, setUsdRate] = useState(5.5);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const [{ data: ls }, { data: ps }, { data: profs }, { data: settings }] = await Promise.all([
      supabase.from('usage_logs').select('user_id,evento,qtd_imagens,qtd_renders,qtd_geracoes,custo_usd,created_at').gte('created_at', since),
      supabase.from('plans').select('id,codigo,nome,valor_plano,custo_total_usd,limite_imagens,limite_renders,limite_geracoes').eq('ativo', true),
      supabase.from('profiles').select('id,email,plano1_id,plano2_id'),
      supabase.from('app_settings').select('usd_brl_rate').eq('id', true).maybeSingle(),
    ]);
    setLogs((ls as Log[]) || []);
    setPlans((ps as unknown as Plan[]) || []);
    setProfiles((profs as Profile[]) || []);
    if (settings?.usd_brl_rate) setUsdRate(Number(settings.usd_brl_rate));
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  // ── Totais gerais ──
  const totalUsd = logs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const totalImgs = logs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
  const totalRenders = logs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
  const totalGeracoes = logs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);

  // ── Breakdown por tipo ──
  const custoImgBase = logs.filter(l => l.evento === 'image.generate').reduce((s, l) => {
    const isEdit = Number(l.custo_usd) === COST_USD.image_edit || (Number(l.custo_usd) > COST_USD.image_base + 0.001);
    return isEdit ? s : s + Number(l.custo_usd || 0);
  }, 0);
  const custoImgEdit = logs.filter(l => l.evento === 'image.generate').reduce((s, l) => {
    const isEdit = Number(l.custo_usd) === COST_USD.image_edit || (Number(l.custo_usd) > COST_USD.image_base + 0.001);
    return isEdit ? s + Number(l.custo_usd || 0) : s;
  }, 0);
  const custoVideo = logs.filter(l => l.evento === 'video.generate').reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const custoConteudo = logs.filter(l => l.evento === 'gerar_conteudo_mop').reduce((s, l) => s + Number(l.custo_usd || 0), 0);

  // ── Por cliente ──
  const emailMap: Record<string, string> = {};
  profiles.forEach(p => { emailMap[p.id] = p.email; });

  const clientMap: Record<string, ClientRow> = {};
  logs.forEach(l => {
    if (!l.user_id) return;
    if (!clientMap[l.user_id]) {
      clientMap[l.user_id] = { userId: l.user_id, email: emailMap[l.user_id] || l.user_id.slice(0, 8), imgs: 0, renders: 0, geracoes: 0, custoUsd: 0 };
    }
    clientMap[l.user_id].imgs += l.qtd_imagens || 0;
    clientMap[l.user_id].renders += l.qtd_renders || 0;
    clientMap[l.user_id].geracoes += l.qtd_geracoes || 0;
    clientMap[l.user_id].custoUsd += Number(l.custo_usd || 0);
  });
  const clientRows = Object.values(clientMap).sort((a, b) => b.custoUsd - a.custoUsd);

  // ── Por plano ──
  const planRows: PlanRow[] = plans.map(p => {
    const users = profiles.filter(u => u.plano1_id === p.id || u.plano2_id === p.id);
    const userIds = new Set(users.map(u => u.id));
    const planLogs = logs.filter(l => l.user_id && userIds.has(l.user_id));
    const custoReal = planLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
    const receita = users.length * Number(p.valor_plano);
    const margem = receita > 0 ? ((receita - custoReal) / receita) * 100 : null;
    const projecao = (Number(p.custo_total_usd) || (
      p.limite_imagens * COST_USD.image_base +
      p.limite_renders * COST_USD.video +
      p.limite_geracoes * COST_USD.content
    ));
    return {
      planId: p.id,
      codigo: p.codigo,
      nome: p.nome,
      precoVendaUsd: Number(p.valor_plano),
      custoEstimadoUsd: projecao,
      custoRealUsd: custoReal,
      usuarios: users.length,
      receitaUsd: receita,
      margemPct: margem,
      projecaoUsd: projecao,
    };
  }).sort((a, b) => b.custoRealUsd - a.custoRealUsd);

  const brl = (usd: number) => `R$ ${(usd * usdRate).toFixed(2)}`;
  const usdFmt = (v: number) => `$${v.toFixed(3)}`;

  return (
    <div>
      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Custos de API</h2>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>câmbio US$ 1 = R$ {usdRate.toFixed(2)}</span>
        <button onClick={load} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
          ↻ Atualizar
        </button>
      </div>

      {loading ? <p style={{ color: '#64748b' }}>Carregando…</p> : (
        <>
          {/* ── Cards gerais ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
            <SummaryCard label="Custo total" value={usdFmt(totalUsd)} sub={brl(totalUsd)} highlight />
            <SummaryCard label="Imagens" value={String(totalImgs)} sub={usdFmt(custoImgBase + custoImgEdit)} />
            <SummaryCard label="Vídeos" value={String(totalRenders)} sub={usdFmt(custoVideo)} />
            <SummaryCard label="Conteúdos" value={String(totalGeracoes)} sub={usdFmt(custoConteudo)} />
          </div>

          {/* ── Breakdown por tipo ── */}
          <Section title="Breakdown por tipo de operação">
            <table style={tbl}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <Th>Tipo</Th><Th>Qtd</Th><Th>Custo unit.</Th><Th>Custo total USD</Th><Th>Custo total R$</Th>
                </tr>
              </thead>
              <tbody>
                <tr style={tRow}>
                  <Td><b>fal.ai</b> — Imagem base</Td>
                  <Td>{logs.filter(l => l.evento === 'image.generate' && Number(l.custo_usd) <= COST_USD.image_base + 0.001).reduce((s,l) => s + l.qtd_imagens, 0)}</Td>
                  <Td>${COST_USD.image_base}</Td>
                  <Td>{usdFmt(custoImgBase)}</Td>
                  <Td>{brl(custoImgBase)}</Td>
                </tr>
                <tr style={tRow}>
                  <Td><b>fal.ai</b> — Imagem c/ refs</Td>
                  <Td>{logs.filter(l => l.evento === 'image.generate' && Number(l.custo_usd) > COST_USD.image_base + 0.001).reduce((s,l) => s + l.qtd_imagens, 0)}</Td>
                  <Td>${COST_USD.image_edit}</Td>
                  <Td>{usdFmt(custoImgEdit)}</Td>
                  <Td>{brl(custoImgEdit)}</Td>
                </tr>
                <tr style={tRow}>
                  <Td><b>fal.ai</b> — Vídeo (VEO 3)</Td>
                  <Td>{totalRenders}</Td>
                  <Td>${COST_USD.video}</Td>
                  <Td>{usdFmt(custoVideo)}</Td>
                  <Td>{brl(custoVideo)}</Td>
                </tr>
                <tr style={tRow}>
                  <Td><b>OpenAI</b> — Conteúdo</Td>
                  <Td>{totalGeracoes}</Td>
                  <Td>${COST_USD.content}</Td>
                  <Td>{usdFmt(custoConteudo)}</Td>
                  <Td>{brl(custoConteudo)}</Td>
                </tr>
                <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                  <Td>TOTAL</Td><Td>—</Td><Td>—</Td>
                  <Td>{usdFmt(totalUsd)}</Td>
                  <Td>{brl(totalUsd)}</Td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* ── Por cliente ── */}
          <Section title="Custo por cliente">
            {clientRows.length === 0
              ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Sem consumo no período.</p>
              : (
                <table style={tbl}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr><Th>Cliente</Th><Th>Imgs</Th><Th>Vídeos</Th><Th>Conteúdos</Th><Th>Custo USD</Th><Th>Custo R$</Th></tr>
                  </thead>
                  <tbody>
                    {clientRows.map(r => (
                      <tr key={r.userId} style={tRow}>
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
              )}
          </Section>

          {/* ── Por plano ── */}
          <Section title="Custo vs Receita por plano">
            <table style={tbl}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <Th>Plano</Th>
                  <Th>Usuários</Th>
                  <Th>Custo real USD</Th>
                  <Th>Projeção (100%)</Th>
                  <Th>Preço venda</Th>
                  <Th>Receita total</Th>
                  <Th>Margem</Th>
                </tr>
              </thead>
              <tbody>
                {planRows.map(r => (
                  <tr key={r.planId} style={tRow}>
                    <Td><b>{r.codigo}</b> <span style={{ color: '#94a3b8', fontSize: 11 }}>{r.nome}</span></Td>
                    <Td>{r.usuarios}</Td>
                    <Td>{usdFmt(r.custoRealUsd)}</Td>
                    <Td style={{ color: '#64748b' }}>{usdFmt(r.projecaoUsd)}</Td>
                    <Td>${Number(r.precoVendaUsd).toFixed(2)}</Td>
                    <Td>${r.receitaUsd.toFixed(2)}</Td>
                    <Td>
                      {r.margemPct === null
                        ? <span style={{ color: '#94a3b8' }}>—</span>
                        : <span style={{ fontWeight: 700, color: r.margemPct >= 50 ? '#16a34a' : r.margemPct >= 0 ? '#d97706' : '#dc2626' }}>
                            {r.margemPct.toFixed(1)}%
                          </span>
                      }
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
              * Projeção = custo se o cliente usar 100% dos limites do plano.
              Custo real = consumo registrado no período selecionado.
            </p>
          </Section>

          {/* ── Tabela de preços configurados ── */}
          <Section title="Preços unitários configurados">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Imagem base (GPT-Image-2)', value: COST_USD.image_base },
                { label: 'Imagem c/ refs (edit)', value: COST_USD.image_edit },
                { label: 'Vídeo VEO 3 + render', value: COST_USD.video },
                { label: 'Conteúdo gpt-4.1-mini', value: COST_USD.content },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#f1f5f9', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                  <div style={{ color: '#64748b', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>${value} / un</div>
                  <div style={{ color: '#94a3b8' }}>{brl(value)} / un</div>
                </div>
              ))}
            </div>
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

function SummaryCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? '#0f213f' : '#f1f5f9', padding: '12px 14px', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: highlight ? 'rgba(255,255,255,.6)' : '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: highlight ? '#fff' : '#0f172a' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: highlight ? 'rgba(255,255,255,.5)' : '#94a3b8', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' };
const tRow: React.CSSProperties = { borderTop: '1px solid #e2e8f0' };
const Th = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) =>
  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600, ...style }}>{children}</th>;
const Td = ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) =>
  <td style={{ padding: '8px 10px', ...style }}>{children}</td>;
