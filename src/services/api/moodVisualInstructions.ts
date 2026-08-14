// Instruções de estilo visual por mood — extraído de services/api.ts
// (PLANO_V2 Fase 9.1). Movido 1:1, sem mudança de comportamento.
import { MoodCode } from "../../types";
import { pickPaletaDoMood } from "../../core/colorRotation";

// As linhas de paleta dos três moods com rodízio de cor (ver POOL_POR_MOOD em
// core/colorRotation.ts) ficam extraídas como constantes porque são
// SUBSTITUÍDAS em tempo de execução pela paleta sorteada da sequência — mesmo
// padrão das sentenças de dispositivo do CLAREZA no léxico.
//
// Extrair, em vez de casar a frase por texto solto no ponto de substituição,
// é o que impede o replace de virar no-op silencioso quando alguém reescrever
// a linha aqui: as duas pontas passam a ler a mesma constante. Era assim que o
// SILÊNCIO fazia (casando um trecho literal de 8 cores dentro de api.ts) e é o
// tipo de acoplamento que quebra sem avisar.
export const PALETA_LINE_OP04 = "- Paleta controlada unificando os blocos";

export const PALETA_LINE_OP05 =
  "- Paleta incomum mas legível — combinações: verde frio + magenta, azul profundo + ferrugem, lilás seco + mostarda, petróleo + coral queimado, vinho + azul elétrico suave — evitar excesso carnavalesco";

export const PALETA_LINE_OP06 =
  "- Fundo de paleta suave (areia, off-white, cinza quente, bege rosado, verde sálvia claro, azul névoa, taupe, marfim envelhecido) — evitar branco puro dominante; espaço vazio como elemento principal";

/** Como a paleta escolhida entra em cada mood. O texto ao redor preserva as
 * travas da gramática ("legível", "evitar excesso carnavalesco", "evitar branco
 * puro dominante") — o que muda é sair de um CARDÁPIO de opções para UMA
 * escolhida, que é o que impede o modelo de convergir sempre na mesma. */
const PALETA_TEMPLATE: Partial<Record<MoodCode, (bloco: string) => string>> = {
  "OP-04": (bloco) =>
    `- Paleta controlada unificando os blocos — NESTA PEÇA: ${bloco}. Usar EXATAMENTE esses tons em todos os blocos, sem introduzir um quarto`,
  "OP-05": (bloco) =>
    `- Paleta incomum mas legível — NESTA PEÇA: ${bloco}. Usar SOMENTE esse par como combinação cromática dominante, evitar excesso carnavalesco`,
  "OP-06": (bloco) =>
    `- Fundo de paleta suave — NESTA PEÇA: ${bloco}. Evitar branco puro dominante; espaço vazio como elemento principal`,
};

const PALETA_LINE: Partial<Record<MoodCode, string>> = {
  "OP-04": PALETA_LINE_OP04,
  "OP-05": PALETA_LINE_OP05,
  "OP-06": PALETA_LINE_OP06,
};

/**
 * As instruções visuais do mood com a paleta da SEQUÊNCIA aplicada, quando o
 * mood tem rodízio de cor. Para os outros três, devolve o texto intacto.
 *
 * `seed` é a posição do usuário na fila — a mesma que rege câmera e pose, e uma
 * por sequência. Antes de 12/08/2026 a cor do SILÊNCIO saía do hash do TÍTULO
 * da peça: o mesmo título dava a mesma cor para sempre, e cards diferentes do
 * mesmo carrossel saíam em paletas diferentes.
 */
export function buildMoodVisualInstructions(
  mood: MoodCode,
  seed?: number,
  accentHex?: string,
): string {
  const base = moodVisualInstructions[mood] || moodVisualInstructions["OP-01"];
  const linha = PALETA_LINE[mood];
  const template = PALETA_TEMPLATE[mood];
  if (!linha || !template) return base;
  const paleta = pickPaletaDoMood(mood, seed, accentHex);
  if (!paleta) return base;
  return base.replace(linha, template(paleta.bloco));
}

// A trava de escala do SILÊNCIO (SILENCIO_ESCALA_SENTENCE, no léxico) vivia
// APENAS em MOOD_RULES — que é lido no estágio de CONTEÚDO do MOP e no PU, mas
// nunca no estágio de IMAGEM do MOP. Ou seja: o bloco que vai ao modelo de
// imagem falava de paleta, título à direita e "muito respiro", e a regra que
// define o mood — a escala do sujeito — só chegava lá se o GPT a tivesse
// preservado por conta própria no imagePrompt que ele mesmo escreveu.
// Acrescentada aqui em 14/08/2026. É a mesma regra, no lugar onde faltava.
const SILENCIO_ESCALA_IMAGEM =
  "- ESPAÇO NEGATIVO — REGRA QUE DEFINE ESTE MOOD: o sujeito (objeto, produto ou pessoa) ocupa NO MÁXIMO 30% da área da imagem; os outros 70% são fundo vazio, liso e respirado. A cena inteira contém no máximo 1 objeto mais a superfície em que ele repousa — paredes NUAS, superfícies VAZIAS, sem quadros, prateleiras, papéis, plantas ou objetos ao fundo\n" +
  "- PROIBIDO nesta peça: pessoa sentada à mesa de trabalho em plano de busto na altura dos olhos com luz de janela — essa é a foto do mood CLAREZA e não pode sair aqui. A câmera fica em eixo geométrico (zenital a pino, frontal ortogonal, rasante à superfície ou alta e distante), em teleobjetiva longa";

export const moodVisualInstructions: Record<MoodCode, string> = {
  "OP-01": `ESTILO VISUAL (raiz: Renascentista):
- Composição organizada por alinhamento ortogonal (grid invisível) — fundo contínuo de borda a borda, SEM dividir a peça em blocos, faixas ou painéis de cor
- Título alinhado à ESQUERDA, em CAIXA ALTA bold
- Texto de apoio como SUBTÍTULO DE REVISTA logo abaixo do título — corpo entre 55% e 70% do título, legível sem zoom, alinhado à esquerda; nunca tamanho de legenda
- Luz natural equilibrada, composição simétrica
- Fundo limpo, sem elementos decorativos desnecessários
- Paleta fria e controlada, cor de destaque apenas no elemento-chave`,

  "OP-02": `ESTILO VISUAL (raiz: Barroco):
- Fundo muito escuro, contraste extremo
- Imagem com iluminação dramática, luz focal sobre o elemento principal
- Texto em cor quente de destaque (amarelo ou laranja)
- Título CENTRALIZADO, bold, dominando o terço superior
- Assinatura da marca pequena e direta no rodapé
- Composição assimétrica com tensão visual intencional
- Sombras profundas, luz e sombra como protagonistas`,

  "OP-03": `ESTILO VISUAL (raiz: Impressionista):
- Foto de bastidor ou cena cotidiana capturada ao vivo
- Filtro quente e orgânico, luz ambiente natural sem estúdio
- Título sobreposto à imagem em posição LIVRE e informal, sem alinhamento rígido
- Sem simetria rígida, sem moldura formal
- Sensação de captura espontânea, autêntica
- Cores vibrantes e quentes, textura visível`,

  "OP-04": `ESTILO VISUAL (raiz: Cubista):
- Post-colagem com 3 a 5 blocos visuais distintos
- Cada bloco carrega uma informação ou ângulo diferente
- Título sobreposto à composição em posição LIVRE e informal, sem ficar preso a um bloco de cor — pode ancorar sobre a grade modular, tratado como tipografia livre e não como um dos blocos de conteúdo; mantenha-o legível e fora do canto inferior direito (reservado para a assinatura)
- Texto de apoio posicionado no centro ou terço superior, longe do canto inferior direito
- Grid visível ou implícito organizando os fragmentos
${PALETA_LINE_OP04}
- O canto inferior direito deve permanecer SEMPRE limpo e livre de texto, reservado para assinatura`,

  "OP-05": `ESTILO VISUAL (raiz: Surrealista):
- Imagem-conceito com elemento inesperado ou metáfora visual
- Composição ousada que provoca estranhamento controlado
- Título DESLOCADO e assimétrico — fora do centro, quebrando o equilíbrio esperado
- ELEMENTO INESPERADO — ESCALA E PESO VISUAL: o objeto ou forma inusitado é COADJUVANTE EXPRESSIVO da mensagem — deve ocupar área visual significativa na composição (não um detalhe periférico ou diminuto), grande o suficiente para chamar atenção à primeira vista e orientar o olhar, harmônico com o conjunto e sem dominar o sujeito principal. PROIBIDO: reduzir o elemento surreal a detalhe sutil, pequeno ou escondido na periferia da peça.
${PALETA_LINE_OP05}
- Sombras presentes mas LEVES — o rosto e a cabeça das pessoas NUNCA podem ficar encobertos por escurecimento
- Iluminação equilibrada: o elemento surreal não pode obscurecer o sujeito principal`,

  "OP-06": `ESTILO VISUAL (raiz: Minimalista):
${PALETA_LINE_OP06}
- Título alinhado à DIREITA, ocupando a metade direita do quadro, fonte tipográfica como protagonista, com muito respiro ao redor. A metade DIREITA permanece livre de outros elementos — nenhuma pessoa, produto ou equipamento aparece sob ou atrás do título
- O bloco de título ancora pelo ALTO da metade direita e cresce PARA BAIXO — PROIBIDO centralizá-lo verticalmente ou espremê-lo na base do quadro, colado acima da zona da logomarca; a parte de baixo fica livre para a logo, aplicada depois
- Detalhe mínimo de cor como assinatura
- Composição com muito respiro, elementos reduzidos ao essencial
- Sensação de premium, contenção e autoridade
${SILENCIO_ESCALA_IMAGEM}`,
};
