// Rotação determinística de tonalidade — Post Único, Direção Livre + Objetivo
// "nenhum" (a combinação mais aberta do sistema). Antes, a cor dessa combinação
// era 100% delegada ao modelo de imagem (sem pool, sem seed), o que produzia
// convergência observada: verde na primeira geração, azul na regeneração — o
// gpt-image-2 caindo sempre nos mesmos 2 atratores cromáticos para o mesmo
// briefing. Este módulo fixa um seed por sessão (ver postUnicoTonalidadeSeedRef
// em usePostUnicoGeneration.ts) e avança deterministicamente por um pool de 5
// tonalidades a cada geração, com um observador que pula a tonalidade quando
// ela conflita em matiz com a cor de acento da marca (aplicada em 1
// palavra-chave do título — ver ACENTO DE COR em buildPuPrompt.ts), preservando
// a legibilidade cromática dessa palavra contra o fundo.

import type { MoodCode } from "../types";

export interface TonalidadeCandidata {
  hue: number;
  bloco: string;
}

function hexToHue(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Abaixo desta distância de matiz, a cor de acento aplicada na palavra de
// destaque do título perde contraste cromático contra o fundo da tonalidade.
const CONFLITO_HUE_THRESHOLD = 40;

/**
 * Escolhe uma tonalidade do pool a partir de um índice-base determinístico
 * (seed de sessão + nº da tentativa, calculado pelo chamador — ver
 * postUnicoTonalidadeSeedRef/AttemptRef em usePostUnicoGeneration.ts).
 * Avança para a próxima tonalidade da sequência quando a matiz da candidata
 * conflita com a cor de acento da marca; se todas conflitarem (pool inteiro
 * próximo do acento), usa a base mesmo assim — é heurística textual do
 * prompt, não checagem de contraste em pixels renderizados.
 */
// Rodízio de tonalidade do mood SILÊNCIO (OP-06) — usado por MOP e PU.
//
// Eram 3 de propósito: "SILÊNCIO é o mood menos usado, o ganho de um pool maior
// não justifica o código" (decisão do Aristóteles, 09/07/2026). REVISTA por ele
// em 12/08/2026, com o argumento oposto vindo do uso real: justamente por gerar
// poucas peças nesses moods, ele reencontra a mesma cor com frequência alta —
// 3 tonalidades se esgotam em três peças. Agora são 6.
//
// As três acrescentadas NÃO inventam cor: recombinam as oito que a própria
// regra do mood autoriza (areia, off-white, cinza quente, bege rosado, verde
// sálvia claro, azul névoa, taupe, marfim envelhecido). Paleta é gramática do
// mood — ver feedback-escopo-camera-nao-gramatica-do-mood.
// Cada `bloco` é uma fração de frase solta (sem prefixo "PALETA DESTA
// PEÇA —") porque entra direto na linha "Paleta:"/"Fundo de paleta suave"
// dos dois motores — ver uso em visualDirection.ts (PU) e api.ts (MOP).
export const SILENCIO_TONALIDADES: TonalidadeCandidata[] = [
  {
    hue: 40,
    bloco:
      "areia, cinza quente e marfim envelhecido — serenidade quente, presença discreta e atemporal",
  },
  {
    hue: 205,
    bloco:
      "azul névoa, taupe e off-white — distância contemplativa, frieza contida sem perder o calor humano",
  },
  {
    hue: 110,
    bloco: "verde sálvia claro, bege rosado e off-white — repouso natural, suavidade sem doçura",
  },
  {
    hue: 25,
    bloco:
      "taupe, bege rosado e marfim envelhecido — calor de pele e linho, a mais quente do conjunto",
  },
  {
    hue: 90,
    bloco:
      "cinza quente, verde sálvia claro e off-white — vegetal seco, com o verde entrando como sombra e não como cor de marca",
  },
  {
    hue: 200,
    bloco:
      "azul névoa, areia e marfim envelhecido — frio e quente na mesma peça, os dois rebaixados",
  },
];

// Rodízio de paleta do DESVIO (OP-05). Nenhuma combinação nova aqui: são
// exatamente as cinco que a gramática do mood já lista. O defeito era de
// ENTREGA — as cinco iam juntas no prompt, como um cardápio, e o modelo
// convergia sempre para as mesmas duas ou três. Servir uma por geração é o que
// transforma repertório declarado em variedade real (achado 12/08/2026).
//
// `hue` é o do primeiro tom do par, que é o dominante na composição.
export const DESVIO_TONALIDADES: TonalidadeCandidata[] = [
  {
    hue: 160,
    bloco:
      "verde frio e magenta — tensão fria/quente de alta voltagem, com o magenta restrito a um único elemento",
  },
  {
    hue: 215,
    bloco:
      "azul profundo e ferrugem — gravidade e oxidação, contraste de temperatura sem estridência",
  },
  {
    hue: 280,
    bloco:
      "lilás seco e mostarda — estranheza sofisticada, dois tons dessaturados que não deveriam combinar",
  },
  {
    hue: 185,
    bloco: "petróleo e coral queimado — profundidade fria cortada por um único calor terroso",
  },
  {
    hue: 345,
    bloco: "vinho e azul elétrico suave — peso e eletricidade, com o azul restrito a um acento",
  },
];

// Rodízio de paleta do FRAGMENTO (OP-04). Aqui as quatro são COR NOVA: a
// gramática do mood exige "3 tons unificados que amarram os blocos" mas nunca
// disse QUAIS três — e o que não se especifica, o modelo de imagem preenche
// sempre do mesmo jeito. Propostas e aprovadas pelo Aristóteles em 12/08/2026.
//
// Cada trio é fechado: dois tons de base e um que corta. `hue` é o do tom de
// corte, que é o que dá caráter à peça e o que pode conflitar com o acento da
// marca aplicado na palavra de destaque do título.
export const FRAGMENTO_TONALIDADES: TonalidadeCandidata[] = [
  {
    hue: 15,
    bloco:
      "branco-osso, grafite e terracota — a mais editorial, com o tijolo aparecendo em um bloco só e organizando a leitura",
  },
  {
    hue: 80,
    bloco:
      "areia, verde musgo e branco-osso — terrosa e calma, para ofício manual, alimento ou produto físico",
  },
  {
    hue: 195,
    bloco:
      "creme, azul petróleo e cinza claro — a mais fria e a mais séria, para serviço técnico, consultoria ou saúde",
  },
  {
    hue: 45,
    bloco:
      "branco gelo, azul-acinzentado e mostarda seca — a mais clara do conjunto, com a mostarda como único ponto de calor e nunca em mais de um bloco",
  },
];

/**
 * Rodízio determinístico genérico — mesma ideia do pickTonalidade, sem o
 * observador de matiz (que só faz sentido para cor).
 *
 * Existe porque o arquétipo visual da Direção Livre era sorteado com
 * `Math.random()` no MESMO arquivo em que a paleta já rodava por seed: a cor
 * nunca repetia e o conceito repetia, inclusive duas gerações seguidas. Sorteio
 * com reposição num pool de 5 dá ~20% de chance de repetir a cada regeração —
 * alto o bastante para o usuário notar.
 *
 * `step` deve ser co-primo com o tamanho do pool para o ciclo passar por todos
 * os itens antes de voltar ao começo, e diferente do passo usado pela paleta:
 * se os dois andarem juntos, conceito e cor ficam amarrados e o número real de
 * combinações desaba para o tamanho de um pool só.
 *
 * A co-primalidade é CORRIGIDA aqui, não confiada ao chamador: passo 2 num pool
 * de 4 visita só metade dos itens, sem erro, sem aviso e sem jeito de perceber
 * olhando o resultado. Os pools de variação têm tamanhos diferentes por mood
 * (2, 3, 4, 5, 8, 9 itens) e crescem com o tempo — exigir que quem chama saiba
 * o tamanho de cada um é a mesma armadilha do índice fixo que já causou um P0
 * em 11/08/2026. Ver `coprimeStep`.
 */
export function pickRotating<T>(pool: T[], baseIndex: number, step = 1): T {
  const n = pool.length;
  const i = (((baseIndex * coprimeStep(n, step)) % n) + n) % n;
  return pool[i];
}

/** Maior divisor comum — só para verificar co-primalidade em `coprimeStep`. */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * O passo desejado, se ele for co-primo com `n`; senão, o próximo passo acima
 * dele que seja. Garante que a fila visite TODOS os itens do pool antes de
 * repetir qualquer um. Devolve 1 (co-primo com tudo) quando nada serve — caso
 * de pool com 0 ou 1 item, em que a pergunta não faz sentido.
 */
export function coprimeStep(n: number, desejado: number): number {
  if (n <= 1) return 1;
  const base = Math.max(1, Math.abs(Math.trunc(desejado)));
  for (let s = base; s < base + n; s++) {
    if (gcd(n, s) === 1) return s;
  }
  return 1;
}

/** Os três moods com rodízio de paleta. CLAREZA, IMPACTO e INSTANTE seguem com
 * a paleta única do léxico — decisão do Aristóteles (12/08/2026): são os de uso
 * diário, cuja aparência ele já conhece e aprovou, e não se mexe no que está
 * funcionando. */
const POOL_POR_MOOD: Partial<Record<MoodCode, TonalidadeCandidata[]>> = {
  "OP-04": FRAGMENTO_TONALIDADES,
  "OP-05": DESVIO_TONALIDADES,
  "OP-06": SILENCIO_TONALIDADES,
};

/**
 * A paleta desta geração para os moods que têm rodízio, ou `null` para os que
 * têm paleta única (o chamador então mantém a do léxico, sem ramo especial).
 *
 * `seed` é a posição do usuário na fila de variação — a MESMA que rege câmera e
 * pose. Ela é por SEQUÊNCIA, não por peça: no MOP, todos os cards de um
 * carrossel precisam da mesma paleta, senão a peça perde a unidade cromática
 * que o próprio mood promete (o FRAGMENTO chega a dizer que a paleta é o que
 * "amarra os blocos"). Até 12/08/2026 a escolha vinha do hash do TÍTULO da
 * peça, o que dava paleta diferente por card dentro da mesma sequência — e a
 * mesma cor para sempre quando o título se repetia.
 *
 * Sem `seed`, cai na posição 0: determinístico e sem quebrar, para os caminhos
 * que ainda não passam a fila.
 */
export function pickPaletaDoMood(
  mood: MoodCode,
  seed?: number,
  accentHex?: string,
): TonalidadeCandidata | null {
  const pool = POOL_POR_MOOD[mood];
  if (!pool) return null;
  return pickTonalidade(pool, seed ?? 0, accentHex);
}

export function pickTonalidade(
  pool: TonalidadeCandidata[],
  baseIndex: number,
  accentHex?: string,
): TonalidadeCandidata {
  const n = pool.length;
  const normalizedBase = ((baseIndex % n) + n) % n;
  const accentHue = accentHex ? hexToHue(accentHex) : null;
  if (accentHue === null) return pool[normalizedBase];
  for (let i = 0; i < n; i++) {
    const candidate = pool[(normalizedBase + i) % n];
    if (hueDistance(candidate.hue, accentHue) >= CONFLITO_HUE_THRESHOLD) return candidate;
  }
  return pool[normalizedBase];
}
