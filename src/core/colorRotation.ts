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
