// Decupagem da câmera em EIXOS INDEPENDENTES — Fase 2 do levantamento de
// repetição visual dos moods (11/08/2026). Aplicada ao CLAREZA e, no mesmo dia,
// estendida a IMPACTO e SILÊNCIO (12/08/2026).
//
// Até aqui, "câmera" era UMA frase pronta por mood, escolhida de um pool. Os
// pools eram pequenos e internamente parecidos:
//   · CLAREZA — 2 opções, ambas 50mm/plano médio/altura dos olhos; variava só
//     frontal × 3/4 lateral;
//   · IMPACTO — 2 opções, ambas 35mm/distância média; variava só contra-plongée
//     × 3/4 dinâmico;
//   · SILÊNCIO — 4 opções, misturando distância, altura e lente numa frase só,
//     sem profundidade nem luz.
// Distância, altura, lente, profundidade de campo e qualidade de luz ficavam
// praticamente constantes, e é esse conjunto que o olho lê como "de novo a
// mesma foto" (ver project-moods-rodizio-fase1: as peças que destoavam não
// eram mais criativas, só tinham outra câmera).
//
// Aqui a câmera passa a ser COMPOSTA por cinco eixos, cada um com fila própria:
// distância · altura · ótica · profundidade · luz. É a decupagem que qualquer
// direção de fotografia usa, e permite variar um eixo sem mexer nos outros.
//
// A gramática do mood continua mandando no que é LEGAL: cada mood recebe uma
// FAIXA PERMITIDA por eixo, e nenhuma faixa contradiz a regra inegociável do
// próprio mood — o CLAREZA nunca vira dramático, o IMPACTO nunca perde o
// contra-plongée nem ganha plongée, o SILÊNCIO nunca perde o espaço negativo.
// O rodízio escolhe DENTRO da gramática, nunca contra ela (ver
// feedback-escopo-camera-nao-gramatica-do-mood: câmera, altura, lente, luz e
// pose são EXECUÇÃO; o que é o sujeito da cena é gramática e não se sorteia).

import { MoodCode } from "../types";
import { pickRotating } from "./colorRotation";
import { pickRandom } from "./visualDirection.lexicon";

// ── CLAREZA (OP-01) ─────────────────────────────────────────────────────────
// Faixa sem nada dramático: o mood pede leitura imediata e "sem ângulos
// dramáticos". Macro/detalhe fica fora de propósito — peça sem pessoa legível
// é SILÊNCIO ou FRAGMENTO, não CLAREZA.
//
// A distância só pôde entrar porque a trava de plano médio do mood
// (CLAREZA_PLANO_MEDIO_SENTENCE, "da cintura ao topo da cabeça") foi reescrita
// como CLAREZA_ROSTO_INTEIRO_SENTENCE: ela existia para proteger o rosto de ser
// decapitado, e protegia travando o enquadramento.
export const EIXO_DISTANCIA_CLAREZA: string[] = [
  "PLANO PRÓXIMO: enquadramento fechado no busto — ombros, rosto e mãos (quando entram na ação) ocupando a maior parte do quadro, com a CABEÇA INTEIRA dentro do quadro, sem cortar testa, queixo nem o topo do cabelo",
  "PLANO MÉDIO: da cintura ou do quadril ao topo da cabeça, com a superfície de trabalho ou o entorno imediato entrando na base do quadro",
  "PLANO AMERICANO: do meio da coxa ao topo da cabeça — o gesto das mãos e a postura inteira cabem no quadro junto com parte do ambiente",
  "PLANO GERAL: a pessoa ocupa uma parte menor do quadro e o ambiente organizado de trabalho entra inteiro ao redor dela — a ordem do espaço é parte do que a peça comunica",
];

export const EIXO_ALTURA_CLAREZA: string[] = [
  "altura dos olhos, câmera nivelada com o horizonte",
  "levemente acima da linha dos olhos, plongée suave que revela a organização da superfície de trabalho — inclinação discreta, NUNCA ângulo mergulhado",
  "levemente abaixo da linha dos olhos, contra-plongée discreto que assenta a figura no quadro — inclinação mínima, NUNCA ângulo ascendente forte",
];

// Variar a lente exige mexer na `assinatura` do mood junto: ela é colada no fim
// de todo imagePrompt e declarava uma lente única — variar aqui sem tocar lá
// contradiria o próprio fecho do prompt. Foi por isso que o INSTANTE ficou
// preso em 35mm na Fase 1. As assinaturas dos três moods passaram a declarar a
// FAIXA, no padrão que o SILÊNCIO já usava ("lente 50-70mm").
export const EIXO_OTICA_CLAREZA: string[] = [
  "lente 35mm, que deixa entrar mais ar e contexto do ambiente ao redor da figura",
  "lente 50mm, perspectiva neutra e leitura imediata, sem nenhuma distorção",
  "lente 85mm, que comprime o fundo e recorta a figura com suavidade, sem distorcer traços",
];

// Fundo derretido em bokeh forte fica FORA da faixa do CLAREZA: o ambiente
// organizado é parte do que o mood comunica, e apagá-lo aproxima a peça de um
// retrato genérico de banco de imagem — vício que a própria regra do mood lista.
export const EIXO_PROFUNDIDADE_CLAREZA: string[] = [
  "profundidade ampla: ambiente inteiro legível e nítido, do primeiro ao último plano",
  "separação suave: figura nítida e fundo levemente fora de foco, ainda reconhecível — NUNCA fundo derretido em bokeh forte",
];

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

// ── IMPACTO (OP-02) ─────────────────────────────────────────────────────────
// O mood tem a trava mais estreita dos três: IMPACTO_CAMERA_SENTENCE declara
// "OBRIGATÓRIO contra-plongée leve ou ângulo 3/4 dinâmico, PROIBIDO câmera
// frontal reta na altura dos olhos, PROIBIDO plongée de cima para baixo". Isso
// é gramática do mood — a força dramática vem do ângulo ascendente — e NÃO foi
// tocada. O eixo de altura varia DENTRO dela: são três sabores de ângulo
// ascendente, nenhum frontal reto, nenhum de cima para baixo.
export const EIXO_DISTANCIA_IMPACTO: string[] = [
  "PLANO PRÓXIMO: busto ou rosto recortado pela luz ocupando quase todo o quadro — a proximidade é o que cria a intensidade",
  "PLANO MÉDIO: da cintura ao topo da cabeça, com o vazio escuro do ambiente fechando a composição em volta",
  "PLANO AMERICANO: do meio da coxa ao topo da cabeça — postura e gesto inteiros dentro do quadro, com peso e presença",
  "PLANO ABERTO: a figura recortada pela luz ocupa parte menor do quadro e o vazio escuro domina o resto — a escala do vazio é o que amplifica o sujeito",
];

export const EIXO_ALTURA_IMPACTO: string[] = [
  "contra-plongée leve, câmera pouco abaixo da linha dos olhos, ângulo ascendente sutil",
  "contra-plongée mais marcado, câmera claramente abaixo da linha dos olhos — perspectiva forte, ainda natural, sem caricatura",
  "ângulo 3/4 dinâmico partindo de baixo, câmera lateral e abaixo da linha dos olhos ao mesmo tempo — perspectiva cinematográfica",
];

export const EIXO_OTICA_IMPACTO: string[] = [
  "lente 35mm, perspectiva forte que aumenta a presença do sujeito no quadro",
  "lente 50mm, perspectiva firme sem exagero de profundidade",
  "lente 85mm, que comprime o fundo escuro e recorta o sujeito contra ele",
];

export const EIXO_PROFUNDIDADE_IMPACTO: string[] = [
  "profundidade rasa: sujeito nítido e fundo escuro dissolvido, sem nenhum detalhe competindo",
  "profundidade média: o vazio escuro do ambiente ainda legível atrás do sujeito, dando escala à cena",
];

// Todas dentro do que o mood declara: "luz focal direcional sobre fundo escuro
// médio, contraste pronunciado com alguma gradação, sombras recortadas sem
// extremismo — dramaticidade presente sem apagar completamente o fundo".
export const EIXO_LUZ_IMPACTO: string[] = [
  "foco direcional lateral recortando o sujeito, fundo escuro médio com alguma gradação",
  "contraluz quente desenhando o contorno do sujeito, com preenchimento mínimo que mantém o rosto legível",
  "fonte dura única, alta e lateral, projetando sombra recortada na parede ao lado do sujeito",
];

// ── SILÊNCIO (OP-06) ────────────────────────────────────────────────────────
// A trava aqui é de ESCALA, não de ângulo: SILENCIO_ESCALA_SENTENCE exige que o
// sujeito ocupe NO MÁXIMO 30% do quadro e o resto seja vazio respirado. Isso é
// a identidade do mood ("o espaço vazio É a mensagem") e NÃO foi tocada — cada
// distância abaixo diz explicitamente que o sujeito permanece pequeno, para
// nenhuma delas competir com a regra dentro do mesmo prompt.
// Também não há filtro de avatar aqui: o próprio mood determina que a pessoa,
// quando aparece, é fragmento parcial e pequena. Mexer nisso seria gramática.
export const EIXO_DISTANCIA_SILENCIO: string[] = [
  "CÂMERA PRÓXIMA: distância curta, enquadramento fechado no sujeito — que mesmo assim ocupa proporção discreta do quadro, com vasto entorno respirado em volta",
  "CÂMERA MÉDIA: distância intermediária, sujeito pequeno e centrado ou em regra dos terços, o vazio ocupando a maior parte da composição",
  "CÂMERA ABERTA: distância maior, o sujeito reduzido a um ponto de interesse mínimo dentro de um campo vazio e sereno",
  "CÂMERA MUITO ABERTA: o sujeito quase perdido na amplitude do ambiente — parede, janela ou superfície vazia dominando quase todo o quadro",
];

export const EIXO_ALTURA_SILENCIO: string[] = [
  "câmera nivelada com o sujeito, sem inclinação nenhuma",
  "câmera zenital, vista de cima a pino — composição plana e geométrica, sombra curta projetada na superfície",
  "câmera levemente acima do sujeito, plongée suave que abre a superfície vazia atrás dele",
  "câmera levemente abaixo do sujeito, ângulo ascendente mínimo que lhe dá presença discreta sem nenhuma dramaticidade",
];

export const EIXO_OTICA_SILENCIO: string[] = [
  "lente 50mm, perspectiva neutra e limpa",
  "lente 70mm, leve compressão que assenta o sujeito no vazio",
  "lente 100mm, compressão maior que achata os planos e aumenta a sensação de quietude",
];

export const EIXO_PROFUNDIDADE_SILENCIO: string[] = [
  "tudo nítido: fundo liso e limpo, sem desfoque, a nitidez uniforme reforçando a quietude",
  "separação suave: sujeito nítido sobre fundo levemente fora de foco — NUNCA bokeh forte, que traria drama a um mood que não o tem",
];

// Dentro da luz que o mood declara: "suave alta-chave, de fonte ampla e difusa,
// sombras quase ausentes, atmosfera serena". Nenhuma introduz direção dura.
export const EIXO_LUZ_SILENCIO: string[] = [
  "luz difusa entrando por uma janela ampla lateral, sombra longa e quase imperceptível",
  "luz alta-chave frontal e envolvente, praticamente sem sombra, superfícies uniformemente claras",
  "luz difusa vinda de cima, como de claraboia ou teto translúcido, com sombra curta e suave sob o sujeito",
];

// ── Composição dos eixos ────────────────────────────────────────────────────

interface EixosDoMood {
  distancia: string[];
  altura: string[];
  otica: string[];
  profundidade: string[];
  luz: string[];
  /** Se a distância mais afastada deve sair da faixa quando há avatar
   *  selecionado no Kit Imagem — ver distanciaPreservaOAvatar. */
  filtraDistanciaComAvatar: boolean;
}

const EIXOS_POR_MOOD: Partial<Record<MoodCode, EixosDoMood>> = {
  "OP-01": {
    distancia: EIXO_DISTANCIA_CLAREZA,
    altura: EIXO_ALTURA_CLAREZA,
    otica: EIXO_OTICA_CLAREZA,
    profundidade: EIXO_PROFUNDIDADE_CLAREZA,
    luz: EIXO_LUZ_CLAREZA,
    filtraDistanciaComAvatar: true,
  },
  "OP-02": {
    distancia: EIXO_DISTANCIA_IMPACTO,
    altura: EIXO_ALTURA_IMPACTO,
    otica: EIXO_OTICA_IMPACTO,
    profundidade: EIXO_PROFUNDIDADE_IMPACTO,
    luz: EIXO_LUZ_IMPACTO,
    filtraDistanciaComAvatar: true,
  },
  // SILÊNCIO fica de fora do filtro de avatar de propósito: a gramática do mood
  // já determina que a pessoa é fragmento parcial e pequeno no quadro. Filtrar
  // a distância aqui seria decidir contra o mood, não a favor do avatar.
  "OP-06": {
    distancia: EIXO_DISTANCIA_SILENCIO,
    altura: EIXO_ALTURA_SILENCIO,
    otica: EIXO_OTICA_SILENCIO,
    profundidade: EIXO_PROFUNDIDADE_SILENCIO,
    luz: EIXO_LUZ_SILENCIO,
    filtraDistanciaComAvatar: false,
  },
};

// Marcador de texto, não índice: os pools crescem e reordenam com o tempo, e
// filtrar por posição é a armadilha que já causou um P0 em 11/08/2026 (índice
// fixo apontando para fora do array). Mesmo motivo de variationHasFaceNotDominant.
const DISTANCIA_REDUZ_O_ROSTO = /^PLANO (GERAL|ABERTO)\b/;

/**
 * Avatar selecionado no Kit Imagem é um CONTRATO: o usuário escolheu um rosto
 * para aparecer na peça (achado real 06/08/2026 — a pessoa sumiu no "gerar
 * novamente"). A distância mais afastada não retira o rosto da cena, mas reduz
 * a pessoa a uma figura pequena, que é como o usuário lê "o avatar sumiu". Com
 * avatar marcado, ela sai da faixa; as demais continuam.
 */
export function distanciaPreservaOAvatar(distancia: string): boolean {
  return !DISTANCIA_REDUZ_O_ROSTO.test(distancia);
}

/** Moods cuja câmera já foi decupada em eixos. Os demais (INSTANTE, FRAGMENTO,
 *  DESVIO) seguem com os pools de frase pronta no léxico. */
export function moodTemEixosDeCamera(mood?: MoodCode): boolean {
  return !!mood && !!EIXOS_POR_MOOD[mood];
}

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
 * Monta a linha de câmera do mood compondo os cinco eixos.
 *
 * Sem `seed`, cada eixo é sorteado (comportamento dos caminhos ainda não
 * fiados na fila). Com `seed`, cada eixo ANDA na fila do usuário — e como todos
 * os cinco andam a cada posição, duas gerações consecutivas nunca compartilham
 * a mesma câmera em nenhum eixo.
 *
 * Espaço de combinações: CLAREZA e IMPACTO 4·3·3·2·3 = 216 (162 com avatar
 * marcado, que tira a distância mais afastada); SILÊNCIO 4·4·3·2·3 = 288.
 * O CICLO da fila, porém, é o mmc dos tamanhos de pool — 12 nos três moods.
 * É quanto o usuário percorre antes de reencontrar a mesma combinação exata, e
 * é o número honesto, não o tamanho do espaço.
 *
 * Devolve "" para mood sem eixos — quem chama mantém o pool antigo.
 */
export function buildCameraLine(
  mood: MoodCode | undefined,
  opts: { seed?: number; hasAvatarRef?: boolean },
): string {
  const eixos = mood ? EIXOS_POR_MOOD[mood] : undefined;
  if (!eixos) return "";
  const { seed, hasAvatarRef } = opts;
  const distancias =
    hasAvatarRef && eixos.filtraDistanciaComAvatar
      ? eixos.distancia.filter(distanciaPreservaOAvatar)
      : eixos.distancia;
  const pick = <T>(pool: T[], passo: number): T =>
    seed === undefined ? pickRandom(pool) : pickRotating(pool, seed, passo);
  return [
    pick(distancias, PASSO_DISTANCIA),
    pick(eixos.altura, PASSO_ALTURA),
    pick(eixos.otica, PASSO_OTICA),
    pick(eixos.profundidade, PASSO_PROFUNDIDADE),
    pick(eixos.luz, PASSO_LUZ),
  ].join(" · ");
}
