import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { stopImpersonation } from "./useImpersonation";
import { clearSessionImages } from "../utils/sessionImageCache";
import { lsClearPrefix, lsRemove, ssClearPrefix } from "../lib/storage/store";
import {
  RESULT_KEY,
  PU_IMG_KEY,
  PU_CAPTION_KEY,
  PU_STARTED_KEY,
  PU_VISUAL_KEY,
  COPY_EDITS_KEY,
  KIT_KEY,
  LOGO_KEY,
  FORM_KEY,
  POSTUNICO_FORM_KEY,
  MODO_INIT_KEY,
  USO_REF_PREFIX,
} from "../lib/storage/keys";

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
      // Remove dados escopados por userId
      for (const base of [
        RESULT_KEY,
        PU_IMG_KEY,
        PU_CAPTION_KEY,
        PU_STARTED_KEY,
        PU_VISUAL_KEY,
        COPY_EDITS_KEY,
        KIT_KEY,
        LOGO_KEY,
        FORM_KEY,
        POSTUNICO_FORM_KEY,
      ]) {
        lsRemove(base, userId);
      }
      // Limpa imagens do MOP (memória + localStorage, via prefixo)
      clearSessionImages(userId);
      // Seleção de referências do Kit Imagem por peça — mesmo padrão de prefixo.
      lsClearPrefix(`${USO_REF_PREFIX}:${userId}:`);
    }
  } catch {
    /* sem sessão pra obter userId: nada pra limpar */
  }
  // Permite que um login realmente novo (mesma aba) re-execute o
  // auto-select de modo por plano. Limpa também flags de impersonações.
  ssClearPrefix(`${MODO_INIT_KEY}:`);
  await supabase.auth.signOut();
}
