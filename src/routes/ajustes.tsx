import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthGate } from '@/components/app/AuthGate';
import { TopBar } from '@/components/app/TopBar';

export const Route = createFileRoute('/ajustes')({
  component: () => (
    <AuthGate requireAdmin>
      <TopBar />
      <AjustesPage />
    </AuthGate>
  ),
});

function AjustesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [imagePrice, setImagePrice] = useState('');
  const [renderPrice, setRenderPrice] = useState('');
  const [usdRate, setUsdRate] = useState('');

  useEffect(() => {
    supabase.from('app_settings').select('*').eq('id', true).maybeSingle().then(({ data }) => {
      if (data) {
        setImagePrice(String(data.image_price_usd));
        setRenderPrice(String(data.render_price_usd));
        setUsdRate(String(data.usd_brl_rate));
      }
      setLoading(false);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from('app_settings')
      .update({
        image_price_usd: Number(imagePrice),
        render_price_usd: Number(renderPrice),
        usd_brl_rate: Number(usdRate),
      })
      .eq('id', true);
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : 'Valores salvos.');
  }

  if (loading) return <div style={{ padding: 24 }}>Carregando…</div>;

  return (
    <div style={{ maxWidth: 540, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Ajustes de custo</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
        Valores usados para calcular custo nos relatórios e logs de uso.
      </p>

      <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
        <Field
          label="Imagem (US$ por imagem)"
          value={imagePrice}
          onChange={setImagePrice}
          hint="Custo unitário de cada imagem gerada."
        />
        <Field
          label="Render vídeo + áudio (US$ por render)"
          value={renderPrice}
          onChange={setRenderPrice}
          hint="Custo unitário de cada render de vídeo (com áudio)."
        />
        <Field
          label="Câmbio do dólar (R$ por US$ 1)"
          value={usdRate}
          onChange={setUsdRate}
          hint="Usado para mostrar custo em reais nos painéis."
        />

        <div style={{
          background: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: 13, color: '#334155',
        }}>
          Preview: 1 imagem = US$ {Number(imagePrice || 0).toFixed(2)} ·
          {' '}1 render = US$ {Number(renderPrice || 0).toFixed(2)} ·
          {' '}US$ 1 = R$ {Number(usdRate || 0).toFixed(2)}
        </div>

        {msg && <p style={{ fontSize: 13, color: msg.startsWith('Erro') ? '#b91c1c' : '#15803d' }}>{msg}</p>}

        <button
          type="submit"
          disabled={saving}
          style={{
            background: '#0f213f', color: '#fff', border: 'none',
            padding: '10px 16px', borderRadius: 8, fontWeight: 600,
            cursor: 'pointer', justifySelf: 'start', opacity: saving ? .6 : 1,
          }}
        >
          {saving ? 'Salvando…' : 'Salvar ajustes'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{label}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
          fontSize: 14, background: '#fff',
        }}
      />
      {hint && <span style={{ fontSize: 12, color: '#64748b' }}>{hint}</span>}
    </label>
  );
}
