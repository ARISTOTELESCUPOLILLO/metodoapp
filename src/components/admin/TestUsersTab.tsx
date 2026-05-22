import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { startImpersonation } from '@/hooks/useImpersonation';
import { useIsMobile } from '@/hooks/use-mobile';
import { createTestUser, deleteTestUser } from '@/lib/testUsers.functions';


type Segmento = 'SERVIÇOS' | 'VAREJO' | 'MARCA';
type SlotKey = 'plano1' | 'plano2' | 'bonus';

interface Row {
  id: string;
  nome: string | null;
  email: string;
  client_code: string | null;
  segmento: Segmento | null;
  created_at: string;
  plano1_id: string | null; plano1_imgs_usadas: number; plano1_imgs_limite: number;
  plano2_id: string | null; plano2_imgs_usadas: number; plano2_imgs_limite: number;
  bonus_id:  string | null; bonus_imgs_usadas:  number; bonus_imgs_limite:  number;
}
interface Plan { id: string; codigo: string; nome: string; elegivel_bonus: boolean }

export function TestUsersTab() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const createTestUserFn = useServerFn(createTestUser);
  const deleteTestUserFn = useServerFn(deleteTestUser);
  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  

  // form
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState<Segmento>('VAREJO');
  const [plano1Id, setPlano1Id] = useState('');
  const [plano2Id, setPlano2Id] = useState('');
  const [bonusId, setBonusId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: pls }] = await Promise.all([
      supabase.from('profiles').select('id,nome,email,client_code,segmento,created_at,plano1_id,plano1_imgs_usadas,plano1_imgs_limite,plano2_id,plano2_imgs_usadas,plano2_imgs_limite,bonus_id,bonus_imgs_usadas,bonus_imgs_limite').eq('is_test', true).order('created_at', { ascending: false }),
      supabase.from('plans').select('id,codigo,nome,elegivel_bonus').eq('ativo', true).order('nome'),
    ]);
    setRows((profs as Row[]) || []);
    setPlans((pls as Plan[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createTest(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!nome.trim()) { setMsg('Informe um nome.'); return; }
    setBusy('new');
    try {
      await createTestUserFn({
        data: {
          nome: nome.trim(),
          segmento,
          plano1_id: plano1Id || null,
          plano2_id: plano2Id || null,
          bonus_id: bonusId || null,
        },
      });
      setNome(''); setPlano1Id(''); setPlano2Id(''); setBonusId('');
      setMsg('Teste criado.');
      load();
    } catch (err: any) {
      setMsg(`Erro: ${err?.message || 'falha ao criar teste'}`);
    } finally {
      setBusy(null);
    }
  }

  function actAs(r: Row) {
    startImpersonation({ userId: r.id, nome: r.nome || 'Teste', email: r.email, isTest: true });
    navigate({ to: '/app' });
  }

  async function changeSeg(r: Row, seg: string) {
    setBusy(r.id);
    await supabase.from('profiles').update({ segmento: (seg || null) as any }).eq('id', r.id);
    await load(); setBusy(null);
  }
  async function changeSlot(r: Row, slot: SlotKey, planId: string) {
    if (!confirm(`Alterar slot vai zerar o consumo. Continuar?`)) return;
    setBusy(r.id);
    const col = slot === 'bonus' ? 'bonus_id' : `${slot}_id`;
    await supabase.from('profiles').update({ [col]: planId || null } as any).eq('id', r.id);
    await load(); setBusy(null);
  }
  async function resetCounters(r: Row) {
    if (!confirm(`Zerar consumo de ${r.nome}?`)) return;
    setBusy(r.id);
    await supabase.from('profiles').update({
      plano1_imgs_usadas: 0, plano1_renders_usados: 0, plano1_geracoes_usadas: 0,
      plano2_imgs_usadas: 0, plano2_renders_usados: 0, plano2_geracoes_usadas: 0,
      bonus_imgs_usadas: 0, bonus_renders_usados: 0, bonus_geracoes_usadas: 0,
    }).eq('id', r.id);
    await load(); setBusy(null);
  }
  async function remove(r: Row) {
    if (!confirm(`Excluir teste "${r.nome}"? Apaga perfil, Kit de Marca e sequências.`)) return;
    const typed = prompt(`Digite EXCLUIR para confirmar:`);
    if (typed !== 'EXCLUIR') { alert('Cancelado.'); return; }
    setBusy(r.id);
    try {
      await deleteTestUserFn({ data: { id: r.id } });
      load();
    } catch (err: any) {
      alert(`Erro: ${err?.message || 'falha ao excluir'}`);
    } finally {
      setBusy(null);
    }
  }

  const bonusPlans = plans.filter((p) => p.elegivel_bonus);
  const mainPlans = plans.filter((p) => !p.elegivel_bonus);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={card}>
        <h3 style={cardTitle}>＋ Criar usuário de teste</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px' }}>
          Cria um perfil fictício (sem e-mail real, sem login) para você atuar como ele e testar fluxos por segmento.
        </p>
        <form onSubmit={createTest} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Field label="Nome">
            <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Teste Varejo 1" style={inp} />
          </Field>
          <Field label="Segmento">
            <select value={segmento} onChange={(e) => setSegmento(e.target.value as Segmento)} style={{ ...inp, background: '#fff' }}>
              <option value="SERVIÇOS">SERVIÇOS</option>
              <option value="VAREJO">VAREJO</option>
              <option value="MARCA">MARCA</option>
            </select>
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
            <button type="submit" disabled={busy === 'new'} style={{
              background: '#7c3aed', color: '#fff', border: 'none',
              padding: '9px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: busy === 'new' ? .6 : 1, width: '100%',
            }}>{busy === 'new' ? 'Criando…' : '＋ Criar teste'}</button>
          </div>
        </form>
        {msg && <p style={{ fontSize: 13, marginTop: 12, marginBottom: 0, color: msg.startsWith('Erro') || msg.startsWith('Informe') ? '#b91c1c' : '#15803d' }}>{msg}</p>}
      </section>

      <section style={card}>
        <h3 style={cardTitle}>Usuários de teste ({rows.length})</h3>
        {loading ? <p>Carregando…</p> : rows.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>Nenhum teste criado ainda.</p>
        ) : isMobile ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, opacity: busy === r.id ? .5 : 1 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {r.nome}
                    <span style={{ background: '#7c3aed', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>TESTE</span>
                  </div>
                  {r.client_code && <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace', marginTop: 2 }}>{r.client_code}</div>}
                </div>
                <MRow k="Segmento"><SegSelect value={r.segmento} onChange={(v) => changeSeg(r, v)} /></MRow>
                <MRow k="Plano 1"><PlanSelect value={r.plano1_id} options={mainPlans} onChange={(v) => changeSlot(r, 'plano1', v)} /></MRow>
                <MRow k="Plano 2"><PlanSelect value={r.plano2_id} options={mainPlans} onChange={(v) => changeSlot(r, 'plano2', v)} /></MRow>
                <MRow k="Bônus"><PlanSelect value={r.bonus_id} options={bonusPlans} onChange={(v) => changeSlot(r, 'bonus', v)} /></MRow>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                  <button onClick={() => actAs(r)} style={{ ...btn, background: '#7c3aed', color: '#fff', borderColor: '#7c3aed', fontWeight: 700 }}>Atuar como</button>
                  <button onClick={() => resetCounters(r)} style={btn}>Zerar</button>
                  <button onClick={() => remove(r)} style={{ ...btn, color: '#b91c1c', borderColor: '#fecaca' }}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr><Th>Nome</Th><Th>Segmento</Th><Th>P1</Th><Th>P2</Th><Th>Bônus</Th><Th>Criado</Th><Th>Ações</Th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0', opacity: busy === r.id ? .5 : 1 }}>
                    <Td>
                      <div style={{ fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                        {r.nome}
                        <span style={{ background: '#7c3aed', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>TESTE</span>
                      </div>
                      {r.client_code && <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{r.client_code}</div>}
                    </Td>
                    <Td><SegSelect value={r.segmento} onChange={(v) => changeSeg(r, v)} /></Td>
                    <Td><PlanSelect value={r.plano1_id} options={mainPlans} onChange={(v) => changeSlot(r, 'plano1', v)} /></Td>
                    <Td><PlanSelect value={r.plano2_id} options={mainPlans} onChange={(v) => changeSlot(r, 'plano2', v)} /></Td>
                    <Td><PlanSelect value={r.bonus_id} options={bonusPlans} onChange={(v) => changeSlot(r, 'bonus', v)} /></Td>
                    <Td style={{ color: '#64748b', fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => actAs(r)} style={{ ...btn, background: '#7c3aed', color: '#fff', borderColor: '#7c3aed', fontWeight: 700 }}>Atuar como</button>
                        
                        <button onClick={() => resetCounters(r)} style={btn}>Zerar</button>
                        <button onClick={() => remove(r)} style={{ ...btn, color: '#b91c1c', borderColor: '#fecaca' }}>Excluir</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SegSelect({ value, onChange }: { value: Segmento | null; onChange: (v: string) => void }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}
      style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12, maxWidth: 130 }}>
      <option value="">—</option>
      <option value="SERVIÇOS">SERVIÇOS</option>
      <option value="VAREJO">VAREJO</option>
      <option value="MARCA">MARCA</option>
    </select>
  );
}
function PlanSelect({ value, options, onChange }: { value: string | null; options: Plan[]; onChange: (v: string) => void }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}
      style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12, maxWidth: 150 }}>
      <option value="">— vazio —</option>
      {options.map((p) => <option key={p.id} value={p.id}>{p.codigo}</option>)}
    </select>
  );
}

const card: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 };
const cardTitle: React.CSSProperties = { margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#7c3aed' };
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, width: '100%' };
const btn: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer' };
const Th = ({ children }: any) => <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>{children}</th>;
const Td = ({ children, style }: any) => <td style={{ padding: '8px 10px', verticalAlign: 'middle', ...style }}>{children}</td>;
const MRow = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #f1f5f9', fontSize: 13, gap: 8 }}>
    <span style={{ color: '#64748b' }}>{k}</span>
    <span style={{ textAlign: 'right' }}>{children}</span>
  </div>
);
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</span>
      {children}
    </label>
  );
}
