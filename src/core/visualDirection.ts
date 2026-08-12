// Direção Visual OP — orquestra o léxico interno por Mood × Segmento.
// ⚠️ NÃO EXIBIR em UI, PDF, tooltip, export ou qualquer canal acessível ao usuário.
// Este módulo traduz cada Mood na gramática visual concreta (luz, paleta,
// composição, atitude da câmera) que o motor injeta no prompt da sugestão
// de imagem do Método OP.
//
// Fase 8 (fatiamento de megafiles) extraiu o léxico bruto, a hierarquia
// produto×personagem×cenário e o sorteio de variação para módulos próprios.
// Este arquivo permanece como fonte única de import para os consumidores
// (api.ts, postUnico.ts, regenerateWithKit.ts, hooks e components) — todas as
// funções/tipos abaixo são re-exportados das suas novas localizações.
//
// - ./visualDirection.lexicon.ts: VISUAL_DIRECTIONS, SEGMENT_LAYERS, MOOD_RULES,
//   getVisualDirection, arrays de variação (INSTANTE/CLAREZA/IMPACTO/SILÊNCIO/DESVIO).
// - ./productHierarchy.ts: regras PRODUTO_*/PERSONAGEM_*, variationHasFaceNotDominant,
//   buildProductHierarchyBlock.
// - ./imageVariationPicker.ts: pickImageVariationBlock.

import { MoodCode, Segment } from "../types";
import { pickPaletaDoMood, pickRotating } from "./colorRotation";
import { buildCameraLine } from "./cameraAxes";
import {
  getVisualDirection,
  SEGMENT_LAYERS,
  MOOD_RULES,
  pickRandom,
  CLAREZA_CHARACTER_VARIATIONS,
  IMPACTO_CHARACTER_VARIATIONS,
  INSTANTE_CAMERA_VARIATIONS,
  INSTANTE_CHARACTER_VARIATIONS,
  INSTANTE_POOL_SEM_PDV,
  FRAGMENTO_GRID_VARIATIONS,
  PERSONAGEM_GENDER_VARIATIONS,
  DESVIO_SYMBOLIC_RUPTURE_VARIATIONS,
  DESVIO_CAMERA_VARIATIONS,
  PRECEDENCIA_PLANO_SOBRE_POSE,
  ARCO_PRECEDENCIA_CAMERA,
  CLAREZA_DEVICE_WELCOME_SENTENCE,
  CLAREZA_MATERIAL_TRABALHO_SENTENCE,
  CLAREZA_MATERIAL_TRABALHO_SUPPRESSED,
  CLAREZA_DEVICE_CLAUSE_SUPPRESSED,
  CLAREZA_ROSTO_INTEIRO_SENTENCE,
  CLAREZA_ENQUADRAMENTO_PRODUTO_HERO,
  FRAGMENTO_DEVICE_CONDITIONAL_SENTENCE,
  FRAGMENTO_DEVICE_CLAUSE_SUPPRESSED,
  IMPACTO_CAMERA_SENTENCE,
  IMPACTO_CAMERA_LOOKBOOK,
  INSTANTE_POSE_SENTENCE,
  INSTANTE_POSE_LOOKBOOK,
  FRAGMENTO_BLOCOS_SENTENCE,
  FRAGMENTO_BLOCOS_LOOKBOOK,
  DESVIO_CAMERA_SENTENCE,
  DESVIO_CAMERA_LOOKBOOK,
  SILENCIO_ESCALA_SENTENCE,
  SILENCIO_ESCALA_LOOKBOOK,
  SILENCIO_PESSOA_SENTENCE,
  SILENCIO_PESSOA_LOOKBOOK,
} from "./visualDirection.lexicon";
import {
  buildProductHierarchyBlock,
  variationHasFaceNotDominant,
  buildPersonagemMoodReconciliation,
} from "./productHierarchy";
import { pickImageVariationBlock } from "./imageVariationPicker";

// Re-exports — mantêm o import único "./visualDirection" (ou "../core/visualDirection")
// para todo o restante do código após o fatiamento da Fase 8.
export {
  buildProductHierarchyBlock,
  variationHasFaceNotDominant,
  buildPersonagemMoodReconciliation,
  pickImageVariationBlock,
};

export type PersonagemGender = "mulher" | "homem";

// Dispara só quando o título/texto menciona "mulher(es)" literalmente — marcador
// inequívoco de pessoa retratada. Termos genéricos do PÚBLICO (gestoras,
// empresárias, executivas, decisoras) não entram aqui: descrevem para quem a
// mensagem fala, não necessariamente quem aparece na imagem.
// Nota: "(es)?" (não "es?") é necessário para casar tanto o singular "mulher"
// quanto o plural "mulheres" — "mulheres?" sozinho nunca casava o singular.
const FEMININE_COPY_RE = /\bmulher(es)?\b/i;

// "Mulher(es)" também aparece com frequência descrevendo o PÚBLICO/cliente da
// peça ("para as mulheres da sua loja", "mulheres que buscam X"), não a pessoa
// retratada na cena — esses padrões são removidos do texto ANTES do teste
// acima para não forçar gênero por engano (ex.: VAREJO com personagem
// ancorado manualmente como homem, mas o texto fala do público feminino).
// O lookbehind evita exigir \b antes de "à/às" (letra acentuada, fora do \w
// padrão do regex em modo não-unicode — \b não detecta fronteira ali).
const FEMININE_AUDIENCE_RE =
  /\b(para|de|com|entre)\s+(as?\s+)?mulher(es)?\b|(?<![a-zà-ÿ])(às|à|pelas|pela)\s+mulher(es)?\b|\bas\s+mulher(es)?\s+(da|do|de|que)\b|\bmulher(es)?\s+que\b/gi;

export function detectForcedGenderFromCopy(
  titulo?: string,
  texto?: string,
): PersonagemGender | null {
  const copyText = `${titulo ?? ""} ${texto ?? ""}`.replace(FEMININE_AUDIENCE_RE, "");
  return FEMININE_COPY_RE.test(copyText) ? "mulher" : null;
}

// Reconcilia a gramática do mood com o que já foi decidido em outros pontos do
// MESMO prompt, substituindo sentenças pontuais em vez de acumular proibições:
//  · noDeviceThisScene — a regra global já baniu dispositivo digital nesta peça,
//    então as sentenças de CLAREZA/FRAGMENTO que os recebem bem saem de cena;
//  · produtoHero — há produto referenciado que deve ocupar 30-40% do quadro, e a
//    regra de rosto do CLAREZA ganha o parágrafo que declara que a distância
//    cede a essa exigência sem nunca cortar a cabeça da pessoa.
function resolveMoodRuleText(
  mood: MoodCode,
  noDeviceThisScene: boolean,
  produtoHero?: boolean,
  lookBook?: boolean,
): string | undefined {
  let base = MOOD_RULES[mood];
  if (!base) return base;
  // Look book × mood: cada mood tem uma sentença de câmera/pose/escala que
  // contradiz a pose de modelo e o enquadramento por tipo de peça. Trocadas por
  // versões que cedem só a parte conflitante e preservam o resto do mood — ver
  // o bloco LOOK BOOK × MOOD no léxico.
  if (lookBook) {
    if (mood === "OP-02") base = base.replace(IMPACTO_CAMERA_SENTENCE, IMPACTO_CAMERA_LOOKBOOK);
    if (mood === "OP-03") base = base.replace(INSTANTE_POSE_SENTENCE, INSTANTE_POSE_LOOKBOOK);
    if (mood === "OP-04") base = base.replace(FRAGMENTO_BLOCOS_SENTENCE, FRAGMENTO_BLOCOS_LOOKBOOK);
    if (mood === "OP-05") base = base.replace(DESVIO_CAMERA_SENTENCE, DESVIO_CAMERA_LOOKBOOK);
    if (mood === "OP-06") {
      base = base
        .replace(SILENCIO_ESCALA_SENTENCE, SILENCIO_ESCALA_LOOKBOOK)
        .replace(SILENCIO_PESSOA_SENTENCE, SILENCIO_PESSOA_LOOKBOOK);
    }
  }
  // Produto-herói (VAREJO com produto referenciado): a regra de rosto inteiro
  // ganha o parágrafo específico do produto, que declara que a distância cede
  // aos 30-40% do quadro exigidos pela hierarquia — ver
  // CLAREZA_ENQUADRAMENTO_PRODUTO_HERO no léxico.
  if (mood === "OP-01" && produtoHero) {
    base = base.replace(CLAREZA_ROSTO_INTEIRO_SENTENCE, CLAREZA_ENQUADRAMENTO_PRODUTO_HERO);
  }
  if (!noDeviceThisScene) return base;
  if (mood === "OP-01") {
    return base
      .replace(CLAREZA_DEVICE_WELCOME_SENTENCE, CLAREZA_DEVICE_CLAUSE_SUPPRESSED)
      .replace(CLAREZA_MATERIAL_TRABALHO_SENTENCE, CLAREZA_MATERIAL_TRABALHO_SUPPRESSED);
  }
  if (mood === "OP-04") {
    return base.replace(FRAGMENTO_DEVICE_CONDITIONAL_SENTENCE, FRAGMENTO_DEVICE_CLAUSE_SUPPRESSED);
  }
  return base;
}

// Bloco canônico "papel da empresa na mensagem" — fonte única para MOP e PU.
// Garante que a decisão de cena parta do ofício real, não da leitura literal de
// metáforas do título, e que o mood governe linguagem visual, não assunto da cena.
//
// opts.includeConcreteAction (default true):
//   true  → 3 pontos de derivação de papel + trava anti-metáfora (uso geral).
//   false → apenas a trava anti-metáfora, sem "mostre ação concreta".
//            Usar quando a instrução de ação concreta conflitaria: Kit Imagem ativo
//            (referência ancora a cena), mood simbólico (OP-04/05/06) ou objetivo
//            sem ação operacional (homenagem/aviso). A trava anti-metáfora permanece.
export function buildSceneRoleRule(opts?: { includeConcreteAction?: boolean }): string {
  const includeConcreteAction = opts?.includeConcreteAction !== false;

  const metaphorGuard =
    "⚠ TRAVA ANTI-LITERALIDADE: palavras do título com sentido estratégico ou metafórico " +
    '("longe", "avançar", "subir", "alcançar", "chegar", "rumo", "caminho", "direção", "passo", ' +
    '"virada", "sentido", "ponte", "norte", "avanço", "impulso", "crescimento") descrevem a INTENÇÃO ' +
    "da mensagem — NUNCA traduzir como deslocamento físico (pessoa andando, saindo pela porta, " +
    "caminhando com pasta, personagem de costas indo embora) nem como cenário de passagem " +
    "(corredor, porta, escada como elemento principal). " +
    "ADJETIVOS DE QUALIDADE também ancoram no ofício, não na propriedade física: " +
    '"rápido" = eficiência, não velocidade; "forte" = coesão, não músculo; ' +
    '"claro" = transparência, não iluminação; "sólido" = confiança, não material rígido. ' +
    'EXPRESSÕES DE EXECUÇÃO no título OU no texto de apoio ("ação real", "na prática", "mão na massa", ' +
    '"colocar em prática", "fazer acontecer") significam APLICAR ou ENTREGAR o serviço real — conduzir ' +
    "a reunião, revisar o documento, orientar o cliente, executar a recomendação — NUNCA artesanato, " +
    "produção manual, fabricação ou trabalho de oficina quando o ofício real da empresa for consultivo, " +
    "analítico, jurídico ou de orientação. " +
    "A cena nasce do ofício real da empresa, não da leitura literal de uma palavra do título.";

  if (!includeConcreteAction) return metaphorGuard;

  return (
    "PERSONAGEM-PADRÃO DA CENA — O PÚBLICO-ALVO, NÃO A EMPRESA: sem avatar/uniforme de " +
    "referência real, o personagem desta cena é o PÚBLICO-ALVO (o receptor da comunicação) " +
    "vivendo o contexto, o benefício ou o resultado da oferta — NUNCA a empresa, o dono ou " +
    "o profissional fazendo seu ofício (o emissor). Mostrar o emissor é uma escolha " +
    "deliberada do usuário ao marcar avatar/uniforme de referência; sem isso, não o " +
    "invente como protagonista da cena.\n" +
    "DERIVAR ANTES DE MONTAR A CENA:\n" +
    "1. O que a empresa CONCRETAMENTE ENTREGA nesta mensagem " +
    "(com base na atividade real, no título, no texto e na informação-chave)?\n" +
    "2. O que o PÚBLICO-ALVO VIVE, RECEBE ou SENTE ao se beneficiar dessa entrega — está " +
    "sendo orientado, comprando, tendo um problema resolvido, sendo atendido, recebendo um " +
    "diagnóstico, organizando algo com apoio, sendo facilitado ou recebendo algo específico?\n" +
    "3. Traduza essa experiência em uma AÇÃO CONCRETA do público-alvo: essa ação é o " +
    "assunto da cena. O mood define luz, clima, paleta, composição, câmera e energia — " +
    "nunca o assunto.\n" +
    metaphorGuard
  );
}

// Monta o resumo da gramática visual canônica de um mood (tensão Dondis +
// luz/paleta/composição/câmera/detalhe + regra inegociável) para uso fora do
// motor MOP — hoje consumido pelo PU em direcaoBlock. Fonte única junto com
// VISUAL_DIRECTIONS e MOOD_RULES: evita duas descrições do mesmo mood divergindo.
export function buildMoodGrammarBlock(
  mood: MoodCode,
  opts?: {
    noDeviceThisScene?: boolean;
    tonalidadeSeed?: number;
    accentHex?: string;
    /** VAREJO com produto referenciado: o produto é o herói do quadro e a
     * câmera precisa poder aproximar dele (ver resolveMoodRuleText). */
    produtoHero?: boolean;
    /** Modo look book: pose de modelo e enquadramento por tipo de peça vêm do
     * bloco de variação — a linha de câmera do mood e as sentenças que exigem
     * outro ângulo/pose cedem lugar (ver core/lookBook.ts). */
    lookBook?: boolean;
  },
): string {
  const v = getVisualDirection(mood);
  // FRAGMENTO, DESVIO e SILÊNCIO rodam a paleta em vez de usar a fixa do léxico
  // (ver POOL_POR_MOOD em core/colorRotation.ts). Começou só no SILÊNCIO em
  // 09/07/2026 e chegou aos outros dois em 12/08/2026, quando o Ari relatou que
  // via a mesma cor se repetir justamente nos moods que usa pouco. CLAREZA,
  // IMPACTO e INSTANTE seguem com paleta única, por decisão dele.
  const paleta = pickPaletaDoMood(mood, opts?.tonalidadeSeed, opts?.accentHex)?.bloco ?? v.paleta;
  const ruleText = resolveMoodRuleText(
    mood,
    !!opts?.noDeviceThisScene,
    !!opts?.produtoHero,
    !!opts?.lookBook,
  );
  const ruleBlock = ruleText ? `\n\nREGRA INEGOCIÁVEL DO MOOD ${v.nome}:\n${ruleText}` : "";
  // A linha de câmera da gramática descreve lente, altura e ângulo — os três
  // campos que o look book já fixou pelo tipo da peça. Deixar as duas no mesmo
  // prompt é pedir 35mm em contra-plongée (IMPACTO) e 50-85mm frontal
  // (look book) ao mesmo tempo.
  const cameraLine = opts?.lookBook
    ? "definida pelo LOOK BOOK (ver bloco de variação): 50-85mm, altura entre peito e quadril, frontal ou três-quartos, sem distorção. A lente e o ângulo típicos deste mood cedem lugar nesta peça; luz, paleta e clima do mood permanecem integralmente"
    : v.camera;
  return `TENSÃO VISUAL CANÔNICA (técnicas Dondis, vocabulário inegociável): ${v.tensaoDondis}.\n\nGRAMÁTICA VISUAL DO MOOD ${v.nome}:\n- Luz: ${v.luz}\n- Paleta: ${paleta}\n- Composição: ${v.composicao}\n- Atitude da câmera: ${cameraLine}\n- Detalhe criativo (obrigatório, sutil): ${v.detalheCriativo}${ruleBlock}`;
}

// Bloco pronto para injeção no prompt do motor.
// Reforça a regra inegociável: a gramática visual GOVERNA luz, paleta,
// composição e câmera de TODA peça da sequência (estático, carrossel,
// estático final e reels), sem alterar a Matriz psicológica.
export function buildVisualDirectionBlock(
  mood: MoodCode,
  segment?: Segment,
  /** Posição desta sequência na fila de variação do usuário (ver
   * nextVariacaoSeed em utils/storage.ts). Com ela, câmera e pose ANDAM entre
   * uma sequência e a próxima em vez de serem sorteadas de novo do zero. Sem
   * ela, sorteio de sempre. */
  seed?: number,
): string {
  const v = getVisualDirection(mood);
  // Mesmos eixos e passos do bloco de imagem — ver o comentário em
  // imageVariationPicker.ts, que é a outra ponta desta mesma fila.
  const pickEixo = <T>(pool: T[], passo: number): T =>
    seed === undefined ? pickRandom(pool) : pickRotating(pool, seed, passo);
  const PASSO_CAMERA = 1;
  const PASSO_ESTRUTURA = 2;
  const PASSO_CONCEITO = 3;
  // A paleta da sequência entra aqui pela MESMA posição de fila que rege câmera
  // e pose — uma decisão por sequência, para todas as peças saírem na mesma cor
  // (ver pickPaletaDoMood). Nos três moods sem rodízio, devolve null e vale a
  // paleta única do léxico.
  const paletaSequencia = pickPaletaDoMood(mood, seed)?.bloco ?? v.paleta;
  const seg = segment ? SEGMENT_LAYERS[mood]?.[segment] : undefined;

  const segmentBlock = seg
    ? `

CONTEXTO DE SEGMENTO (${segment}):
- Referência: ${seg.referenciaConcreta}
- Não usar como padrão automático: ${seg.evitar}
Permitir apenas quando estiver explicitamente ligado à informação-chave, ao segmento ou à natureza real do negócio — e desde que não contrarie a gramática do mood.`
    : "";

  // OP-01, OP-02, OP-03 sorteia variação de personagem (+ gênero, + câmera no
  // CLAREZA e no INSTANTE).
  const characterVariationMap: Partial<Record<MoodCode, string[]>> = {
    "OP-01": CLAREZA_CHARACTER_VARIATIONS,
    "OP-02": IMPACTO_CHARACTER_VARIATIONS,
    "OP-03": INSTANTE_CHARACTER_VARIATIONS,
  };

  // Cada mood combina seus próprios sorteios independentes — mesmo padrão do
  // CLAREZA (personagem + câmera sorteados separadamente). DESVIO combina
  // ruptura + câmera; SILÊNCIO combina objeto + câmera; FRAGMENTO sorteia o
  // arranjo da grade; OP-01/02/03 combinam personagem + gênero (+ câmera no
  // CLAREZA e no INSTANTE).
  let variacaoBlock = "";
  const TEMA_DERIVATION_RULE =
    'ANTES de aplicar a estrutura sorteada abaixo, identifique em UMA palavra ou ação concreta o que o título e o texto desta peça comunicam (ex.: título sobre "atendimento ágil" → ação de responder/atender; título sobre "transparência" → ação de mostrar/revisar/explicar documento ou processo; título sobre "comunicação e design" → ação de revisar peças/material visual, OU direcionar uma produção/sessão de fotos, OU organizar referências em mural; título sobre "ignorar retorno do cliente" → símbolo ligado a voz, escuta ou feedback; título com metáfora estratégica como "rumo da campanha" → ação de apresentar plano a um interlocutor, organizar referências em mural ou revisar material — o que a empresa FAZ, NÃO pessoa andando). Essa ação ou símbolo concreto é o que preenche a estrutura sorteada — a estrutura é a moldura (pose/câmera/composição), o tema da peça é o que vai dentro dela. METÁFORAS/MODIFICADORES DO TÍTULO — ANCORAGEM NO OFÍCIO: palavras como "longe", "avançar", "subir", "crescimento", "rumo", "caminho" e adjetivos como "rápido", "forte", "claro", "sólido" ancoram-se no ofício real — NUNCA traduzir como cenário físico (escada, degraus, horizonte vazio) nem como propriedade física literal (velocidade, músculo, iluminação). Ex.: "avançar com método" em consultoria → reunião com pauta, não caminho; "atendimento rápido" → cliente atendido sem espera, não borrão de movimento. CRÍTICO — A CENA NUNCA PODE NEGAR O SUJEITO DO TÍTULO: se o título menciona interação ou equipe, a cena tem ao menos dois sujeitos ou troca visível; se menciona decisão, o personagem está no ato de decidir; se menciona escuta, há presença de interlocutor ou elemento de recepção — nunca personagem sozinho sem contexto relacional quando o título é relacional.';

  if (mood === "OP-05") {
    const ruptura = pickEixo(DESVIO_SYMBOLIC_RUPTURE_VARIATIONS, PASSO_CONCEITO);
    const camera = pickEixo(DESVIO_CAMERA_VARIATIONS, PASSO_CAMERA);
    variacaoBlock = `\n\nVARIAÇÕES SORTEADAS PARA ESTA GERAÇÃO — SEGUIR EXATAMENTE, SEM SUBSTITUIÇÃO:\n• Câmera: ${camera}\n${ARCO_PRECEDENCIA_CAMERA}\n• Estrutura da ruptura simbólica: ${ruptura}\n${TEMA_DERIVATION_RULE} Aqui, o objeto, gesto ou elemento deslocado que ENCARNA a ruptura deve ser esse símbolo derivado do tema da peça — não um conceito surreal genérico solto. Uma ruptura por cena, sem acumular.`;
  } else if (mood === "OP-04") {
    // FRAGMENTO não recebia nenhuma variação sorteada até 11/08/2026 — a grade
    // saía sempre com o mesmo arranjo e ponto de vista.
    const grade = pickEixo(FRAGMENTO_GRID_VARIATIONS, PASSO_CONCEITO);
    variacaoBlock = `\n\nVARIAÇÕES SORTEADAS PARA ESTA GERAÇÃO — SEGUIR EXATAMENTE, SEM SUBSTITUIÇÃO:\n• Arranjo da grade: ${grade}\n${TEMA_DERIVATION_RULE} Aqui, o CONTEÚDO de cada bloco é o que deriva do tema — o arranjo acima é só a moldura que organiza os blocos. Manter a paleta unificada de 3 tons costurando o conjunto e a margem de respiro das bordas.`;
  } else if (mood === "OP-06") {
    // ⚠ SÓ CÂMERA — ver o comentário do OP-06 em imageVariationPicker.ts: o
    // sorteio de sujeito isolado foi religado em 11/08/2026 e revertido em
    // 12/08/2026 por decisão do Aristóteles. A condição do SILÊNCIO (o que é o
    // sujeito da cena) não se sorteia; o escopo da Fase 1 era câmera, luz e pose.
    // Cinco eixos desde 12/08/2026 (ver core/cameraAxes.ts). A trava de escala
    // do mood — sujeito em no máximo 30% do quadro — não foi tocada: é a
    // identidade do SILÊNCIO, e cada distância do eixo a repete.
    const camera = buildCameraLine("OP-06", { seed });
    variacaoBlock = `\n\nVARIAÇÕES SORTEADAS PARA ESTA GERAÇÃO — SEGUIR EXATAMENTE, SEM SUBSTITUIÇÃO:\n• Câmera: ${camera}\n${ARCO_PRECEDENCIA_CAMERA}\n${TEMA_DERIVATION_RULE} O OBJETO ou sujeito isolado nasce do ofício real da empresa — derive do título, do texto e da leituraCenica: um único instrumento, ferramenta, material, produto ou elemento que pertença genuinamente à atividade real do negócio descrito no kit de marca. PROIBIDO objeto genérico desconectado do ofício (livro de leitura, caderno de escrita, óculos soltos, caneta sem contexto), PROIBIDO laptop, notebook ou dispositivo digital como elemento principal. INEDITISMO: prefira o objeto menos óbvio do ofício real — evite a primeira associação mais previsível e busque algo específico do negócio.`;
  } else if (characterVariationMap[mood]) {
    // Para INSTANTE (OP-03), MARCA e SERVIÇOS usam o pool reduzido sem léxico de
    // PDV — ver INSTANTE_POOL_SEM_PDV no léxico, onde a seleção mora agora.
    // VAREJO mantém o pool completo.
    const pool =
      mood === "OP-03" && segment && segment !== "VAREJO"
        ? INSTANTE_POOL_SEM_PDV
        : characterVariationMap[mood]!;
    const variation = pickEixo(pool, PASSO_ESTRUTURA);
    // OP-03 entrou aqui em 11/08/2026 — antes só o CLAREZA tinha câmera
    // sorteada no lado do conteúdo, e o INSTANTE usava uma string fixa.
    // OP-01 deixou de sortear uma frase pronta em 12/08/2026: a câmera do
    // CLAREZA passou a ser COMPOSTA por cinco eixos (ver core/cameraAxes.ts).
    // Sem hasAvatarRef aqui de propósito — este é o lado do CONTEÚDO, que roda
    // uma vez por sequência e não conhece a seleção do Kit Imagem; o filtro de
    // avatar existe no picker de imagem, que é onde essa informação chega.
    const camera =
      mood === "OP-01"
        ? buildCameraLine(mood, { seed })
        : mood === "OP-03"
          ? pickEixo(INSTANTE_CAMERA_VARIATIONS, PASSO_CAMERA)
          : null;
    // Gênero fica no sorteio de propósito: é 50/50 e não é eixo de repetição
    // visual — pôr na fila faria homem e mulher alternarem em ordem fixa, o que
    // é outra decisão (e um terreno com histórico de bug: ver o fallback de
    // gênero da PU em 16/07/2026).
    const gender = pickRandom(PERSONAGEM_GENDER_VARIATIONS);
    // Duas precedências diferentes, ambas sobre plano: PRECEDENCIA_PLANO_SOBRE_POSE
    // resolve câmera × pose dentro da MESMA peça; a do arco resolve câmera ×
    // sequência entre as peças. Não se substituem — e a ordem completa
    // (arco > câmera > pose) está dita na primeira.
    const precedencia =
      (mood === "OP-01" || mood === "OP-03") && camera ? `\n${PRECEDENCIA_PLANO_SOBRE_POSE}` : "";
    const arco = camera ? `\n${ARCO_PRECEDENCIA_CAMERA}` : "";
    variacaoBlock = `\n\nVARIAÇÕES SORTEADAS PARA ESTA GERAÇÃO — SEGUIR EXATAMENTE, SEM SUBSTITUIÇÃO:${camera ? `\n• Câmera: ${camera}` : ""}${precedencia}${arco}\n• Gênero do personagem NESTA GERAÇÃO: ${gender} — ESCOPO EXCLUSIVO: aplica-se APENAS ao campo "personagem" da leituraCenica e à composição visual da imagem — NÃO deve alterar título, texto, legenda, hook nem qualquer campo textual da peça. Nos campos de texto, quando o usuário não especificou gênero, usar sempre termos neutros ("gestores", "profissionais", "decisores", "equipes", "pessoas") — nunca escolher gênero nos textos por conta própria. No campo "personagem": adapte para ${gender}, preservando a mesma ação, postura, papel e contexto — troque só o gênero, sem estereótipo.\n• Estrutura de pose/enquadramento/ambiente: ${variation}\n${TEMA_DERIVATION_RULE} Aqui, o GESTO e A AÇÃO do personagem dentro dessa estrutura devem ser exatamente essa ação concreta derivada do tema — nunca uma pose dramática genérica de "executivo" sem relação com o que a peça comunica.`;
  }

  const moodRuleBlock = MOOD_RULES[mood]
    ? `\n\nREGRA INEGOCIÁVEL DO MOOD ${v.nome}:\n${MOOD_RULES[mood]}`
    : "";

  return `
DIREÇÃO VISUAL DOMINANTE — INEGOCIÁVEL:

TENSÃO VISUAL CANÔNICA (técnicas Dondis, vocabulário inegociável):
${v.tensaoDondis}.
Toda peça da sequência DEVE expressar essa tensão visual de forma reconhecível — não como rótulo escrito, mas como sensação ao olhar.

GRAMÁTICA VISUAL DO MOOD:
Toda imagePrompt e toda leituraCenica de TODA peça (estáticos, cards de carrossel, estáticos finais e reels) DEVE ser fotografada conforme esta gramática única:
- Luz: ${v.luz}
- Paleta: ${paletaSequencia}
- Composição: ${v.composicao}
- Atitude da câmera: ${v.camera}
- Detalhe criativo (obrigatório, sutil): ${v.detalheCriativo}${variacaoBlock}${moodRuleBlock}${segmentBlock}

TIPOGRAFIA NA IMAGEM — INEGOCIÁVEL (vale para QUALQUER mood × segmento):
- O TÍTULO renderizado na peça deve ser BOLD e GRANDE — o bloco de título deve ocupar no MÍNIMO 45% da altura vertical do canvas. Se o título tiver 4 ou mais palavras, quebre em até 3 linhas para MANTER O CORPO GRANDE — nunca reduza o corpo para caber em menos linhas. Letras legíveis a pelo menos 3 metros da tela do celular. SEMPRE dentro da margem de respiro das bordas — ajuste quebra de linha e posição do bloco, jamais o corpo da fonte.
- O TEXTO DE APOIO (subtítulo) é um BLOCO DE SUBTÍTULO DE REVISTA — corpo entre 55% e 70% do tamanho do título. Deve ser lido de imediato no celular sem aproximar nem dar zoom. NÃO é legenda de rodapé, NÃO é texto decorativo pequeno, NÃO é legenda de foto.
- ACENTO DE COR NO TÍTULO: aplique a cor de acento da paleta do mood (ou tom vibrante da paleta) em 1 palavra-chave ou na linha mais impactante do título — o restante fica em branco ou neutro. Este contraste de cor cria hierarquia visual e personalidade. Não obrigatório se a composição já tiver energia cromática suficiente, mas fortemente recomendado.
- PROIBIDO: texto de apoio com menos de 50% do tamanho do título, texto miniatura, corpo tipo "legenda", qualquer tipografia que exija zoom para ler.
- Regra prática: ambos título e texto de apoio devem ser lidos de imediato ao ver a peça no celular em tamanho normal — se precisar aproximar o celular para ler qualquer um deles, o tamanho está errado.

REGRA DE DISPOSITIVOS DIGITAIS — DECISÃO DE CENA (vale para QUALQUER mood × segmento):
- SE a cena envolver dispositivo digital, decida o TIPO conforme a atividade real da empresa e o que a cena pede — varie entre celular/smartphone, tablet, notebook, monitor de desktop ou tela/TV ao fundo. NÃO recorra sempre a notebook como padrão automático — diversifique o tipo entre as peças da mesma sequência.
- MÁXIMO 1 dispositivo por cena.
- PROIBIDO posicionar laptop aberto com a tela voltada frontalmente para o observador e o personagem ATRÁS dele — essa "barreira de laptop" é banida em TODOS os moods e segmentos.
- SE A CENA ENVOLVER TELEFONE: deve ser smartphone/celular moderno (touchscreen, sem fio) — PROIBIDO telefone fixo, com fio, orelhão, fax ou modelo retrô.
- NÃO descreva conteúdo de tela, logo de marca real ou texto legível no dispositivo no imagePrompt — a física de renderização da tela e da carcaça é tratada na etapa de geração da imagem, não na leitura de cena.

Os campos "clima" e "composicao" da leituraCenica DEVEM derivar diretamente da Tensão Dondis e da Gramática Visual acima — não são livres.
Os campos "intencao", "personagem", "ambiente" e "expressao" continuam vindo da progressão psicológica da Matriz; a gramática visual apenas determina COMO a cena é fotografada, não O QUE ela diz.

TODA imagePrompt DEVE conter, embutido na descrição da cena, o "Detalhe criativo" acima — pequeno, integrado, jamais como adesivo gráfico sobreposto. Ele é o que diferencia a peça de uma foto de banco genérica.

A coerência visual entre todas as peças da sequência é OBRIGATÓRIA: ao olhar duas peças quaisquer, deve ser evidente que pertencem ao mesmo trabalho.

Encerre cada imagePrompt com a assinatura técnica exata (não traduzir, não parafrasear): "${v.assinatura}".
`.trim();
}

export function getMoodSignature(mood: MoodCode): string {
  return getVisualDirection(mood).assinatura;
}
