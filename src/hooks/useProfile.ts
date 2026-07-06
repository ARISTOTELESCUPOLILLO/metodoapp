import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "./useAuth";
import { ZERO_COTA, type CotaPorTipo } from "@/core/personalizacaoMop";
import { loadProfileServer } from "@/lib/profile.functions";

// Re-exporta tipos canônicos de profile.repo para evitar quebrar importadores.
export type { PlanInfo, SlotInfo, Profile } from "@/repository/profile.repo";

export function useProfile(targetUserId?: string | null) {
  const { user, loading: authLoading } = useAuth();
  // userId (não `user` inteiro) como dependência — achado real de produção
  // (07/2026): o Supabase entrega um objeto `session.user` NOVO a cada
  // TOKEN_REFRESHED (evento automático e silencioso quando a aba volta a
  // ficar visível depois de um tempo em segundo plano), mesmo sendo o MESMO
  // usuário. Se `refresh` dependesse do objeto inteiro, esse refresh de
  // token disparava `setLoading(true)` de novo — e como AuthGate/conta.tsx
  // substituem toda a árvore filha enquanto `loading` é true, a página
  // inteira (aba ativa, formulário em preenchimento) desmontava e remontava
  // do zero só por causa de uma renovação de token silenciosa.
  const userId = user?.id;
  const loadFn = useServerFn(loadProfileServer);
  const [profile, setProfile] = useState<import("@/repository/profile.repo").Profile | null>(null);
  const [slots, setSlots] = useState<import("@/repository/profile.repo").SlotInfo[]>([]);
  const [cotaPersonalizados, setCotaPersonalizados] = useState<CotaPorTipo>(ZERO_COTA);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSelfAdmin, setIsSelfAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setSlots([]);
      setIsAdmin(false);
      setIsSelfAdmin(false);
      setCotaPersonalizados(ZERO_COTA);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await loadFn({
        data: { targetUserId: targetUserId ?? undefined },
      });
      setProfile(result.profile);
      setIsAdmin(result.isAdmin);
      setIsSelfAdmin(result.isSelfAdmin);
      setSlots(result.slots);
      setCotaPersonalizados(result.cotaPersonalizados);
    } catch {
      setProfile(null);
      setSlots([]);
      setIsAdmin(false);
      setIsSelfAdmin(false);
      setCotaPersonalizados(ZERO_COTA);
    }
    setLoading(false);
  }, [userId, loadFn, targetUserId]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  return {
    profile,
    slots,
    isAdmin,
    isSelfAdmin,
    cotaPersonalizados,
    loading: loading || authLoading,
    refresh,
  };
}
