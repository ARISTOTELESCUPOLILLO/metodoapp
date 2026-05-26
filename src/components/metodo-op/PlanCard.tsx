import { computeCycleFromExpiry } from '@/lib/cycle';
import type { SlotInfo } from '@/hooks/useProfile';

interface Props {
  slot: SlotInfo;
}

export function PlanCard({ slot }: Props) {
  const isBonus = slot.key === 'bonus';
  const cycle = computeCycleFromExpiry(slot.expiraEm);

  // Barra de imagens — barra de % só quando tem teto; contador aparece quando há uso ou teto.
  const hasImgsBar = slot.imgsLimite > 0;
  const hasImgsSection = slot.imgsLimite > 0 || slot.imgsUsadas > 0;
  const imgsPct = slot.imgsLimite > 0 ? Math.min(100, Math.round((slot.imgsUsadas / slot.imgsLimite) * 100)) : 0;
  const imgsBarColor = imgsPct >= 90 ? '#ef4444' : imgsPct >= 50 ? '#f59e0b' : '#22c55e';

  // Barra de vídeos — mesma lógica.
  const hasSecondBar = slot.rendersLimite > 0;
  const hasSecondSection = slot.rendersLimite > 0 || slot.rendersUsados > 0;
  const renderPct = slot.rendersLimite > 0 ? Math.min(100, Math.round((slot.rendersUsados / slot.rendersLimite) * 100)) : 0;
  const renderBarColor = renderPct >= 90 ? '#ef4444' : renderPct >= 50 ? '#f59e0b' : '#6366f1';

  const expiryColor =
    cycle.status === 'overdue' ? '#ef4444' :
    cycle.status === 'due_soon' ? '#f59e0b' :
    'rgba(255,255,255,.55)';

  const expiryLabel =
    cycle.status === 'none' ? 'sem data' :
    cycle.status === 'overdue' ? `vencido há ${Math.abs(cycle.daysLeft)}d` :
    cycle.daysLeft === 0 ? 'vence hoje' :
    `vence em ${cycle.daysLeft}d`;

  const expiryDate = cycle.dueAt
    ? cycle.dueAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
    : null;

  return (
    <div style={{
      background: isBonus ? 'rgba(244,176,0,.10)' : 'rgba(255,255,255,.08)',
      border: `1px solid ${isBonus ? 'rgba(244,176,0,.35)' : 'rgba(255,255,255,.14)'}`,
      borderRadius: 10,
      padding: '9px 11px',
      minWidth: 130,
      maxWidth: 200,
      flex: '0 1 160px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {isBonus && (
            <span style={{ fontSize: 9, color: '#f4b000', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 1 }}>
              Bônus
            </span>
          )}
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: 0.2 }}>
            {slot.plan.codigo}
          </span>
          <div style={{ color: 'rgba(255,255,255,.50)', fontSize: 10, marginTop: 1, lineHeight: 1.3 }}>
            {slot.plan.nome}
          </div>
        </div>

        {/* Vencimento */}
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
          <div style={{ color: expiryColor, fontSize: 10, fontWeight: 700 }}>
            {expiryLabel}
          </div>
          {expiryDate && (
            <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 10, marginTop: 1 }}>
              {expiryDate}
            </div>
          )}
        </div>
      </div>

      {/* ── Imagens ── */}
      {hasImgsSection && (
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.40)', marginBottom: 2 }}>imagens</div>
          {hasImgsBar && (
            <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,.10)', borderRadius: 3, overflow: 'visible' }}>
              <div style={{
                position: 'absolute', inset: 0, right: `${100 - imgsPct}%`,
                borderRadius: 3, background: imgsBarColor,
                transition: 'right .3s ease',
              }} />
              <div style={{ position: 'absolute', left: '50%', top: -3, height: 12, width: 1.5, background: 'rgba(255,255,255,.45)', transform: 'translateX(-50%)' }} />
              <div style={{ position: 'absolute', left: '90%', top: -3, height: 12, width: 1.5, background: 'rgba(239,68,68,.65)', transform: 'translateX(-50%)' }} />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 1 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>
              {slot.imgsLimite > 0 ? `${slot.imgsUsadas}/${slot.imgsLimite}` : `${slot.imgsUsadas} usadas`}
            </span>
          </div>
        </div>
      )}

      {/* ── Vídeos (renders) ── */}
      {hasSecondSection && (
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.40)', marginBottom: 2 }}>vídeos</div>
          {hasSecondBar && (
            <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,.10)', borderRadius: 3, overflow: 'visible' }}>
              <div style={{
                position: 'absolute', inset: 0, right: `${100 - renderPct}%`,
                borderRadius: 3, background: renderBarColor,
                transition: 'right .3s ease',
              }} />
              <div style={{ position: 'absolute', left: '50%', top: -3, height: 12, width: 1.5, background: 'rgba(255,255,255,.45)', transform: 'translateX(-50%)' }} />
              <div style={{ position: 'absolute', left: '90%', top: -3, height: 12, width: 1.5, background: 'rgba(239,68,68,.65)', transform: 'translateX(-50%)' }} />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 1 }}>
            {hasSecondBar && (
              <div style={{ position: 'relative', height: 10, flex: 1 }}>
                <span style={{ position: 'absolute', left: 'calc(50% - 4px)', fontSize: 8, color: 'rgba(255,255,255,.30)', userSelect: 'none' }}>½</span>
                <span style={{ position: 'absolute', left: 'calc(90% - 4px)', fontSize: 8, color: 'rgba(239,68,68,.55)', userSelect: 'none' }}>!</span>
              </div>
            )}
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', flexShrink: 0 }}>
              {slot.rendersLimite > 0 ? `${slot.rendersUsados}/${slot.rendersLimite}` : `${slot.rendersUsados} usados`}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
