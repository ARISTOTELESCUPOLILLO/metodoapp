// Custo unitário por operação (USD) — preços reais cobrados ao cliente.
// content_* já inclui um buffer médio de 1 clique no botão "Sugestão"
// (gpt-4.1, ~$0,0070/clique, limite de 3 por sessão) — não debitado separadamente.
export const COST_USD = {
  image_base: 0.06, // GPT Image 2 — geração base
  image_edit: 0.08, // GPT Image 2 — edição com referências
  video: 1.6, // VEO 3 fast + render
  content_pu: 0.0115, // Post Único — copy (gpt-4.1) + legenda (gpt-4.1-mini)
  content_mop_s3: 0.0405, // Método OP — ciclo de Sequência 3 (gpt-4.1)
  content_mop_s6: 0.0555, // Método OP — ciclo de Sequência 6 (gpt-4.1)
  content_mop_s9: 0.071, // Método OP — ciclo de Sequência 9 (gpt-4.1)
} as const;

// Custo nominal (preço de tabela dos provedores — fal.ai / OpenAI, sem o
// buffer de Sugestão). Usado para cálculo de margem no painel admin.
export const COST_NOMINAL_USD = {
  image_base: 0.05,
  image_edit: 0.06,
  video: 1.5,
  content_pu: 0.0045,
  content_mop_s3: 0.0334,
  content_mop_s6: 0.0487,
  content_mop_s9: 0.064,
} as const;

// Custo do ciclo de geração MOP (evento gerar_conteudo_mop) por tamanho de sequência.
export function mopContentCost(sequenceSize: number): number {
  if (sequenceSize <= 3) return COST_USD.content_mop_s3;
  if (sequenceSize >= 9) return COST_USD.content_mop_s9;
  return COST_USD.content_mop_s6;
}

// Ciclos de geração MOP por mês, por tamanho de sequência — S3/S6 semanal
// (4 ciclos/mês), S9 quinzenal (2 ciclos/mês). Reflete limite_*_display dos
// planos (ex.: S3V = 4 ciclos × 7 peças, S9V = 2 ciclos × 21 peças).
export const MOP_CICLOS_POR_MES: Record<number, number> = { 3: 4, 6: 4, 9: 2 };

// Custo OpenAI mensal projetado de um plano de Sequência (S3/S6/S9, V ou C).
export function mopMonthlyCost(sequenceSize: number): number {
  return mopContentCost(sequenceSize) * (MOP_CICLOS_POR_MES[sequenceSize] ?? 4);
}
