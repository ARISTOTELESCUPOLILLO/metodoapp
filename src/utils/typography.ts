// Instrução de tipografia para o gerador de imagem.
// IMPORTANTE: nome de fonte ("Inter", "Playfair", "Helvética") NÃO funciona
// com gpt-image-2 — o modelo trata como decoração textual, não como forma da
// letra. A instrução abaixo descreve a FORMA do glifo (haste, terminação,
// presença ou ausência de serifa), que é o que o modelo realmente entende.

import type { SecondaryFont } from '../types';

const SANS_FONTS = ['Inter', 'Montserrat', 'Poppins', 'Raleway'];
const SERIF_FONTS = ['Roboto Slab', 'Playfair Display', 'Lora', 'Merriweather'];

// Fontes Google Fonts usadas para renderizar a palavra-chave em manuscrita
// no overlay de canvas (capa do Reels). Sem custo de licença, mesmo esquema
// de @import já usado para as tipografias primárias.
export const SECONDARY_FONT_CSS: Record<SecondaryFont, string> = {
  fina: 'Allura',
  grossa: 'Great Vibes',
};

// Descrição de FORMA (não nome de fonte) para a IA — mesma estratégia das
// regras serifada/sem-serifa abaixo, aplicada à palavra-chave em destaque.
const SECONDARY_FONT_SHAPES: Record<SecondaryFont, string> = {
  fina: 'cursiva conectada, traço fino e uniforme tipo caneta monoline, inclinação suave para a direita, com floreios discretos nas entradas e saídas das letras — estilo "assinatura elegante"',
  grossa: 'cursiva conectada, traço caligráfico com forte contraste de espessura (hastes descendentes grossas, ascendentes finas) tipo pincel, inclinação para a direita, com floreios expressivos — estilo "caligrafia a pincel"',
};

// Bloco de exceção pontual: quando o Kit de Marca tem uma tipografia
// secundária (manuscrita) escolhida, a MESMA palavra-chave que recebe a cor
// de destaque (ver regra de acento de cor no prompt) também recebe esse
// estilo manuscrito — abrindo exceção à proibição geral de "fontes
// manuscritas" do bloco principal, só para essa palavra.
export function buildScriptAccentBlock(style: SecondaryFont): string {
  return `EXCEÇÃO PONTUAL — PALAVRA-CHAVE EM MANUSCRITA: a MESMA palavra-chave do título que recebe a COR DE DESTAQUE (ver regra de acento de cor) deve TAMBÉM ser escrita em estilo manuscrito: ${SECONDARY_FONT_SHAPES[style]}. Aplique esse estilo a EXATAMENTE 1 palavra-chave do título — a de maior carga emocional ou benefício, com no máximo 10 letras — preservando os mesmos caracteres exatos, sem abreviar nem distorcer a ponto de ilegibilidade, sem sombra/contorno/brilho extra. TODAS as demais palavras do título seguem rigorosamente a regra tipográfica principal abaixo, incluindo a proibição de fontes manuscritas — que NÃO se aplica a essa única palavra-chave.`;
}

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
- PROIBIDO ABSOLUTAMENTE: terminações cortadas em ângulo reto sem ganchos, hastes de espessura uniforme sem variação fino/grosso, geometria sem serifa, fontes manuscritas (exceto na palavra-chave de destaque, se houver regra de exceção abaixo), fontes condensadas extremas, fontes display decorativas.
- Esta regra vence qualquer sugestão tipográfica implícita do mood ou do estilo da cena.`;
  }
  return `REGRA FINAL INVIOLÁVEL DE TIPOGRAFIA — SEM SERIFA, GEOMÉTRICA:
- Toda letra renderizada na imagem (título, texto de apoio, qualquer palavra) DEVE ter hastes de espessura uniforme, terminações cortadas em ângulo reto, SEM nenhum traço horizontal nas pontas das hastes (sem serifas).
- NÃO pode haver variação fino/grosso entre traços — tudo no mesmo peso, geometria limpa e construída, alta legibilidade.
- Âncora visual: se você desenhasse a letra "T", a barra superior terminaria em corte reto sem ganchos; se desenhasse a letra "I", seria uma única haste reta sem barras nas pontas.
- PROIBIDO ABSOLUTAMENTE: pequenos ganchos/traços horizontais nas pontas das letras (serifas), contraste fino/grosso, fontes serifadas editoriais, fontes manuscritas (exceto na palavra-chave de destaque, se houver regra de exceção abaixo), fontes display decorativas.
- Esta regra vence qualquer sugestão tipográfica implícita do mood ou do estilo da cena.`;
}

// Linha curta para reforçar dentro do bloco "REGRAS:" final.
export function buildTypographyShortRule(fontFamily: string): string {
  return classifyFont(fontFamily) === 'serif'
    ? 'Tipografia: serifada com ganchos visíveis nas pontas das letras e contraste fino/grosso — JAMAIS sans-serif'
    : 'Tipografia: sem serifa, hastes uniformes com terminações cortadas retas — JAMAIS serifada';
}
