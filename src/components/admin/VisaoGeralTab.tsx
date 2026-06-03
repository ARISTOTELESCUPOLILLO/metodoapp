import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  nome: string | null;
  email: string;
  status: string;
  is_test: boolean;
  plano1_id: string | null; plano1_preco_brl: number | null;
  plano2_id: string | null; plano2_preco_brl: number | null;
  bonus_id:  string | null; bonus_preco_brl:  number | null;
}
interface Plan {
  id: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
}
interface Settings {
  image_price_usd: number;
  render_price_usd: number;
  geracao_price_usd: number;
  usd_brl_rate: number;
  falai_balance_usd: number;
  openai_balance_usd: number;
}

const R = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const U = (n: number) => `US$ ${n.toFixed(2)}`;

function coverColor(cycles: number | null) {
  if (cycles === null) return '#64748b';
  if (cycles > 2) return '#15803d';
  if (cycles > 1) return '#d97706';
  return '#dc2626';
}
function coverLabel(cycles: number | null) {
  if (cycles === null || cycles === Infinity) return '—';
  if (cycles > 20) return '> 20 ciclos';
  return `~${cycles.toFixed(1)} ciclo(s)`;
}
function coverBg(cycles: number | null) {
  if (cycles === null) return '#64748b';
  if (cycles > 2) return '#dcfce7';
  if (cycles > 1) return '#fef3c7';
  return '#fee2e2';
}

export function VisaoGeralTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: pls }, { data: roles }, { data: s }] = await Promise.all([
      supabase.from('profiles').select(
        'id,nome,email,status,is_test,' +
        'plano1_id,plano1_preco_brl,' +
        'plano2_id,plano2_preco_brl,' +
        'bonus_id,bonus_preco_brl'
      ),
      supabase.from('plans').select('id,limite_imagens,limite_renders,limite_geracoes').eq('ativo', true),
      supabase.from('user_roles').select('user_id,role'),
      supabase.from('app_settings')
        .select('image_price_usd,render_price_usd,geracao_price_usd,usd_brl_rate,falai_balance_usd,openai_balance_usd')
        .eq('id', true).maybeSingle(),
    ]);
    setProfiles((profs || []) as unknown as Profile[]);
    setPlans((pls || []) as Plan[]);
    setAdminIds(new Set<string>((roles || []).filter((r: any) => r.role === 'admin').map((r: any) => r.user_id as string)));
    if (s) setSettings(s as unknown as Settings);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p style={{ color: '#64748b', padding: 12 }}>Carregando painel…</p>;

  const admins  = profiles.filter(p => adminIds.has(p.id));
  const tests   = profiles.filter(p => p.is_test && !adminIds.has(p.id));
  const clients = profiles.filter(p => !p.is_test && !adminIds.has(p.id));
  const activeClients = clients.filter(p => p.status === 'ativo').length;

  const planMap = new Map((plans || []).map(p => [p.id, p]));
  const imgP    = settings?.image_price_usd    ?? 0.058;
  const renP    = settings?.render_price_usd   ?? 1.60;
  const gerP    = settings?.geracao_price_usd  ?? 0.013;
  const rate    = settings?.usd_brl_rate       ?? 5.8;
  const falB    = settings?.falai_balance_usd  ?? 0;
  const oaiB    = settings?.openai_balance_usd ?? 0;

  let totalSold = 0;
  let falaiCost = 0; // USD
  let openaiCost = 0; // USD

  for (const p of clients) {
    const slots = [
      { planId: p.plano1_id, preco: p.plano1_preco_brl },
      { planId: p.plano2_id, preco: p.plano2_preco_brl },
      { planId: p.bonus_id,  preco: p.bonus_preco_brl  },
    ];
    for (const s of slots) {
      if (!s.planId) continue;
      const plan = planMap.get(s.planId);
      if (!plan) continue;
      totalSold  += s.preco ?? 0;
      falaiCost  += plan.limite_imagens * imgP + plan.limite_renders * renP;
      openaiCost += plan.limite_geracoes * gerP;
    }
  }

  const totalCostBrl = (falaiCost + openaiCost) * rate;
  const lucro = totalSold - totalCostBrl;
  const margin = totalSold > 0 ? (lucro / totalSold * 100) : null;

  const falaiCycles  = falaiCost  > 0 ? falB / falaiCost  : null;
  const openaiCycles = openaiCost > 0 ? oaiB / openaiCost : null;
  const falaiBarPct  = Math.min(100, ((falaiCycles  ?? 0) / 3) * 100);
  const openaiBarPct = Math.min(100, ((openaiCycles ?? 0) / 3) * 100);

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* ── Bloco 1: Usuários ─────────────────────────── */}
      <section>
        <SectionTitle>Usuários</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <BigCard
            label="Clientes reais"
            value={String(clients.length)}
            sub={`${activeClients} ativo${activeClients !== 1 ? 's' : ''} · ${clients.length - activeClients} inativo${clients.length - activeClients !== 1 ? 's' : ''}`}
            color="#0f213f"
          />
          <BigCard label="Usuários teste"  value={String(tests.length)}   color="#92400e" />
          <BigCard label="Admins"          value={String(admins.length)}   color="#4c1d95" />
        </div>
      </section>

      {/* ── Bloco 2: Financeiro ───────────────────────── */}
      <section>
        <SectionTitle>Financeiro — clientes reais</SectionTitle>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <BigCard label="Total vendido"    value={R(totalSold)}      color="#15803d" />
          <BigCard label="Custo proj."      value={R(totalCostBrl)}   color="#b45309" />
          <BigCard
            label="Lucro estimado"
            value={R(lucro)}
            color={lucro >= 0 ? '#15803d' : '#dc2626'}
          />
          <BigCard
            label="Margem"
            value={margin !== null ? `${margin.toFixed(0)}%` : '—'}
            color={margin !== null && margin >= 0 ? '#15803d' : '#dc2626'}
          />
        </div>
        {totalSold === 0 && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            Nenhum preço preenchido ainda. Preencha o campo "R$" em cada plano do cliente (aba Clientes).
          </p>
        )}
      </section>

      {/* ── Bloco 3: Saldo das APIs ───────────────────── */}
      <section>
        <SectionTitle>Saldo das APIs</SectionTitle>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

          <ApiCard
            name="fal.ai (imagens e vídeos)"
            balance={U(falB)}
            custo={falaiCost > 0 ? `${U(falaiCost)} / ciclo` : 'Sem planos ativos'}
            cycles={falaiCycles}
            barPct={falaiBarPct}
          />

          <ApiCard
            name="OpenAI (conteúdo)"
            balance={U(oaiB)}
            custo={openaiCost > 0 ? `${U(openaiCost)} / ciclo` : 'Sem planos ativos'}
            cycles={openaiCycles}
            barPct={openaiBarPct}
          />

        </div>
      </section>

      {/* ── Rodapé ────────────────────────────────────── */}
      <p style={{ fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
        Custo proj. = 100% dos limites contratados × preço unitário × câmbio. Para consumo real, veja "Custos e Consumo".
        Cobertura = saldo da API ÷ custo projetado por ciclo dos clientes reais.
      </p>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
      {children}
    </h3>
  );
}

function BigCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 18px', minWidth: 130 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? '#0f213f', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ApiCard({ name, balance, custo, cycles, barPct }: {
  name: string; balance: string; custo: string; cycles: number | null; barPct: number;
}) {
  const cc = coverColor(cycles);
  const bg = coverBg(cycles);
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', minWidth: 240, flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f213f', marginBottom: 8 }}>{name}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: '#64748b' }}>Saldo</span>
        <span style={{ fontWeight: 700, color: '#0f213f' }}>{balance}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
        <span style={{ color: '#64748b' }}>Custo proj.</span>
        <span style={{ fontWeight: 600, color: '#b45309' }}>{custo}</span>
      </div>

      {/* Barra de cobertura */}
      <div style={{ background: '#e2e8f0', borderRadius: 99, height: 6, marginBottom: 6 }}>
        <div style={{ background: cc, borderRadius: 99, height: 6, width: `${Math.max(2, barPct)}%`, transition: 'width .3s' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>Cobertura</span>
        <span style={{ fontSize: 12, fontWeight: 700, background: bg, color: cc, padding: '2px 8px', borderRadius: 999 }}>
          {coverLabel(cycles)}
        </span>
      </div>
    </div>
  );
}
