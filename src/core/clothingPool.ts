// Lógica de vestuário neutro/coerente com a marca, compartilhada entre as
// trilhas MOP (regenerateWithKit.ts) e PU (postUnico.ts) — antes duplicada
// literalmente nos dois arquivos, com risco de os dois textos divergirem
// silenciosamente a cada ajuste feito em só um dos lados.

export function isClothingFriendly(hex: string): boolean {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  if (l < 0.35) return true; // cores escuras: navy, vinho, verde-escuro → OK
  if (s < 0.25) return true; // muito dessaturadas: cinzas, pastéis neutros → OK
  return false; // vivas + claras: laranja, amarelo, coral → não para roupa
}

export function buildClothingPool(primary: string, accent: string): string[] {
  const pool = [
    "Roupa branca — neutra e limpa; cores da marca reservadas para fundo, grafismos ou tipografia.",
    "Roupa preta — neutra e forte; cores da marca em outros elementos da composição.",
    "Cinza claro ou chumbo — versátil, harmoniza com qualquer paleta de marca.",
    "Bege ou creme — neutro quente que complementa qualquer paleta.",
  ];
  if (isClothingFriendly(primary)) {
    pool.push(`Peça principal (camisa, blazer ou jaqueta) na cor primária da marca (${primary}).`);
  }
  if (isClothingFriendly(accent) && accent.toLowerCase() !== primary.toLowerCase()) {
    pool.push(
      `Destaque da cor de acento da marca (${accent}) em detalhe ou peça secundária sobre base neutra.`,
    );
  }
  return pool;
}
