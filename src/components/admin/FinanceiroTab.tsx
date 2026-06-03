import { useState } from 'react';
import { CustosTab } from './CustosTab';
import { ProjecaoTab } from './ProjecaoTab';
import { ClientesFinanceiroTab } from './ClientesFinanceiroTab';
import { VisaoGeralTab } from './VisaoGeralTab';

type Sub = 'visao' | 'custos' | 'projecao' | 'clientes';

const SUB_TABS: { id: Sub; label: string }[] = [
  { id: 'visao',     label: 'Painel' },
  { id: 'custos',    label: 'Custos e Consumo' },
  { id: 'projecao',  label: 'Projeção de Compras' },
  { id: 'clientes',  label: 'Clientes' },
];

const subStyle = (active: boolean): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  color: active ? '#0f213f' : '#64748b',
  borderBottom: active ? '2px solid #0f213f' : '2px solid transparent',
  marginBottom: -1,
});

export function FinanceiroTab() {
  const [sub, setSub] = useState<Sub>('visao');
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {SUB_TABS.map((t) => (
          <button key={t.id} onClick={() => setSub(t.id)} style={subStyle(sub === t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'visao'     && <VisaoGeralTab />}
      {sub === 'custos'    && <CustosTab />}
      {sub === 'projecao'  && <ProjecaoTab />}
      {sub === 'clientes'  && <ClientesFinanceiroTab />}
    </div>
  );
}
