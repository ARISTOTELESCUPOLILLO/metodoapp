// Tipos da aba Testes — extraído de TestUsersTab.tsx (Fase 9.1).

export type Segmento = "SERVIÇOS" | "VAREJO" | "MARCA";
export type SlotKey = "plano1" | "plano2" | "bonus";

export interface Row {
  id: string;
  nome: string | null;
  email: string;
  client_code: string | null;
  segmento: Segmento | null;
  created_at: string;
  plano1_id: string | null;
  plano1_imgs_usadas: number;
  plano1_imgs_limite: number;
  plano1_renders_usados: number;
  plano1_renders_limite: number;
  plano1_geracoes_usadas: number;
  plano1_geracoes_limite: number;
  plano2_id: string | null;
  plano2_imgs_usadas: number;
  plano2_imgs_limite: number;
  plano2_renders_usados: number;
  plano2_renders_limite: number;
  plano2_geracoes_usadas: number;
  plano2_geracoes_limite: number;
  bonus_id: string | null;
  bonus_imgs_usadas: number;
  bonus_imgs_limite: number;
  bonus_renders_usados: number;
  bonus_renders_limite: number;
  bonus_geracoes_usadas: number;
  bonus_geracoes_limite: number;
}

export interface Plan {
  id: string;
  codigo: string;
  nome: string;
  elegivel_bonus: boolean;
}
