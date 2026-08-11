import { ContentFormData, Track } from "../types";
import { FAIXA_ETARIA_REGISTRO } from "./audienceAge";
import { AUDIENCE_SEGMENT_CONFIG } from "../domain/audienceSegment.config";
import { getVoiceProfile } from "../data/brandVoice";
import { buildVisualDirectionBlock, getMoodSignature, buildSceneRoleRule } from "./visualDirection";
import {
  LEGENDA_CORPO_MAX_WORDS,
  LEGENDA_CTA_MAX_WORDS,
  LEGENDA_HASHTAGS,
  TECNICISMO_RULE,
} from "./textValidation";
import { momentModulators, SILABA_EXCECAO_RULE } from "./mopModulators";

export const SEQUENCE_COMPOSITION = {
  3: { estatico: 1, carrossel: 1, fechamento: 1 },
  6: { estatico: 2, carrossel: 2, fechamento: 2 },
  9: { estatico: 3, carrossel: 3, fechamento: 3 },
};

// Nº total de "peças" de título+texto(+legenda) geradas numa chamada de
// generate-content.ts — usado pelo contador "Primeira Geração" (camada
// adicional de bloqueio, não precisa ser matematicamente perfeito). Cada
// estático/estático-final é 1 peça; cada sequência de carrossel tem 5 cards
// (título+texto por card, legenda 1x por sequência — mas conta como peça
// igual às demais pro propósito deste contador). Ex.: S3 = 1+5+1 = 7,
// S6 = 2+10+2 = 14, S9 = 3+15+3 = 21 — mesmo bucketing defensivo de
// mopContentCost() (costs.ts) para tolerar um sequenceSize fora de {3,6,9}.
export function mopPiecesCount(sequenceSize: number): number {
  const comp =
    sequenceSize <= 3
      ? SEQUENCE_COMPOSITION[3]
      : sequenceSize >= 9
        ? SEQUENCE_COMPOSITION[9]
        : SEQUENCE_COMPOSITION[6];
  return comp.estatico + comp.carrossel * 5 + comp.fechamento;
}

function buildPostProgression(qty: number, entrada: string, isB2BOperational: boolean): string {
  // A modulação do momento ("entryModifier") já é declarada uma única vez em
  // ANÁLISE INTERNA → "4. Modulação do momento" — não repetir aqui.
  const ativacao = isB2BOperational
    ? `Ativação da ENTRADA (${entrada}) via gatilho de SEGURANÇA: enfatizar estabilidade, proteção, previsibilidade operacional, redução de incerteza e controle de processo.`
    : `Ativação da ENTRADA: ${entrada}, aplicada ao contexto real do negócio.`;

  const segurancaNote = isB2BOperational
    ? " → Como o início já ativou Segurança, esta etapa deve aprofundar com provas concretas. NÃO repetir estabilidade/proteção."
    : "";

  if (qty === 1) return `- Post 1: ${ativacao}`;
  if (qty === 2) return `- Post 1: ${ativacao}\n- Post 2: Confiança e autoridade`;
  if (qty === 3)
    return `- Post 1: ${ativacao}\n- Post 2: Confiança e segurança${segurancaNote}\n- Post 3: Autoridade e ação`;
  return `- Post 1: ${ativacao}\n- Post 2: Amplia o contexto\n- Post 3: Aplica entendimento\n- Post 4: Segurança${segurancaNote}\n- Post 5: Confiança ou autoridade\n- Post 6: Conduz à ação`;
}

function buildCommunicativeFunctionMap(
  comp: { estatico: number; carrossel: number; fechamento: number },
  isVisualOrExperimentacao: boolean,
  progressionStages: string[],
): string {
  const fnMap: Record<string, { label: string; desc: string }> = {
    IDENTIFICAÇÃO: {
      label: "EDUCATIVO + INSPIRACIONAL",
      desc: "FORMA observação-espelho: nomeia a realidade do público — a marca entende, não vende",
    },
    RECONHECIMENTO: {
      label: "INSPIRACIONAL",
      desc: "FORMA afirmação de identidade: revela a marca — sem CTA, sem argumento comercial",
    },
    DESEJO: {
      label: "INSPIRACIONAL",
      desc: "FORMA cena desejável: mostra o que passa a ser possível — sem pressionar",
    },
    ENTENDIMENTO: {
      label: "EDUCATIVO + INFORMATIVO",
      desc: "FORMA observação-espelho: nomeia o contexto ou problema que o receptor vive",
    },
    SEGURANÇA: {
      label: "INFORMATIVO + PERSUASIVO",
      desc: "FORMA critério prático: entrega um ponto de avaliação concreto que o receptor já pode usar",
    },
    CONFIANÇA: {
      label: "PERSUASIVO",
      desc: "FORMA prova/consequência: mostra o resultado observável de aplicar esse critério",
    },
    AUTORIDADE: {
      label: "PERSUASIVO",
      desc: "FORMA afirmação de domínio: posiciona o que a marca entrega — pode citar resultados e diferenciais",
    },
    AGIR: {
      label: "CONVENCIMENTO",
      desc: "FORMA convite consultivo: indica o próximo passo — pode nomear o que a empresa oferece",
    },
  };

  const lines: string[] = [];

  for (let i = 0; i < comp.estatico; i++) {
    const stage = progressionStages[i] || progressionStages[0];
    const fn = fnMap[stage] || {
      label: "EDUCATIVO + INFORMATIVO",
      desc: "contextualiza e informa",
    };
    lines.push(`Estático ${i + 1} [${stage}] → ${fn.label}: ${fn.desc}`);
  }

  if (comp.carrossel > 0) {
    const card5Desc =
      comp.carrossel > 1
        ? `Card 5 (ação)                → CONVENCIMENTO — FORMA por posição: nos carrosséis 1 a ${comp.carrossel - 1}, "síntese sem convite": resume o avanço e aponta direção, SEM citar a empresa e SEM CTA comercial explícito; SOMENTE no carrossel ${comp.carrossel} (o último), FORMA "convite consultivo": consolida e indica o próximo passo — pode citar o que a empresa entrega`
        : `Card 5 (ação)                → CONVENCIMENTO — FORMA convite consultivo: consolida e indica o próximo passo — pode citar o que a empresa entrega`;
    lines.push(
      `Carrossel — arco interno de 5 cards:`,
      `  Card 1 (abertura)            → EDUCATIVO — FORMA observação-espelho: nomeia o problema ou aspiração que o público reconhece, sem citar a empresa`,
      `  Cards 2-3 (desenvolvimento)  → INFORMATIVO — FORMA EVIDÊNCIA CONCRETA (Dia 2 = evidência, NÃO metáfora): o TÍTULO destes cards deve trazer um fato, número, situação real ou comparação observável — NÃO metáfora nem adjetivo de qualidade solto ("redondo", "certo", "sólido", "ideal"). Ex.: prefira "Folga errada some o rolamento" a "Motor redondo pede cuidado certo". OPÇÃO (não obrigação): pode usar formato de lista numerada quando fizer sentido (ex.: "N sinais de que...", "N motivos para..."), mas NÃO é regra fixa nem deve se repetir como fórmula entre gerações — é só UMA entre várias formas de evidência concreta (dado real, comparação, situação observável). Um ponto de avaliação por card`,
      `  Card 4 (direção)             → PERSUASIVO — FORMA indicação de caminho: aponta a direção a seguir — sem CTA, sem nomear a empresa`,
      `  ${card5Desc}`,
    );
  }

  const fechamentoTipo = isVisualOrExperimentacao ? "Estático Final" : "Reels";
  if (comp.fechamento > 0) {
    const fechamentoDesc =
      comp.fechamento > 1
        ? `${fechamentoTipo} → CONVENCIMENTO — FORMA por posição: do 1º ao ${comp.fechamento - 1}º ${fechamentoTipo}, "síntese sem convite": consolida a camada da progressão concluída até ali, SEM citar a empresa e sem convite explícito; SOMENTE no ${comp.fechamento}º ${fechamentoTipo} (o último da sequência), FORMA "convite consultivo + resolução": consolida toda a progressão e indica o próximo passo — pode nomear o que a empresa oferece. Tom consultivo, sem pressão artificial.`
        : `${fechamentoTipo} → CONVENCIMENTO — FORMA convite consultivo + resolução: consolida a progressão e indica o próximo passo — pode nomear o que a empresa oferece. Tom consultivo, sem pressão artificial.`;
    lines.push(fechamentoDesc);
  }

  return lines.join("\n");
}

// ESTRUTURA DO PROMPT — PREFIXO ESTÁTICO PARA PROMPT CACHING DA OPENAI:
// a OpenAI cacheia (mais barato) o prefixo IDÊNTICO entre chamadas — mas só
// enquanto ele permanecer byte-a-byte igual desde o início. Por isso os
// únicos 3 valores realmente livres/únicos por chamada — companyName,
// mainActivity e keyInfo — foram agrupados em UM bloco "CONTEXTO" só, o mais
// tarde possível no prompt (logo antes de buildVisualDirectionBlock, que já
// sorteia variações via Math.random internamente e por isso nunca seria
// cacheável mesmo se viesse antes). Tudo o resto do prompt (regras do
// método, formatos, limites) depende só de enums de baixa cardinalidade
// (track/segmento/B2B-B2C/tamanho da sequência/mood) — calls com as mesmas
// opções reaproveitam o mesmo prefixo cacheado mesmo vindo de empresas/
// keyInfo diferentes. Nenhuma regra/instrução foi reescrita aqui — só
// reordenada (ver `emissorLine` e `ancoraDataLine` abaixo, que são texto
// idêntico ao que já existia, só deslocado).
export function buildMetodoOpPrompt(
  data: ContentFormData,
  /** Posição desta sequência na fila de variação do usuário — ver
   * nextVariacaoSeed em utils/storage.ts. Repassada à direção visual para que
   * câmera e pose andem de uma sequência para a próxima em vez de serem
   * sorteadas do zero toda vez. Opcional: sem ela, sorteio de sempre. */
  variacaoSeed?: number,
): string {
  const isB2B = data.audience === "B2B";
  const seg = AUDIENCE_SEGMENT_CONFIG[isB2B ? "B2B" : "B2C"][data.segment];
  const moment = momentModulators[data.businessMoment] || momentModulators["consolidação"];
  const isB2BOperational = isB2B && (data.segment === "SERVIÇOS" || data.segment === "VAREJO");
  const wantsStories = data.outputMode === "stories" || data.outputMode === "feed+stories";
  const hasFeed = data.outputMode === "feed" || data.outputMode === "feed+stories";

  const track: Track = data.track || "cinematica";
  const isVisual = track === "visual";
  const isExperimentacao = track === "experimentacao";
  const isVisualOrExperimentacao = isVisual || isExperimentacao;

  const requestedSize = (data.sequenceSize || 6) as 3 | 6 | 9;
  const size: 3 | 6 | 9 = isExperimentacao ? 3 : requestedSize;
  const comp = SEQUENCE_COMPOSITION[size];

  const progressionText = seg.progressionText;

  const audienceDirection = isB2B
    ? "Conteúdo SEMPRE para o decisor empresarial (gestor, diretor ou responsável pela área), NUNCA para o consumidor final."
    : "Conteúdo SEMPRE para o consumidor final (cliente do cliente), NUNCA para o empresário.";

  const faixaDirection = data.faixaEtaria ? FAIXA_ETARIA_REGISTRO[data.faixaEtaria] : "";

  const vendaRule = isB2B
    ? `- Venda só pode aparecer no último conteúdo da sequência.\n- O último conteúdo DEVE conter convite claro para reunião, diagnóstico ou proposta personalizada.\n- Proibido CTA agressivo, pressão ou urgência artificial.`
    : `- Venda só pode aparecer no último conteúdo da sequência.\n- A abordagem deve ser consultiva, natural e coerente.\n- Proibido CTA agressivo, pressão ou urgência artificial.`;

  const prohibitedWords = isB2B
    ? '"risco", "comoditização", "incerteza", "custo de troca", "falta de referências", "eficiência", "previsibilidade", "margem", "giro", "posicionamento", "diferenciação", "bloqueio", "entrada", "progressão"'
    : '"confuso", "confusa", "confusão", "desconfiança", "indecisão", "inércia", "desconexão", "bloqueio", "entrada", "progressão"';

  // ── Bloco de fechamento da sequência ──
  // Cinemática: REELS (movimento, retenção, expansão emocional)
  // Visual / Experimentação: ESTÁTICO FINAL (resolução, fechamento, imagem fixa)
  const composicaoLine = isVisualOrExperimentacao
    ? `${size} peças no total: ${comp.estatico} estático${comp.estatico > 1 ? "s" : ""} + ${comp.carrossel} carrossel${comp.carrossel > 1 ? "is" : ""} + ${comp.fechamento} estático${comp.fechamento > 1 ? "s" : ""} final${comp.fechamento > 1 ? "is" : ""}`
    : `${size} peças no total: ${comp.estatico} estático${comp.estatico > 1 ? "s" : ""} + ${comp.carrossel} carrossel${comp.carrossel > 1 ? "is" : ""} + ${comp.fechamento} reels`;

  const reelsBlock = `
REELS (${comp.fechamento} guia${comp.fechamento > 1 ? "s" : ""} de produção):
- Cada Reels: até 15 segundos, imagem PURA (sem texto, sem logo), sempre com UMA ÚNICA PESSOA adulta como porta-voz.
- O imagePrompt do Reels DEVE descrever uma FOTO ÚNICA, sem colagem, sem sequência de quadros, sem reunião e sem várias pessoas.
- Se a ideia envolver clientes, equipe, reunião ou atendimento, traduza visualmente para uma pessoa sozinha olhando para a câmera.
- Campo "hook": título editorial do reels, NO MÁXIMO 6 palavras, ${SILABA_EXCECAO_RULE}. Sem ponto final — EXCETO se for pergunta (direta ou retórica): nesse caso "?" é obrigatório (ex.: "Por que isso acontece?", "O que está faltando?").
- Texto de tela em "screenText", frase curta até 7 palavras.
- Roteiro falado (campo "script"): ESTRUTURA em 2 partes — (1) mensagem principal de 14 a 16 palavras curtas + ponto final + (2) CTA genérico de 5 a 6 palavras. TOTAL: 19 a 22 palavras → ~7 segundos em voz.
  CTA OBRIGATORIAMENTE GENÉRICO — varie a cada geração, escolha entre: "Fale com a gente hoje.", "Entre em contato agora.", "Venha saber mais.", "Comece ainda hoje.", "Fale conosco agora.", "Dá pra começar hoje.", "A gente te ajuda.", "Vem com a gente.", "O primeiro passo é seu.", "Bora dar o próximo passo." — ou crie outro de mesmo tom. PROIBIDO mencionar canal específico: NUNCA use as palavras site, WhatsApp, Instagram, telefone, link, e-mail, acesse, clique, siga, baixe, cadastre.
- REGRA TTS — campo "script" (será LIDO em voz alta por sintetizador): USE palavras de 1 ou 2 sílabas sempre que possível. PROIBIDO: palavras com mais de 3 sílabas, siglas em caixa alta (APP→"app", CRM→"sistema", ROI→"retorno", KPI→"meta", IA→"inteligência"), anglicismos crus (link, lead, brief, deadline, framework), abreviações (vc, tb, p/). TRADUZA termos difíceis: "consultoria"→"apoio"; "estratégia"→"plano"; "posicionamento"→"presença". Exemplo correto (21 palavras, ~7s): "Sua marca fala. Seu time entrega. Seu cliente volta. É assim que se cresce. Fale com a gente hoje." O campo "screenText" PODE conter sigla (é lido com os olhos), mas o "script" NÃO PODE — precisa fluir natural em voz alta em português brasileiro.
- Retornar em "reels": [{ "sequencia": 1, "hook", "screenText", "script", "imagePrompt", "legenda": "corpo até ${LEGENDA_CORPO_MAX_WORDS} palavras + CTA até ${LEGENDA_CTA_MAX_WORDS} palavras, terminando com ${LEGENDA_HASHTAGS} hashtags em letra minúscula sem acento (ver REGRA DE LEGENDA)" }]
${comp.fechamento > 1 ? `- Gerar ${comp.fechamento} reels com abordagens visuais E estruturais distintas (script com sujeito/estrutura diferentes, não só troca de verbo). Convite consultivo + CTA comercial explícito SÓ no reels ${comp.fechamento} (o último); os reels anteriores fecham em síntese/direção, sem nomear a empresa.` : ""}`;

  const estaticoFinalBlock = `
ESTÁTICO FINAL (${comp.fechamento} peça${comp.fechamento > 1 ? "s" : ""} de fechamento narrativo):
- O Estático Final NÃO é um estático comum nem um reel congelado.
- É um formato HÍBRIDO de fechamento visual com função psicológica própria: consolidação, resolução visual, fechamento emocional, organização da decisão.
- Função na sequência: encerrar o ciclo narrativo aberto pelo estático e desenvolvido pelo carrossel.
- Cada Estático Final: título com NO MÁXIMO 6 palavras, ${SILABA_EXCECAO_RULE}, sem ponto final (EXCETO se for pergunta: "?" é obrigatório); texto com NO MÁXIMO 15 palavras terminando com PONTO FINAL (16ª palavra em diante é cortada); legenda com corpo até ${LEGENDA_CORPO_MAX_WORDS} palavras e CTA até ${LEGENDA_CTA_MAX_WORDS} palavras, terminando com ${LEGENDA_HASHTAGS} hashtags em letra minúscula (ver REGRA DE LEGENDA).
- O TÍTULO do Estático Final deve carregar resolução, não provocação. Frase de conclusão, não de abertura. O elemento concreto da Informação-chave PODE e DEVE ser reconhecível aqui — reaparecer como prova da decisão tomada é a própria função do fechamento (a sequência é acompanhada dia a dia como uma história; o Estático Final fecha o ciclo que o Estático inicial abriu). O que NÃO pode se repetir é o BENEFÍCIO/GANHO: se o título reescreve a Informação-chave trocando só 2-3 palavras por sinônimos do mesmo benefício (ex.: Informação-chave fala em "manter produção ativa" → título final repetir "produção ativa" é fraco), troque por um GANHO DE NEGÓCIO que só a resolução revela — uma consequência real e específica da atividade desta empresa (ex.: "marca em evidência", "portfólio fortalecido", "autoridade construída", "capacidade ampliada", "presença consolidada") — NUNCA um estado emocional genérico e intercambiável entre segmentos ("confiança", "tranquilidade", "paz de espírito", "rotina resolvida", "decisão certa"/"decisão feita"); o ganho precisa ser específico a ESTE negócio (deriva da atividade/segmento informados no CONTEXTO), não um clichê de fechamento que serviria pra qualquer marca.
- PROIBIDO estruturar o título como ESCOLHA/ALTERNATIVA dupla ("[ação] já ou [ação] sem parar", "[verbo] agora ou [verbo] depois") — essa forma é CTA/oferta, soa como provocação de abertura, não como conclusão de um ciclo já resolvido. Ex. ruim: "Venda já ou cresça sem parar" (lê como slogan de oferta, não como fechamento). O título deve afirmar UM resultado já consolidado, não apresentar duas opções.
- O TEXTO deve consolidar a direção da sequência em uma afirmação clara e estável.
- A IMAGEM deve traduzir literalmente o título e o texto, com cena de calma, foco e estabilidade — não tensão, não movimento.
- Retornar dentro do array "feed" com formato exato "Estático Final" (com acento e espaço, exatamente assim).
- Estrutura de cada item: { "dia", "formato": "Estático Final", "titulo", "texto", "legenda", "imagem", "leituraCenica": { "intencao": "sensação de fechamento que esta peça consolida", "personagem": "quem aparece na cena, em postura de calma e direção definida", "ambiente": "ambiente estável, com poucos elementos competindo pela atenção", "expressao": "expressão serena, decidida, sem dramaticidade", "clima": "luz suave, atmosfera de resolução, hora estável do dia", "composicao": "composição centralizada ou em equilíbrio claro, com espaço negativo amplo, sem ruído gráfico" } }
${comp.fechamento > 1 ? `- Gerar ${comp.fechamento} Estáticos Finais com abordagens narrativas E estruturais distintas (sujeito/molde de frase diferentes, não só sinônimo do mesmo molde), cada um fechando uma camada diferente da sequência. Convite consultivo + nomear a empresa SÓ no Estático Final ${comp.fechamento} (o último); os anteriores fecham em síntese, sem citar a empresa.` : ""}`;

  const closingBlock = isVisualOrExperimentacao ? estaticoFinalBlock : reelsBlock;

  // ⚠️ REGRA DE TRILHA — bloco crítico, posicionado NO TOPO do prompt para máxima prioridade.
  // Linguagem absoluta e instrução negativa explícita são mais eficazes que descrições suaves.
  const trackHeader = isVisualOrExperimentacao
    ? `
⚠️ TRILHA ${isExperimentacao ? "EXPERIMENTAÇÃO" : "VISUAL"} — REGRAS INVIOLÁVEIS:
1. FECHAMENTO obrigatório: peças com formato "Estático Final" dentro do array "feed".
2. Chaves do JSON: EXCLUSIVAMENTE "feed", "carousel"${wantsStories ? ', "stories"' : ""}. NADA MAIS.

`
    : `
TRILHA SOLICITADA: CINEMÁTICA (sequência com movimento, fechamento em Reels).
Chaves esperadas no JSON: "feed", "carousel", "reels"${wantsStories ? ', "stories"' : ""}.
`;

  const feedRules = hasFeed
    ? `
SEQUÊNCIA DO FEED (${composicaoLine}):

A SEQUÊNCIA COMPLETA segue a progressão: ${progressionText}
Os formatos são distribuídos pelo método — NÃO pelo usuário.

ESTÁTICOS (${comp.estatico} peça${comp.estatico > 1 ? "s" : ""}):
- Cada estático: título com NO MÁXIMO 6 palavras, ${SILABA_EXCECAO_RULE}, sem ponto final (EXCETO se for pergunta: nesse caso "?" é OBRIGATÓRIO — ex.: "Por que é assim?" ✓, "O que está faltando?" ✓, nunca "Por que é assim." ✗); texto com NO MÁXIMO 15 palavras terminando com PONTO FINAL (16ª palavra em diante é cortada); legenda com corpo até ${LEGENDA_CORPO_MAX_WORDS} palavras e CTA até ${LEGENDA_CTA_MAX_WORDS} palavras, terminando com ${LEGENDA_HASHTAGS} hashtags em letra minúscula (ver REGRA DE LEGENDA).
- Variar títulos entre afirmação, pergunta, contraste e observação cotidiana.
- DIVERSIDADE LEXICAL OBRIGATÓRIA: os títulos dos estáticos de uma mesma sequência NÃO podem começar com a mesma palavra — garantir abertura distinta entre Estático 1, Estático 2 e Estático Final. ALÉM DISSO, nenhuma palavra de conteúdo (substantivo, verbo ou adjetivo — ignore artigos/preposições) pode se repetir, mesma raiz incluída, entre os títulos do Estático, do Carrossel e do Estático Final/Reels desta sequência — ex.: se um título usa "guardado", os outros NÃO podem usar "guardado", "guardados" nem "guarda" em nenhuma posição. Cada título precisa de vocabulário próprio, mesmo tratando do mesmo tema.
- SUJEITO DO TÍTULO: aplica-se a regra de liberdade gramatical do item 11 (ver ANÁLISE INTERNA acima) — qualquer classe gramatical pode ser sujeito quando substantivada; proibida construção passiva sem agente.
- ANCORAGEM CONCRETA — ANTI-SÍMBOLO: o título deve poder virar uma FOTO de pessoa(s) real(is) em ação observável (decidir, alinhar, atender, revisar, entregar, fechar, apresentar). Teste antes de retornar: "dá para fotografar isso sem recorrer a objeto-metáfora ou cenário espacial genérico?" Se a única imagem possível for engrenagem, peão de madeira, seta, xadrez, escada, degraus, horizonte vazio ou aperto de mãos → título conceitual demais; reescreva com verbo de ação + agente humano. Exemplo: prefira "Time decide junto e fecha" a "Equipe forte traz bom ganho". Metáforas de jornada ("longe", "avançar", "crescer", "subir") e adjetivos de qualidade ("rápido", "forte", "claro", "sólido") SÃO PERMITIDOS nos títulos — a imagePrompt e leituraCenica os traduzirão pelo contexto real do negócio, não por cenário físico nem propriedade literal.
- TEXTO DE APOIO — PADRÕES PROIBIDOS: "vendas aumentadas", "resultados mais consistentes", "crescimento constante e", "para seu negócio", "para a sua empresa", "para a sua marca". Proibido o padrão "[abstrato] gera [resultado]", "[abstrato] faz [resultado]", "[abstrato] traz [resultado]" ou "[abstrato] é [abstrato]" como estrutura dominante — preferir construções diretas: sujeito + verbo de ação + complemento específico.
- Progressão dos estáticos: ${buildPostProgression(comp.estatico, seg.entrada, isB2BOperational)}
- ARCO VISUAL DA SEQUÊNCIA — OBRIGATÓRIO: as leituraCenicas devem criar progressão de câmera ao longo da sequência completa. Estático 1 (abertura): plano ABERTO — personagem integrado ao ambiente, espaço e contexto visíveis, câmera mais afastada; registrar "plano aberto" no campo 'composicao'. Estático Final/Reels (fechamento): plano MÉDIO-FECHADO ou CLOSE — personagem em destaque, composição mais centralizada, menos elementos de ambiente; registrar "plano médio-fechado" ou "close-up" no campo 'composicao'. Nunca dois estáticos consecutivos com o mesmo enquadramento.
- Retornar em "feed": [{ "dia", "formato":"Estático", "titulo", "texto", "legenda", "imagem", "leituraCenica": { "intencao": "o que este post ativa emocionalmente", "personagem": "quem aparece na cena e o que faz", "ambiente": "onde a cena acontece com detalhes físicos", "expressao": "expressão facial e corporal do personagem", "clima": "luz, hora do dia, atmosfera", "composicao": "enquadramento e distância de câmera (plano aberto / plano médio / plano médio-fechado / close-up) + como os elementos se organizam no quadro" } }]

CARROSSEL (${comp.carrossel} sequência${comp.carrossel > 1 ? "s" : ""} de 5 cards cada):
- Cada carrossel tem exatamente 5 cards com função comunicativa distinta: abertura (EDUCATIVO) → desenvolvimento (INFORMATIVO) → aprofundamento (INFORMATIVO) → direção (PERSUASIVO) → ação (CONVENCIMENTO).
- Card 1 deve acolher o problema ou aspiração do público sem mencionar a empresa — funciona como espelho empático: nomeia a realidade do receptor, não critica nem julga. PROIBIDO ironia, negatividade ou ambiguidade sobre o tema central da marca no título do card 1; a abertura deve soar como "eu entendo você", não como acusação ou problema criado pela empresa. ${comp.carrossel > 1 ? `Card 5 SÓ pode citar o que a empresa entrega e ter CTA comercial na legenda no carrossel ${comp.carrossel} (o último da sequência) — nos carrosséis anteriores, Card 5 fecha em síntese/direção, sem citar a empresa.` : "Card 5 pode citar o que a empresa entrega e tem CTA na legenda."}
- Cada card: titulo até 6 palavras, ${SILABA_EXCECAO_RULE}, sem ponto final (EXCETO se for pergunta: "?" é obrigatório); texto até 12 palavras terminando com PONTO FINAL (13ª palavra em diante é cortada); imagePrompt próprio. ANCORAGEM CONCRETA nos títulos dos cards: mesmo critério dos estáticos acima (teste "dá para fotografar isso?").
- FORMA DO TÍTULO nos Cards 2-3 (desenvolvimento) — EVIDÊNCIA CONCRETA, NÃO METÁFORA: este é o estágio de evidência da sequência (Dia 2). O TÍTULO dos cards 2 e 3 deve trazer EVIDÊNCIA CONCRETA — um fato, número, situação real ou comparação observável — e NÃO metáfora nem adjetivo de qualidade solto ("redondo", "certo", "sólido", "ideal", "perfeito"). Isto é DIFERENTE da ANCORAGEM CONCRETA — ANTI-SÍMBOLO acima (que trata da tradução VISUAL): aqui é sobre o CONTEÚDO do título em si — evidência vs. metáfora. Ex.: prefira "Folga errada gasta o rolamento" a "Motor redondo pede cuidado certo". OPÇÃO (não obrigação): pode usar formato de lista numerada quando fizer sentido (ex.: "N sinais de que...", "N motivos para..."), mas NÃO é obrigatório nem deve se repetir como fórmula fixa entre gerações — é UMA opção entre várias formas de evidência concreta (dado real, comparação, situação observável, etc.).
- ARCO VISUAL INTERNO DO CARROSSEL — OBRIGATÓRIO: os 5 cards devem ter enquadramento progressivo de câmera, criando narrativa visual de abertura a fechamento. Card 1 (abertura): PLANO ABERTO — personagem e ambiente visíveis, câmera afastada; 'composicao' = "plano aberto". Cards 2-3 (desenvolvimento): PLANO MÉDIO — ação ou objeto em destaque, ângulo engajado; 'composicao' = "plano médio". Card 4 (direção): PLANO MÉDIO-FECHADO — detalhe do trabalho, produto ou gesto; 'composicao' = "plano médio-fechado". Card 5 (ação): CLOSE-UP ou enquadramento íntimo — expressão ou gesto de resolução, câmera mais próxima; 'composicao' = "close-up". PROIBIDO repetir o mesmo enquadramento em cards consecutivos — cada card deve ter distância de câmera diferente do anterior.
- Retornar em "carousel": [{ "sequencia": 1, "legenda": "corpo até ${LEGENDA_CORPO_MAX_WORDS} palavras + CTA até ${LEGENDA_CTA_MAX_WORDS} palavras, terminando com ${LEGENDA_HASHTAGS} hashtags em letra minúscula sem acento (ver REGRA DE LEGENDA)", "cards": [{ "card":1, "titulo", "texto", "imagePrompt", "leituraCenica": { "intencao": "o que este card ativa", "personagem": "quem aparece e o que faz", "ambiente": "onde acontece com detalhes físicos", "expressao": "expressão do personagem", "clima": "luz e atmosfera", "composicao": "enquadramento e distância de câmera (plano aberto / plano médio / plano médio-fechado / close-up) + organização dos elementos" } }, ...] }]
${comp.carrossel > 1 ? `- Gerar ${comp.carrossel} sequências de carrossel com temas complementares, não repetidos.` : ""}
${closingBlock}

REGRA DE LEGENDA (vale para feed estático, carrossel, reels e estático final):
- A legenda tem 3 parágrafos separados por linha em branco. FORMATO OBRIGATÓRIO no JSON (use \\n\\n como separador literal):
  "{corpo da legenda terminando com ponto final.}\\n\\n{CTA curto terminando com ponto final.}\\n\\n#hash1 #hash2 #hash3"
- Parágrafo 1 — corpo: ATÉ ${LEGENDA_CORPO_MAX_WORDS} palavras, terminando com PONTO FINAL. RETOMA o conceito central do título e da imagem — não introduz tema novo nem desconectado da peça (a legenda fecha o ciclo palavra→imagem→palavra). Sem texto explicativo longo, sem repetir o título inteiro. PROIBIDO terminar o corpo com frase no imperativo dirigida ao leitor (ex.: "Compartilhe...", "Salve...", "Acesse...") — isso é função EXCLUSIVA do Parágrafo 2. O corpo só descreve/retoma, nunca convida à ação. PROIBIDO abrir o corpo com "Antes" (ex.: "Antes de comprar...", "Antes era assim...") — é a saída mais previsível pra "retomar e fechar o ciclo", vira contraste antes/depois repetido em toda peça. Varie a abertura: afirmação direta, observação concreta, cena ou pergunta. DIVERSIDADE: os corpos das legendas de Estático, Carrossel e Estático Final/Reels desta MESMA sequência NÃO podem começar com a mesma palavra entre si (mesmo critério de diversidade lexical já exigido para os títulos).
- Parágrafo 2 — CTA: EXATAMENTE 1 frase genérica curta (máx ${LEGENDA_CTA_MAX_WORDS} palavras), terminando com PONTO FINAL. Varie entre as peças. Exemplos: "Salve este post.", "Comente o que achou.", "Compartilhe com quem precisa ver.", "Marque quem precisa ver isso.", "Envie para quem decide isso." PROIBIDO incluir uma 2ª frase ou CTA indireto (ex.: "Acesse a bio...", "Acesse o site...") no mesmo parágrafo ou em parágrafo extra — apenas essa única frase. PROIBIDO o CTA começar com "vem"/"venha" (ex.: "Vem conhecer...", "Venha aproveitar...") — é um clichê publicitário batido demais. Comece com um verbo direto no imperativo: conheça, descubra, aproveite, confira, garanta, agende, peça, experimente, fale com a gente, entre outros.
- Parágrafo 3 — hashtags: EXATAMENTE ${LEGENDA_HASHTAGS}, todas em letra MINÚSCULA, sem acento e sem caracteres especiais, separadas por espaço (ex.: #marketing #comunicacao #estrategia).
- Hashtags coerentes com o segmento e a atividade da marca, nunca genéricas demais ("#instagram", "#post").
- Nunca usar CAPS, nunca mais que ${LEGENDA_HASHTAGS} hashtags, nunca emojis dentro das hashtags, nunca emojis exagerados no corpo ou no CTA.
`
    : "";

  const storiesRules = wantsStories
    ? `
STORIES (CONTEÚDO TEXTUAL, SEM IMAGEM):
- Gerar exatamente ${data.storiesDays} sequência(s), uma por dia.
- Cada sequência deve ter ${data.storiesQuantity} stories.
- Stories não geram imagem no MÉTODO OP V1.
- Vídeo: tom de conversa, 20-30 palavras, uma ideia por story.
- Post textual: frase curta, até 8 palavras.
- A primeira story de cada dia deve ativar a entrada psicológica do segmento (${seg.entrada}).
- Retornar em "stories": [{ "dia", "sequencia", "stories": [{ "ordem", "tipo":"vídeo"|"post", "texto" }] }]
`
    : "";

  const coordinationRules =
    hasFeed && wantsStories
      ? `
MATRIZ DE INTENÇÃO — COORDENAÇÃO FEED ↔ STORIES:
Esta seção só roda porque Feed e Stories foram solicitados juntos.

CONCEITO CENTRAL — INTENÇÃO DO DIA:
Para cada dia N em que existe Feed[dia=N] E Stories[dia=N]:
- Defina internamente UMA única "Intenção do Dia" expressa como VERBO + FOCO.
  Exemplos válidos: "abrir percepção sobre previsibilidade", "romper inércia em organização da rotina".
- Essa intenção é INTERNA ao raciocínio do modelo.
- NUNCA aparece no texto final. NUNCA aparece no JSON de saída.
- Ela é o eixo invisível que amarra Post e Stories daquele dia.

PAPÉIS FIXOS — IMUTÁVEIS:
- Feed (Post do dia N): PLANTA a intenção — apresenta, provoca ou estrutura o tema.
- Stories (do dia N): EXECUTAM a intenção plantada pelo post.
- O Feed NUNCA executa. Os Stories NUNCA plantam. Isso é absoluto.

MODOS DE EXECUÇÃO DOS STORIES:
Os Stories do dia N executam a intenção em EXATAMENTE UM destes três modos,
escolhido conforme o estágio do dia dentro da progressão estratégica geral:
1. APROFUNDAMENTO — detalhar uma camada que o post deixou em superfície. (dias de início do ciclo)
2. CURIOSIDADE — abrir um ângulo que o post não revelou, sem clickbait. (dias de meio do ciclo)
3. CONVERSÃO — traduzir o interesse plantado pelo post em micro-ação concreta, sem CTA agressivo. (dias de fim do ciclo)

QUANDO OS DIAS NÃO BATEM:
- A coordenação só se aplica aos dias com sobreposição (Feed[dia=N] + Stories[dia=N] existem juntos).
- Dias de Stories sem post correspondente: seguem progressão de stories independente.
- Dias de Feed sem story correspondente: seguem progressão de feed independente.

PROIBIÇÕES DURAS — VIOLAÇÃO DESTRÓI A ESTRATÉGIA:
1. PROIBIDO o Story ser reescrita, paráfrase ou resumo do Post do mesmo dia.
2. PROIBIDO usar o mesmo título, mesma frase de abertura ou mesmo exemplo do post correspondente.
Essas proibições forçam o Story a entrar por outro ângulo, mesmo tratando do mesmo tema.

RESUMO OPERACIONAL:
Para cada dia com Feed + Stories: defina internamente a intenção (verbo + foco) → Feed planta → Stories executam por APROFUNDAMENTO, CURIOSIDADE ou CONVERSÃO — nunca por repetição.
`
      : "";

  const outputKeys = (() => {
    const parts: string[] = ['"ancora_visual"'];
    if (hasFeed) {
      parts.push('"feed"', '"carousel"');
      if (!isVisualOrExperimentacao) parts.push('"reels"');
    }
    if (wantsStories) parts.push('"stories"');
    return parts.join(", ");
  })();

  const mainActivity = (data.mainActivity || "").trim();
  const keyInfo = (data.keyInfo || "").trim();
  const voiceProfile = getVoiceProfile(data.brandVoice);

  const activityLine = mainActivity
    ? `- Atividade principal: ${mainActivity}
  → Use a atividade para escolher cenários, objetos em cena, vocabulário do setor e exemplos concretos. Proibido cenários genéricos quando a atividade for específica.`
    : "";

  const keyInfoBlock = keyInfo
    ? `
EIXO OBRIGATÓRIO DA SEQUÊNCIA — INFORMAÇÃO-CHAVE:
"${keyInfo}"
- TODA peça (estáticos, carrosséis e ${isVisualOrExperimentacao ? "estáticos finais" : "reels"}) deve orbitar este eixo.
- O eixo determina o ÂNGULO de cada post dentro da progressão psicológica — não substitui a progressão.
- O fechamento da sequência deve consolidar a decisão em torno deste eixo.
- Proibido peça que não se conecte de forma evidente ao eixo.
- ANCORAGEM CONCRETA DO EIXO: a informação-chave nomeia um elemento concreto (produto, peça, serviço, canal, procedimento ou situação) — esse elemento, ou sinônimo direto, deve aparecer no título OU no texto do PRIMEIRO Estático E do Estático Final/última peça — abertura e fechamento da sequência precisam ser reconhecíveis como sendo sobre esse elemento, não sobre um tema genérico do segmento. As peças intermediárias podem tratar o eixo de forma mais abstrata.
- ABERTURA E FECHAMENTO NÃO PODEM SOAR COMO A MESMA FRASE: ancorar o mesmo elemento concreto no título do primeiro Estático e no título do Estático Final/última peça NÃO significa repetir a mesma estrutura com só o verbo final trocado (ex.: "[elemento] ativa" / "[elemento] resolve" são a MESMA frase disfarçada — proibido). Se as duas peças ancoram o elemento no TÍTULO, os títulos precisam ter sujeito, estrutura sintática e ângulo claramente diferentes (não apenas o verbo). Alternativa preferível: uma das duas peças ancora o elemento no TEXTO (não no título), liberando o título para um ângulo totalmente distinto — observação/contexto na abertura, decisão/convite no fechamento (conforme a função comunicativa de cada peça, ver mapa de funções acima).
- VOCABULÁRIO-POR-PÚBLICO NA ANCORAGEM: ao repetir o elemento concreto do eixo (ou sinônimo direto) no título/texto de abertura e fechamento, use o termo na forma como o PÚBLICO-ALVO desta peça (${isB2B ? "decisor empresarial — gestor, diretor ou responsável pela área" : "consumidor final — cliente do cliente"}) o reconheceria no dia a dia — não a forma como o segmento, o fornecedor ou o redator o nomeiam internamente. Sigla ou termo técnico (ex.: TEF, ERP, KPI, NF-e) É a forma CORRETA quando esse é o vocabulário natural do público-alvo desta peça — ${isB2B ? "como neste caso, em que o público é o decisor empresarial: se o ofício/rotina dele envolve o termo, use a sigla sem medo, sem traduzir nem explicar — traduzir aqui empobreceria a precisão e soaria condescendente" : "mas o público desta peça é o consumidor final, que normalmente NÃO usa siglas internas de fornecedor/segmento no dia a dia — só mantenha a sigla se ela for genuinamente parte do vocabulário cotidiano desse consumidor; caso contrário, prefira o termo que ele de fato usaria"}. Só traduza/explique/substitua quando a sigla pertencer a um vocabulário interno do fornecedor ou do segmento que o público-alvo desta peça especificamente NÃO usaria no dia a dia. Nunca proíba um termo técnico legítimo só por ser sigla — o critério é exclusivamente: o público-alvo DESTA peça reconhece e usa esse termo?
- EXCEÇÃO AO ITEM 8 (PROIBIDO REPETIR A MESMA PALAVRA): o NOME do produto/serviço/objeto concreto do eixo — o SUBSTANTIVO-NÚCLEO apenas (ex.: "poltrona", "correia", "mangueira", "ordem de serviço") — é EXCEÇÃO à regra de não-repetição — pode e deve se repetir, com a MESMA palavra, em todas as peças que tratarem desse elemento. "Sinônimo direto" acima significa variação morfológica do mesmo item (singular/plural: "poltrona"/"poltronas") ou termo realmente equivalente no uso comum — NUNCA outro produto da mesma categoria ("poltrona"→"cadeira", "armário"→"estante", "mangueira"→"cano" são produtos DIFERENTES, e trocar um pelo outro muda o que está sendo vendido). ESTA EXCEÇÃO NÃO COBRE adjetivos ou qualificadores que acompanham o núcleo na informação-chave original (ex.: se a informação-chave diz "ordem de serviço DIGITAL", o adjetivo "digital" NÃO é parte do núcleo protegido — repeti-lo colado ao núcleo em mais de uma peça da sequência é exatamente o tipo de repetição que o item 8 proíbe, e costuma ser o que faz duas peças parecerem a mesma frase). A regra de não-repetição (item 8) e a diversidade lexical continuam valendo para o restante do vocabulário — verbos, adjetivos, conectores — ao redor desse núcleo.
`
    : "";

  const voiceBlock = voiceProfile
    ? `DIREÇÃO DE VOZ — "${voiceProfile.label}":
- Ritmo: ${voiceProfile.ritmo}
- Vocabulário: ${voiceProfile.vocabulario}
- Registro: ${voiceProfile.registro}
- Evitar: ${voiceProfile.evitar}
- Calibração de abertura (referência interna, NÃO copiar literalmente): "${voiceProfile.exemploAbertura}"
A voz se aplica a TODOS os títulos, textos, legendas, cards de carrossel, screenText e roteiro de reels — sem exceção.
Proibido mencionar literalmente o nome da voz no texto final.`
    : `Voz da marca: ${data.brandVoice || "padrão do segmento"}.
A voz governa ritmo, vocabulário e registro emocional.
Proibido mencionar literalmente a voz no texto final.`;

  const progressionStages = progressionText.split(" → ");
  const communicativeFunctionsMap = buildCommunicativeFunctionMap(
    comp,
    isVisualOrExperimentacao,
    progressionStages,
  );
  // EMISSOR foi extraído deste bloco (ver `emissorLine`, concatenada lá no
  // fim do prompt junto do resto do CONTEXTO) — texto idêntico, só a posição
  // mudou. Motivo: companyName é livre/único por chamada; mantê-lo aqui
  // quebrava o prefixo do prompt logo no início de "ANÁLISE INTERNA",
  // impedindo o prompt caching da OpenAI de reaproveitar nada depois dele.
  const emissorLine = `EMISSOR: ${data.companyName} — fala com voz própria e consistente. Não precisa ser nomeada em cada peça: a coerência de voz, os exemplos concretos da atividade e o eixo da keyInfo identificam o emissor. Nomear a empresa repetidamente torna a comunicação fraca.`;
  const mercadologicalFrameBlock = `10. FRAME DE COMUNICAÇÃO MERCADOLÓGICA:
RECEPTOR: ${isB2B ? "decisor empresarial" : "consumidor final"} — situação atual: "${seg.entrada}" / bloqueio a superar: "${seg.bloqueio}".
INTENÇÃO: conduzir o receptor da situação atual até a decisão de escolher esta empresa — usando educação, informação, inspiração, persuasão e convencimento como ferramentas progressivas e distintas.
FUNÇÕES COMUNICATIVAS POR PEÇA:
${communicativeFunctionsMap}
REGRA: cada peça cumpre a FORMA indicada acima — CTA e menção à empresa só onde a FORMA expressamente permitir.`;

  // Mesma extração de `emissorLine` acima: texto idêntico ao que já existia
  // dentro de ÂNCORA NARRATIVA, só deslocado para o bloco de CONTEXTO no
  // final do prompt (mainActivity é texto livre por chamada).
  const ancoraDataLine = `Segmento: ${data.segment} | Público: ${isB2B ? "B2B" : "B2C"} | Atividade: ${mainActivity || "não informada"}`;

  const titleSyntaxRule = `11. SUJEITO DO TÍTULO — LIBERDADE GRAMATICAL COM FUNÇÃO: qualquer classe gramatical da língua portuguesa pode exercer função de sujeito quando substantivada — substantivo (concreto ou abstrato), adjetivo, verbo no infinitivo, advérbio, numeral, pronome ou locução. Exemplos de abertura válidos: "O melhor…", "A solução…", "A saudade…", "Decidir…", "Cuidar…", "O que define…". O título CUMPRE A FORMA do seu estágio (ver FUNÇÕES COMUNICATIVAS POR PEÇA): entrega observação, critério, prova, posicionamento ou convite — nunca descreve o leitor de fora. PROIBIDO: (a) construção passiva sem agente (ex.: "Operações sem atrasos garantidas", "Entrega sem falhas comprovada" — sem quem age); (b) abrir o título nomeando o leitor de fora — "Quem decide…", "Gestores…", "Decisores…", "A equipe…", "Quem cuida…", "Quem usa…" + verbo descritivo. VARIE o sujeito entre pessoas, conceitos abstratos, verbos substantivados e qualificadores.`;

  return `Você é o motor estratégico do MÉTODO OP. Retorne SOMENTE JSON válido, sem markdown, sem comentários.
${trackHeader}
ÂNCORA NARRATIVA DA SEQUÊNCIA — DEFINIR ANTES DE GERAR QUALQUER PEÇA:
Defina UMA VEZ o fio condutor visual desta sequência. Essa âncora guia APENAS as peças em que a IA gera imagem sem referência real do cliente (avatar, cenário ou produto enviado). Quando houver referência real, ela prevalece sobre a âncora.
PRINCÍPIO DE COMUNICAÇÃO — RECEPTOR, NÃO EMISSOR: em SERVIÇOS e MARCA, o personagem-padrão da âncora é o PÚBLICO-ALVO (o receptor da comunicação) — nunca a empresa/profissional/dono (o emissor). Mostrar o emissor é uma quebra de padrão deliberada que o usuário faz ao enviar um avatar de referência real para uma peça específica; a âncora nunca deve inventar esse emissor como personagem-padrão.
Regras por segmento:
- SERVIÇOS: personagem é o público-alvo vivendo o contexto ou o benefício do serviço, papel = "publico_alvo"
- MARCA: personagem é o público-alvo se conectando com a identidade ou a solução da marca, papel = "publico_alvo"
- VAREJO: PRODUTO é o protagonista — personagem aparece apenas como contexto de uso (quem usa o item), papel = "contexto_de_uso"; a âncora NÃO transforma a pessoa em centro da cena quando o foco deve ser o produto
Critérios de gênero: B2B industrial/técnico/construção/logística → M preferencialmente; B2B serviços/saúde/educação/gestão → quem usa mais o serviço; B2C beleza/estética/moda/bem-estar → F preferencialmente; B2C geral → comprador típico do produto; MARCA → o público-alvo típico da marca. Se atividade ou keyInfo mencionar "mulheres" ou "homens" como público → seguir à risca.
A âncora NÃO força humano em todo card — apenas garante que quando uma pessoa aparecer, seja sempre o mesmo tipo de personagem (o público-alvo, exceto em VAREJO), mantendo coerência visual da sequência.
Retornar em "ancora_visual": { "genero": "M" ou "F", "papel": "publico_alvo" ou "contexto_de_uso", "faixa_etaria": "ex: 35–45 anos", "marcadores_profissionais": "ex: roupa casual do dia a dia, postura natural e atenta", "ambiente_base": "ex: ambiente cotidiano coerente com onde o público vive ou usa a solução" }

ANÁLISE INTERNA — NÃO EXIBIR NO TEXTO FINAL:
1. Ponto de entrada do público: ${seg.entrada}
2. Bloqueio inicial típico: ${seg.bloqueio}
3. Progressão interna obrigatória: ${progressionText}
4. Modulação do momento: ${moment.entryModifier}
5. Palavras proibidas no conteúdo final: ${prohibitedWords}
6. Proibido usar termos da metodologia: pensar, fazer, agir, destravamento, bloco inicial, bloco intermediário, bloco final, progressão, entrada, matriz.
7. PROIBIDO ABSOLUTO mencionar os nomes dos moods/templates internos em QUALQUER campo de texto exibido (titulo, texto, legenda, hook, screenText, script, cards do carrossel). Palavras BANIDAS no conteúdo final: "clareza", "claro", "claras", "claros", "impacto", "impactos", "impactar", "impactante", "instante", "instantes", "instantâneo", "fragmento", "fragmentos", "fragmentado", "desvio", "desvios", "desviar", "silêncio", "silêncios", "silencioso", "silenciosa", "silenciar", "OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06", "mood", "moods", "template OP". Use SEMPRE sinônimos ou perífrases. Ex.: em vez de "clareza" → "direção definida", "leitura simples", "entendimento sem ruído"; em vez de "impacto" → "efeito imediato", "marca forte"; em vez de "silêncio" → "pausa", "respiro"; em vez de "instante" → "momento", "agora"; em vez de "fragmento" → "recorte", "pedaço"; em vez de "desvio" → "outro caminho", "ângulo inesperado".
8. PROIBIDO repetir a mesma palavra OU qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue — todas proibidas juntas no mesmo texto) em frases próximas ou consecutivas. Use sinônimos ou reformule completamente. Ex. a evitar: "O digital traz mais alcance. Quer mais? Venha saber mais." — correto: "O digital amplia seu alcance. Quer crescer? Conheça nossa solução."
9. Respeitar rigorosamente as normas gramaticais e ortográficas do português brasileiro: concordância nominal e verbal, pontuação correta, acentuação gráfica conforme o Acordo Ortográfico vigente. Nenhum erro de gramática, ortografia ou regência será tolerado em nenhum campo do JSON.
${mercadologicalFrameBlock}
${titleSyntaxRule}

DIREÇÃO DE LINGUAGEM:
- ${audienceDirection}${faixaDirection ? `\n- ${faixaDirection}` : ""}
${voiceBlock}

REGRA DE VENDA:
${vendaRule}

${feedRules}
${storiesRules}
${coordinationRules}
${
  hasFeed
    ? `
⚠️ COMPLETUDE OBRIGATÓRIA — VERIFIQUE ANTES DE RETORNAR:
Esta sequência DEVE conter EXATAMENTE:
□ "ancora_visual": objeto com genero, papel, faixa_etaria, marcadores_profissionais, ambiente_base — OBRIGATÓRIO, deve ser a PRIMEIRA chave do JSON
□ "feed": ${comp.estatico} estático${comp.estatico > 1 ? "s" : ""} (formato "Estático")${isVisualOrExperimentacao ? ` + ${comp.fechamento} estático${comp.fechamento > 1 ? "s" : ""} final (formato "Estático Final")` : ' — fechamento vai em "reels", não em "feed"'}
□ "carousel": ${comp.carrossel * 5} cards preenchidos (${comp.carrossel} sequência${comp.carrossel > 1 ? "s" : ""} × 5 cards) — PROIBIDO retornar "carousel": []${!isVisualOrExperimentacao ? `\n□ "reels": ${comp.fechamento} guia${comp.fechamento > 1 ? "s" : ""} com hook + screenText + script + imagePrompt + legenda` : ""}
Cada peça: titulo + texto + legenda + imagePrompt — TODOS preenchidos. Resposta incompleta quebra a sequência do usuário.
`
    : ""
}
CONTEXTO:
- Empresa: ${data.companyName}
- Segmento: ${data.segment}
- Público-alvo: ${isB2B ? "B2B (empresas e decisores empresariais)" : "B2C (consumidor final)"}
${activityLine}
- Momento do negócio: ${moment.contextNote}
${keyInfoBlock}
${ancoraDataLine}
${emissorLine}
${buildVisualDirectionBlock(data.mood, data.segment, variacaoSeed)}

DIRETRIZES VISUAIS PARA CAMPOS DE IMAGEM:
${buildSceneRoleRule()}
PRINCÍPIO-RAIZ — CICLO DA PALAVRA: a imagem responde ao título. Antes de descrever imagePrompt e leituraCenica, identifique o núcleo do título (sujeito + verbo/promessa central) e garanta que a cena o torne visível. A legenda fecha o ciclo retomando esse conceito. A imagem NUNCA pode negar o que o título afirma.
- A cena deve traduzir estrategicamente o sentido do título e do texto, identificando o que o público-alvo vive na mensagem (ver PERSONAGEM-PADRÃO DA CENA acima) e a ação concreta que produz esse benefício — metáforas do título não se convertem automaticamente em cena física literal.
- Quando o núcleo do título for um conceito abstrato (sucesso, união, força, resultado, crescimento, ganho), NÃO o represente por objeto-metáfora (engrenagem, peão de madeira, xadrez, balança, troféu, seta). Traduza em PESSOAS reais vivendo a ação concreta que PRODUZ aquele conceito, com o público-alvo como protagonista — ex.: "união" → cliente decidindo lado a lado com quem o atende, numa mesa real; "crescimento" → cliente acompanhando a evolução dos próprios resultados.
- Pessoas em cena são regra quando houver cliente, profissional, decisor, problema vivido ou ação humana; para Reels, isso significa exatamente UMA pessoa, nunca grupo.
- Proibido: distorções anatômicas, texto dentro da imagem, logomarca inventada, interfaces irreais, gráficos flutuantes, lâmpadas, setas como símbolo de crescimento, Post-it com ícones de negócios, engrenagens e handshake genérico.
- Regra de dispositivos digitais (notebook, celular, tablet etc.) no imagePrompt e na leituraCenica: ver "REGRA DE DISPOSITIVOS DIGITAIS" acima — vale igualmente aqui.
- Estático e Carrossel: composição vertical 1080x1350.
- Estático Final: composição vertical 1080x1350, com mais respiro, menos ruído e foco centralizado.
${!isVisualOrExperimentacao ? "- Reels: composição vertical 1080x1920, imagem pura sem texto, sem logo, sem colagem e com somente uma pessoa no quadro." : ""}
- Sufixo técnico OBRIGATÓRIO ao final de cada imagePrompt (substitui qualquer sufixo genérico): "${getMoodSignature(data.mood)}".

INEDITISMO CONTROLADO:
- Não repetir estruturas de abertura.
- Alternar pergunta, afirmação, contraste, exemplo cotidiano e micro narrativa.
- Priorizar linguagem concreta, cotidiana e específica da atividade.
${TECNICISMO_RULE}
- Evitar clichês: descubra, saiba mais, transforme, segredo, incrível.

FORMATO DE SAÍDA:
Retorne EXCLUSIVAMENTE estas chaves: ${outputKeys}.
A primeira chave do JSON DEVE ser "ancora_visual" — defina o personagem-tipo ANTES de gerar qualquer peça de conteúdo.
`;
}

// Normalização da resposta da IA — extraída para normalizeMethodResult.ts
export { normalizeMethodResult } from "./normalizeMethodResult";
