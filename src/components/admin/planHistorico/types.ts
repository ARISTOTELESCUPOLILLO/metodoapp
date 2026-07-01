// Tipos e formatadores da aba Histórico de Planos — extraído de PlanHistoricoTab.tsx (Fase 9.1).

export interface PurchaseRow {
  id: string;
  user_id: string;
  slot: string;
  plan_codigo: string | null;
  plan_nome: string | null;
  inicio: string | null;
  expira_em: string | null;
  preco_brl: number | null;
  imgs_limite: number;
  renders_limite: number;
  geracoes_limite: number;
  imgs_usadas_final: number;
  renders_usados_final: number;
  geracoes_usados_final: number;
  motivo_fechamento: string | null;
  created_at: string;
  profiles: { nome: string | null; email: string } | null;
  closer_nome: string | null;
}

export const LIMIT = 50;

export const slotLabel: Record<string, string> = { plano1: "P1", plano2: "P2", bonus: "Bônus" };
export const motivoLabel: Record<string, string> = {
  renovacao: "Renovação",
  troca_plano: "Troca de plano",
  remocao: "Remoção",
};

export const fmt = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "—";

export const brl = (v: number | null) => (v != null ? `R$ ${v.toFixed(2)}` : "—");
