import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface Log {
  id: string;
  created_at: string;
  user_id: string | null;
  evento: string;
  modulo: string | null;
  qtd_imagens: number;
  qtd_renders: number;
  qtd_geracoes: number;
  custo_usd: number;
}

export function UsageTab() {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<Log[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [days, setDays] = useState(30);
  const [usdRate, setUsdRate] = useState(5);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [{ data: ls }, { data: profs }, { data: settings }] = await Promise.all([
      supabase.from('usage_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('id,email,nome'),
      supabase.from('app_settings').select('usd_brl_rate').eq('id', true).maybeSingle(),
    ]);
    setLogs((ls as Log[]) || []);
    const emailMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    (profs || []).forEach((p: any) => { emailMap[p.id] = p.email; if (p.nome) nameMap[p.id] = p.nome; });
    setEmails(emailMap);
    setNames(nameMap);
    if (settings) setUsdRate(Number(settings.usd_brl_rate));
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const q = search.toLowerCase().trim();
  const filteredLogs = q
    ? logs.filter(l => {
        const email = l.user_id ? (emails[l.user_id] || '') : '';
        const nome = l.user_id ? (names[l.user_id] || '') : '';
        return email.toLowerCase().includes(q)
          || nome.toLowerCase().includes(q)
          || (l.user_id || '').toLowerCase().startsWith(q)
          || (l.modulo || '').toLowerCase().includes(q)
          || l.evento.toLowerCase().includes(q);
      })
    : logs;

  const totalImgs = filteredLogs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
  const totalRenders = filteredLogs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
  const totalGeracoes = filteredLogs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);
  const totalUsd = filteredLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const totalBrl = totalUsd * usdRate;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Consumo</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <span style={{ fontSize: 12, color: '#64748b' }}>câmbio US$ 1 = R$ {usdRate.toFixed(2)}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            placeholder="Buscar por nome, e-mail, evento ou módulo"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, minWidth: 240 }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#f1f5f9', fontSize: 12, cursor: 'pointer', color: '#475569' }}>
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Card label="Imagens" value={totalImgs.toLocaleString('pt-BR')} />
        <Card label="Renders" value={totalRenders.toLocaleString('pt-BR')} />
        <Card label="Gerações" value={totalGeracoes.toLocaleString('pt-BR')} />
        <Card label="Custo US$" value={`$ ${totalUsd.toFixed(2)}`} />
        <Card label="Custo R$" value={`R$ ${totalBrl.toFixed(2)}`} />
      </div>

      {loading ? <p>Carregando…</p> : isMobile ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {filteredLogs.map((l) => (
            <div key={l.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>{l.evento}</strong>
                <span style={{ color: '#64748b', fontSize: 12 }}>{new Date(l.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div style={{ color: '#475569', fontSize: 12, marginBottom: 6, wordBreak: 'break-all' }}>
                {l.user_id ? (emails[l.user_id] || l.user_id.slice(0, 8)) : '—'}{l.modulo ? ` · ${l.modulo}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
                <span>Img: <strong>{l.qtd_imagens}</strong></span>
                <span>Rdr: <strong>{l.qtd_renders}</strong></span>
                <span>Ger: <strong>{l.qtd_geracoes}</strong></span>
                <span>US$ <strong>{Number(l.custo_usd).toFixed(2)}</strong></span>
                <span>R$ <strong>{(Number(l.custo_usd) * usdRate).toFixed(2)}</strong></span>
              </div>
            </div>
          ))}
          {filteredLogs.length === 0 && <p style={{ textAlign: 'center', color: '#64748b' }}>Sem registros no período.</p>}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <Th>Data</Th><Th>Usuário</Th><Th>Evento</Th><Th>Módulo</Th>
                <Th>Imgs</Th><Th>Renders</Th><Th>Ger.</Th><Th>US$</Th><Th>R$</Th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <Td>{new Date(l.created_at).toLocaleString('pt-BR')}</Td>
                  <Td>{l.user_id ? (emails[l.user_id] || l.user_id.slice(0, 8)) : '—'}</Td>
                  <Td>{l.evento}</Td>
                  <Td>{l.modulo || '—'}</Td>
                  <Td>{l.qtd_imagens}</Td>
                  <Td>{l.qtd_renders}</Td>
                  <Td>{l.qtd_geracoes}</Td>
                  <Td>{Number(l.custo_usd).toFixed(2)}</Td>
                  <Td>{(Number(l.custo_usd) * usdRate).toFixed(2)}</Td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>Sem registros no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Th = ({ children }: any) => <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>{children}</th>;
const Td = ({ children }: any) => <td style={{ padding: '8px 10px' }}>{children}</td>;
const Card = ({ label, value }: { label: string; value: string }) => (
  <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 8 }}>
    <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: '#0f213f', marginTop: 2 }}>{value}</div>
  </div>
);
