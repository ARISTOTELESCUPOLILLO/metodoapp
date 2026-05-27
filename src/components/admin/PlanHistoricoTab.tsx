import { useEffect, useState, useCallback } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { loadPlanHistorico } from '@/lib/planHistory.functions';

interface PurchaseRow {
  id: string;
  user_id: string;
  slot: string;
  plan_codigo: string | null;
  plan_nome: string | null;
  inicio: string | null;
  expira_em: string | null;
  preco_brl: number | null;
  imgs_limite: number;
  renders_limite: number;
  geracoes_limite: number;
  imgs_usadas_final: number;
  renders_usados_final: number;
  geracoes_usados_final: number;
  motivo_fechamento: string | null;
  created_at: string;
  profiles: { nome: string | null; email: string } | null;
  closer: { nome: string | null; email: string } | null;
}

const LIMIT = 50;

const slotLabel: Record<string, string> = { plano1: 'P1', plano2: 'P2', bonus: 'Bônus' };
const motivoLabel: Record<string, string> = {
  renovacao: 'Renovação',
  troca_plano: 'Troca de plano',
  remocao: 'Remoção',
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

const brl = (v: number | null) =>
  v != null ? `R$ ${v.toFixed(2)}` : '—';

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 12, color: '#64748b', background: '#f8fafc', ...style }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '8px 10px', fontSize: 13, borderTop: '1px solid #e2e8f0', verticalAlign: 'middle', ...style }}>{children}</td>;
}

export function PlanHistoricoTab() {
  const loadFn = useServerFn(loadPlanHistorico);
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (off = 0, q = search) => {
    setLoading(true);
    try {
      const res = await loadFn({ data: { search: q || undefined, offset: off, limit: LIMIT } });
      setRows(res.rows as PurchaseRow[]);
      setTotal(res.total);
      setOffset(off);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [loadFn, search]);

  useEffect(() => { load(0, ''); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(0, search);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Histórico de planos</h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
            {total} ciclo{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 6 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente…"
            style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px', fontSize: 13, width: 200 }}
          />
          <button type="submit" style={{ background: '#123a63', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Buscar
          </button>
        </form>
      </div>

      {loading ? (
        <p style={{ color: '#64748b', fontSize: 13 }}>Carregando…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 13 }}>Nenhum ciclo registrado ainda. Os ciclos são criados automaticamente ao renovar ou remover um plano.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th>Slot</Th>
                  <Th>Plano</Th>
                  <Th>Início</Th>
                  <Th>Fim</Th>
                  <Th style={{ textAlign: 'right' }}>Imgs usadas</Th>
                  <Th style={{ textAlign: 'right' }}>Vídeos usados</Th>
                  <Th style={{ textAlign: 'right' }}>Preço</Th>
                  <Th>Motivo</Th>
                  <Th>Fechado por</Th>
                  <Th>Registrado em</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const imgsPercent = r.imgs_limite > 0 ? Math.round((r.imgs_usadas_final / r.imgs_limite) * 100) : null;
                  const rendersPercent = r.renders_limite > 0 ? Math.round((r.renders_usados_final / r.renders_limite) * 100) : null;
                  return (
                    <tr key={r.id}>
                      <Td>
                        <div style={{ fontWeight: 600 }}>{r.profiles?.nome || '—'}</div>
                        <div style={{ color: '#94a3b8', fontSize: 11 }}>{r.profiles?.email}</div>
                      </Td>
                      <Td>
                        <span style={{
                          background: r.slot === 'bonus' ? '#fef3c7' : '#eff6ff',
                          color: r.slot === 'bonus' ? '#92400e' : '#1e40af',
                          padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 11,
                        }}>
                          {slotLabel[r.slot] ?? r.slot}
                        </span>
                      </Td>
                      <Td>
                        <div style={{ fontWeight: 600 }}>{r.plan_codigo ?? '—'}</div>
                        <div style={{ color: '#64748b', fontSize: 11 }}>{r.plan_nome}</div>
                      </Td>
                      <Td style={{ color: '#475569' }}>{fmt(r.inicio)}</Td>
                      <Td style={{ color: '#475569' }}>{fmt(r.expira_em)}</Td>
                      <Td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 600 }}>{r.imgs_usadas_final}</span>
                        <span style={{ color: '#94a3b8' }}>/{r.imgs_limite}</span>
                        {imgsPercent != null && (
                          <span style={{ marginLeft: 4, fontSize: 11, color: imgsPercent >= 90 ? '#ef4444' : '#94a3b8' }}>
                            {imgsPercent}%
                          </span>
                        )}
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 600 }}>{r.renders_usados_final}</span>
                        <span style={{ color: '#94a3b8' }}>/{r.renders_limite}</span>
                        {rendersPercent != null && (
                          <span style={{ marginLeft: 4, fontSize: 11, color: rendersPercent >= 90 ? '#ef4444' : '#94a3b8' }}>
                            {rendersPercent}%
                          </span>
                        )}
                      </Td>
                      <Td style={{ textAlign: 'right', fontWeight: 600, color: '#15803d' }}>{brl(r.preco_brl)}</Td>
                      <Td>
                        <span style={{
                          background: r.motivo_fechamento === 'remocao' ? '#fee2e2' : '#f0fdf4',
                          color: r.motivo_fechamento === 'remocao' ? '#b91c1c' : '#15803d',
                          padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        }}>
                          {r.motivo_fechamento ? motivoLabel[r.motivo_fechamento] : '—'}
                        </span>
                      </Td>
                      <Td style={{ color: '#475569', fontSize: 12 }}>
                        {r.closer?.nome || r.closer?.email || '—'}
                      </Td>
                      <Td style={{ color: '#94a3b8', fontSize: 12 }}>{fmt(r.created_at)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
              <button
                onClick={() => load(offset - LIMIT)}
                disabled={offset === 0}
                style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: offset === 0 ? 'not-allowed' : 'pointer', opacity: offset === 0 ? 0.5 : 1 }}
              >
                ← Anterior
              </button>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => load(offset + LIMIT)}
                disabled={offset + LIMIT >= total}
                style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', opacity: offset + LIMIT >= total ? 0.5 : 1 }}
              >
                Próximo →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
