import { useState } from 'react';
import { PlansTab } from './PlansTab';
import { PrecosTab } from './PrecosTab';

type Sub = 'planos' | 'precos';

const SUB_TABS: { id: Sub; label: string }[] = [
  { id: 'planos', label: 'Planos' },
  { id: 'precos', label: 'Tabela de Preços' },
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

export function PlanosCompletoTab() {
  const [sub, setSub] = useState<Sub>('planos');
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {SUB_TABS.map((t) => (
          <button key={t.id} onClick={() => setSub(t.id)} style={subStyle(sub === t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'planos' && <PlansTab />}
      {sub === 'precos' && <PrecosTab />}
    </div>
  );
}
