// Detecta se um texto (Informação-chave) descreve uma oferta/promoção
// concreta (valores, %, parcelamento, condição de pagamento) — heurística
// por regex, sem chamada de IA. Usada em generate-pu-copy.ts e
// regenerate-block.ts para decidir se o PU objetivo=promocao aciona o modo
// de título AJUSTADO (até 9 palavras, cunho promocional, fiel ao que foi
// escrito) em vez do padrão (6 palavras, com ângulo/virada). Decisão travada
// com o Ari 15/07/2026 — ver memória project-mic-equalizacao-keyinfo-2026-07-15.

// Numeral em algarismo OU por extenso. A lista original só enxergava algarismo, e
// "compre uma e leve duas" — oferta das mais concretas que existem — caía no título
// padrão de 6 palavras por não ter nenhum dígito.
const NUMERAL = "(?:\\d+|um|uma|uns|umas|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez)";

// Leve-e-pague em qualquer ordem e com ou sem conector: "compre uma e leve duas",
// "leve 3 pague 2", "compre 1 ganhe 2". A folga entre os dois lados é curta de
// proposito — o suficiente para "e"/"que"/"e ainda", nao para atravessar a frase
// inteira e casar dois numeros sem relacao.
const LEVE_PAGUE_RE = new RegExp(
  `\\b(?:compre|leve|pague)\\s+${NUMERAL}\\b[\\s\\S]{0,20}?\\b(?:leve|pague|ganhe|leva)\\s+${NUMERAL}\\b`,
  "i",
);

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
  // ── Ampliacao 21/07/2026 ────────────────────────────────────────────────
  // Ofertas igualmente concretas que a lista original nao via, todas trazidas
  // por um caso real: "compre uma e leve duas" ficou em 6 palavras. O criterio
  // continua o mesmo travado em 15/07 — so vira manchete de 9 quem tem oferta
  // concreta. O que mudou e o reconhecimento, nao a regra: nada aqui casa com
  // promocao generica ("promocao de inverno", "oferta especial", "aproveite"),
  // que segue no titulo de 6 palavras com angulo.
  LEVE_PAGUE_RE,
  /\bgr[áa]tis\b|\bgratuit[ao]s?\b/i, // frete grátis, brinde gratuito
  /\bbrindes?\b|\bcortesia\b/i,
  /\d+\s*reais\b/i, // 120 reais, sem o R$
  /\b\d+\s+por\s+\d+\b/, // 2 por 1, e tambem "de 200 por 150"
  /\bcombos?\b/i,
  // "metade" sozinho pegaria "metade dos clientes", que e texto generico e nao
  // oferta. So vale preso ao pagamento; "metade do preco" ja cai na regra de preco.
  /\b(?:pague|por|pela)\s+metade\b/i,
  /\d+\s*off\b/i, // 50 off (com % ja cai na regra do %)
  /\bna\s+compra\s+d[eo]\b/i, // na compra de X, ganhe Y
];

export function isOfertaConcreta(texto: string): boolean {
  const t = (texto || "").trim();
  if (!t) return false;
  return OFERTA_PATTERNS.some((re) => re.test(t));
}
