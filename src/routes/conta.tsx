import { createFileRoute, Link } from '@tanstack/react-router';
import { AuthGate } from '@/components/app/AuthGate';
import { TopBar } from '@/components/app/TopBar';
import { useProfile, SlotInfo } from '@/hooks/useProfile';

export const Route = createFileRoute('/conta')({
  component: () => (
    <AuthGate>
      <TopBar />
      <ContaPage />
    </AuthGate>
  ),
});

function bar(used: number, limit: number) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 100 ? '#dc2626' : pct >= 90 ? '#d97706' : '#0f766e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: '#e2e8f0', height: 10, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontSize: 12, color: '#475569', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('pt-BR') : '—';
}

function pctOf(u: number, l: number) { return l > 0 ? (u / l) * 100 : 0; }

function SlotCard({ slot }: { slot: SlotInfo }) {
  const pImg = pctOf(slot.imgsUsadas, slot.imgsLimite);
  const pRen = pctOf(slot.rendersUsados, slot.rendersLimite);
  const hasRenders = slot.rendersLimite > 0;
  const alertImg = pImg >= 90;
  const alertRen = hasRenders && pRen >= 90;

  return (
    <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid #e2e8f0', display: 'grid', gap: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{slot.label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{slot.plan.nome}</div>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right' }}>
          início<br /><strong style={{ color: '#0f172a' }}>{fmtDate(slot.inicio)}</strong>
        </div>
      </header>

      <div>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Uso de imagens</div>
        {bar(slot.imgsUsadas, slot.imgsLimite)}
      </div>

      {hasRenders && (
        <div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Uso de renders</div>
          {bar(slot.rendersUsados, slot.rendersLimite)}
        </div>
      )}

      {(alertImg || alertRen) && (
        <div style={{
          padding: 10, borderRadius: 8,
          background: pImg >= 100 || pRen >= 100 ? '#fee2e2' : '#fef3c7',
          color: pImg >= 100 || pRen >= 100 ? '#991b1b' : '#92400e',
          fontSize: 13,
        }}>
          {pImg >= 100 || pRen >= 100
            ? `Limite atingido em ${slot.label}.`
            : `Você atingiu 90% do uso de ${slot.label}.`}
        </div>
      )}
    </div>
  );
}

function ContaPage() {
  const { profile, slots, isAdmin, loading } = useProfile();
  if (loading) return <div style={{ padding: 24 }}>Carregando…</div>;
  if (!profile) return <div style={{ padding: 24 }}>Perfil não encontrado.</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 14px', display: 'grid', gap: 20 }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Olá, {profile.nome || profile.email}</h1>
          <Link to="/" style={{ fontSize: 13, color: '#0f213f', textDecoration: 'none', fontWeight: 600 }}>
            ← Voltar para Home
          </Link>
          <button
            type="button"
            onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.href = '/'; }}
            style={{ marginLeft: 'auto', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            title="Voltar para a página anterior"
          >
            ✕ Fechar
          </button>
        </div>
        <p style={{ color: '#64748b' }}>
          {isAdmin ? 'Acesso de administrador (consumo ilimitado).' : `Você tem ${slots.length} ${slots.length === 1 ? 'plano ativo' : 'planos ativos'}.`}
        </p>
        {profile.client_code && (
          <p style={{ marginTop: 4, fontSize: 12, color: '#94a3b8', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
            ID do cliente: {profile.client_code}
          </p>
        )}
        {profile.segmento && (
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: '#ecfeff', border: '1px solid #67e8f9', color: '#0e7490', fontSize: 13 }}>
            <strong>Seu segmento:</strong> {profile.segmento}
            <span style={{ fontSize: 11, opacity: 0.8 }}>· orienta a personalização das imagens</span>
          </div>
        )}
      </header>

      {isAdmin ? (
        <div style={{ padding: 16, borderRadius: 12, background: '#0f213f', color: '#fff' }}>
          <strong>Consumo ilimitado</strong> — administrador.
        </div>
      ) : slots.length === 0 ? (
        <div style={{ padding: 16, borderRadius: 12, background: '#fef3c7', color: '#92400e' }}>
          Você ainda não tem nenhum plano ativo. Fale com o administrador.
        </div>
      ) : (
        <section style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {slots.map((s) => <SlotCard key={s.key} slot={s} />)}
        </section>
      )}

      <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/" style={{ padding: '10px 16px', background: '#0f172a', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 600 }}>
          Nova sequência
        </Link>
        <Link to="/esqueci-senha" style={{ padding: '10px 16px', background: '#f1f5f9', color: '#0f172a', borderRadius: 10, textDecoration: 'none', fontWeight: 600 }}>
          Alterar senha
        </Link>
      </section>
    </div>
  );
}
