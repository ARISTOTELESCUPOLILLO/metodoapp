// Tipos da aba Projeção — extraído de ProjecaoTab.tsx (Fase 9).

export interface Settings {
  usd_brl_rate: number;
  falai_balance_usd: number;
  openai_balance_usd: number;
  image_price_usd: number;
  render_price_usd: number;
  geracao_price_usd: number;
}

export interface Plan {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
}

export interface Profile {
  id: string;
  nome: string | null;
  email: string;
  is_test: boolean;
  plano1_id: string | null;
  plano1_inicio: string | null;
  plano1_imgs_usadas: number;
  plano1_imgs_limite: number;
  plano1_renders_usados: number;
  plano1_renders_limite: number;
  plano1_geracoes_usadas: number;
  plano1_geracoes_limite: number;
  plano1_preco_brl: number | null;
  plano2_id: string | null;
  plano2_inicio: string | null;
  plano2_imgs_usadas: number;
  plano2_imgs_limite: number;
  plano2_renders_usados: number;
  plano2_renders_limite: number;
  plano2_geracoes_usadas: number;
  plano2_geracoes_limite: number;
  plano2_preco_brl: number | null;
  bonus_id: string | null;
  bonus_inicio: string | null;
  bonus_imgs_usadas: number;
  bonus_imgs_limite: number;
  bonus_renders_usados: number;
  bonus_renders_limite: number;
  bonus_geracoes_usadas: number;
  bonus_geracoes_limite: number;
  bonus_preco_brl: number | null;
}

export type Bucket = "0-30" | "31-60" | "61-90" | "90+" | "sem_venc";

export interface SlotProj {
  userName: string;
  userEmail: string;
  isTest: boolean;
  isAdmin: boolean;
  slot: string;
  planCodigo: string;
  endDate: Date | null;
  daysLeft: number | null;
  bucket: Bucket;
  remImgs: number;
  remRenders: number;
  remGeracoes: number;
  falCost: number;
  openaiCost: number;
  revenueBrl: number;
}

export interface BucketTotals {
  fal: number;
  openai: number;
  revenue: number;
  slots: number;
}

export const BUCKETS: Bucket[] = ["0-30", "31-60", "61-90", "90+", "sem_venc"];
export const BUCKET_LABEL: Record<Bucket, string> = {
  "0-30": "Vence em ≤ 30 dias",
  "31-60": "31 – 60 dias",
  "61-90": "61 – 90 dias",
  "90+": "Mais de 90 dias",
  sem_venc: "Sem vencimento",
};
