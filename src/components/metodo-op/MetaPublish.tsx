import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const META_ALLOWED_EMAIL = 'acupolillo@uol.com.br';

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

const igIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
);
const fbIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
);

export function MetaPublish({ imageDataUrl, caption }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<MetaStatus | null>(null);

  // Estados OAuth (modo normal)
  const [igState, setIgState] = useState<BtnState>('idle');
  const [fbState, setFbState] = useState<BtnState>('idle');
  const [igError, setIgError] = useState('');
  const [fbError, setFbError] = useState('');

  // Estados devMode — botões individuais
  const [igTestState, setIgTestState] = useState<BtnState>('idle');
  const [fbTestState, setFbTestState] = useState<BtnState>('idle');
  const [igTestError, setIgTestError] = useState('');
  const [fbTestError, setFbTestError] = useState('');

  // Estados devMode — botão "ambos"
  const [bothLoading, setBothLoading] = useState(false);
  const [bothIgState, setBothIgState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [bothFbState, setBothFbState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [bothIgError, setBothIgError] = useState('');
  const [bothFbError, setBothFbError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meta/status', { headers: await authHeader() });
        const text = await res.text();
        try {
          setStatus(JSON.parse(text) as MetaStatus);
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

  if (!user || user.email !== META_ALLOWED_EMAIL) return null;
  if (!status) return null;
  if (!imageDataUrl && !status.devMode) return null;

  const hasRegular = status.connected && !status.expired;

  const primaryBtn = (busy: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 10, border: 'none',
    fontWeight: 700, fontSize: 13,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.6 : 1,
  });

  const successTag = (color: 'green' | 'blue'): React.CSSProperties => ({
    padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    ...(color === 'green'
      ? { background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d' }
      : { background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8' }),
  });

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

  async function publishBoth() {
    setBothLoading(true);
    setBothIgState('idle');
    setBothFbState('idle');
    setBothIgError('');
    setBothFbError('');
    try {
      const res = await fetch('/api/meta/test-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ imageDataUrl, target: 'both', caption: caption || '' }),
      });
      const d = await res.json() as {
        success?: boolean;
        error?: string;
        instagram?: { success?: boolean; post_id?: string; error?: string };
        facebook?: { success?: boolean; post_id?: string; error?: string };
      };
      if (d.error) throw new Error(d.error);
      setBothIgState(d.instagram?.error ? 'err' : 'ok');
      setBothFbState(d.facebook?.error ? 'err' : 'ok');
      if (d.instagram?.error) setBothIgError(d.instagram.error);
      if (d.facebook?.error) setBothFbError(d.facebook.error);
    } catch (e) {
      setBothIgState('err');
      setBothFbState('err');
      setBothIgError((e as Error).message);
      setBothFbError((e as Error).message);
    } finally {
      setBothLoading(false);
    }
  }

  const bothDone = bothIgState !== 'idle' || bothFbState !== 'idle';

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
                <div style={successTag('green')}>✓ Publicado no Instagram</div>
              ) : (
                <button
                  type="button"
                  onClick={() => callPublish('/api/meta/publish-instagram', { imageDataUrl, caption: caption || '' }, setIgState, setIgError)}
                  disabled={igState === 'loading'}
                  style={{ ...primaryBtn(igState === 'loading'), background: 'linear-gradient(135deg,#833AB4,#C13584,#E1306C,#FD1D1D)', color: '#fff' }}
                >
                  {igIcon}{igState === 'loading' ? 'Publicando…' : 'Publicar no Instagram'}
                </button>
              )
            )}
            {status.has_facebook && (
              fbState === 'ok' ? (
                <div style={successTag('blue')}>✓ Publicado no Facebook</div>
              ) : (
                <button
                  type="button"
                  onClick={() => callPublish('/api/meta/publish-facebook', { imageDataUrl, text: caption || '' }, setFbState, setFbError)}
                  disabled={fbState === 'loading'}
                  style={{ ...primaryBtn(fbState === 'loading'), background: '#1877F2', color: '#fff' }}
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

      {/* ── Publicação via System User (devMode) ── */}
      {status.devMode && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Publicar diretamente
          </div>

          {/* Botão principal: ambos */}
          {bothDone ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {bothIgState === 'ok' && <div style={successTag('green')}>✓ Instagram publicado</div>}
              {bothFbState === 'ok' && <div style={successTag('blue')}>✓ Facebook publicado</div>}
              {bothIgState === 'err' && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>Instagram: {bothIgError}</p>}
              {bothFbState === 'err' && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>Facebook: {bothFbError}</p>}
            </div>
          ) : (
            <button
              type="button"
              onClick={publishBoth}
              disabled={bothLoading}
              style={{ ...primaryBtn(bothLoading), background: 'linear-gradient(135deg,#833AB4,#1877F2)', color: '#fff', alignSelf: 'flex-start' }}
            >
              {igIcon}{fbIcon}{bothLoading ? 'Publicando…' : 'Publicar Instagram + Facebook'}
            </button>
          )}

          {/* Botões individuais */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {igTestState === 'ok' ? (
              <div style={successTag('green')}>✓ Instagram</div>
            ) : (
              <button
                type="button"
                onClick={() => callPublish('/api/meta/test-publish', { imageDataUrl, target: 'instagram', caption: caption || '' }, setIgTestState, setIgTestError)}
                disabled={igTestState === 'loading'}
                style={{ ...primaryBtn(igTestState === 'loading'), background: 'linear-gradient(135deg,#833AB4,#C13584,#E1306C,#FD1D1D)', color: '#fff' }}
              >
                {igIcon}{igTestState === 'loading' ? 'Publicando…' : 'Publicar no Instagram'}
              </button>
            )}
            {fbTestState === 'ok' ? (
              <div style={successTag('blue')}>✓ Facebook</div>
            ) : (
              <button
                type="button"
                onClick={() => callPublish('/api/meta/test-publish', { imageDataUrl, target: 'facebook', caption: caption || '' }, setFbTestState, setFbTestError)}
                disabled={fbTestState === 'loading'}
                style={{ ...primaryBtn(fbTestState === 'loading'), background: '#1877F2', color: '#fff' }}
              >
                {fbIcon}{fbTestState === 'loading' ? 'Publicando…' : 'Publicar no Facebook'}
              </button>
            )}
          </div>
          {igTestState === 'err' && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>Instagram: {igTestError}</p>}
          {fbTestState === 'err' && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>Facebook: {fbTestError}</p>}

        </div>
      )}
    </div>
  );
}
