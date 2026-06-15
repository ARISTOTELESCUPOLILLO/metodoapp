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
  grossa: 'cursiva conectada, traço de PINCEL GROSSO E ENCORPADO — linhas espessas e cheias do início ao fim de cada letra, sem afinar em curvas, hastes ou ligaduras, peso visual equivalente a um brush lettering BOLD/HEAVY, inclinação leve para a direita, floreios expressivos igualmente grossos — estilo "lettering a pincel bold", JAMAIS um traço fino, hairline ou delicado em qualquer trecho',
};

// Reforço extra de peso só para a variante "grossa" — a "fina" é
// intencionalmente um traço monoline delicado tipo assinatura, então não
// recebe essa cobrança de espessura.
const SECONDARY_FONT_WEIGHT_REINFORCEMENT: Partial<Record<SecondaryFont, string>> = {
  grossa: '\nREFORÇO DE TRAÇO NA MANUSCRITA: o traço dessa palavra deve ser GROSSO em toda a sua extensão, sem afinar em curvas, conexões ou floreios — compare com a espessura das letras do restante do título (caixa alta, bold) e garanta peso visual equivalente. PROIBIDO: traço fino, hairline, ou contraste forte entre partes grossas e finas dentro da própria palavra manuscrita.',
};

// Bloco de exceção pontual: quando o Kit de Marca tem uma tipografia
// secundária (manuscrita) escolhida, EXATAMENTE 1 palavra do título recebe
// esse estilo — nunca a primeira palavra, alternando automaticamente entre
// 3 papéis possíveis (fechamento da frase, palavra-chave do assunto, palavra
// do benefício percebido), com "fechamento" priorizado. A escolha do papel é
// determinística por título (mesmo princípio do pickImageVariationBlock):
// garante variedade entre as peças de uma mesma sequência (títulos
// diferentes) e estabilidade entre regenerações da mesma peça.
type AccentRole = 'fechamento' | 'assunto' | 'beneficio';

const ACCENT_ROLE_SEQUENCE: AccentRole[] = ['fechamento', 'assunto', 'fechamento', 'beneficio'];

const ACCENT_ROLE_DESCRIPTION: Record<AccentRole, string> = {
  fechamento: 'a ÚLTIMA palavra de conteúdo do título (fechamento da frase)',
  assunto: 'a palavra-chave que nomeia o ASSUNTO ou tema central do título',
  beneficio: 'a palavra que expressa o BENEFÍCIO ou resultado percebido pelo leitor',
};

function pickAccentRole(seed: string): AccentRole {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return ACCENT_ROLE_SEQUENCE[Math.abs(hash) % ACCENT_ROLE_SEQUENCE.length];
}

export function buildScriptAccentBlock(style: SecondaryFont, titulo: string): string {
  const role = pickAccentRole(titulo);
  const order = [role, ...(['fechamento', 'assunto', 'beneficio'] as AccentRole[]).filter((r) => r !== role)];
  const priorityList = order.map((r, i) => `${i + 1}) ${ACCENT_ROLE_DESCRIPTION[r]}`).join('; ');

  return `EXCEÇÃO PONTUAL — 1 PALAVRA DO TÍTULO EM MANUSCRITA: escolha EXATAMENTE 1 palavra do título para receber estilo manuscrito: ${SECONDARY_FONT_SHAPES[style]}. Preserve os mesmos caracteres exatos dessa palavra, sem abreviar nem distorcer a ponto de ilegibilidade, sem sombra/contorno/brilho extra. TODAS as demais palavras do título seguem rigorosamente a regra tipográfica principal abaixo, incluindo a proibição de fontes manuscritas — que NÃO se aplica a essa única palavra.
COMO ESCOLHER A PALAVRA: o manuscrito é um ACENTO visual da mensagem, não o elemento principal do título — por isso NUNCA escolha a PRIMEIRA palavra do título, mesmo que pareça a mais forte. Avalie as opções nesta ordem de prioridade até encontrar uma palavra que se encaixe: ${priorityList}. A palavra escolhida deve ser uma palavra de conteúdo (substantivo, verbo ou adjetivo — nunca artigo, preposição, conjunção ou pronome), com NO MÁXIMO 8 LETRAS, do mesmo tamanho/altura de linha das demais palavras do título — sem dominar visualmente a composição. Se a opção prioritária não tiver uma palavra adequada (muito longa, é a primeira do título, ou inexistente no título), passe para a próxima opção da lista.
ALINHAMENTO COM A COR DE DESTAQUE: esta é também a palavra que deve receber a COR DE DESTAQUE (ver regra de acento de cor no prompt) — não escolha uma palavra diferente para o acento de cor.
REFORÇO DE COR NA MANUSCRITA: o traço cursivo cobre menos área do que letras em caixa alta, então a cor de destaque aplicada nessa palavra tende a parecer apagada/fraca. Para compensar, use nessa palavra uma versão MAIS CLARA E VIBRANTE da cor de destaque (mesmo matiz, com luminosidade e saturação aumentadas), garantindo que ela continue se destacando com a mesma força das demais aplicações da cor de destaque na peça.${SECONDARY_FONT_WEIGHT_REINFORCEMENT[style] || ''}`;
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
