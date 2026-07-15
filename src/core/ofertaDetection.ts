// Detecta se um texto (Informação-chave) descreve uma oferta/promoção
// concreta (valores, %, parcelamento, condição de pagamento) — heurística
// por regex, sem chamada de IA. Usada em generate-pu-copy.ts e
// regenerate-block.ts para decidir se o PU objetivo=promocao aciona o modo
// de título AJUSTADO (até 9 palavras, cunho promocional, fiel ao que foi
// escrito) em vez do padrão (6 palavras, com ângulo/virada). Decisão travada
// com o Ari 15/07/2026 — ver memória project-mic-equalizacao-keyinfo-2026-07-15.
const OFERTA_PATTERNS: RegExp[] = [
  /R\$\s*\d/i, // R$ 120
  /\d+\s*%/, // 20%
  /\ba\s+partir\s+de\b/i,
  /\bparcel(a|as|ado|amento)\b/i,
  /\bcart[ãa]o\b/i,
  /\b[àa]\s+vista\b/i,
  /\bpor\s+apenas\b/i,
  /\bem\s+\d+\s*x\b/i, // em 3x, em 10x
  /\d+\s*x\s+de\b/i, // 3x de
  /\bdesconto\b/i,
  /\bpre[çc]o\b/i,
];

export function isOfertaConcreta(texto: string): boolean {
  const t = (texto || "").trim();
  if (!t) return false;
  return OFERTA_PATTERNS.some((re) => re.test(t));
}
