import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  imageDataUrl?: string;
  caption?: string;
}

interface MetaStatus {
  connected: boolean;
  devMode: boolean;
  expired?: boolean;
  has_instagram?: boolean;
  has_facebook?: boolean;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type BtnState = 'idle' | 'loading' | 'ok' | 'err';

export function MetaPublish({ imageDataUrl, caption }: Props) {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [igState, setIgState] = useState<BtnState>('idle');
  const [fbState, setFbState] = useState<BtnState>('idle');
  const [igTestState, setIgTestState] = useState<BtnState>('idle');
  const [fbTestState, setFbTestState] = useState<BtnState>('idle');
  const [igError, setIgError] = useState('');
  const [fbError, setFbError] = useState('');
  const [igTestError, setIgTestError] = useState('');
  const [fbTestError, setFbTestError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meta/status', { headers: await authHeader() });
        // Protege contra respostas não-JSON (ex: error page HTML em caso de 500)
        const text = await res.text();
        try {
          const d = JSON.parse(text) as MetaStatus;
          setStatus(d);
        } catch {
          console.error('[MetaPublish] status não retornou JSON:', res.status, text.slice(0, 200));
          setStatus({ connected: false, devMode: false });
        }
      } catch (e) {
        console.error('[MetaPublish] fetch /api/meta/status falhou:', e);
        setStatus({ connected: false, devMode: false });
      }
    })();
  }, []);

  // Sem imagem E sem nada para mostrar → não renderiza
  if (!status) return null;
  if (!imageDataUrl && !status.devMode) return null;

  const hasRegular = status.connected && !status.expired;

  async function callPublish(
    endpoint: string,
    body: object,
    setState: (s: BtnState) => void,
    setError: (e: string) => void,
  ) {
    setState('loading');
    setError('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(body),
      });
      const d = await res.json() as { success?: boolean; error?: string };
      if (!d.success) throw new Error(d.error || 'Erro ao publicar');
      setState('ok');
    } catch (e) {
      setError((e as Error).message);
      setState('err');
    }
  }

  const primaryBtn = (busy: boolean, ok: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 10, border: 'none',
    fontWeight: 700, fontSize: 13,
    cursor: busy || ok ? 'default' : 'pointer',
    opacity: busy ? 0.6 : 1,
  });

  const devBtn = (busy: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 13px', borderRadius: 8, border: '1px dashed #d97706',
    background: '#fffbeb', color: '#92400e',
    fontWeight: 600, fontSize: 12,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.6 : 1,
  });

  const igIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
  );
  const fbIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  );

  return (
    <div style={{ display: 'grid', gap: 10 }}>

      {/* ── Publicação normal (via OAuth) ── */}
      {hasRegular && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Publicar diretamente
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {status.has_instagram && (
              igState === 'ok' ? (
                <div style={{ padding: '9px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 13, fontWeight: 700 }}>✓ Publicado no Instagram</div>
              ) : (
                <button
                  type="button"
                  onClick={() => callPublish('/api/meta/publish-instagram', { imageDataUrl, caption: caption || '' }, setIgState, setIgError)}
                  disabled={igState === 'loading'}
                  style={{ ...primaryBtn(igState === 'loading', false), background: 'linear-gradient(135deg,#833AB4,#C13584,#E1306C,#FD1D1D)', color: '#fff' }}
                >
                  {igIcon}{igState === 'loading' ? 'Publicando…' : 'Publicar no Instagram'}
                </button>
              )
            )}
            {status.has_facebook && (
              fbState === 'ok' ? (
                <div style={{ padding: '9px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', fontSize: 13, fontWeight: 700 }}>✓ Publicado no Facebook</div>
              ) : (
                <button
                  type="button"
                  onClick={() => callPublish('/api/meta/publish-facebook', { imageDataUrl, text: caption || '' }, setFbState, setFbError)}
                  disabled={fbState === 'loading'}
                  style={{ ...primaryBtn(fbState === 'loading', false), background: '#1877F2', color: '#fff' }}
                >
                  {fbIcon}{fbState === 'loading' ? 'Publicando…' : 'Publicar no Facebook'}
                </button>
              )
            )}
          </div>
          {igState === 'err' && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>Instagram: {igError}</p>}
          {fbState === 'err' && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>Facebook: {fbError}</p>}
        </div>
      )}

      {/* ── Modo Teste Dev (admin + META_ACCESS_TOKEN) ── */}
      {status.devMode && (
        <div style={{ padding: 10, borderRadius: 10, background: '#fefce8', border: '1px dashed #fbbf24', display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            🧪 Modo Teste Dev
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>
            Token de desenvolvimento configurado. Publica usando <code>META_ACCESS_TOKEN</code> do servidor.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {igTestState === 'ok' ? (
              <div style={{ padding: '7px 13px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12, fontWeight: 700 }}>✓ Teste Instagram OK</div>
            ) : (
              <button
                type="button"
                onClick={() => callPublish('/api/meta/test-publish', { imageDataUrl, target: 'instagram', caption: caption || '' }, setIgTestState, setIgTestError)}
                disabled={igTestState === 'loading'}
                style={devBtn(igTestState === 'loading')}
              >
                {igIcon}{igTestState === 'loading' ? 'Testando…' : 'Testar Instagram'}
              </button>
            )}
            {fbTestState === 'ok' ? (
              <div style={{ padding: '7px 13px', borderRadius: 8, background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', fontSize: 12, fontWeight: 700 }}>✓ Teste Facebook OK</div>
            ) : (
              <button
                type="button"
                onClick={() => callPublish('/api/meta/test-publish', { imageDataUrl, target: 'facebook', caption: caption || '' }, setFbTestState, setFbTestError)}
                disabled={fbTestState === 'loading'}
                style={devBtn(fbTestState === 'loading')}
              >
                {fbIcon}{fbTestState === 'loading' ? 'Testando…' : 'Testar Facebook'}
              </button>
            )}
          </div>
          {igTestState === 'err' && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>IG: {igTestError}</p>}
          {fbTestState === 'err' && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>FB: {fbTestError}</p>}
        </div>
      )}
    </div>
  );
}
