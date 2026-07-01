// Tipos da aba Convites — extraído de InvitesTab.tsx (Fase 9).

export interface Invite {
  id: string;
  nome: string | null;
  email: string;
  status: string;
  segment: string | null;
  plano1_id: string | null;
  plano2_id: string | null;
  bonus_id: string | null;
  accepted_at: string | null;
  created_at: string;
  source_test_profile_id: string | null;
  kit_migrated_at: string | null;
}

export interface Plan {
  id: string;
  codigo: string;
  nome: string;
  elegivel_bonus: boolean;
}

export interface TestProfile {
  id: string;
  nome: string | null;
  email: string;
}

export interface ProfileSlots {
  email: string;
  plano1_id: string | null;
  plano2_id: string | null;
  bonus_id: string | null;
}

export interface DirectProfile {
  id: string;
  email: string;
  nome: string | null;
  plano1_id: string | null;
  plano2_id: string | null;
  bonus_id: string | null;
}
