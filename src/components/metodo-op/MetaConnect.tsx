import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MetaStatus {
  connected: boolean;
  devMode?: boolean;
  expired?: boolean;
  ig_username?: string;
  fb_page_name?: string;
  has_instagram?: boolean;
  has_facebook?: boolean;
  token_expires_at?: string;
  _debug?: { isAdmin: boolean; hasToken: boolean; roles: unknown[]; rolesErr?: string; uid?: string };
}

// Estado interno de diagnóstico (visível em /conta)
let _rawStatusText = '';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function MetaConnect() {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [rawStatus, setRawStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Captura feedback do callback OAuth na URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('meta_connected')) setSuccessMsg('Instagram/Facebook conectado com sucesso.');
    if (params.get('meta_error')) {
      const codes: Record<string, string> = {
        cancelado: 'Autorização cancelada.',
        config: 'Variáveis META_* não configuradas no servidor.',
        estado_invalido: 'Estado OAuth inválido. Tente novamente.',
        token: 'Falha ao obter token da Meta.',
        db: 'Erro ao salvar conexão. Tente novamente.',
        servidor: 'Erro no servidor. Tente novamente.',
      };
      setError(codes[params.get('meta_error')!] || 'Erro desconhecido ao conectar.');
    }
    fetchStatus();
  }, []);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch('/api/meta/status', { headers: await authHeader() });
      const text = await res.text();
      setRawStatus(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      try {
        const data = JSON.parse(text) as MetaStatus;
        setStatus(data);
      } catch {
        setStatus({ connected: false, devMode: false });
      }
    } catch (e) {
      setRawStatus(`Erro de rede: ${(e as Error).message}`);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/meta/auth-url', { method: 'POST', headers: await authHeader() });
      const { url, error: err } = await res.json() as { url?: string; error?: string };
      if (err || !url) throw new Error(err || 'Falha ao gerar URL de autorização');
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Desconectar sua conta Meta? Você precisará reconectar para publicar.')) return;
    setDisconnecting(true);
    setError(null);
    try {
      await fetch('/api/meta/disconnect', { method: 'POST', headers: await authHeader() });
      setStatus({ connected: false });
      setSuccessMsg(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Verificando conexão…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', gap: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Ícone Meta */}
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#405DE6,#5851DB,#833AB4,#C13584,#E1306C,#FD1D1D,#F56040,#F77737,#FCAF45)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Instagram / Facebook</div>
          {status?.connected
            ? <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>● Conectado</div>
            : <div style={{ fontSize: 12, color: '#64748b' }}>Não conectado</div>}
        </div>
      </header>


      {successMsg && (
        <div style={{ padding: 10, borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 13 }}>
          {successMsg}
        </div>
      )}
      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {status?.connected ? (
        <>
          <div style={{ display: 'grid', gap: 6 }}>
            {status.has_instagram && status.ig_username && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Instagram:</span>
                <strong>@{status.ig_username}</strong>
              </div>
            )}
            {status.has_facebook && status.fb_page_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>Página Facebook:</span>
                <strong>{status.fb_page_name}</strong>
              </div>
            )}
            {status.token_expires_at && (
              <div style={{ fontSize: 11, color: status.expired ? '#dc2626' : '#94a3b8' }}>
                {status.expired ? '⚠ Token expirado — reconecte' : `Token válido até ${new Date(status.token_expires_at).toLocaleDateString('pt-BR')}`}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {status.expired && (
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                style={{ padding: '8px 16px', background: '#f5a623', color: '#0a1326', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                {connecting ? 'Abrindo…' : '↺ Reconectar'}
              </button>
            )}
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{ padding: '8px 16px', background: '#fff', color: '#dc2626', borderRadius: 8, border: '1px solid #fecaca', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: disconnecting ? 0.6 : 1 }}
            >
              {disconnecting ? 'Desconectando…' : 'Desconectar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            Conecte sua conta Meta para publicar imagens e legendas diretamente no Instagram e Facebook após gerar a peça.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            style={{ alignSelf: 'flex-start', padding: '10px 18px', background: '#0f172a', color: '#fff', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, cursor: connecting ? 'not-allowed' : 'pointer', opacity: connecting ? 0.7 : 1 }}
          >
            {connecting ? 'Abrindo autorização…' : 'Conectar Instagram / Facebook'}
          </button>
        </>
      )}
    </div>
  );
}
