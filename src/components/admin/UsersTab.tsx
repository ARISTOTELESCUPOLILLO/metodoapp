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
  plano1_preco_brl: number | null;
  plano2_id: string | null; plano2_inicio: string | null;
  plano2_imgs_usadas: number; plano2_imgs_limite: number;
  plano2_renders_usados: number; plano2_renders_limite: number;
  plano2_preco_brl: number | null;
  bonus_id: string | null; bonus_inicio: string | null;
  bonus_imgs_usadas: number; bonus_imgs_limite: number;
  bonus_renders_usados: number; bonus_renders_limite: number;
  bonus_preco_brl: number | null;
}
interface Plan {
  id: string; nome: string; codigo: string; elegivel_bonus: boolean; tipo: string;
  limite_imagens: number; limite_renders: number; limite_geracoes: number;
  preco_maximo_brl: number;
}
interface Costs { imageRef: number; video: number; content: number }

function planPeriodo(inicio: string | null, tipo: string): string {
  if (!inicio) return '';
  const start = new Date(inicio);
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  if (tipo === 'mensal') {
    const end = new Date(start); end.setMonth(end.getMonth() + 1);
    return `${fmt(start)} → ${fmt(end)} · 1 mês`;
  }
  if (tipo === 'anual') {
    const end = new Date(start); end.setFullYear(end.getFullYear() + 1);
    return `${fmt(start)} → ${fmt(end)} · 12 meses`;
  }
  if (tipo === 'vitalicio') return `${fmt(start)} · vitalício`;
  return fmt(start);
}

type SlotKey = 'plano1' | 'plano2' | 'bonus';

export function UsersTab() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editNome, setEditNome] = useState<{ id: string; val: string } | null>(null);
  const [costs, setCosts] = useState<Costs>({ imageRef: 0.058, video: 1.50, content: 0.003 });
  const [usdRate, setUsdRate] = useState(5.5);
  
  const navigate = useNavigate();

  function actAs(r: Row) {
    if (!confirm(`Atuar como ${r.nome || r.email}? Você poderá editar o Kit de Marca dele.`)) return;
    startImpersonation({ userId: r.id, nome: r.nome || r.email, email: r.email });
    navigate({ to: '/app' });
  }

  function verGeracoes(r: Row) {
    startImpersonation({ userId: r.id, nome: r.nome || r.email, email: r.email });
    navigate({ to: '/historico' });
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: pls }, { data: roles }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_test', false).order('ultimo_login', { ascending: false, nullsFirst: false }),
      supabase.from('plans').select('id,nome,codigo,elegivel_bonus,tipo,limite_imagens,limite_renders,limite_geracoes,preco_maximo_brl').eq('ativo', true).order('nome'),
      supabase.from('user_roles').select('user_id,role'),
      supabase.from('app_settings').select('usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd').eq('id', true).maybeSingle(),
    ]);
    const adminSet = new Set((roles || []).filter((r: any) => r.role === 'admin').map((r: any) => r.user_id));
    setRows((profs || []).map((p: any) => ({ ...p, is_admin: adminSet.has(p.id) })));
    setPlans((pls as Plan[]) || []);
    if (s) {
      setUsdRate(Number((s as any).usd_brl_rate) || 5.5);
      setCosts({ imageRef: Number((s as any).image_price_usd) || 0.058, video: Number((s as any).render_price_usd) || 1.50, content: Number((s as any).geracao_price_usd) || 0.003 });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeNome(userId: string, nome: string) {
    setBusy(userId);
    await supabase.from('profiles').update({ nome: nome.trim() || null }).eq('id', userId);
    setEditNome(null);
    await load();
    setBusy(null);
  }

  async function changePreco(userId: string, slot: SlotKey, val: number | null) {
    const col = slot === 'bonus' ? 'bonus_preco_brl' : `${slot}_preco_brl`;
    await supabase.from('profiles').update({ [col]: val } as any).eq('id', userId);
    await load();
  }

  async function changePlanInicio(userId: string, slot: SlotKey, dateStr: string) {
    if (!dateStr) return;
    const col = slot === 'bonus' ? 'bonus_inicio' : `${slot}_inicio`;
    const iso = new Date(dateStr + 'T12:00:00').toISOString();
    setBusy(userId);
    await supabase.from('profiles').update({ [col]: iso } as any).eq('id', userId);
    await load();
    setBusy(null);
  }

  async function changeSlot(userId: string, slot: SlotKey, planId: string) {
    const label = slot === 'plano1' ? 'Plano 1' : slot === 'plano2' ? 'Plano 2' : 'Bônus';
    if (!confirm(`Alterar ${label} vai zerar o consumo deste slot. Continuar?`)) return;
    setBusy(userId);
    const col = slot === 'bonus' ? 'bonus_id' : `${slot}_id`;
    const extraPrefix = slot === 'plano1' ? 'p1' : slot === 'plano2' ? 'p2' : 'b';
    const patch: Record<string, string | number | null> = {
      [col]: planId || null,
      [`${slot}_imgs_usadas`]: 0,
      [`${slot}_renders_usados`]: 0,
      [`${slot}_geracoes_usadas`]: 0,
      [`extra_${extraPrefix}_estatico`]: 0,
      [`extra_${extraPrefix}_carrossel`]: 0,
      [`extra_${extraPrefix}_estatico_final`]: 0,
      [`extra_${extraPrefix}_reels`]: 0,
    };
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
      plano1_imgs_usadas: 0, plano1_renders_usados: 0, plano1_geracoes_usadas: 0,
      plano2_imgs_usadas: 0, plano2_renders_usados: 0, plano2_geracoes_usadas: 0,
      bonus_imgs_usadas: 0, bonus_renders_usados: 0, bonus_geracoes_usadas: 0,
    } as any).eq('id', r.id);
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
                  {editNome?.id === r.id ? (
                    <>
                      <input autoFocus value={editNome.val} onChange={(e) => setEditNome({ id: r.id, val: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') changeNome(r.id, editNome.val); if (e.key === 'Escape') setEditNome(null); }}
                        style={{ fontSize: 14, fontWeight: 700, padding: '2px 6px', border: '1px solid #0f213f', borderRadius: 4, width: 140 }} />
                      <button onClick={() => changeNome(r.id, editNome.val)} style={miniSave}>✓</button>
                      <button onClick={() => setEditNome(null)} style={miniCancel}>✕</button>
                    </>
                  ) : (
                    <span onClick={() => setEditNome({ id: r.id, val: r.nome || '' })} title="Clique para editar nome"
                      style={{ cursor: 'pointer', borderBottom: '1px dashed #cbd5e1' }}>
                      {r.nome || '—'}
                    </span>
                  )}
                  {r.is_admin && <span style={{ background: '#0f213f', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>ADMIN</span>}
                </div>
                <div style={{ color: '#64748b', fontSize: 12, wordBreak: 'break-all' }}>{r.email}</div>
                {r.client_code && <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace', marginTop: 2 }}>{r.client_code}</div>}
              </div>
              <MRow k="Plano 1">
                <div>
                  <PlanCell planId={r.plano1_id} inicio={r.plano1_inicio} options={mainPlans} onChange={(v) => changeSlot(r.id, 'plano1', v)} onInicio={(d) => changePlanInicio(r.id, 'plano1', d)} />
                  {r.plano1_id && <PlanPriceField planId={r.plano1_id} plans={mainPlans} costs={costs} usdRate={usdRate} value={r.plano1_preco_brl} onChange={(v) => changePreco(r.id, 'plano1', v)} />}
                </div>
              </MRow>
              <MRow k="Plano 2">
                <div>
                  <PlanCell planId={r.plano2_id} inicio={r.plano2_inicio} options={mainPlans} onChange={(v) => changeSlot(r.id, 'plano2', v)} onInicio={(d) => changePlanInicio(r.id, 'plano2', d)} />
                  {r.plano2_id && <PlanPriceField planId={r.plano2_id} plans={mainPlans} costs={costs} usdRate={usdRate} value={r.plano2_preco_brl} onChange={(v) => changePreco(r.id, 'plano2', v)} />}
                </div>
              </MRow>
              <MRow k="Bônus">
                <div>
                  <PlanCell planId={r.bonus_id} inicio={r.bonus_inicio} options={bonusPlans} onChange={(v) => changeSlot(r.id, 'bonus', v)} onInicio={(d) => changePlanInicio(r.id, 'bonus', d)} />
                  {r.bonus_id && <PlanPriceField planId={r.bonus_id} plans={bonusPlans} costs={costs} usdRate={usdRate} value={r.bonus_preco_brl} onChange={(v) => changePreco(r.id, 'bonus', v)} />}
                </div>
              </MRow>
              <MRow k="Faturamento"><FaturamentoCell row={r} plans={[...mainPlans, ...bonusPlans]} costs={costs} usdRate={usdRate} /></MRow>
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
                <button onClick={() => verGeracoes(r)} style={{ ...actionBtn, background: '#0f172a', color: '#fff', borderColor: '#0f172a' }}>Gerações</button>
                <button onClick={() => resetCounters(r)} style={actionBtn}>Zerar</button>
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
                <Th>Usuário</Th><Th>Plano 1</Th><Th>Plano 2</Th><Th>Bônus</Th>
                <Th title="Soma dos preços aplicados nos slots ativos">Faturamento</Th>
                <Th>Segmento</Th><Th>Consumo</Th><Th>Status</Th><Th>Admin</Th><Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0', opacity: busy === r.id ? .5 : 1 }}>
                  <Td>
                    <div style={{ fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                      {editNome?.id === r.id ? (
                        <>
                          <input autoFocus value={editNome.val} onChange={(e) => setEditNome({ id: r.id, val: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') changeNome(r.id, editNome.val); if (e.key === 'Escape') setEditNome(null); }}
                            style={{ fontSize: 13, fontWeight: 600, padding: '2px 6px', border: '1px solid #0f213f', borderRadius: 4, width: 130 }} />
                          <button onClick={() => changeNome(r.id, editNome.val)} style={miniSave}>✓</button>
                          <button onClick={() => setEditNome(null)} style={miniCancel}>✕</button>
                        </>
                      ) : (
                        <span onClick={() => setEditNome({ id: r.id, val: r.nome || '' })} title="Clique para editar nome"
                          style={{ cursor: 'pointer', borderBottom: '1px dashed #cbd5e1' }}>
                          {r.nome || '—'}
                        </span>
                      )}
                      {r.is_admin && <span style={{ background: '#0f213f', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>ADMIN</span>}
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{r.email}</div>
                    {r.client_code && <div style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace', marginTop: 2 }}>{r.client_code}</div>}
                  </Td>
                  <Td>
                    <PlanCell planId={r.plano1_id} inicio={r.plano1_inicio} options={mainPlans} onChange={(v) => changeSlot(r.id, 'plano1', v)} onInicio={(d) => changePlanInicio(r.id, 'plano1', d)} />
                    {r.plano1_id && <PlanPriceField planId={r.plano1_id} plans={mainPlans} costs={costs} usdRate={usdRate} value={r.plano1_preco_brl} onChange={(v) => changePreco(r.id, 'plano1', v)} />}
                  </Td>
                  <Td>
                    <PlanCell planId={r.plano2_id} inicio={r.plano2_inicio} options={mainPlans} onChange={(v) => changeSlot(r.id, 'plano2', v)} onInicio={(d) => changePlanInicio(r.id, 'plano2', d)} />
                    {r.plano2_id && <PlanPriceField planId={r.plano2_id} plans={mainPlans} costs={costs} usdRate={usdRate} value={r.plano2_preco_brl} onChange={(v) => changePreco(r.id, 'plano2', v)} />}
                  </Td>
                  <Td>
                    <PlanCell planId={r.bonus_id} inicio={r.bonus_inicio} options={bonusPlans} onChange={(v) => changeSlot(r.id, 'bonus', v)} onInicio={(d) => changePlanInicio(r.id, 'bonus', d)} />
                    {r.bonus_id && <PlanPriceField planId={r.bonus_id} plans={bonusPlans} costs={costs} usdRate={usdRate} value={r.bonus_preco_brl} onChange={(v) => changePreco(r.id, 'bonus', v)} />}
                  </Td>
                  <Td><FaturamentoCell row={r} plans={[...mainPlans, ...bonusPlans]} costs={costs} usdRate={usdRate} /></Td>
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
                      <button onClick={() => verGeracoes(r)} style={{ ...actionBtn, background: '#0f172a', color: '#fff', borderColor: '#0f172a' }} title="Ver histórico de gerações arquivadas deste usuário">Gerações</button>
                      <button onClick={() => resetCounters(r)} style={actionBtn}>Zerar</button>
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

function PlanCell({ planId, inicio, options, onChange, onInicio }: {
  planId: string | null; inicio: string | null; options: Plan[];
  onChange: (v: string) => void; onInicio?: (d: string) => void;
}) {
  const [editDate, setEditDate] = useState(false);
  const [dateVal, setDateVal] = useState('');
  const plan = options.find(p => p.id === planId);
  const periodo = plan ? planPeriodo(inicio, plan.tipo) : '';

  function startEditDate() {
    setDateVal(inicio ? inicio.split('T')[0] : '');
    setEditDate(true);
  }
  function saveDate() {
    if (dateVal && onInicio) onInicio(dateVal);
    setEditDate(false);
  }

  return (
    <div>
      <PlanSelect value={planId} options={options} onChange={onChange} />
      {planId && (
        editDate ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 3 }}>
            <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveDate(); if (e.key === 'Escape') setEditDate(false); }}
              style={{ fontSize: 11, padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: 3 }} />
            <button onClick={saveDate} style={miniSave}>✓</button>
            <button onClick={() => setEditDate(false)} style={miniCancel}>✕</button>
          </div>
        ) : periodo ? (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, lineHeight: 1.3, display: 'flex', gap: 4, alignItems: 'center' }}>
            <span>{periodo}</span>
            {onInicio && (
              <button onClick={startEditDate} title="Editar data de início"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 9, padding: 0, lineHeight: 1 }}>✎</button>
            )}
          </div>
        ) : onInicio ? (
          <button onClick={startEditDate} style={{ fontSize: 10, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginTop: 2 }}>
            + definir data início
          </button>
        ) : null
      )}
    </div>
  );
}

function SlotsConsumption({ row, onRenew }: { row: Row; onRenew?: (slot: SlotKey) => void }) {
  const slots = ([
    { label: 'P1', key: 'plano1' as SlotKey, planId: row.plano1_id, inicio: row.plano1_inicio, iu: row.plano1_imgs_usadas, il: row.plano1_imgs_limite, ru: row.plano1_renders_usados, rl: row.plano1_renders_limite },
    { label: 'P2', key: 'plano2' as SlotKey, planId: row.plano2_id, inicio: row.plano2_inicio, iu: row.plano2_imgs_usadas, il: row.plano2_imgs_limite, ru: row.plano2_renders_usados, rl: row.plano2_renders_limite },
    { label: 'B',  key: 'bonus'  as SlotKey, planId: row.bonus_id,  inicio: row.bonus_inicio,  iu: row.bonus_imgs_usadas,  il: row.bonus_imgs_limite,  ru: row.bonus_renders_usados,  rl: row.bonus_renders_limite },
  ]).filter((s) => s.planId);
  if (!slots.length) {
    if (row.is_admin) return <span style={{ color: '#f4b000', fontWeight: 600, fontSize: 12 }}>Ilimitado (admin)</span>;
    return <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>;
  }
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

function PlanPriceField({ planId, plans, costs, usdRate, value, onChange }: {
  planId: string | null; plans: Plan[]; costs: Costs; usdRate: number;
  value: number | null; onChange: (v: number | null) => void;
}) {
  const [inp, setInp] = useState(value != null ? String(value) : '');
  useEffect(() => { setInp(value != null ? String(value) : ''); }, [value]);
  const plan = plans.find(p => p.id === planId);
  if (!plan) return null;
  const costUsd = plan.limite_imagens * costs.imageRef + plan.limite_renders * costs.video + plan.limite_geracoes * costs.content;
  const minBrl = costUsd * usdRate * 3;
  const maxBrl = plan.preco_maximo_brl || 0;
  const applied = parseFloat(inp);
  const belowMin = !isNaN(applied) && applied > 0 && applied < minBrl;
  function commit() {
    const v = parseFloat(inp);
    onChange(isNaN(v) || inp.trim() === '' ? null : v);
  }
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>R$</span>
        <input type="number" min="0" step="1" value={inp}
          onChange={e => setInp(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          placeholder={minBrl.toFixed(0)}
          style={{ width: 72, padding: '2px 4px', fontSize: 12, fontWeight: 700, border: `1px solid ${belowMin ? '#dc2626' : '#cbd5e1'}`, borderRadius: 4, color: belowMin ? '#dc2626' : '#0f172a', background: belowMin ? '#fef2f2' : '#fff' }}
        />
        {belowMin && <span title={`Abaixo do mínimo (R$ ${minBrl.toFixed(2)})`} style={{ color: '#dc2626', fontSize: 12, fontWeight: 800 }}>⚠</span>}
      </div>
      <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.3, marginTop: 1 }}>
        mín R$ {minBrl.toFixed(0)}{maxBrl > 0 ? ` · máx R$ ${maxBrl.toFixed(0)}` : ''}
      </div>
    </div>
  );
}

function FaturamentoCell({ row, plans, costs, usdRate }: { row: Row; plans: Plan[]; costs: Costs; usdRate: number }) {
  if (row.is_admin) return <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>;
  let total = 0;
  let hasWarning = false;
  const slots = [
    { planId: row.plano1_id, preco: row.plano1_preco_brl },
    { planId: row.plano2_id, preco: row.plano2_preco_brl },
    { planId: row.bonus_id,  preco: row.bonus_preco_brl  },
  ];
  for (const s of slots) {
    if (!s.planId) continue;
    const plan = plans.find(p => p.id === s.planId);
    if (!plan) continue;
    const cost = plan.limite_imagens * costs.imageRef + plan.limite_renders * costs.video + plan.limite_geracoes * costs.content;
    const min = cost * usdRate * 3;
    const preco = s.preco || 0;
    total += preco;
    if (preco > 0 && preco < min) hasWarning = true;
  }
  if (total === 0) return <span style={{ color: '#94a3b8', fontSize: 11 }}>sem preço</span>;
  return (
    <div style={{ fontWeight: 700, fontSize: 13, color: hasWarning ? '#dc2626' : '#15803d' }}>
      {hasWarning && '⚠ '}R$ {total.toFixed(0)}<span style={{ fontSize: 10, fontWeight: 400, color: '#64748b' }}>/mês</span>
    </div>
  );
}

const miniSave: React.CSSProperties = {
  background: '#15803d', color: '#fff', border: 'none', padding: '1px 6px',
  borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer',
};
const miniCancel: React.CSSProperties = {
  background: '#94a3b8', color: '#fff', border: 'none', padding: '1px 6px',
  borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer',
};

const MRow = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid #f1f5f9', fontSize: 13, gap: 8 }}>
    <span style={{ color: '#64748b' }}>{k}</span>
    <span style={{ textAlign: 'right' }}>{children}</span>
  </div>
);
