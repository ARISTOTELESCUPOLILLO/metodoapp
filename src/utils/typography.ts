// Instrução de tipografia para o gerador de imagem.
// IMPORTANTE: nome de fonte ("Inter", "Playfair", "Helvética") NÃO funciona
// com gpt-image-2 — o modelo trata como decoração textual, não como forma da
// letra. A instrução abaixo descreve a FORMA do glifo (haste, terminação,
// presença ou ausência de serifa), que é o que o modelo realmente entende.

const SANS_FONTS = ['Inter', 'Montserrat', 'Poppins', 'Raleway'];
const SERIF_FONTS = ['Roboto Slab', 'Playfair Display', 'Lora', 'Merriweather'];

export type TypographyKind = 'serif' | 'sans';

export function classifyFont(fontFamily: string): TypographyKind {
  if (SERIF_FONTS.includes(fontFamily)) return 'serif';
  if (SANS_FONTS.includes(fontFamily)) return 'sans';
  return 'sans';
}

// Bloco completo de instrução para colar no FINAL do prompt da imagem,
// como regra final inegociável (depois do conteúdo textual).
export function buildTypographyBlock(fontFamily: string): string {
  const kind = classifyFont(fontFamily);
  if (kind === 'serif') {
    return `REGRA FINAL INVIOLÁVEL DE TIPOGRAFIA — SERIFADA EDITORIAL:
- Toda letra renderizada na imagem (título, texto de apoio, qualquer palavra) DEVE ter pequenos traços horizontais marcados nas pontas das hastes verticais — as serifas devem ser claramente visíveis a olho nu.
- DEVE haver contraste evidente entre traços finos (horizontais/curvos) e traços grossos (verticais), no estilo de revista impressa premium.
- Âncora visual: se você desenhasse a letra "T", a barra superior teria pequenos ganchos nas duas pontas; se desenhasse a letra "I", as extremidades teriam pequenas barras horizontais.
- PROIBIDO ABSOLUTAMENTE: terminações cortadas em ângulo reto sem ganchos, hastes de espessura uniforme sem variação fino/grosso, geometria sem serifa, fontes manuscritas, fontes condensadas extremas, fontes display decorativas.
- Esta regra vence qualquer sugestão tipográfica implícita do mood ou do estilo da cena.`;
  }
  return `REGRA FINAL INVIOLÁVEL DE TIPOGRAFIA — SEM SERIFA, GEOMÉTRICA:
- Toda letra renderizada na imagem (título, texto de apoio, qualquer palavra) DEVE ter hastes de espessura uniforme, terminações cortadas em ângulo reto, SEM nenhum traço horizontal nas pontas das hastes (sem serifas).
- NÃO pode haver variação fino/grosso entre traços — tudo no mesmo peso, geometria limpa e construída, alta legibilidade.
- Âncora visual: se você desenhasse a letra "T", a barra superior terminaria em corte reto sem ganchos; se desenhasse a letra "I", seria uma única haste reta sem barras nas pontas.
- PROIBIDO ABSOLUTAMENTE: pequenos ganchos/traços horizontais nas pontas das letras (serifas), contraste fino/grosso, fontes serifadas editoriais, fontes manuscritas, fontes display decorativas.
- Esta regra vence qualquer sugestão tipográfica implícita do mood ou do estilo da cena.`;
}

// Linha curta para reforçar dentro do bloco "REGRAS:" final.
export function buildTypographyShortRule(fontFamily: string): string {
  return classifyFont(fontFamily) === 'serif'
    ? 'Tipografia: serifada com ganchos visíveis nas pontas das letras e contraste fino/grosso — JAMAIS sans-serif'
    : 'Tipografia: sem serifa, hastes uniformes com terminações cortadas retas — JAMAIS serifada';
}
