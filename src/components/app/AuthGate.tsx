import { useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AuthGate({ children, requireAdmin }: Props) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: '/login' });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }
  if (!user) return null;

  if (requireAdmin) return <AdminCheck>{children}</AdminCheck>;
  return <>{children}</>;
}

function AdminCheck({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useProfile();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: '/' });
  }, [loading, isAdmin, navigate]);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verificando permissões…</p>
      </div>
    );
  }
  if (!isAdmin) return null;
  return <>{children}</>;
}
