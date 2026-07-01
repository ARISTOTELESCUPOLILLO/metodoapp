// Tipos da aba Consumo — extraído de UsageTab.tsx (Fase 9).

export interface Log {
  id: string;
  created_at: string;
  user_id: string | null;
  evento: string;
  modulo: string | null;
  qtd_imagens: number;
  qtd_renders: number;
  qtd_geracoes: number;
  custo_usd: number;
  slot: string | null;
  impersonated_by?: string | null;
}

export interface ProfileInfo {
  email: string;
  nome: string | null;
  is_test: boolean;
  created_by: string | null;
  bonus_assigned_by: string | null;
}
