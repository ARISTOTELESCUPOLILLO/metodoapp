import { useState } from 'react';

interface Props {
  products: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

// Checklist de produtos/serviços do Kit de Marca, exibido ao lado da
// Sugestão (Informação-chave) — todos marcados por padrão. Os itens marcados
// são enviados como semente concreta para /api/suggest-keyinfo.
// Estruturado como accordion (recolhido por padrão) com os itens em linha,
// checkbox ao lado do nome, para não empilhar e deixar o box muito alto.
export default function ProductsChecklist({ products, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  if (!products.length) return null;
  const allChecked = selected.length === products.length;

  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter((i) => i !== item) : [...selected, item]);
  };

  return (
    <div style={{ marginTop: 10, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span className="eyebrow" style={{ fontSize: 11 }}>
          Produtos/serviços para a Sugestão{' '}
          <span style={{ color: '#64748b', fontWeight: 500 }}>({selected.length}/{products.length} marcados)</span>
        </span>
        <svg
          width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.5}
          style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => onChange(allChecked ? [] : [...products])}
              style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
            >
              {allChecked ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {products.map((item, i) => (
              <label key={i} className="checkRow" style={{ fontSize: 13, color: '#0f172a', cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.includes(item)} onChange={() => toggle(item)} />
                {item}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
