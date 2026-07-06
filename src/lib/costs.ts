// Custo medido por CHAMADA REAL à OpenAI (07/2026, ver memória do projeto
// "audit-custo-textual-2026-07-06") — substitui as estimativas antigas por
// tokens reais × preço oficial (gpt-4.1: $2,00/1M in, $8,00/1M out; gpt-4.1-
// mini: $0,40/1M in, $1,60/1M out). Sugestão é média ponderada pelo uso real
// dos últimos 90 dias (54 MOP / 37 PU, ~59%/41%): MOP $0,0101 + PU $0,0093.
// MOP S6/S9 são 1 amostra real cada (finish_reason="stop", não truncado) —
// direção confiável (bem abaixo do estimado), valor exato vale reconferir
// com mais amostras se o padrão de uso mudar muito.
const SUGESTAO_BUFFER_USD = 0.0098;

// Custo unitário por operação (USD) — preços reais cobrados ao cliente.
export const COST_USD = {
  image_base: 0.06, // GPT Image 2 — geração base
  image_edit: 0.08, // GPT Image 2 — edição com referências
  video: 1.6, // VEO 3 fast + render
  content_pu: 0.0049, // Post Único — copy (gpt-4.1) + legenda (gpt-4.1-mini) — medido real 07/2026 (era 0.0045)
  content_mop_s3: 0.0299, // Método OP — ciclo de Sequência 3 (gpt-4.1) — medido real 07/2026 (era 0.0335)
  content_mop_s6: 0.0317, // Método OP — ciclo de Sequência 6 (gpt-4.1) — medido real 07/2026 (era 0.0485)
  content_mop_s9: 0.0367, // Método OP — ciclo de Sequência 9 (gpt-4.1) — medido real 07/2026 (era 0.064)
  // Custo de 1 clique de "Sugestão" (botão que gera Informação-chave, gpt-4.1).
  sugestao: SUGESTAO_BUFFER_USD,
  // Custo de 1 clique de "Gerar outro" de bloco (regenerate-block, gpt-4.1).
  // Medido real 07/2026 — era proxy de 0.0115 (estimativa aceita sem medir);
  // a chamada real é bem menor (reescreve só 1 campo, não a peça inteira).
  regen_bloco: 0.0017,
} as const;

// Custo nominal (preço de tabela dos provedores — fal.ai / OpenAI, sem o
// buffer de Sugestão). Usado para cálculo de margem no painel admin.
export const COST_NOMINAL_USD = {
  image_base: 0.05,
  image_edit: 0.06,
  video: 1.5,
  content_pu: 0.0049,
  content_mop_s3: 0.0299,
  content_mop_s6: 0.0317,
  content_mop_s9: 0.0367,
  sugestao: SUGESTAO_BUFFER_USD,
  regen_bloco: 0.0017,
} as const;

// Planos de Sequência (S3/S6/S9, Visual ou Cinemática) têm limite_geracoes=0
// mas geram 1 ciclo MOP por semana (S3/S6) ou quinzena (S9) — extrai o
// tamanho da sequência do código do plano (ex.: "S6V" → 6).
export function mopSequenceSize(codigo: string): number | null {
  const m = codigo.match(/^S(3|6|9)/);
  return m ? Number(m[1]) : null;
}

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

export interface PlanForCost {
  codigo: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  // Opcionais — telas/tipos antigos que ainda não selecionam essas colunas
  // continuam funcionando (tratadas como 0 em planExtrasMonthlyCost), mas
  // planMonthlyCost já soma os 3 contadores de camada adicional quando
  // informados, para não repetir o bug de "aba mostra custo divergente"
  // com quem já foi corrigido (aba Custos/Planos).
  limite_regen_texto?: number | null;
  limite_sugestoes?: number | null;
  limite_primeira_geracao?: number | null;
}

export interface UnitPrices {
  image_price_usd: number;
  render_price_usd: number;
  geracao_price_usd: number;
}

// Custo mensal projetado de um plano com fal.ai (imagens + renders) — usa
// 100% dos limites contratados.
export function planMonthlyFalaiCost(plan: PlanForCost, prices: UnitPrices): number {
  return (
    plan.limite_imagens * prices.image_price_usd + plan.limite_renders * prices.render_price_usd
  );
}

// Custo mensal projetado de um plano com OpenAI — geração avulsa (Post
// Único, limite_geracoes × preço) ou ciclos MOP (planos de Sequência,
// que guardam limite_geracoes=0 por convenção de "ilimitado por ciclo").
export function planMonthlyOpenaiCost(plan: PlanForCost, prices: UnitPrices): number {
  const seqSize = mopSequenceSize(plan.codigo);
  return seqSize ? mopMonthlyCost(seqSize) : plan.limite_geracoes * prices.geracao_price_usd;
}

// Custo mensal total projetado de um plano (fal.ai + OpenAI + os 3
// contadores de camada adicional — Gerar outro/Sugestão/Primeira Geração,
// via planExtrasMonthlyCost mais abaixo). Fonte única — usada por todas as
// telas admin que mostram custo/preço mínimo por plano, pra evitar
// reimplementações divergentes da mesma fórmula.
export function planMonthlyCost(plan: PlanForCost, prices: UnitPrices): number {
  return (
    planMonthlyFalaiCost(plan, prices) +
    planMonthlyOpenaiCost(plan, prices) +
    planExtrasMonthlyCost(plan)
  );
}

// Plano com os limites dos 3 contadores de camada adicional (regen "Gerar
// outro", "Sugestão" e "Primeira Geração"). `codigo` é usado só para decidir
// o custo unitário de "Primeira Geração" (planos de Sequência vs. avulsos —
// ver primeiraGeracaoUnitCost). Todos opcionais para compat com
// chamadores/tipos antigos que ainda não conhecem os campos — tratados como
// 0/ausente quando não informados.
export interface PlanExtras {
  codigo?: string;
  limite_regen_texto?: number | null;
  limite_sugestoes?: number | null;
  limite_primeira_geracao?: number | null;
}

// Custo por peça de "Primeira Geração" (título+texto[+legenda] gerados na
// criação inicial do post — não precisa ser exato, é camada adicional).
// Só se aplica a planos avulsos (PU8/PU4/PU2, EX01) — em planos de
// Sequência (S3/S6/S9) o custo já está 100% coberto por mopMonthlyCost
// (mesmo ciclo, mesma chamada de debitUsage; ver planExtrasMonthlyCost),
// então não é chamada pra esses planos.
const MOP_PIECES_POR_SEQUENCIA: Record<number, number> = { 3: 7, 6: 14, 9: 21 };
function primeiraGeracaoUnitCost(): number {
  return COST_USD.content_pu;
}

// Peças reais geradas por mês por um plano de Sequência (null para planos
// avulsos, que usam limite_geracoes diretamente). Usado na aba Planos para
// exibir "ilimitado (N peças/mês)" em vez do limite_geracoes=0 cru.
export function mopPiecesPerMonth(codigo: string): number | null {
  const seqSize = mopSequenceSize(codigo);
  if (!seqSize) return null;
  const pecas = MOP_PIECES_POR_SEQUENCIA[seqSize] ?? MOP_PIECES_POR_SEQUENCIA[6];
  return pecas * (MOP_CICLOS_POR_MES[seqSize] ?? 4);
}

// Custo mensal projetado dos 3 gastos de OpenAI que passaram a ter limite
// próprio por plano — "Gerar outro" de bloco (regen_bloco), "Sugestão"
// (sugestao) e "Primeira Geração" (primeiraGeracaoUnitCost). FONTE ÚNICA da
// fórmula: usada tanto pela aba Planos quanto pela aba Custos, para as duas
// não divergirem (cada tela reimplementar a fórmula já causou bug antes).
//
// "Primeira Geração" só entra pra planos avulsos (PU8/PU4/PU2, EX01) — em
// planos de Sequência (S3/S6/S9) ela re-precificaria o MESMO ciclo que
// planMonthlyOpenaiCost já cobre inteiro (achado de auditoria 2026-07-03:
// somar os dois inflava o custo de texto projetado em 143%, mesmo o custo
// REAL debitado — generate-content.ts, 1 chamada, 1 custoUsd — nunca dobrando).
export function planExtrasMonthlyCost(plan: PlanExtras): number {
  const isSequencia = !!(plan.codigo && mopSequenceSize(plan.codigo));
  return (
    (plan.limite_regen_texto ?? 0) * COST_USD.regen_bloco +
    (plan.limite_sugestoes ?? 0) * COST_USD.sugestao +
    (isSequencia ? 0 : (plan.limite_primeira_geracao ?? 0) * primeiraGeracaoUnitCost())
  );
}
