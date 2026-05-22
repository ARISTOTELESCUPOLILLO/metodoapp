import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { startImpersonation } from '@/hooks/useImpersonation';
import { useIsMobile } from '@/hooks/use-mobile';

import { computeCycle, cycleLabel, cycleColor } from '@/lib/cycle';

interface Row {
  id: string;
  nome: string | null;
  email: string;
  client_code: string | null;
  status: string;
  segmento: 'SERVIÇOS' | 'VAREJO' | 'MARCA' | null;
  ultimo_login: string | null;
  is_admin: boolean;
  plano1_id: string | null; plano1_inicio: string | null;
  plano1_imgs_usadas: number; plano1_imgs_limite: number;
  plano1_renders_usados: number; plano1_renders_limite: number;
  plano2_id: string | null; plano2_inicio: string | null;
  plano2_imgs_usadas: number; plano2_imgs_limite: number;
  plano2_renders_usados: number; plano2_renders_limite: number;
  bonus_id: string | null; bonus_inicio: string | null;
  bonus_imgs_usadas: number; bonus_imgs_limite: number;
  bonus_renders_usados: number; bonus_renders_limite: number;
}
interface Plan { id: string; nome: string; codigo: string; elegivel_bonus: boolean }

type SlotKey = 'plano1' | 'plano2' | 'bonus';

export function UsersTab() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  
  const navigate = useNavigate();

  function actAs(r: Row) {
    if (!confirm(`Atuar como ${r.nome || r.email}? Você poderá editar o Kit de Marca dele.`)) return;
    startImpersonation({ userId: r.id, nome: r.nome || r.email, email: r.email });
    navigate({ to: '/app' });
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: pls }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_test', false).order('ultimo_login', { ascending: false, nullsFirst: false }),
      supabase.from('plans').select('id,nome,codigo,elegivel_bonus').eq('ativo', true).order('nome'),
      supabase.from('user_roles').select('user_id,role'),
    ]);
    const adminSet = new Set((roles || []).filter((r: any) => r.role === 'admin').map((r: any) => r.user_id));
    setRows((profs || []).map((p: any) => ({ ...p, is_admin: adminSet.has(p.id) })));
    setPlans((pls as Plan[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeSlot(userId: string, slot: SlotKey, planId: string) {
    const label = slot === 'plano1' ? 'Plano 1' : slot === 'plano2' ? 'Plano 2' : 'Bônus';
    if (!confirm(`Alterar ${label} vai zerar o consumo deste slot. Continuar?`)) return;
    setBusy(userId);
    const col = slot === 'bonus' ? 'bonus_id' : `${slot}_id`;
    const patch: Record<string, string | null> = { [col]: planId || null };
    const { error } = await supabase.from('profiles').update(patch as any).eq('id', userId);
    if (error) alert(`Erro: ${error.message}`);
    await load();
    setBusy(null);
  }

  async function toggleStatus(r: Row) {
    const blocking = r.status === 'ativo';
    if (blocking) {
      if (!confirm(`Bloquear ${r.email}? O usuário não poderá mais usar o app.`)) return;
      const typed = prompt(`Confirmação dupla — digite BLOQUEAR para confirmar o bloqueio de ${r.email}:`);
      if (typed !== 'BLOQUEAR') { alert('Confirmação inválida. Bloqueio cancelado.'); return; }
    } else {
      if (!confirm(`Desbloquear ${r.email}?`)) return;
    }
    setBusy(r.id);
    await supabase.from('profiles').update({ status: blocking ? 'bloqueado' : 'ativo' }).eq('id', r.id);
    await load();
    setBusy(null);
  }
  async function toggleAdmin(r: Row) {
    setBusy(r.id);
    if (r.is_admin) await supabase.from('user_roles').delete().eq('user_id', r.id).eq('role', 'admin');
    else await supabase.from('user_roles').insert({ user_id: r.id, role: 'admin' });
    await load();
    setBusy(null);
  }
  async function changeSegmento(r: Row, seg: string) {
    setBusy(r.id);
    await supabase.from('profiles').update({ segmento: (seg || null) as any }).eq('id', r.id);
    await load();
    setBusy(null);
  }
  async function renewSlot(r: Row, slot: SlotKey) {
    const label = slot === 'plano1' ? 'Plano 1' : slot === 'plano2' ? 'Plano 2' : 'Bônus';
    if (!confirm(`Renovar ciclo de ${label} para ${r.nome || r.email}?\n\nIsso zera contadores e reinicia o ciclo (data = agora).`)) return;
    setBusy(r.id);
    const extraPrefix = slot === 'plano1' ? 'p1' : slot === 'plano2' ? 'p2' : 'b';
    const patch: Record<string, any> = {
      [`${slot}_inicio`]: new Date().toISOString(),
      [`${slot}_imgs_usadas`]: 0,
      [`${slot}_renders_usados`]: 0,
      [`${slot}_geracoes_usadas`]: 0,
      [`extra_${extraPrefix}_estatico`]: 0,
      [`extra_${extraPrefix}_carrossel`]: 0,
      [`extra_${extraPrefix}_estatico_final`]: 0,
      [`extra_${extraPrefix}_reels`]: 0,
    };
    const { error } = await supabase.from('profiles').update(patch as never).eq('id', r.id);
    if (error) alert(`Erro: ${error.message}`);
    await load();
    setBusy(null);
  }
  async function resetCounters(r: Row) {
    if (!confirm(`Zerar contadores de ${r.email} (todos os slots)?`)) return;
    setBusy(r.id);
    await supabase.from('profiles').update({
      plano1_imgs_usadas: 0, plano1_renders_usados: 0,
      plano2_imgs_usadas: 0, plano2_renders_usados: 0,
      bonus_imgs_usadas: 0, bonus_renders_usados: 0,
    }).eq('id', r.id);
    await load();
    setBusy(null);
  }
  async function resetPassword(r: Row) {
    if (!confirm(`Enviar e-mail de redefinição de senha para ${r.email}?`)) return;
    setBusy(r.id);
    const { error } = await supabase.auth.resetPasswordForEmail(r.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(null);
    alert(error ? `Erro: ${error.message}` : `E-mail de redefinição enviado para ${r.email}.`);
  }

  const bonusPlans = plans.filter((p) => p.elegivel_bonus);
  const mainPlans = plans.filter((p) => !p.elegivel_bonus);
  const filtered = rows.filter((r) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (r.email || '').toLowerCase().includes(s) || (r.nome || '').toLowerCase().includes(s);
  });

  if (loading) return <p>Carregando usuários…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
        <input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, flex: 1, maxWidth: 320 }} />
        <span style={{ fontSize: 12, color: '#64748b' }}>{filtered.length} usuário(s)</span>
      </div>

      {isMobile ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((r) => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, opacity: busy === r.id ? .5 : 1 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {r.nome || '—'}
                  {r.is_admin && <span style={{ background: '#0f213f', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>ADMIN</span>}
                </div>
                <div style={{ color: '#64748b', fontSize: 12, wordBreak: 'break-all' }}>{r.email}</div>
                {r.client_code && <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace', marginTop: 2 }}>{r.client_code}</div>}
              </div>
              <MRow k="Plano 1"><PlanSelect value={r.plano1_id} options={mainPlans} onChange={(v) => changeSlot(r.id, 'plano1', v)} /></MRow>
              <MRow k="Plano 2"><PlanSelect value={r.plano2_id} options={mainPlans} onChange={(v) => changeSlot(r.id, 'plano2', v)} /></MRow>
              <MRow k="Bônus"><PlanSelect value={r.bonus_id} options={bonusPlans} onChange={(v) => changeSlot(r.id, 'bonus', v)} /></MRow>
              <MRow k="Segmento"><SegmentoSelect value={r.segmento} onChange={(v) => changeSegmento(r, v)} /></MRow>
              <MRow k="Status">
                <button onClick={() => toggleStatus(r)} style={pill(r.status === 'ativo' ? '#15803d' : '#b91c1c')}>
                  {r.status === 'ativo' ? 'bloquear' : 'desbloquear'}
                </button>
              </MRow>
              <MRow k="Admin">
                <button onClick={() => toggleAdmin(r)} style={pill(r.is_admin ? '#0f213f' : '#94a3b8')}>
                  {r.is_admin ? 'admin' : 'user'}
                </button>
              </MRow>
              <div style={{ padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>CONSUMO</div>
                <SlotsConsumption row={r} onRenew={(slot) => renewSlot(r, slot)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                <button onClick={() => actAs(r)} style={{ ...actionBtn, background: '#0f213f', color: '#fff', borderColor: '#0f213f', fontWeight: 700 }} disabled={r.is_admin}>Atuar como</button>
                <button onClick={() => resetCounters(r)} style={actionBtn} disabled={r.is_admin}>Zerar</button>
                <button onClick={() => resetPassword(r)} style={actionBtn}>Senha</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <Th>Usuário</Th><Th>Plano 1</Th><Th>Plano 2</Th><Th>Bônus</Th><Th>Segmento</Th>
                <Th>Consumo</Th><Th>Status</Th><Th>Admin</Th><Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0', opacity: busy === r.id ? .5 : 1 }}>
                  <Td>
                    <div style={{ fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                      {r.nome || '—'}
                      {r.is_admin && <span style={{ background: '#0f213f', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>ADMIN</span>}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{r.email}</div>
                    {r.client_code && <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace', marginTop: 2 }}>{r.client_code}</div>}
                  </Td>
                  <Td><PlanSelect value={r.plano1_id} options={mainPlans} onChange={(v) => changeSlot(r.id, 'plano1', v)} /></Td>
                  <Td><PlanSelect value={r.plano2_id} options={mainPlans} onChange={(v) => changeSlot(r.id, 'plano2', v)} /></Td>
                  <Td><PlanSelect value={r.bonus_id} options={bonusPlans} onChange={(v) => changeSlot(r.id, 'bonus', v)} /></Td>
                  <Td><SegmentoSelect value={r.segmento} onChange={(v) => changeSegmento(r, v)} /></Td>
                  <Td><SlotsConsumption row={r} onRenew={(slot) => renewSlot(r, slot)} /></Td>
                  <Td>
                    <button onClick={() => toggleStatus(r)} style={pill(r.status === 'ativo' ? '#15803d' : '#b91c1c')}>
                      {r.status === 'ativo' ? 'bloquear' : 'desbloquear'}
                    </button>
                  </Td>
                  <Td>
                    <button onClick={() => toggleAdmin(r)} style={pill(r.is_admin ? '#0f213f' : '#94a3b8')}>
                      {r.is_admin ? 'admin' : 'user'}
                    </button>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => actAs(r)} style={{ ...actionBtn, background: '#0f213f', color: '#fff', borderColor: '#0f213f', fontWeight: 700 }} disabled={r.is_admin} title={r.is_admin ? 'Não é necessário para admin' : 'Entrar no contexto deste usuário'}>Atuar como</button>
                      
                      <button onClick={() => resetCounters(r)} style={actionBtn} disabled={r.is_admin} title={r.is_admin ? 'Admin é ilimitado' : ''}>Zerar</button>
                      <button onClick={() => resetPassword(r)} style={actionBtn}>Senha</button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

function SegmentoSelect({ value, onChange }: { value: 'SERVIÇOS' | 'VAREJO' | 'MARCA' | null; onChange: (v: string) => void }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}
      style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12, maxWidth: 130 }}>
      <option value="">— vazio —</option>
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

function SlotsConsumption({ row, onRenew }: { row: Row; onRenew?: (slot: SlotKey) => void }) {
  if (row.is_admin) return <span style={{ color: '#0f213f', fontWeight: 600, fontSize: 12 }}>Ilimitado</span>;
  const slots = ([
    { label: 'P1', key: 'plano1' as SlotKey, planId: row.plano1_id, inicio: row.plano1_inicio, iu: row.plano1_imgs_usadas, il: row.plano1_imgs_limite, ru: row.plano1_renders_usados, rl: row.plano1_renders_limite },
    { label: 'P2', key: 'plano2' as SlotKey, planId: row.plano2_id, inicio: row.plano2_inicio, iu: row.plano2_imgs_usadas, il: row.plano2_imgs_limite, ru: row.plano2_renders_usados, rl: row.plano2_renders_limite },
    { label: 'B',  key: 'bonus'  as SlotKey, planId: row.bonus_id,  inicio: row.bonus_inicio,  iu: row.bonus_imgs_usadas,  il: row.bonus_imgs_limite,  ru: row.bonus_renders_usados,  rl: row.bonus_renders_limite },
  ]).filter((s) => s.planId);
  if (!slots.length) return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 160 }}>
      {slots.map((s, i) => {
        const pct = s.il > 0 ? Math.min(100, Math.round((s.iu / s.il) * 100)) : 0;
        const color = pct >= 100 ? '#dc2626' : pct >= 90 ? '#d97706' : '#2563eb';
        const cycle = computeCycle(s.inicio);
        const cColor = cycleColor(cycle);
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', gap: 4, alignItems: 'center' }}>
              <span><strong>{s.label}</strong> {s.iu}/{s.il}{s.rl > 0 ? ` · r ${s.ru}/${s.rl}` : ''}</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {cColor && (
                  <span style={{ background: cColor.bg, color: cColor.fg, padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700 }}>
                    {cycleLabel(cycle)}
                  </span>
                )}
                <span style={{ color: '#94a3b8' }}>{s.inicio ? new Date(s.inicio).toLocaleDateString('pt-BR') : '—'}</span>
                {onRenew && (
                  <button
                    type="button"
                    onClick={() => onRenew(s.key)}
                    title="Zerar contadores e reiniciar ciclo agora"
                    style={{
                      background: '#0f213f', color: '#fff', border: 'none',
                      padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700,
                      cursor: 'pointer', textTransform: 'lowercase',
                    }}
                  >
                    renovar
                  </button>
                )}
              </span>
            </div>
            <div style={{ height: 4, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Th = ({ children }: any) => <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>{children}</th>;
const Td = ({ children }: any) => <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>{children}</td>;
const actionBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #cbd5e1', padding: '4px 8px',
  borderRadius: 4, fontSize: 12, cursor: 'pointer',
};
const pill = (color: string): React.CSSProperties => ({
  background: color, color: '#fff', border: 'none', padding: '3px 10px',
  borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'lowercase',
});

const MRow = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #f1f5f9', fontSize: 13, gap: 8 }}>
    <span style={{ color: '#64748b' }}>{k}</span>
    <span style={{ textAlign: 'right' }}>{children}</span>
  </div>
);
