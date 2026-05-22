import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { stopImpersonation } from './useImpersonation';

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, user: null, loading: true });

  useEffect(() => {
    // 1) Set up listener BEFORE getSession (avoid race)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Limpa impersonação no logout — impersonação agora vive em localStorage
      // (sobrevive ao background do mobile), então precisa ser limpa
      // explicitamente para não vazar entre contas no mesmo dispositivo.
      if (event === 'SIGNED_OUT') stopImpersonation();
      setState({ session, user: session?.user ?? null, loading: false });
    });
    // 2) Then fetch existing session
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
