// Decupagem da câmera em EIXOS INDEPENDENTES — Fase 2 do levantamento de
// repetição visual dos moods (11/08/2026), aplicada ao CLAREZA em 12/08/2026.
//
// Até aqui, "câmera" era UMA frase pronta por mood, escolhida de um pool. No
// CLAREZA esse pool tinha 2 itens e os dois diziam a MESMA coisa em quase tudo:
// 50mm, plano médio ou americano, altura dos olhos — variava só frontal × 3/4
// lateral. Distância, altura, lente, profundidade de campo e qualidade de luz
// eram constantes, e é exatamente esse conjunto que o olho lê como "de novo a
// mesma foto" (ver project-moods-rodizio-fase1: as peças que destoavam não eram
// mais criativas, só tinham outra câmera).
//
// Aqui a câmera passa a ser COMPOSTA por cinco eixos, cada um com fila própria:
// distância · altura · ótica · profundidade · luz. É a decupagem que qualquer
// direção de fotografia usa, e permite variar um eixo sem mexer nos outros.
//
// A gramática do mood continua mandando no que é LEGAL: cada eixo recebe uma
// FAIXA PERMITIDA por mood, e a faixa do CLAREZA não contém nada dramático —
// nem dutch angle, nem plongée mergulhado, nem contra-plongée forte, nem bokeh
// derretido. O rodízio escolhe DENTRO da gramática, nunca contra ela (ver
// feedback-escopo-camera-nao-gramatica-do-mood: câmera, altura, lente, luz e
// pose são EXECUÇÃO; o que é o sujeito da cena é gramática e não se sorteia).

import { pickRotating } from "./colorRotation";
import { pickRandom } from "./visualDirection.lexicon";

// ── EIXO A · DISTÂNCIA ──────────────────────────────────────────────────────
// O eixo que mais muda a leitura da peça, e o que estava mais travado: as duas
// câmeras antigas do CLAREZA diziam "plano médio ou americano" e a regra do
// mood fixava "da cintura ao topo da cabeça", então close e plano geral eram
// impossíveis por definição. A trava virou regra de ROSTO INTEIRO (ver
// CLAREZA_ROSTO_INTEIRO_SENTENCE no léxico): protege o que ela existia para
// proteger — cabeça nunca cortada — sem congelar a distância.
// Macro/detalhe fica fora da faixa do CLAREZA de propósito: peça sem pessoa
// legível é SILÊNCIO ou FRAGMENTO, não CLAREZA.
export const EIXO_DISTANCIA_CLAREZA: string[] = [
  "PLANO PRÓXIMO: enquadramento fechado no busto — ombros, rosto e mãos (quando entram na ação) ocupando a maior parte do quadro, com a CABEÇA INTEIRA dentro do quadro, sem cortar testa, queixo nem o topo do cabelo",
  "PLANO MÉDIO: da cintura ou do quadril ao topo da cabeça, com a superfície de trabalho ou o entorno imediato entrando na base do quadro",
  "PLANO AMERICANO: do meio da coxa ao topo da cabeça — o gesto das mãos e a postura inteira cabem no quadro junto com parte do ambiente",
  "PLANO GERAL: a pessoa ocupa uma parte menor do quadro e o ambiente organizado de trabalho entra inteiro ao redor dela — a ordem do espaço é parte do que a peça comunica",
];

// Marcador de texto, não índice: o pool cresce e reordena com o tempo, e filtrar
// por posição é a armadilha que já causou um P0 em 11/08/2026 (índice fixo
// apontando para fora do array). Mesmo motivo de variationHasFaceNotDominant.
const DISTANCIA_REDUZ_O_ROSTO = /^PLANO GERAL\b/;

/**
 * Avatar selecionado no Kit Imagem é um CONTRATO: o usuário escolheu um rosto
 * para aparecer na peça (achado real 06/08/2026 — a pessoa sumiu no "gerar
 * novamente"). Plano geral não retira o rosto da cena, mas reduz a pessoa a uma
 * figura pequena, que é como o usuário lê "o avatar sumiu". Com avatar marcado,
 * a distância mais afastada sai da faixa; as outras três continuam.
 */
export function distanciaPreservaOAvatar(distancia: string): boolean {
  return !DISTANCIA_REDUZ_O_ROSTO.test(distancia);
}

// ── EIXO B · ALTURA ─────────────────────────────────────────────────────────
// Era fixa em "altura dos olhos" nas duas câmeras do CLAREZA. As duas
// alternativas são deliberadamente SUAVES: o mood pede leitura imediata e
// "sem ângulos dramáticos", então nem plongée mergulhado nem contra-plongée
// forte entram na faixa (esses pertencem ao IMPACTO e ao DESVIO).
export const EIXO_ALTURA_CLAREZA: string[] = [
  "altura dos olhos, câmera nivelada com o horizonte",
  "levemente acima da linha dos olhos, plongée suave que revela a organização da superfície de trabalho — inclinação discreta, NUNCA ângulo mergulhado",
  "levemente abaixo da linha dos olhos, contra-plongée discreto que assenta a figura no quadro — inclinação mínima, NUNCA ângulo ascendente forte",
];

// ── EIXO C · ÓTICA ──────────────────────────────────────────────────────────
// Variar a lente exige mexer na `assinatura` do mood junto: ela é colada no fim
// de todo imagePrompt e declarava "lente 50mm" — variar aqui sem tocar lá
// contradiria o próprio fecho do prompt. Foi por isso que o INSTANTE ficou
// preso em 35mm na Fase 1. A assinatura do CLAREZA passou a declarar a FAIXA
// (35-85mm), no mesmo padrão que o SILÊNCIO já usava ("lente 50-70mm").
export const EIXO_OTICA_CLAREZA: string[] = [
  "lente 35mm, que deixa entrar mais ar e contexto do ambiente ao redor da figura",
  "lente 50mm, perspectiva neutra e leitura imediata, sem nenhuma distorção",
  "lente 85mm, que comprime o fundo e recorta a figura com suavidade, sem distorcer traços",
];

// ── EIXO D · PROFUNDIDADE ───────────────────────────────────────────────────
// Fundo derretido em bokeh forte fica FORA da faixa do CLAREZA: o ambiente
// organizado é parte do que o mood comunica, e apagá-lo aproxima a peça de um
// retrato genérico de banco de imagem — vício que a própria regra do mood lista.
export const EIXO_PROFUNDIDADE_CLAREZA: string[] = [
  "profundidade ampla: ambiente inteiro legível e nítido, do primeiro ao último plano",
  "separação suave: figura nítida e fundo levemente fora de foco, ainda reconhecível — NUNCA fundo derretido em bokeh forte",
];

// ── EIXO E · LUZ ────────────────────────────────────────────────────────────
// As três são variantes de luz natural suave — a família que o mood declara
// ("luz natural difusa, sem sombras duras, manhã clara e estável"). Nenhuma
// introduz contraste dramático, que seria IMPACTO. O campo `luz` de
// VISUAL_DIRECTIONS["OP-01"] passou a declarar a família e delegar a fonte
// exata a este eixo, para os dois textos não se contradizerem no mesmo prompt.
export const EIXO_LUZ_CLAREZA: string[] = [
  "luz natural difusa entrando por uma janela lateral única, sombras longas e macias",
  "luz alta-chave difusa e envolvente, sombras quase ausentes, ambiente claro e arejado",
  "luz natural difusa somada a uma luminária acesa dentro do quadro, temperatura levemente mista, ainda sem nenhuma sombra dura",
];

// Passos diferentes por eixo para que a ORDEM de cada fila não ande colada à
// dos outros. A co-primalidade com o tamanho de cada pool é corrigida dentro de
// pickRotating (coprimeStep) — não se confia no chamador, porque os pools
// crescem com o tempo e um passo que deixa de ser co-primo passa a visitar meio
// pool sem erro e sem sintoma.
const PASSO_DISTANCIA = 1;
const PASSO_ALTURA = 2;
const PASSO_OTICA = 3;
const PASSO_PROFUNDIDADE = 1;
const PASSO_LUZ = 2;

/**
 * Monta a linha de câmera do CLAREZA compondo os cinco eixos.
 *
 * Sem `seed`, cada eixo é sorteado (comportamento dos caminhos ainda não
 * fiados na fila). Com `seed`, cada eixo ANDA na fila do usuário — e como todos
 * os cinco andam a cada posição, duas gerações consecutivas nunca compartilham
 * a mesma câmera em nenhum eixo.
 *
 * O espaço de combinações é 4·3·3·2·3 = 216 (162 com avatar marcado, que tira o
 * plano geral). O CICLO da fila, porém, é o mmc dos tamanhos de pool = 12: é
 * quanto o usuário percorre antes de reencontrar a mesma combinação exata.
 * Contra as 2 câmeras quase idênticas de antes, é o ganho real — e o número
 * honesto, não o tamanho do espaço.
 */
export function buildClarezaCameraLine(opts: { seed?: number; hasAvatarRef?: boolean }): string {
  const { seed, hasAvatarRef } = opts;
  const distancias = hasAvatarRef
    ? EIXO_DISTANCIA_CLAREZA.filter(distanciaPreservaOAvatar)
    : EIXO_DISTANCIA_CLAREZA;
  const pick = <T>(pool: T[], passo: number): T =>
    seed === undefined ? pickRandom(pool) : pickRotating(pool, seed, passo);
  return [
    pick(distancias, PASSO_DISTANCIA),
    pick(EIXO_ALTURA_CLAREZA, PASSO_ALTURA),
    pick(EIXO_OTICA_CLAREZA, PASSO_OTICA),
    pick(EIXO_PROFUNDIDADE_CLAREZA, PASSO_PROFUNDIDADE),
    pick(EIXO_LUZ_CLAREZA, PASSO_LUZ),
  ].join(" · ");
}
