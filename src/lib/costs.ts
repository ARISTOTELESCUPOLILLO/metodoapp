// Custo unitário por operação (USD).
// Fonte: preços reais fal.ai + estimativa OpenAI gpt-4.1-mini.
export const COST_USD = {
  image_base: 0.0457,   // GPT Image 2 sem referências
  image_edit: 0.0584,   // GPT Image 2 com referências (edit)
  video:      1.50,     // VEO 3 fast + render
  content:    0.003,    // gpt-4.1-mini por geração (estimativa média)
} as const;
