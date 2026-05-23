import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlanCost {
  codigo: string;
  nome: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
}

export function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [imageBasePrice, setImageBasePrice] = useState('');
  const [imageRefPrice, setImageRefPrice] = useState('');
  const [renderPrice, setRenderPrice] = useState('');
  const [geracaoPrice, setGeracaoPrice] = useState('');
  const [usdRate, setUsdRate] = useState('');
  const [falaiBalance, setFalaiBalance] = useState('');
  const [openaiBalance, setOpenaiBalance] = useState('');
  const [plans, setPlans] = useState<PlanCost[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('app_settings').select('*').eq('id', true).maybeSingle(),
      supabase.from('plans').select('codigo,nome,limite_imagens,limite_renders,limite_geracoes').eq('ativo', true).order('codigo'),
    ]).then(([{ data: s }, { data: p }]) => {
      if (s) {
        setImageBasePrice(String((s as any).image_base_price_usd ?? 0.046));
        setImageRefPrice(String(s.image_price_usd ?? 0.058));
        setRenderPrice(String(s.render_price_usd ?? 1.50));
        setGeracaoPrice(String((s as any).geracao_price_usd ?? 0.003));
        setUsdRate(String(s.usd_brl_rate ?? 5.5));
        setFalaiBalance(String((s as any).falai_balance_usd ?? 0));
        setOpenaiBalance(String((s as any).openai_balance_usd ?? 0));
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
        image_base_price_usd: Number(imageBasePrice),
        image_price_usd: Number(imageRefPrice),
        render_price_usd: Number(renderPrice),
        geracao_price_usd: Number(geracaoPrice),
        usd_brl_rate: Number(usdRate),
        falai_balance_usd: Number(falaiBalance),
        openai_balance_usd: Number(openaiBalance),
      } as any)
      .eq('id', true);
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : 'Valores salvos com sucesso.');
  }

  const imgBase = Number(imageBasePrice || 0);
  const imgRef = Number(imageRefPrice || 0);
  const render = Number(renderPrice || 0);
  const geracao = Number(geracaoPrice || 0);
  const rate = Number(usdRate || 5.5);

  if (loading) return <div style={{ padding: 24 }}>Carregando…</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Ajustes de custo</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
        Valores usados em todos os cálculos de custo, projeção e preço mínimo. Qualquer alteração reflete automaticamente em todo o painel.
      </p>

      <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f213f', marginBottom: 10 }}>Custos unitários — fal.ai</div>
          <div className="settingsGrid2">
            <Field label="Imagem simples (US$ / img)" value={imageBasePrice} onChange={setImageBasePrice} />
            <Field label="Imagem c/ referência (US$ / img)" value={imageRefPrice} onChange={setImageRefPrice} />
            <Field label="Vídeo + render (US$ / render)" value={renderPrice} onChange={setRenderPrice} />
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f213f', marginBottom: 10 }}>Custo unitário — OpenAI</div>
          <Field label="Conteúdo de texto (US$ / geração)" value={geracaoPrice} onChange={setGeracaoPrice} />
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f213f', marginBottom: 10 }}>Saldos disponíveis</div>
          <div className="settingsGrid2">
            <Field label="Saldo fal.ai (US$)" value={falaiBalance} onChange={setFalaiBalance} />
            <Field label="Saldo OpenAI (US$)" value={openaiBalance} onChange={setOpenaiBalance} />
          </div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f213f', marginBottom: 10 }}>Câmbio</div>
          <Field label="Dólar (R$ por US$ 1)" value={usdRate} onChange={setUsdRate} />
        </div>

        <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: 8, fontSize: 12, color: '#334155', lineHeight: 1.7 }}>
          <strong>Resumo:</strong>
          {' '}Img simples US$ {imgBase.toFixed(4)} · Img ref US$ {imgRef.toFixed(4)} · Render US$ {render.toFixed(3)} · Conteúdo US$ {geracao.toFixed(4)}
          <br />
          US$ 1 = R$ {rate.toFixed(2)} · Saldo fal.ai US$ {Number(falaiBalance || 0).toFixed(2)} · OpenAI US$ {Number(openaiBalance || 0).toFixed(2)}
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
            Custo calculado em tempo real com base nos valores acima. Usa o custo de <strong>imagem com referência</strong> para todas as imagens (custo maior).
          </p>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  {['Código','Nome','Imgs','Renders','Conteúdos','Custo USD','Custo R$','Preço mín. R$ (×4)'].map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 12, color: '#475569', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const custoUsd = p.limite_imagens * imgRef + p.limite_renders * render + p.limite_geracoes * geracao;
                  const custoBrl = custoUsd * rate;
                  const precoMin = custoBrl * 4;
                  return (
                    <tr key={p.codigo} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{p.codigo}</td>
                      <td style={{ padding: '8px 10px' }}>{p.nome}</td>
                      <td style={{ padding: '8px 10px' }}>{p.limite_imagens}</td>
                      <td style={{ padding: '8px 10px' }}>{p.limite_renders}</td>
                      <td style={{ padding: '8px 10px' }}>{p.limite_geracoes}</td>
                      <td style={{ padding: '8px 10px', color: '#b45309', fontWeight: 600 }}>US$ {custoUsd.toFixed(3)}</td>
                      <td style={{ padding: '8px 10px', color: '#0369a1', fontWeight: 600 }}>R$ {custoBrl.toFixed(2)}</td>
                      <td style={{ padding: '8px 10px', color: '#15803d', fontWeight: 600 }}>R$ {precoMin.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            Fórmula: imgs × custo_ref + renders × custo_render + conteúdos × custo_texto. Preço mín. = custo R$ × 4.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{label}</span>
      <input
        type="number" step="0.0001" min="0" value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
      />
    </label>
  );
}
