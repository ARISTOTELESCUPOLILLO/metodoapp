import { createContext, useContext, type ReactNode } from "react";
import type { SlotInfo, Profile } from "../hooks/useProfile";
import type { PlanAccess } from "../lib/planAccess";
import type { CotaPorTipo } from "../core/personalizacaoMop";

export interface ProfileContextValue {
  profile: Profile | null;
  slots: SlotInfo[];
  planAccess: PlanAccess;
  profileLoading: boolean;
  refreshProfile: () => void;
  rendersTotal: number;
  rendersRestantes: number;
  imgsTotal: number;
  imgsRestantes: number;
  geracoesTotal: number;
  geracoesRestantes: number;
  semPlano: boolean;
  isAdmin: boolean;
  isSelfAdmin: boolean;
  effectiveAdmin: boolean;
  cotaPersonalizados: CotaPorTipo | undefined;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({
  value,
  children,
}: {
  value: ProfileContextValue;
  children: ReactNode;
}) {
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useAppProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useAppProfile deve ser usado dentro de ProfileProvider");
  return ctx;
}
