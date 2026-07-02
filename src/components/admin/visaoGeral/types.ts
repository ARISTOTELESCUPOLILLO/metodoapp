// Tipos da aba Painel (Visão Geral) — extraído de VisaoGeralTab.tsx (Fase 9).

export interface Profile {
  id: string;
  nome: string | null;
  email: string;
  status: string;
  is_test: boolean;
  plano1_id: string | null;
  plano1_preco_brl: number | null;
  plano2_id: string | null;
  plano2_preco_brl: number | null;
  bonus_id: string | null;
  bonus_preco_brl: number | null;
}

export interface Plan {
  id: string;
  codigo: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  limite_regen_texto: number;
  limite_sugestoes: number;
  limite_primeira_geracao: number;
}

export interface Settings {
  image_price_usd: number;
  render_price_usd: number;
  geracao_price_usd: number;
  usd_brl_rate: number;
  falai_balance_usd: number;
  openai_balance_usd: number;
}
