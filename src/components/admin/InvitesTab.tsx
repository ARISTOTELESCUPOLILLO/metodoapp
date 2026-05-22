import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface Invite {
  id: string;
  nome: string | null;
  email: string;
  status: string;
  plano1_id: string | null;
  plano2_id: string | null;
  bonus_id: string | null;
  accepted_at: string | null;
  created_at: string;
}
interface Plan { id: string; codigo: string; nome: string; elegivel_bonus: boolean }

export function InvitesTab() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<Invite[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [plano1Id, setPlano1Id] = useState('');
  const [plano2Id, setPlano2Id] = useState('');
  const [bonusId, setBonusId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: inv }, { data: pls }] = await Promise.all([
      supabase.from('invited_emails').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('id,codigo,nome,elegivel_bonus').eq('ativo', true).order('nome'),
    ]);
    setRows((inv as Invite[]) || []);
    setPlans((pls as Plan[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = nome.trim();
    if (!cleanEmail.includes('@')) { setMsg('E-mail inválido.'); return; }
    if (!cleanNome) { setMsg('Informe o nome do cliente.'); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('invited_emails').insert({
      nome: cleanNome, email: cleanEmail,
      plano1_id: plano1Id || null,
      plano2_id: plano2Id || null,
      bonus_id: bonusId || null,
      invited_by: user?.id || null,
    });
    setBusy(false);
    if (error) { setMsg(error.code === '23505' ? 'Este e-mail já foi convidado.' : `Erro: ${error.message}`); return; }
    setNome(''); setEmail(''); setPlano1Id(''); setPlano2Id(''); setBonusId('');
    setMsg(`Convite criado. Envie o link de cadastro para ${cleanEmail}.`);
    load();
  }

  async function setStatus(r: Invite, status: string) {
    if (!confirm(`${status === 'revogado' ? 'Revogar' : 'Reativar'} convite de ${r.email}?`)) return;
    await supabase.from('invited_emails').update({ status }).eq('id', r.id);
    load();
  }
  async function remove(r: Invite) {
    if (!confirm(`Excluir convite de ${r.email}?\n(Se já se cadastrou, exclua-o também na aba Usuários.)`)) return;
    await supabase.from('invited_emails').delete().eq('id', r.id);
    load();
  }
  function copyLink(r: Invite) {
    const url = `${window.location.origin}/signup`;
    navigator.clipboard.writeText(url).then(
      () => alert(`Link copiado!\n\nEnvie para ${r.email}:\n${url}`),
      () => prompt('Copie o link:', url),
    );
  }

  const filtered = rows.filter((r) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (r.email || '').toLowerCase().includes(s) || (r.nome || '').toLowerCase().includes(s);
  });

  const bonusPlans = plans.filter((p) => p.elegivel_bonus);
  const mainPlans = plans.filter((p) => !p.elegivel_bonus);
  const labelFor = (id: string | null) => id ? (plans.find((p) => p.id === id)?.codigo || '—') : '—';
  const statusColor = (s: string) => s === 'aceito' ? '#15803d' : s === 'revogado' ? '#b91c1c' : '#0f213f';
  const statusLabel = (s: string) => s === 'aceito' ? 'Ativo' : s === 'revogado' ? 'Bloqueado' : 'Convidado';

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={card}>
        <h3 style={cardTitle}>＋ Pré-cadastro de Cliente</h3>
        <form onSubmit={invite} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Field label="Nome">
            <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" style={inp} />
          </Field>
          <Field label="E-mail">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@cliente.com" style={inp} />
          </Field>
          <Field label="Plano 1 (opcional)">
            <select value={plano1Id} onChange={(e) => setPlano1Id(e.target.value)} style={{ ...inp, background: '#fff' }}>
              <option value="">— Sem plano —</option>
              {mainPlans.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
            </select>
          </Field>
          <Field label="Plano 2 (opcional)">
            <select value={plano2Id} onChange={(e) => setPlano2Id(e.target.value)} style={{ ...inp, background: '#fff' }}>
              <option value="">— Sem plano —</option>
              {mainPlans.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
            </select>
          </Field>
          <Field label="Bônus (opcional)">
            <select value={bonusId} onChange={(e) => setBonusId(e.target.value)} style={{ ...inp, background: '#fff' }}>
              <option value="">— Sem bônus —</option>
              {bonusPlans.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" disabled={busy} style={{
              background: '#2563eb', color: '#fff', border: 'none',
              padding: '9px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: busy ? .6 : 1, width: '100%',
            }}>{busy ? 'Adicionando…' : '＋ Adicionar convite'}</button>
          </div>
        </form>
        {msg && (
          <p style={{
            fontSize: 13, marginTop: 12, marginBottom: 0,
            color: msg.startsWith('Erro') || msg.includes('inválid') || msg.includes('já foi') || msg.includes('Informe') ? '#b91c1c' : '#15803d',
          }}>{msg}</p>
        )}
      </section>

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
          <h3 style={cardTitle}>Emails Autorizados</h3>
          <input placeholder="Buscar nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inp, maxWidth: 240 }} />
        </div>

        {loading ? <p>Carregando…</p> : isMobile ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map((r) => (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.nome || '—'}</div>
                    <div style={{ color: '#475569', fontSize: 12, wordBreak: 'break-all' }}>{r.email}</div>
                  </div>
                  <span style={{ background: statusColor(r.status), color: '#fff', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, height: 'fit-content' }}>{statusLabel(r.status)}</span>
                </div>
                <IRow k="P1" v={labelFor(r.plano1_id)} />
                <IRow k="P2" v={labelFor(r.plano2_id)} />
                <IRow k="Bônus" v={labelFor(r.bonus_id)} />
                <IRow k="Cadastrado" v={new Date(r.created_at).toLocaleDateString('pt-BR')} />
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button style={{ ...btn, flex: 1 }} onClick={() => copyLink(r)}>Link</button>
                  {r.status !== 'revogado' ? (
                    <button style={{ ...btn, flex: 1 }} onClick={() => setStatus(r, 'revogado')}>Revogar</button>
                  ) : (
                    <button style={{ ...btn, flex: 1 }} onClick={() => setStatus(r, 'convidado')}>Reativar</button>
                  )}
                  <button style={{ ...btn, flex: 1 }} onClick={() => remove(r)}>Excluir</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#64748b' }}>Nenhum convite.</p>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#64748b', fontSize: 12 }}>
                  <Th>Nome</Th><Th>E-mail</Th><Th>P1</Th><Th>P2</Th><Th>Bônus</Th><Th>Status</Th><Th>Cadastrado em</Th><Th>Ação</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <Td><strong>{r.nome || '—'}</strong></Td>
                    <Td style={{ color: '#475569' }}>{r.email}</Td>
                    <Td>{labelFor(r.plano1_id)}</Td>
                    <Td>{labelFor(r.plano2_id)}</Td>
                    <Td>{labelFor(r.bonus_id)}</Td>
                    <Td>
                      <span style={{
                        background: statusColor(r.status), color: '#fff',
                        padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      }}>{statusLabel(r.status)}</span>
                    </Td>
                    <Td>{new Date(r.created_at).toLocaleDateString('pt-BR')}</Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button style={btn} onClick={() => copyLink(r)}>Link</button>
                        {r.status !== 'revogado' ? (
                          <button style={btn} onClick={() => setStatus(r, 'revogado')}>Revogar</button>
                        ) : (
                          <button style={btn} onClick={() => setStatus(r, 'convidado')}>Reativar</button>
                        )}
                        <button style={btn} onClick={() => remove(r)}>Excluir</button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>Nenhum convite.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const card: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 };
const cardTitle: React.CSSProperties = { margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#2563eb' };
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, width: '100%' };
const btn: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer' };
const Th = ({ children }: any) => <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{children}</th>;
const Td = ({ children, style }: any) => <td style={{ padding: '10px', verticalAlign: 'middle', ...style }}>{children}</td>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</span>
      {children}
    </label>
  );
}

const IRow = ({ k, v }: { k: string; v: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderTop: '1px solid #f1f5f9' }}>
    <span style={{ color: '#64748b' }}>{k}</span>
    <span style={{ fontWeight: 600, color: '#0f172a' }}>{v}</span>
  </div>
);
