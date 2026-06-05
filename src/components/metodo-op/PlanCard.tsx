import { computeCycleFromExpiry } from '@/lib/cycle';
import type { SlotInfo } from '@/hooks/useProfile';

interface Props {
  slot: SlotInfo;
  isAdmin?: boolean;
}

export function PlanCard({ slot, isAdmin }: Props) {
  const isBonus = slot.key === 'bonus';
  const cycle = computeCycleFromExpiry(slot.expiraEm);

  // Régua visual usa limite de display (Uso Normal), capada em 99% — nunca exibe 100% via barra.
  // Esgotado usa limite real (Uso Estendido) — só trava quando o real é atingido.
  const hasImgsBar = slot.imgsLimiteDisplay > 0;
  const hasImgsSection = slot.imgsLimiteDisplay > 0 || slot.imgsUsadas > 0;
  const imgsPct = slot.imgsLimiteDisplay > 0 ? Math.min(99, Math.round((slot.imgsUsadas / slot.imgsLimiteDisplay) * 100)) : 0;
  const imgsBarColor = imgsPct >= 90 ? '#ef4444' : imgsPct >= 50 ? '#f59e0b' : '#22c55e';
  const imgsExhausted = hasImgsBar && slot.imgsUsadas >= slot.imgsLimite;

  // Barra de vídeos — mesma lógica.
  const hasSecondBar = slot.rendersLimiteDisplay > 0;
  const hasSecondSection = slot.rendersLimiteDisplay > 0 || slot.rendersUsados > 0;
  const renderPct = slot.rendersLimiteDisplay > 0 ? Math.min(99, Math.round((slot.rendersUsados / slot.rendersLimiteDisplay) * 100)) : 0;
  const renderBarColor = renderPct >= 90 ? '#ef4444' : renderPct >= 50 ? '#f59e0b' : '#6366f1';
  const rendersExhausted = hasSecondBar && slot.rendersUsados >= slot.rendersLimite;

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
    <div
      style={{
        background: isBonus ? 'rgba(244,176,0,.08)' : 'rgba(255,255,255,.07)',
        border: `1px solid ${isBonus ? 'rgba(244,176,0,.30)' : 'rgba(255,255,255,.14)'}`,
        borderRadius: 10,
        padding: '8px 12px',
        minWidth: 0,
        maxWidth: 240,
        flex: '1 1 150px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >

      {/* ── Cabeçalho ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {isBonus && (
            <div style={{ marginBottom: 1 }}>
              <span style={{ fontSize: 9, color: '#f4b000', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, display: 'block' }}>
                Bônus
              </span>
              <span style={{ fontSize: 8, color: 'rgba(244,176,0,.60)', display: 'block', lineHeight: 1.2 }}>
                reserva automática
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: 0.2 }}>
              {slot.plan.codigo}
            </span>
          </div>
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
          {imgsExhausted ? (
            <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, letterSpacing: 0.2 }}>🔒 Esgotado</div>
          ) : hasImgsBar && (
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
        </div>
      )}

      {/* ── Vídeos (renders) ── */}
      {hasSecondSection && (
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.40)', marginBottom: 2 }}>vídeos</div>
          {rendersExhausted ? (
            <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, letterSpacing: 0.2 }}>🔒 Esgotado</div>
          ) : hasSecondBar && (
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
        </div>
      )}

    </div>
  );
}
