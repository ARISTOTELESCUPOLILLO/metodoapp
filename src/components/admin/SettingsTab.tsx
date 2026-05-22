import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlanCost {
  codigo: string;
  nome: string;
  custo_total_usd: number;
  valor_plano: number;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
}

export function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [imagePrice, setImagePrice] = useState('');
  const [renderPrice, setRenderPrice] = useState('');
  const [geracaoPrice, setGeracaoPrice] = useState('');
  const [usdRate, setUsdRate] = useState('');
  const [plans, setPlans] = useState<PlanCost[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('app_settings').select('*').eq('id', true).maybeSingle(),
      supabase.from('plans').select('codigo,nome,custo_total_usd,valor_plano,limite_imagens,limite_renders,limite_geracoes').eq('ativo', true).order('codigo'),
    ]).then(([{ data: s }, { data: p }]) => {
      if (s) {
        setImagePrice(String(s.image_price_usd));
        setRenderPrice(String(s.render_price_usd));
        setGeracaoPrice(String((s as any).geracao_price_usd ?? 0));
        setUsdRate(String(s.usd_brl_rate));
      }
      setPlans((p as PlanCost[]) || []);
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
        geracao_price_usd: Number(geracaoPrice),
        usd_brl_rate: Number(usdRate),
      } as any)
      .eq('id', true);
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : 'Valores salvos.');
  }

  if (loading) return <div style={{ padding: 24 }}>Carregando…</div>;

  return (
    <div style={{ maxWidth: 540 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Ajustes de custo</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
        Valores usados para calcular custo nos relatórios e logs de uso.
      </p>

      <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
        <Field label="Imagem — gpt-image-2 / gpt-image-2-edit (US$ por imagem)" value={imagePrice} onChange={setImagePrice} />
        <Field label="Render de vídeo — Veo3 rápido (US$ por render)" value={renderPrice} onChange={setRenderPrice} />
        <Field label="Geração de texto / copy (US$ por geração)" value={geracaoPrice} onChange={setGeracaoPrice} />
        <Field label="Câmbio do dólar (R$ por US$ 1)" value={usdRate} onChange={setUsdRate} />

        <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: 13, color: '#334155' }}>
          1 imagem = US$ {Number(imagePrice || 0).toFixed(2)} ·
          {' '}1 render = US$ {Number(renderPrice || 0).toFixed(2)} ·
          {' '}1 geração = US$ {Number(geracaoPrice || 0).toFixed(2)} ·
          {' '}US$ 1 = R$ {Number(usdRate || 0).toFixed(2)}
        </div>

        {msg && <p style={{ fontSize: 13, color: msg.startsWith('Erro') ? '#b91c1c' : '#15803d' }}>{msg}</p>}

        <button type="submit" disabled={saving} style={{
          background: '#0f213f', color: '#fff', border: 'none',
          padding: '10px 16px', borderRadius: 8, fontWeight: 600,
          cursor: 'pointer', justifySelf: 'start', opacity: saving ? .6 : 1,
        }}>
          {saving ? 'Salvando…' : 'Salvar ajustes'}
        </button>
      </form>

      {plans.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Tabela de custos por plano</h3>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            Custo real em USD (col 7 do PDF) e preço cobrado ao cliente.
          </p>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  {['Código','Nome','Custo USD','Custo R$ (câmbio atual)','Preço cobrado R$','Imgs','Renders','Ger.'].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const brl = (Number(p.custo_total_usd) * Number(usdRate || 5)).toFixed(2);
                  return (
                    <tr key={p.codigo} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{p.codigo}</td>
                      <td style={{ padding: '8px 10px' }}>{p.nome}</td>
                      <td style={{ padding: '8px 10px', color: '#b45309', fontWeight: 600 }}>US$ {Number(p.custo_total_usd).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', color: '#0369a1', fontWeight: 600 }}>R$ {brl}</td>
                      <td style={{ padding: '8px 10px', color: '#15803d', fontWeight: 600 }}>R$ {(Number(p.custo_total_usd) * Number(usdRate || 5) * 3).toFixed(2)}</td>
                      <td style={{ padding: '8px 10px' }}>{p.limite_imagens}</td>
                      <td style={{ padding: '8px 10px' }}>{p.limite_renders}</td>
                      <td style={{ padding: '8px 10px' }}>{p.limite_geracoes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            "Custo R$" = Custo USD × câmbio. "Preço cobrado R$" = Custo R$ × 3. Ambos atualizam em tempo real ao alterar o câmbio acima.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{label}</span>
      <input
        type="number" step="0.01" min="0" value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
      />
    </label>
  );
}
