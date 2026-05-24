// Custo unitário por operação (USD) — preços reais cobrados ao cliente.
export const COST_USD = {
  image_base: 0.0600,  // GPT Image 2 — geração base
  image_edit: 0.0800,  // GPT Image 2 — edição com referências
  video:      1.6000,  // VEO 3 fast + render
  content:    0.0130,  // gpt-4.1-mini por geração
} as const;

// Custo nominal (preço de tabela dos provedores — fal.ai / OpenAI).
// Usado para cálculo de margem no painel admin.
export const COST_NOMINAL_USD = {
  image_base: 0.0500,
  image_edit: 0.0600,
  video:      1.5000,
  content:    0.0100,
} as const;
