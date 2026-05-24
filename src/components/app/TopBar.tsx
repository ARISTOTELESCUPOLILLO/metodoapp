import { Link } from '@tanstack/react-router';
import { Home, Moon, Sun, History, Users, LogOut, UserX, Image as ImageIcon } from 'lucide-react';
import { useAuth, signOut } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useImpersonation, stopImpersonation } from '@/hooks/useImpersonation';
import { useDarkMode } from '@/hooks/useDarkMode';
import logoOp from '@/assets/lp-logo-op.png';

export function TopBar() {
  const { user } = useAuth();
  const { isAdmin } = useProfile();
  const impersonation = useImpersonation();
  const [isDark, toggleDark] = useDarkMode();
  if (!user) return null;

  const iconBtn: React.CSSProperties = {
    background: '#0f213f',
    border: 'none',
    color: '#fff',
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    cursor: 'pointer',
    textDecoration: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,.15)',
  };

  return (
    <>
    {impersonation && (
      <div style={{
        background: '#fde68a', color: '#78350f', padding: '8px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 13, fontWeight: 600, borderBottom: '2px solid #f59e0b',
      }}>
        <span>
          {impersonation.isTest && (
            <span style={{ background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginRight: 8 }}>TESTE</span>
          )}
          👤 Atuando como <strong>{impersonation.nome}</strong> ({impersonation.email}) — alterações no Kit de Marca serão salvas para esse usuário.
        </span>
        <button
          type="button"
          onClick={() => { stopImpersonation(); window.location.assign('/app'); }}
          style={{
            background: '#78350f', color: '#fff', border: 'none', padding: '4px 10px',
            borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <UserX size={14} /> Sair desse modo
        </button>
      </div>
    )}
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 6, padding: '10px 12px', flexWrap: 'wrap',
    }}>
      <Link to="/" title="Voltar ao site" aria-label="Voltar ao site" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <img src={logoOp} alt="Método OP" style={{ height: 28, width: 'auto', display: 'block' }} />
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Link to="/app" style={iconBtn} title="Início" aria-label="Voltar para a home">
        <Home size={16} />
      </Link>
      <button type="button" style={iconBtn} title={isDark ? 'Modo claro' : 'Modo escuro'} aria-label="Alternar tema" onClick={toggleDark}>
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <Link to="/conta" style={iconBtn} title="Minha conta" aria-label="Minha conta">
        <History size={16} />
      </Link>
      <Link to="/historico" style={iconBtn} title="Histórico de gerações" aria-label="Histórico de gerações">
        <ImageIcon size={16} />
      </Link>
      {isAdmin && (
        <Link to="/admin" style={iconBtn} title="Administração" aria-label="Administração">
          <Users size={16} />
        </Link>
      )}
      <button
        type="button" style={iconBtn} title="Sair" aria-label="Sair"
        onClick={() => signOut().then(() => window.location.assign('/login'))}
      >
        <LogOut size={16} />
      </button>
      </div>
    </div>
    </>
  );
}
