import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AuthGate({ children, requireAdmin }: Props) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || user) return;
    // useAuth pode reportar user=null momentaneamente durante a inicialização
    // (corrida entre onAuthStateChange e getSession — mais provável em
    // mobile com o app aberto em mais de um lugar, ex.: atalho da tela
    // inicial + navegador, disputando a renovação do mesmo token). Confirma
    // com uma releitura direta da sessão antes de chutar para /login.
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && !data.session) navigate({ to: "/login" });
    });
    return () => {
      cancelled = true;
    };
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
    if (!loading && !isAdmin) navigate({ to: "/" });
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
