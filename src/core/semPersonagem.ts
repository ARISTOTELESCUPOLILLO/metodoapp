// Modo "peça sem personagem" (Post Único) — nenhuma pessoa na imagem.
//
// Contexto (auditoria 2026-07-26): a PU não tinha caminho para gerar peça sem
// gente. Mesmo marcando só produto/cenário/fachada, o prompt AFIRMAVA a
// existência de uma pessoa em quatro pontos independentes:
//   1. genderSafetyBlock (buildPuPrompt.ts) — "a pessoa retratada DEVE ser X",
//      disparado sempre que não havia avatar, porque usePostUnicoGeneration
//      sorteia um gênero de fallback quando o formulário não define nenhum;
//   2. pickImageVariationBlock (imageVariationPicker.ts) — a mesma frase, mais
//      uma pose de personagem sorteada nos moods CLAREZA/IMPACTO/INSTANTE;
//   3. bloco CENÁRIO (puReferencesBlock.ts) — "Adicione personagem e ação
//      dentro deste espaço real";
//   4. buildSceneRoleRule (visualDirection.ts) — "PERSONAGEM-PADRÃO DA CENA —
//      O PÚBLICO-ALVO", quando não havia nenhuma referência do Kit marcada.
//
// Este módulo concentra o texto que desliga os quatro e declara o sujeito
// alternativo da composição. Vale nos 3 segmentos (VAREJO/SERVIÇOS/MARCA) e
// nas 7 direções (Livre + 6 moods). A hierarquia produto×cena quando não há
// personagem vive em core/productHierarchy.ts, junto das demais regras de
// protagonismo.
//
// Escopo: só o prompt de IMAGEM da PU. O MOP não usa nada daqui, e o léxico
// compartilhado (visualDirection.lexicon.ts) permanece intocado — a
// reconciliação com a gramática de cada mood é feita por adição, no mesmo
// padrão já usado para dispositivos digitais (resolveMoodRuleText).

import { MoodCode } from "../types";
import { pickRandom } from "./visualDirection.lexicon";
import { buildCameraLine } from "./cameraAxes";

// Termos negativos repetidos na regra principal e no reforço final — modelos
// de imagem respondem melhor à lista em inglês, como no restante do projeto.
const SEM_PERSONAGEM_NEGATIVE =
  "NEGATIVE: person, people, human, human figure, man, woman, child, face, portrait, hand, hands, arm, leg, body, silhouette, human shadow, human reflection, mannequin, statue of a person, crowd, person in background, blurred person, person cropped at frame edge.";

/** Sujeito visual da cena quando não há personagem — decisão de 26/07/2026:
 *  produto marcado → ambiente (cenário/fachada) → objeto do ofício real. Vale
 *  igualmente nos 3 segmentos; o peso relativo produto×cena continua sendo
 *  definido por buildProductHierarchyBlock. */
function sujeitoDaCena(opts: {
  hasProdutos?: boolean;
  hasCenario?: boolean;
  hasFachada?: boolean;
}): string {
  if (opts.hasProdutos) {
    return "o(s) PRODUTO(S) enviados como referência — ver bloco de referências";
  }
  if (opts.hasCenario) {
    return "o AMBIENTE do cenário enviado como referência e os objetos que já pertencem a ele";
  }
  if (opts.hasFachada) {
    return "a FACHADA enviada como referência — o próprio ponto físico do negócio";
  }
  return "um objeto, instrumento, material, superfície ou detalhe concreto do ofício REAL da empresa (ou a composição de luz, textura e escala derivada dele)";
}

/** Regra principal — entra logo depois do bloco de referências, com
 *  precedência declarada inclusive sobre ele (o referenceAnchorBlock diz ter
 *  precedência sobre "qualquer personagem descrito no restante do prompt", e
 *  sem esta cláusula explícita as duas âncoras competiriam). */
export function buildSemPersonagemBlock(opts: {
  hasProdutos?: boolean;
  hasCenario?: boolean;
  hasFachada?: boolean;
}): string {
  return `⚠ PEÇA SEM PERSONAGEM — REGRA INVIOLÁVEL DE PRECEDÊNCIA MÁXIMA: esta peça NÃO tem pessoas. PROIBIDO ABSOLUTO renderizar figura humana ou qualquer fragmento dela, em qualquer plano da imagem: rosto, cabeça, busto, corpo inteiro, mão, dedo, braço, perna, pé, silhueta, sombra de pessoa, reflexo de pessoa em vidro/espelho/superfície, manequim, estátua ou boneco antropomórfico, pessoa desfocada ao fundo, transeunte, cliente, funcionário, multidão, pessoa cortada na borda do quadro, pessoa impressa em cartaz/quadro/foto dentro da cena. Nenhuma pessoa — nem protagonista, nem secundária, nem ao fundo, nem parcial, nem sugerida por parte do corpo.
PRECEDÊNCIA: esta regra vence QUALQUER outra instrução deste prompt, INCLUSIVE o bloco de REFERÊNCIA VISUAL ENVIADA e a gramática do mood. Onde qualquer trecho mencionar personagem, pessoa, avatar, público-alvo, profissional, equipe, gesto humano, pose, expressão, olhar, figurino ou presença humana, esse trecho fica SUSPENSO nesta peça e deve ser ignorado.
SUJEITO DA COMPOSIÇÃO (o que ocupa o papel que seria do personagem): ${sujeitoDaCena(opts)}. A cena se sustenta por luz, escala, enquadramento, textura e ordem — não por alguém em quadro.
HUMANIZAÇÃO NESTA PEÇA: a exigência de imagem "humana e autêntica" (ver regra no início do prompt) significa AQUI autenticidade da cena real — luz de verdade, marcas de uso, imperfeição natural, objetos que pertencem ao ofício —, jamais presença de pessoas.
${SEM_PERSONAGEM_NEGATIVE}`;
}

/** Reforço curto repetido como ÚLTIMA linha do prompt — modelos de imagem dão
 *  mais peso à instrução mais recente em prompts longos (mesmo motivo do
 *  buildUltimaVerificacaoBlock usado na contagem de produtos). */
export const SEM_PERSONAGEM_REFORCO_FINAL = `⚠ VERIFICAÇÃO FINAL — SEM PESSOAS: confirme, antes de finalizar, que NENHUMA pessoa ou parte de pessoa (rosto, mão, braço, silhueta, sombra, reflexo, figura ao fundo, pessoa cortada na borda) aparece na imagem. Se apareceu, refaça a composição sem ela. ${SEM_PERSONAGEM_NEGATIVE}`;

// Câmeras escritas para cena sem pessoa. As câmeras com personagem
// (IMPACTO_CAMERA_VARIATIONS no léxico, e os cinco eixos de CLAREZA, IMPACTO e
// DESVIO em core/cameraAxes.ts) descrevem o enquadramento DE UM
// PERSONAGEM ("da cintura ao topo da cabeça", "abaixo da linha dos olhos",
// "acima da cabeça do personagem") e não servem aqui — reescritas em vez de
// filtradas/substituídas por regex. SILÊNCIO é a exceção: as câmeras dele já
// são de objeto isolado, então são reaproveitadas.
// Fora do escopo da extensão de eixos de 12/08/2026 de propósito: sem pessoa em
// cena, os eixos de distância (busto, plano americano) não têm sujeito a medir.
const CAMERAS_SEM_PERSONAGEM: Partial<Record<MoodCode, string[]>> = {
  "OP-01": [
    "CÂMERA FRONTAL: lente 50mm, plano médio, altura da superfície de trabalho — composição simétrica e respirada, objeto de frente, linhas do ambiente paralelas às bordas do quadro",
    "CÂMERA ZENITAL: vista de cima, lente 50mm, distância média — objetos organizados sobre a superfície, geometria evidente, sombra curta e limpa",
    "CÂMERA LATERAL 3/4: lente 50mm, plano médio-próximo — o objeto levemente de lado, com espaço negativo generoso de um dos lados e profundidade legível do ambiente ao fundo",
  ],
  "OP-02": [
    "CONTRA-PLONGÉE APLICADO AO OBJETO: câmera abaixo da base do sujeito, lente 35mm, distância média — ângulo ascendente que faz o objeto crescer no quadro e dominar o enquadramento",
    "ÂNGULO 3/4 DINÂMICO: lente 35mm, distância média, câmera levemente lateral e inclinada — perspectiva cinematográfica sobre o objeto, sem ser extrema",
  ],
  // Mesmas alturas e distâncias do pool com personagem (INSTANTE_CAMERA_VARIATIONS),
  // reescritas para cena sem gente. Até 11/08/2026 havia uma única opção aqui.
  "OP-03": [
    "CÂMERA 35mm levemente alta, distância natural, grão sutil — ponto de vista de quem passa pelo local e registra sem preparar a cena",
    "CÂMERA 35mm na altura da superfície, distância curta — enquadramento próximo do material deixado em uso, grão sutil, como quem se debruça sobre a bancada",
    "CÂMERA 35mm afastada, plano aberto — o ambiente inteiro no quadro com o sinal de trabalho em andamento em algum ponto dele, grão sutil",
    "CÂMERA 35mm levemente baixa, distância média — ponto de vista de quem está sentado no local e olha o espaço à sua volta, grão sutil",
  ],
  // FRAGMENTO não tinha câmera aqui: os blocos saíam sempre no mesmo ponto de
  // vista. Nenhuma opção pode fixar UM ângulo para todos os blocos: MOOD_RULES
  // do mood exige "perspectivas simultâneas, como se múltiplas câmeras
  // registrassem de ângulos diferentes", e proíbe leitura de catálogo.
  "OP-04": [
    "ZENITAL PREDOMINANTE COM QUEBRA: a maioria dos blocos vista de cima, lente 50mm, sombras curtas e uniformes — mas ao menos UM bloco fotografado de frente ou rasante, quebrando o eixo e revelando a mesma cena por outro ponto de vista",
    "FRONTAL PREDOMINANTE COM QUEBRA: a maioria dos blocos de frente, lente 50mm, geometria evidente — com ao menos UM bloco zenital ou em três-quartos, para os fragmentos não lerem como uma única fotografia recortada",
    "ALTERNÂNCIA MACRO E MÉDIO: blocos de detalhe extremo intercalados com blocos de ambiente, lentes 50mm e macro, cada um em ângulo próprio — a mudança de escala E de eixo entre blocos vizinhos é o ritmo da peça",
  ],
  "OP-05": [
    "PLONGÉE ACENTUADA: câmera nitidamente acima do objeto, lente 28-35mm, enquadramento médio — o olhar de cima revela o deslocamento",
    "LATERAL RASANTE AO CHÃO: câmera quase ao nível do piso, ângulo lateral extremo, lente 28mm, distância curta — composição diagonal que distorce a perspectiva",
    "DIAGONAL HOLANDESA (DUTCH ANGLE): câmera na altura do objeto, quadro inteiro rotacionado em diagonal (10-15°), lente 35mm — horizonte e verticais visivelmente tortos",
    "PLANO FECHADO ANGULADO: câmera próxima do objeto da ruptura, levemente angulada a partir de um lado (nunca frontal neutra), lente 50mm, profundidade de campo rasa",
  ],
  // OP-06 não aparece aqui: as câmeras do SILÊNCIO viraram cinco eixos em
  // 12/08/2026 (core/cameraAxes.ts) e continuam servindo a cena sem pessoa —
  // são de sujeito isolado por natureza. Composta no builder abaixo.
};

// Estrutura da cena por mood, com a suspensão explícita do que a gramática
// daquele mood diz sobre personagem. Cada texto é adjacente, no prompt final,
// ao bloco de gramática do mood (ver direcaoBlock em buildPuPrompt.ts) — a
// proximidade é intencional: a instrução que suspende precisa estar perto da
// instrução suspensa para o modelo relacionar as duas.
const ESTRUTURA_SEM_PERSONAGEM: Partial<Record<MoodCode, string>> = {
  "OP-01":
    "ESTRUTURA SEM PERSONAGEM (CLAREZA): a cena é uma composição ordenada de objeto, produto, superfície de trabalho e ambiente — organização visível, geometria limpa, hierarquia imediata. Ficam SUSPENSAS nesta peça todas as instruções da gramática de CLAREZA sobre personagem, pose, plano médio e enquadramento de rosto (não há pessoa para enquadrar). Mantêm-se luz difusa e organizada, ordem, respiro e o acento ÚNICO de cor saturada em um elemento da cena.",
  "OP-02":
    "ESTRUTURA SEM PERSONAGEM (IMPACTO): a peça usa a leitura SUJEITO SEM PERSONAGEM DOMINANTE — produto, objeto, detalhe de operação ou elemento da marca como protagonista absoluto, foco único, luz recortada, composição dramática intensa. Ficam SUSPENSAS todas as instruções sobre personagem, pose, olhar e expressão. Mantêm-se o ângulo ascendente (aplicado ao objeto) e a explosão cromática única sobre fundo escuro.",
  "OP-03":
    "ESTRUTURA SEM PERSONAGEM (INSTANTE): o flagrante documental é do AMBIENTE e dos OBJETOS do ofício, nunca de alguém — bancada com trabalho em andamento, balcão no meio do expediente, mesa recém-usada, material deixado em uso interrompido, espaço apanhado entre um atendimento e outro. A cena parece capturada e não montada: luz real do local, enquadramento levemente imperfeito, grão sutil, nada arrumado para a foto. Ficam SUSPENSAS todas as instruções da gramática de INSTANTE sobre personagem, pose, olhar, sorriso e expressão — inclusive as que descrevem o que o personagem faz ou deixa de fazer.",
  "OP-04":
    "ESTRUTURA SEM PERSONAGEM (FRAGMENTO): os 3 a 5 blocos visuais são de objeto, detalhe, material, textura e ambiente do ofício real — nenhum bloco traz pessoa, rosto, mão ou qualquer fragmento humano.",
  "OP-05":
    "ESTRUTURA SEM PERSONAGEM (DESVIO): a ruptura acontece entre OBJETO e AMBIENTE, sem ninguém para reagir a ela — objeto do ofício deslocado para lugar inesperado, em escala alterada ou em cor inesperada, sempre fisicamente apoiado na cena (nunca flutuante, nunca recortado sobre o fundo). O estranhamento nasce da relação do objeto com o espaço. Ficam SUSPENSAS todas as instruções que colocam um personagem percebendo, observando, tocando ou segurando o objeto da ruptura. Uma ruptura por cena, sem acumular.",
  "OP-06":
    "ESTRUTURA SEM PERSONAGEM (SILÊNCIO): o sujeito isolado no vasto espaço negativo é um objeto do ofício REAL da empresa — instrumento, ferramenta, material, embalagem ou produto específico do negócio, pousado em repouso. PROIBIDO o fragmento humano (mão, braço, silhueta, nuca) que este mood às vezes admite: nesta peça não há nenhuma pessoa. PROIBIDO também objeto genérico desconectado do ofício (livro de leitura, caderno de escrita, óculos soltos) e dispositivo digital como elemento principal.",
};

const ESTRUTURA_SEM_PERSONAGEM_LIVRE =
  "ESTRUTURA SEM PERSONAGEM: a cena é construída a partir de objeto, produto, material, textura ou ambiente do ofício real — nunca de uma pessoa. Luz, escala, enquadramento e composição fazem o trabalho que o personagem faria.";

const TEMA_DERIVATION_SEM_PERSONAGEM =
  "O objeto ou detalhe que ocupa a cena deriva do que o título e o texto comunicam e da ATIVIDADE REAL da empresa — nunca de um objeto de banco de imagem genérico nem da tradução literal de uma palavra do título.";

/** Substitui pickImageVariationBlock quando a peça é sem personagem: aquele
 *  sorteia pose de personagem e injeta "a pessoa retratada DEVE ser X" em
 *  todos os moods. Aqui, câmera + estrutura de cena sem gente. */
export function buildSemPersonagemVariationBlock(mood?: MoodCode): string {
  const estrutura = (mood && ESTRUTURA_SEM_PERSONAGEM[mood]) || ESTRUTURA_SEM_PERSONAGEM_LIVRE;
  const cameras = mood ? CAMERAS_SEM_PERSONAGEM[mood] : undefined;
  // SILÊNCIO compõe pelos cinco eixos; os demais seguem com as câmeras
  // reescritas acima, que descrevem objeto e ambiente em vez de personagem.
  const cameraStr =
    mood === "OP-06"
      ? `Câmera: ${buildCameraLine(mood, {})}. `
      : cameras?.length
        ? `Câmera: ${pickRandom(cameras)}. `
        : "";
  return `\n⚠ VARIAÇÃO — SEM PERSONAGEM: ${cameraStr}${estrutura} ${TEMA_DERIVATION_SEM_PERSONAGEM}`;
}
