// Tipos da aba Clientes (Financeiro) — extraído de ClientesFinanceiroTab.tsx (Fase 9).

export interface Plan {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
}

export interface Profile {
  id: string;
  nome: string | null;
  email: string;
  status: string;
  is_test: boolean;
  segmento: string | null;
  plano1_id: string | null;
  plano1_inicio: string | null;
  plano1_preco_brl: number | null;
  plano2_id: string | null;
  plano2_inicio: string | null;
  plano2_preco_brl: number | null;
  bonus_id: string | null;
  bonus_inicio: string | null;
  bonus_preco_brl: number | null;
}

export type SlotStatus = "ativo" | "bloqueado" | "concluido";

export const STATUS_ORDER: Record<SlotStatus, number> = { ativo: 0, bloqueado: 1, concluido: 2 };
export const STATUS_COLOR: Record<SlotStatus, string> = {
  ativo: "#15803d",
  bloqueado: "#b91c1c",
  concluido: "#94a3b8",
};
export const STATUS_BG: Record<SlotStatus, string> = {
  ativo: "#dcfce7",
  bloqueado: "#fee2e2",
  concluido: "#f1f5f9",
};

export interface SlotData {
  label: string;
  plan: Plan;
  inicio: string | null;
  endDate: Date | null;
  status: SlotStatus;
  costBrl: number;
  soldBrl: number;
  profitBrl: number;
}

export interface ClientRow extends Profile {
  slots: SlotData[];
  totalSold: number;
  totalCost: number;
  totalProfit: number;
}
