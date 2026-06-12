interface Props {
  products: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

// Checklist de produtos/serviços do Kit de Marca, exibido ao lado da
// Sugestão (Informação-chave) — todos marcados por padrão. Os itens marcados
// são enviados como semente concreta para /api/suggest-keyinfo.
export default function ProductsChecklist({ products, selected, onChange }: Props) {
  if (!products.length) return null;
  const allChecked = selected.length === products.length;

  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter((i) => i !== item) : [...selected, item]);
  };

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <span className="eyebrow" style={{ fontSize: 11 }}>Produtos/serviços para a Sugestão</span>
        <button
          type="button"
          onClick={() => onChange(allChecked ? [] : [...products])}
          style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
        >
          {allChecked ? 'Desmarcar todos' : 'Marcar todos'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {products.map((item, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0f172a', cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.includes(item)} onChange={() => toggle(item)} />
            {item}
          </label>
        ))}
      </div>
    </div>
  );
}
