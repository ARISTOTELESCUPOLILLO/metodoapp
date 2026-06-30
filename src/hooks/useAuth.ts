import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { stopImpersonation } from "./useImpersonation";
import { clearSessionImages } from "../utils/sessionImageCache";

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
      if (event === "SIGNED_OUT") stopImpersonation();
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
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (userId) {
      [
        `metodo-op-result-v1:${userId}`,
        `metodo-op-postunico-img-v1:${userId}`,
        `metodo-op-postunico-caption-v1:${userId}`,
        `metodo-op-postunico-started-v1:${userId}`,
        `metodo-op-postunico-visualselection-v1:${userId}`,
      ].forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {
          /* limpeza de sessão best-effort */
        }
      });
      // Limpa imagens do MOP do localStorage (memória e localStorage via clearSessionImages)
      clearSessionImages(userId);
    }
  } catch {
    /* sem sessão pra obter userId: nada pra limpar */
  }
  // Permite que um login realmente novo (mesma aba) re-execute o
  // auto-select de modo por plano. Loop por prefixo cobre também flags
  // deixadas por impersonações.
  try {
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith("metodo-op-modo-init-v1:")) sessionStorage.removeItem(k);
    }
  } catch {
    /* limpeza de sessão best-effort */
  }
  await supabase.auth.signOut();
}
