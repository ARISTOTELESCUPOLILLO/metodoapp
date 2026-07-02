// Tipos da aba Planos — extraído de PlansTab.tsx (Fase 9).
import { planExtrasMonthlyCost } from "@/lib/costs";

export interface Plan {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  limite_regen_texto: number;
  limite_sugestoes: number;
  limite_imgs_display: number | null;
  limite_renders_display: number | null;
  limite_geracoes_display: number | null;
  preco_maximo_brl: number;
  ativo: boolean;
  base_estatico: number;
  base_carrossel: number;
  base_estatico_final: number;
  base_reels: number;
}

export interface Costs {
  imageRef: number;
  video: number;
  content: number;
}

export const EMPTY_PLAN: Omit<Plan, "id"> = {
  codigo: "",
  nome: "",
  tipo: "mensal",
  limite_imagens: 0,
  limite_renders: 0,
  limite_geracoes: 0,
  limite_regen_texto: 0,
  limite_sugestoes: 0,
  limite_imgs_display: null,
  limite_renders_display: null,
  limite_geracoes_display: null,
  preco_maximo_brl: 0,
  ativo: true,
  base_estatico: 0,
  base_carrossel: 0,
  base_estatico_final: 0,
  base_reels: 0,
};

export function calcCusto(
  p: Pick<
    Plan,
    | "limite_imagens"
    | "limite_renders"
    | "limite_geracoes"
    | "limite_regen_texto"
    | "limite_sugestoes"
  >,
  costs: Costs,
) {
  return (
    p.limite_imagens * costs.imageRef +
    p.limite_renders * costs.video +
    p.limite_geracoes * costs.content +
    // Contadores de texto (regen "Gerar outro" + "Sugestão") — fórmula na FONTE
    // ÚNICA de costs.ts, para não divergir da aba Custos.
    planExtrasMonthlyCost(p)
  );
}
