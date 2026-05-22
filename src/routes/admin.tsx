import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { AuthGate } from '@/components/app/AuthGate';
import { TopBar } from '@/components/app/TopBar';
import { UsersTab } from '@/components/admin/UsersTab';
import { PlansTab } from '@/components/admin/PlansTab';
import { UsageTab } from '@/components/admin/UsageTab';
import { SettingsTab } from '@/components/admin/SettingsTab';
import { InvitesTab } from '@/components/admin/InvitesTab';
import { CobrancasTab } from '@/components/admin/CobrancasTab';
import { TestUsersTab } from '@/components/admin/TestUsersTab';

export const Route = createFileRoute('/admin')({
  component: () => (
    <AuthGate requireAdmin>
      <TopBar />
      <AdminPage />
    </AuthGate>
  ),
});

type Tab = 'users' | 'invites' | 'tests' | 'plans' | 'usage' | 'cobrancas' | 'settings';

function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Usuários' },
    { id: 'invites', label: 'Convites' },
    { id: 'tests', label: 'Testes' },
    { id: 'plans', label: 'Planos' },
    { id: 'usage', label: 'Consumo' },
    { id: 'cobrancas', label: 'Cobranças' },
    { id: 'settings', label: 'Ajustes de custo' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Administração</h1>
        <Link to="/" style={{ fontSize: 13, color: '#0f213f', textDecoration: 'none', fontWeight: 600 }}>
          ← Voltar para Home
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'transparent', border: 'none', padding: '10px 14px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            color: tab === t.id ? '#0f213f' : '#64748b',
            borderBottom: tab === t.id ? '2px solid #0f213f' : '2px solid transparent',
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'invites' && <InvitesTab />}
      {tab === 'tests' && <TestUsersTab />}
      {tab === 'plans' && <PlansTab />}
      {tab === 'usage' && <UsageTab />}
      {tab === 'cobrancas' && <CobrancasTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}
