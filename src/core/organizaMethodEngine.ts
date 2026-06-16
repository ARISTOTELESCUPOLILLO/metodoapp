import { ContentFormData, MethodOpResult, FeedItem, GenerationSummary, Track, ValidationFlag } from '../types';
import { getVoiceProfile } from '../data/brandVoice';
import { buildVisualDirectionBlock, getMoodSignature, buildSceneRoleRule } from './visualDirection';
import { truncateWords, validatePieceFields, normalizeLegenda, enforceLegendaLimits, checkObserverSubject, checkCrossPieceLabelRepeat, correctPortugueseSpelling } from './textValidation';

interface MomentModulator {
  label: string;
  entryModifier: string;
  securityAngle: string;
  storyEntryModifier: string;
  contextNote: string;
}

const momentModulators: Record<string, MomentModulator> = {
  'lançamento': {
    label: 'Lançamento',
    entryModifier: 'modulada por DESCOBERTA e NOVIDADE — o 1º conteúdo apresenta o que ainda não é percebido pelo público, despertando curiosidade legítima sobre algo novo.',
    securityAngle: 'ancorada na previsibilidade e clareza da adoção do que está sendo introduzido (reduzir incerteza diante do novo)',
    storyEntryModifier: 'modulada por descoberta e novidade — abrir o dia revelando algo que o público ainda não percebeu sobre o tema.',
    contextNote: 'Lançamento (empresa nova ou novo produto/serviço — ativação via descoberta)',
  },
  'consolidação': {
    label: 'Consolidação',
    entryModifier: 'ativação padrão da entrada do segmento, sem modulação adicional — reforçar autoridade e prova sobre o que já é percebido.',
    securityAngle: 'ancorada em estabilidade comprovada e previsibilidade operacional consolidada',
    storyEntryModifier: 'ativação padrão da entrada do segmento, aplicada ao contexto do negócio.',
    contextNote: 'Consolidação (operação estável buscando crescer — ativação padrão do segmento)',
  },
  'reativação': {
    label: 'Reativação',
    entryModifier: 'modulada por RECONEXÃO e RELEVÂNCIA RENOVADA — reabre uma conversa que ficou em aberto, recuperando a atenção de quem já conhece mas se afastou.',
    securityAngle: 'ancorada em reduzir o risco percebido de retomar (mostrar que o caminho de volta é seguro e previsível)',
    storyEntryModifier: 'modulada por reconexão — abrir o dia reativando uma percepção que pode ter esfriado no público.',
    contextNote: 'Reativação (cliente parado, retomada após pausa — ativação via reconexão)',
  },
  'sazonalidade': {
    label: 'Sazonalidade',
    entryModifier: 'modulada pelo CONTEXTO TEMPORAL VIGENTE — ancora a entrada no momento atual (data, temporada, ciclo), conectando a oferta ao agora.',
    securityAngle: 'ancorada na previsibilidade de aproveitar o momento certo, sem improviso',
    storyEntryModifier: 'modulada pelo contexto temporal — abrir o dia ancorando o tema no momento sazonal vigente.',
    contextNote: 'Sazonalidade (data comemorativa ou alta/baixa temporada — ativação ancorada no agora)',
  },
};

const segmentConfigB2C = {
  'SERVIÇOS': { entrada: 'clareza e organização mental', bloqueio: 'confusão e desconfiança' },
  'VAREJO':   { entrada: 'identificação e movimento',   bloqueio: 'indecisão e inércia' },
  'MARCA':    { entrada: 'reconhecimento e vínculo',    bloqueio: 'desconexão e falta de familiaridade' },
} as const;

const segmentConfigB2B = {
  'SERVIÇOS': { entrada: 'eficiência e previsibilidade operacional', bloqueio: 'risco de mudança e falta de referências' },
  'VAREJO':   { entrada: 'margem e giro de estoque',                 bloqueio: 'custo de troca e incerteza de demanda' },
  'MARCA':    { entrada: 'posicionamento e diferenciação no mercado', bloqueio: 'comoditização e falta de percepção de valor' },
} as const;

const SEQUENCE_COMPOSITION = {
  3: { estatico: 1, carrossel: 1, fechamento: 1 },
  6: { estatico: 2, carrossel: 2, fechamento: 2 },
  9: { estatico: 3, carrossel: 3, fechamento: 3 },
};

function buildPostProgression(qty: number, entrada: string, isB2BOperational: boolean, moment: MomentModulator): string {
  const ativacao = isB2BOperational
    ? `Ativação da ENTRADA (${entrada}) via gatilho de SEGURANÇA ${moment.securityAngle}: enfatizar estabilidade, proteção, previsibilidade operacional, redução de incerteza e controle de processo. Modulação do momento "${moment.label}": ${moment.entryModifier}`
    : `Ativação da ENTRADA: ${entrada}, aplicada ao contexto real do negócio. Modulação do momento "${moment.label}": ${moment.entryModifier}`;

  const segurancaNote = isB2BOperational
    ? ' → Como o início já ativou Segurança, esta etapa deve aprofundar com provas concretas. NÃO repetir estabilidade/proteção.'
    : '';

  if (qty === 1) return `- Post 1: ${ativacao}`;
  if (qty === 2) return `- Post 1: ${ativacao}\n- Post 2: Confiança e autoridade`;
  if (qty === 3) return `- Post 1: ${ativacao}\n- Post 2: Confiança e segurança${segurancaNote}\n- Post 3: Autoridade e ação`;
  return `- Post 1: ${ativacao}\n- Post 2: Amplia o contexto\n- Post 3: Aplica entendimento\n- Post 4: Segurança${segurancaNote}\n- Post 5: Confiança ou autoridade\n- Post 6: Conduz à ação`;
}

function buildCommunicativeFunctionMap(
  comp: { estatico: number; carrossel: number; fechamento: number },
  isVisualOrExperimentacao: boolean,
  progressionStages: string[]
): string {
  const fnMap: Record<string, { label: string; desc: string }> = {
    'IDENTIFICAÇÃO':  { label: 'EDUCATIVO + INSPIRACIONAL', desc: 'FORMA observação-espelho: nomeia a realidade do público — a marca entende, não vende' },
    'RECONHECIMENTO': { label: 'INSPIRACIONAL',             desc: 'FORMA afirmação de identidade: revela a marca — sem CTA, sem argumento comercial' },
    'DESEJO':         { label: 'INSPIRACIONAL',             desc: 'FORMA cena desejável: mostra o que passa a ser possível — sem pressionar' },
    'ENTENDIMENTO':   { label: 'EDUCATIVO + INFORMATIVO',   desc: 'FORMA observação-espelho: nomeia o contexto ou problema que o receptor vive' },
    'SEGURANÇA':      { label: 'INFORMATIVO + PERSUASIVO',  desc: 'FORMA critério prático: entrega um ponto de avaliação concreto que o receptor já pode usar' },
    'CONFIANÇA':      { label: 'PERSUASIVO',                desc: 'FORMA prova/consequência: mostra o resultado observável de aplicar esse critério' },
    'AUTORIDADE':     { label: 'PERSUASIVO',                desc: 'FORMA afirmação de domínio: posiciona o que a marca entrega — pode citar resultados e diferenciais' },
    'AGIR':           { label: 'CONVENCIMENTO',             desc: 'FORMA convite consultivo: indica o próximo passo — pode nomear o que a empresa oferece' },
  };

  const lines: string[] = [];

  for (let i = 0; i < comp.estatico; i++) {
    const stage = progressionStages[i] || progressionStages[0];
    const fn = fnMap[stage] || { label: 'EDUCATIVO + INFORMATIVO', desc: 'contextualiza e informa' };
    lines.push(`Estático ${i + 1} [${stage}] → ${fn.label}: ${fn.desc}`);
  }

  if (comp.carrossel > 0) {
    lines.push(
      `Carrossel — arco interno de 5 cards:`,
      `  Card 1 (abertura)            → EDUCATIVO — FORMA observação-espelho: nomeia o problema ou aspiração que o público reconhece, sem citar a empresa`,
      `  Cards 2-3 (desenvolvimento)  → INFORMATIVO — FORMA critério/prova concreta: detalha com evidência real da atividade, um ponto de avaliação por card`,
      `  Card 4 (direção)             → PERSUASIVO — FORMA indicação de caminho: aponta a direção a seguir — sem CTA, sem nomear a empresa`,
      `  Card 5 (ação)                → CONVENCIMENTO — FORMA convite consultivo: consolida e indica o próximo passo — pode citar o que a empresa entrega`
    );
  }

  const fechamentoTipo = isVisualOrExperimentacao ? 'Estático Final' : 'Reels';
  if (comp.fechamento > 0) {
    lines.push(`${fechamentoTipo} → CONVENCIMENTO — FORMA convite consultivo + resolução: consolida a progressão e indica o próximo passo — pode nomear o que a empresa oferece. Tom consultivo, sem pressão artificial.`);
  }

  return lines.join('\n');
}

export function buildMetodoOpPrompt(data: ContentFormData): string {
  const isB2B = data.audience === 'B2B';
  const segConfig = isB2B ? segmentConfigB2B : segmentConfigB2C;
  const seg = segConfig[data.segment];
  const moment = momentModulators[data.businessMoment] || momentModulators['consolidação'];
  const isB2BOperational = isB2B && (data.segment === 'SERVIÇOS' || data.segment === 'VAREJO');
  const wantsStories = data.outputMode === 'stories' || data.outputMode === 'feed+stories';
  const hasFeed = data.outputMode === 'feed' || data.outputMode === 'feed+stories';

  const track: Track = data.track || 'cinematica';
  const isVisual = track === 'visual';
  const isExperimentacao = track === 'experimentacao';
  const isVisualOrExperimentacao = isVisual || isExperimentacao;

  const requestedSize = (data.sequenceSize || 6) as 3 | 6 | 9;
  const size: 3 | 6 | 9 = isExperimentacao ? 3 : requestedSize;
  const comp = SEQUENCE_COMPOSITION[size];

  const progressionText = isB2B
    ? 'ENTENDIMENTO → CONFIANÇA → SEGURANÇA → AUTORIDADE → AGIR'
    : data.segment === 'VAREJO'
      ? 'IDENTIFICAÇÃO → DESEJO → SEGURANÇA → CONFIANÇA → AGIR'
      : data.segment === 'MARCA'
        ? 'RECONHECIMENTO → IDENTIFICAÇÃO → SEGURANÇA → CONFIANÇA → AGIR'
        : 'ENTENDIMENTO → SEGURANÇA → CONFIANÇA → AUTORIDADE → AGIR';

  const audienceDirection = isB2B
    ? 'Conteúdo SEMPRE para o decisor empresarial (gestor, diretor ou responsável pela área), NUNCA para o consumidor final.'
    : 'Conteúdo SEMPRE para o consumidor final (cliente do cliente), NUNCA para o empresário.';

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
    ? `${size} peças no total: ${comp.estatico} estático${comp.estatico > 1 ? 's' : ''} + ${comp.carrossel} carrossel${comp.carrossel > 1 ? 'is' : ''} + ${comp.fechamento} estático${comp.fechamento > 1 ? 's' : ''} final${comp.fechamento > 1 ? 'is' : ''}`
    : `${size} peças no total: ${comp.estatico} estático${comp.estatico > 1 ? 's' : ''} + ${comp.carrossel} carrossel${comp.carrossel > 1 ? 'is' : ''} + ${comp.fechamento} reels`;

  const reelsBlock = `
REELS (${comp.fechamento} guia${comp.fechamento > 1 ? 's' : ''} de produção):
- Cada Reels: até 15 segundos, imagem PURA (sem texto, sem logo), sempre com UMA ÚNICA PESSOA adulta como porta-voz.
- O imagePrompt do Reels DEVE descrever uma FOTO ÚNICA, sem colagem, sem sequência de quadros, sem reunião e sem várias pessoas.
- Se a ideia envolver clientes, equipe, reunião ou atendimento, traduza visualmente para uma pessoa sozinha olhando para a câmera.
- Campo "hook": título editorial do reels, NO MÁXIMO 6 palavras, cada palavra com no máximo 3 sílabas (EXCETO o substantivo concreto central da informação-chave — produto, peça, serviço, objeto ou procedimento — que pode ter mais sílabas quando essencial para clareza, ex.: "equipamento", "manutenção", "lubrificante", "orçamento", "diagnóstico", "estratégia"). Sem ponto final — EXCETO se for pergunta (direta ou retórica): nesse caso "?" é obrigatório (ex.: "Por que isso acontece?", "O que está faltando?").
- Texto de tela em "screenText", frase curta até 7 palavras.
- Roteiro falado (campo "script"): ESTRUTURA em 2 partes — (1) mensagem principal de 14 a 16 palavras curtas + ponto final + (2) CTA genérico de 5 a 6 palavras. TOTAL: 19 a 22 palavras → ~7 segundos em voz.
  CTA OBRIGATORIAMENTE GENÉRICO — varie a cada geração, escolha entre: "Fale com a gente hoje.", "Entre em contato agora.", "Venha saber mais.", "Comece ainda hoje.", "Fale conosco agora.", "Dá pra começar hoje.", "A gente te ajuda.", "Vem com a gente.", "O primeiro passo é seu.", "Bora dar o próximo passo." — ou crie outro de mesmo tom. PROIBIDO mencionar canal específico: NUNCA use as palavras site, WhatsApp, Instagram, telefone, link, e-mail, acesse, clique, siga, baixe, cadastre.
- REGRA TTS — campo "script" (será LIDO em voz alta por sintetizador): USE palavras de 1 ou 2 sílabas sempre que possível. PROIBIDO: palavras com mais de 3 sílabas, siglas em caixa alta (APP→"app", CRM→"sistema", ROI→"retorno", KPI→"meta", IA→"inteligência"), anglicismos crus (link, lead, brief, deadline, framework), abreviações (vc, tb, p/). TRADUZA termos difíceis: "consultoria"→"apoio"; "estratégia"→"plano"; "posicionamento"→"presença". Exemplo correto (21 palavras, ~7s): "Sua marca fala. Seu time entrega. Seu cliente volta. É assim que se cresce. Fale com a gente hoje." O campo "screenText" PODE conter sigla (é lido com os olhos), mas o "script" NÃO PODE — precisa fluir natural em voz alta em português brasileiro.
- Retornar em "reels": [{ "sequencia": 1, "hook", "screenText", "script", "imagePrompt", "legenda": "corpo até 35 palavras + CTA até 5 palavras, terminando com 3 hashtags em letra minúscula sem acento (ver REGRA DE LEGENDA)" }]
${comp.fechamento > 1 ? `- Gerar ${comp.fechamento} reels com abordagens visuais distintas.` : ''}`;

  const estaticoFinalBlock = `
ESTÁTICO FINAL (${comp.fechamento} peça${comp.fechamento > 1 ? 's' : ''} de fechamento narrativo):
- O Estático Final NÃO é um estático comum nem um reel congelado.
- É um formato HÍBRIDO de fechamento visual com função psicológica própria: consolidação, resolução visual, fechamento emocional, organização da decisão.
- Função na sequência: encerrar o ciclo narrativo aberto pelo estático e desenvolvido pelo carrossel.
- Cada Estático Final: título com NO MÁXIMO 6 palavras, cada palavra com no máximo 3 sílabas (EXCETO o substantivo concreto central da informação-chave — produto, peça, serviço, objeto ou procedimento — que pode ter mais sílabas quando essencial para clareza, ex.: "equipamento", "manutenção", "lubrificante", "orçamento", "diagnóstico", "estratégia"), sem ponto final (EXCETO se for pergunta: "?" é obrigatório); texto com NO MÁXIMO 15 palavras terminando com PONTO FINAL (16ª palavra em diante é cortada); legenda com corpo até 35 palavras e CTA até 5 palavras, terminando com 3 hashtags em letra minúscula (ver REGRA DE LEGENDA).
- O TÍTULO do Estático Final deve carregar resolução, não provocação. Frase de conclusão, não de abertura. O elemento concreto da Informação-chave PODE e DEVE ser reconhecível aqui — reaparecer como prova da decisão tomada é a própria função do fechamento (a sequência é acompanhada dia a dia como uma história; o Estático Final fecha o ciclo que o Estático inicial abriu). O que NÃO pode se repetir é o BENEFÍCIO/GANHO: se o título reescreve a Informação-chave trocando só 2-3 palavras por sinônimos do mesmo benefício (ex.: Informação-chave fala em "manter produção ativa" → título final repetir "produção ativa" é fraco), troque por um ganho que só a resolução revela — o que essa decisão PASSA A SIGNIFICAR para quem a tomou (confiança, tranquilidade, decisão certa, rotina resolvida) — não o que o produto/serviço já prometia desde o início.
- O TEXTO deve consolidar a direção da sequência em uma afirmação clara e estável.
- A IMAGEM deve traduzir literalmente o título e o texto, com cena de calma, foco e estabilidade — não tensão, não movimento.
- Retornar dentro do array "feed" com formato exato "Estático Final" (com acento e espaço, exatamente assim).
- Estrutura de cada item: { "dia", "formato": "Estático Final", "titulo", "texto", "legenda", "imagem", "leituraCenica": { "intencao": "sensação de fechamento que esta peça consolida", "personagem": "quem aparece na cena, em postura de calma e direção definida", "ambiente": "ambiente estável, com poucos elementos competindo pela atenção", "expressao": "expressão serena, decidida, sem dramaticidade", "clima": "luz suave, atmosfera de resolução, hora estável do dia", "composicao": "composição centralizada ou em equilíbrio claro, com espaço negativo amplo, sem ruído gráfico" } }
${comp.fechamento > 1 ? `- Gerar ${comp.fechamento} Estáticos Finais com abordagens narrativas distintas, cada um fechando uma camada diferente da sequência.` : ''}`;

  const closingBlock = isVisualOrExperimentacao ? estaticoFinalBlock : reelsBlock;

  // ⚠️ REGRA DE TRILHA — bloco crítico, posicionado NO TOPO do prompt para máxima prioridade.
  // Linguagem absoluta e instrução negativa explícita são mais eficazes que descrições suaves.
  const trackHeader = isVisualOrExperimentacao
    ? `
⚠️ TRILHA ${isExperimentacao ? 'EXPERIMENTAÇÃO' : 'VISUAL'} — REGRAS INVIOLÁVEIS:
1. FECHAMENTO obrigatório: peças com formato "Estático Final" dentro do array "feed".
2. Chaves do JSON: EXCLUSIVAMENTE "feed", "carousel"${wantsStories ? ', "stories"' : ''}. NADA MAIS.

`
    : `
TRILHA SOLICITADA: CINEMÁTICA (sequência com movimento, fechamento em Reels).
Chaves esperadas no JSON: "feed", "carousel", "reels"${wantsStories ? ', "stories"' : ''}.
`;

  const feedRules = hasFeed ? `
SEQUÊNCIA DO FEED (${composicaoLine}):

A SEQUÊNCIA COMPLETA segue a progressão: ${progressionText}
Os formatos são distribuídos pelo método — NÃO pelo usuário.

ESTÁTICOS (${comp.estatico} peça${comp.estatico > 1 ? 's' : ''}):
- Cada estático: título com NO MÁXIMO 6 palavras, cada palavra com no máximo 3 sílabas (EXCETO o substantivo concreto central da informação-chave — produto, peça, serviço, objeto ou procedimento — que pode ter mais sílabas quando essencial para clareza, ex.: "equipamento", "manutenção", "lubrificante", "orçamento", "diagnóstico", "estratégia"), sem ponto final (EXCETO se for pergunta: nesse caso "?" é OBRIGATÓRIO — ex.: "Por que é assim?" ✓, "O que está faltando?" ✓, nunca "Por que é assim." ✗); texto com NO MÁXIMO 15 palavras terminando com PONTO FINAL (16ª palavra em diante é cortada); legenda com corpo até 35 palavras e CTA até 5 palavras, terminando com 3 hashtags em letra minúscula (ver REGRA DE LEGENDA).
- Variar títulos entre afirmação, pergunta, contraste e observação cotidiana.
- DIVERSIDADE LEXICAL OBRIGATÓRIA: os títulos dos estáticos de uma mesma sequência NÃO podem começar com a mesma palavra — garantir abertura distinta entre Estático 1, Estático 2 e Estático Final.
- SUJEITO DO TÍTULO: aplica-se a regra de liberdade gramatical do item 11 (ver ANÁLISE INTERNA acima) — qualquer classe gramatical pode ser sujeito quando substantivada; proibida construção passiva sem agente.
- ANCORAGEM CONCRETA — ANTI-SÍMBOLO: o título deve poder virar uma FOTO de pessoa(s) real(is) em ação observável (decidir, alinhar, atender, revisar, entregar, fechar, apresentar). Teste antes de retornar: "dá para fotografar isso sem recorrer a objeto-metáfora ou cenário espacial genérico?" Se a única imagem possível for engrenagem, peão de madeira, seta, xadrez, escada, degraus, horizonte vazio ou aperto de mãos → título conceitual demais; reescreva com verbo de ação + agente humano. Exemplo: prefira "Time decide junto e fecha" a "Equipe forte traz bom ganho". Metáforas de jornada ("longe", "avançar", "crescer", "subir") e adjetivos de qualidade ("rápido", "forte", "claro", "sólido") SÃO PERMITIDOS nos títulos — a imagePrompt e leituraCenica os traduzirão pelo contexto real do negócio, não por cenário físico nem propriedade literal.
- TEXTO DE APOIO — PADRÕES PROIBIDOS: "vendas aumentadas", "resultados mais consistentes", "crescimento constante e", "para seu negócio", "para a sua empresa", "para a sua marca". Proibido o padrão "[abstrato] gera [resultado]", "[abstrato] faz [resultado]", "[abstrato] traz [resultado]" ou "[abstrato] é [abstrato]" como estrutura dominante — preferir construções diretas: sujeito + verbo de ação + complemento específico.
- Progressão dos estáticos: ${buildPostProgression(comp.estatico, seg.entrada, isB2BOperational, moment)}
- ARCO VISUAL DA SEQUÊNCIA — OBRIGATÓRIO: as leituraCenicas devem criar progressão de câmera ao longo da sequência completa. Estático 1 (abertura): plano ABERTO — personagem integrado ao ambiente, espaço e contexto visíveis, câmera mais afastada; registrar "plano aberto" no campo 'composicao'. Estático Final/Reels (fechamento): plano MÉDIO-FECHADO ou CLOSE — personagem em destaque, composição mais centralizada, menos elementos de ambiente; registrar "plano médio-fechado" ou "close-up" no campo 'composicao'. Nunca dois estáticos consecutivos com o mesmo enquadramento.
- Retornar em "feed": [{ "dia", "formato":"Estático", "titulo", "texto", "legenda", "imagem", "leituraCenica": { "intencao": "o que este post ativa emocionalmente", "personagem": "quem aparece na cena e o que faz", "ambiente": "onde a cena acontece com detalhes físicos", "expressao": "expressão facial e corporal do personagem", "clima": "luz, hora do dia, atmosfera", "composicao": "enquadramento e distância de câmera (plano aberto / plano médio / plano médio-fechado / close-up) + como os elementos se organizam no quadro" } }]

CARROSSEL (${comp.carrossel} sequência${comp.carrossel > 1 ? 's' : ''} de 5 cards cada):
- Cada carrossel tem exatamente 5 cards com função comunicativa distinta: abertura (EDUCATIVO) → desenvolvimento (INFORMATIVO) → aprofundamento (INFORMATIVO) → direção (PERSUASIVO) → ação (CONVENCIMENTO).
- Card 1 deve acolher o problema ou aspiração do público sem mencionar a empresa — funciona como espelho empático: nomeia a realidade do receptor, não critica nem julga. PROIBIDO ironia, negatividade ou ambiguidade sobre o tema central da marca no título do card 1; a abertura deve soar como "eu entendo você", não como acusação ou problema criado pela empresa. Card 5 pode citar o que a empresa entrega e tem CTA na legenda.
- Cada card: titulo até 6 palavras, cada palavra com no máximo 3 sílabas (EXCETO o substantivo concreto central da informação-chave — produto, peça, serviço, objeto ou procedimento — que pode ter mais sílabas quando essencial para clareza, ex.: "equipamento", "manutenção", "lubrificante", "orçamento", "diagnóstico", "estratégia"), sem ponto final (EXCETO se for pergunta: "?" é obrigatório); texto até 12 palavras terminando com PONTO FINAL (13ª palavra em diante é cortada); imagePrompt próprio. ANCORAGEM CONCRETA nos títulos dos cards: mesmo critério dos estáticos acima (teste "dá para fotografar isso?").
- ARCO VISUAL INTERNO DO CARROSSEL — OBRIGATÓRIO: os 5 cards devem ter enquadramento progressivo de câmera, criando narrativa visual de abertura a fechamento. Card 1 (abertura): PLANO ABERTO — personagem e ambiente visíveis, câmera afastada; 'composicao' = "plano aberto". Cards 2-3 (desenvolvimento): PLANO MÉDIO — ação ou objeto em destaque, ângulo engajado; 'composicao' = "plano médio". Card 4 (direção): PLANO MÉDIO-FECHADO — detalhe do trabalho, produto ou gesto; 'composicao' = "plano médio-fechado". Card 5 (ação): CLOSE-UP ou enquadramento íntimo — expressão ou gesto de resolução, câmera mais próxima; 'composicao' = "close-up". PROIBIDO repetir o mesmo enquadramento em cards consecutivos — cada card deve ter distância de câmera diferente do anterior.
- Retornar em "carousel": [{ "sequencia": 1, "legenda": "corpo até 35 palavras + CTA até 5 palavras, terminando com 3 hashtags em letra minúscula sem acento (ver REGRA DE LEGENDA)", "cards": [{ "card":1, "titulo", "texto", "imagePrompt", "leituraCenica": { "intencao": "o que este card ativa", "personagem": "quem aparece e o que faz", "ambiente": "onde acontece com detalhes físicos", "expressao": "expressão do personagem", "clima": "luz e atmosfera", "composicao": "enquadramento e distância de câmera (plano aberto / plano médio / plano médio-fechado / close-up) + organização dos elementos" } }, ...] }]
${comp.carrossel > 1 ? `- Gerar ${comp.carrossel} sequências de carrossel com temas complementares, não repetidos.` : ''}
${closingBlock}

REGRA DE LEGENDA (vale para feed estático, carrossel, reels e estático final):
- A legenda tem 3 parágrafos separados por linha em branco. FORMATO OBRIGATÓRIO no JSON (use \\n\\n como separador literal):
  "{corpo da legenda terminando com ponto final.}\\n\\n{CTA curto terminando com ponto final.}\\n\\n#hash1 #hash2 #hash3"
- Parágrafo 1 — corpo: ATÉ 35 palavras, terminando com PONTO FINAL. RETOMA o conceito central do título e da imagem — não introduz tema novo nem desconectado da peça (a legenda fecha o ciclo palavra→imagem→palavra). Sem texto explicativo longo, sem repetir o título inteiro. PROIBIDO terminar o corpo com frase no imperativo dirigida ao leitor (ex.: "Compartilhe...", "Salve...", "Acesse...") — isso é função EXCLUSIVA do Parágrafo 2. O corpo só descreve/retoma, nunca convida à ação.
- Parágrafo 2 — CTA: EXATAMENTE 1 frase genérica curta (máx 5 palavras), terminando com PONTO FINAL. Varie entre as peças. Exemplos: "Salve este post.", "Comente o que achou.", "Compartilhe com quem precisa ver.", "Marque quem precisa ver isso.", "Envie para quem decide isso." PROIBIDO incluir uma 2ª frase ou CTA indireto (ex.: "Acesse a bio...", "Acesse o site...") no mesmo parágrafo ou em parágrafo extra — apenas essa única frase.
- Parágrafo 3 — hashtags: EXATAMENTE 3, todas em letra MINÚSCULA, sem acento e sem caracteres especiais, separadas por espaço (ex.: #marketing #comunicacao #estrategia).
- Hashtags coerentes com o segmento e a atividade da marca, nunca genéricas demais ("#instagram", "#post").
- Nunca usar CAPS, nunca mais que 3 hashtags, nunca emojis dentro das hashtags, nunca emojis exagerados no corpo ou no CTA.
` : '';

  const storiesRules = wantsStories ? `
STORIES (CONTEÚDO TEXTUAL, SEM IMAGEM):
- Gerar exatamente ${data.storiesDays} sequência(s), uma por dia.
- Cada sequência deve ter ${data.storiesQuantity} stories.
- Stories não geram imagem no MÉTODO OP V1.
- Vídeo: tom de conversa, 20-30 palavras, uma ideia por story.
- Post textual: frase curta, até 8 palavras.
- A primeira story de cada dia deve ativar a entrada psicológica do segmento (${seg.entrada}).
- Retornar em "stories": [{ "dia", "sequencia", "stories": [{ "ordem", "tipo":"vídeo"|"post", "texto" }] }]
` : '';

  const coordinationRules = hasFeed && wantsStories ? `
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
` : '';

  const outputKeys = (() => {
    const parts: string[] = [];
    if (hasFeed) {
      parts.push('"feed"', '"carousel"');
      if (!isVisualOrExperimentacao) parts.push('"reels"');
    }
    if (wantsStories) parts.push('"stories"');
    return parts.join(', ');
  })();

  const mainActivity = (data.mainActivity || '').trim();
  const keyInfo = (data.keyInfo || '').trim();
  const voiceProfile = getVoiceProfile(data.brandVoice);

  const activityLine = mainActivity
    ? `- Atividade principal: ${mainActivity}
  → Use a atividade para escolher cenários, objetos em cena, vocabulário do setor e exemplos concretos. Proibido cenários genéricos quando a atividade for específica.`
    : '';

  const keyInfoBlock = keyInfo
    ? `
EIXO OBRIGATÓRIO DA SEQUÊNCIA — INFORMAÇÃO-CHAVE:
"${keyInfo}"
- TODA peça (estáticos, carrosséis e ${isVisualOrExperimentacao ? 'estáticos finais' : 'reels'}) deve orbitar este eixo.
- O eixo determina o ÂNGULO de cada post dentro da progressão psicológica — não substitui a progressão.
- O fechamento da sequência deve consolidar a decisão em torno deste eixo.
- Proibido peça que não se conecte de forma evidente ao eixo.
- ANCORAGEM CONCRETA DO EIXO: a informação-chave nomeia um elemento concreto (produto, peça, serviço, canal, procedimento ou situação) — esse elemento, ou sinônimo direto, deve aparecer no título OU no texto do PRIMEIRO Estático E do Estático Final/última peça — abertura e fechamento da sequência precisam ser reconhecíveis como sendo sobre esse elemento, não sobre um tema genérico do segmento. As peças intermediárias podem tratar o eixo de forma mais abstrata.
- EXCEÇÃO AO ITEM 8 (PROIBIDO REPETIR A MESMA PALAVRA): o NOME do produto/serviço/objeto concreto do eixo (ex.: "poltrona", "correia", "mangueira") é EXCEÇÃO à regra de não-repetição — pode e deve se repetir, com a MESMA palavra, em todas as peças que tratarem desse elemento. "Sinônimo direto" acima significa variação morfológica do mesmo item (singular/plural: "poltrona"/"poltronas") ou termo realmente equivalente no uso comum — NUNCA outro produto da mesma categoria ("poltrona"→"cadeira", "armário"→"estante", "mangueira"→"cano" são produtos DIFERENTES, e trocar um pelo outro muda o que está sendo vendido). A regra de não-repetição (item 8) e a diversidade lexical continuam valendo para o restante do vocabulário — verbos, adjetivos, conectores — ao redor desse núcleo.
`
    : '';

  const voiceBlock = voiceProfile
    ? `DIREÇÃO DE VOZ — "${voiceProfile.label}":
- Ritmo: ${voiceProfile.ritmo}
- Vocabulário: ${voiceProfile.vocabulario}
- Registro: ${voiceProfile.registro}
- Evitar: ${voiceProfile.evitar}
- Calibração de abertura (referência interna, NÃO copiar literalmente): "${voiceProfile.exemploAbertura}"
A voz se aplica a TODOS os títulos, textos, legendas, cards de carrossel, screenText e roteiro de reels — sem exceção.
Proibido mencionar literalmente o nome da voz no texto final.`
    : `Voz da marca: ${data.brandVoice || 'padrão do segmento'}.
A voz governa ritmo, vocabulário e registro emocional.
Proibido mencionar literalmente a voz no texto final.`;

  const progressionStages = progressionText.split(' → ');
  const communicativeFunctionsMap = buildCommunicativeFunctionMap(comp, isVisualOrExperimentacao, progressionStages);
  const mercadologicalFrameBlock = `10. FRAME DE COMUNICAÇÃO MERCADOLÓGICA:
EMISSOR: ${data.companyName} — fala com voz própria e consistente. Não precisa ser nomeada em cada peça: a coerência de voz, os exemplos concretos da atividade e o eixo da keyInfo identificam o emissor. Nomear a empresa repetidamente torna a comunicação fraca.
RECEPTOR: ${isB2B ? 'decisor empresarial' : 'consumidor final'} — situação atual: "${seg.entrada}" / bloqueio a superar: "${seg.bloqueio}".
INTENÇÃO: conduzir o receptor da situação atual até a decisão de escolher esta empresa — usando educação, informação, inspiração, persuasão e convencimento como ferramentas progressivas e distintas.
FUNÇÕES COMUNICATIVAS POR PEÇA:
${communicativeFunctionsMap}
REGRA: cada peça cumpre a FORMA indicada acima — CTA e menção à empresa só onde a FORMA expressamente permitir.`;

  const titleSyntaxRule = `11. SUJEITO DO TÍTULO — LIBERDADE GRAMATICAL COM FUNÇÃO: qualquer classe gramatical da língua portuguesa pode exercer função de sujeito quando substantivada — substantivo (concreto ou abstrato), adjetivo, verbo no infinitivo, advérbio, numeral, pronome ou locução. Exemplos de abertura válidos: "O melhor…", "A solução…", "A saudade…", "Decidir…", "Cuidar…", "O que define…". O título CUMPRE A FORMA do seu estágio (ver FUNÇÕES COMUNICATIVAS POR PEÇA): entrega observação, critério, prova, posicionamento ou convite — nunca descreve o leitor de fora. PROIBIDO: (a) construção passiva sem agente (ex.: "Operações sem atrasos garantidas", "Entrega sem falhas comprovada" — sem quem age); (b) abrir o título nomeando o leitor de fora — "Quem decide…", "Gestores…", "Decisores…", "A equipe…", "Quem cuida…", "Quem usa…" + verbo descritivo. VARIE o sujeito entre pessoas, conceitos abstratos, verbos substantivados e qualificadores.`;

  return `Você é o motor estratégico do MÉTODO OP. Retorne SOMENTE JSON válido, sem markdown, sem comentários.
${trackHeader}
CONTEXTO:
- Empresa: ${data.companyName}
- Segmento: ${data.segment}
- Público-alvo: ${isB2B ? 'B2B (empresas e decisores empresariais)' : 'B2C (consumidor final)'}
${activityLine}
- Momento do negócio: ${moment.contextNote}
${keyInfoBlock}
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
- ${audienceDirection}
${voiceBlock}

REGRA DE VENDA:
${vendaRule}

${feedRules}
${storiesRules}
${coordinationRules}
${hasFeed ? `
⚠️ COMPLETUDE OBRIGATÓRIA — VERIFIQUE ANTES DE RETORNAR:
Esta sequência DEVE conter EXATAMENTE:
□ "feed": ${comp.estatico} estático${comp.estatico > 1 ? 's' : ''} (formato "Estático")${isVisualOrExperimentacao ? ` + ${comp.fechamento} estático${comp.fechamento > 1 ? 's' : ''} final (formato "Estático Final")` : ' — fechamento vai em "reels", não em "feed"'}
□ "carousel": ${comp.carrossel * 5} cards preenchidos (${comp.carrossel} sequência${comp.carrossel > 1 ? 's' : ''} × 5 cards) — PROIBIDO retornar "carousel": []${!isVisualOrExperimentacao ? `\n□ "reels": ${comp.fechamento} guia${comp.fechamento > 1 ? 's' : ''} com hook + screenText + script + imagePrompt + legenda` : ''}
Cada peça: titulo + texto + legenda + imagePrompt — TODOS preenchidos. Resposta incompleta quebra a sequência do usuário.
` : ''}
${buildVisualDirectionBlock(data.mood, data.segment)}

DIRETRIZES VISUAIS PARA CAMPOS DE IMAGEM:
${buildSceneRoleRule()}
PRINCÍPIO-RAIZ — CICLO DA PALAVRA: a imagem responde ao título. Antes de descrever imagePrompt e leituraCenica, identifique o núcleo do título (sujeito + verbo/promessa central) e garanta que a cena o torne visível. A legenda fecha o ciclo retomando esse conceito. A imagem NUNCA pode negar o que o título afirma.
- A cena deve traduzir estrategicamente o sentido do título e do texto, identificando o papel da empresa na mensagem e a ação concreta do ofício real — metáforas do título não se convertem automaticamente em cena física literal.
- Quando o núcleo do título for um conceito abstrato (sucesso, união, força, resultado, crescimento, ganho), NÃO o represente por objeto-metáfora (engrenagem, peão de madeira, xadrez, balança, troféu, seta). Traduza em PESSOAS reais executando a ação concreta do ofício que PRODUZ aquele conceito — ex.: "união" → colegas decidindo lado a lado numa mesa real; "crescimento" → profissional revisando resultados com cliente.
- Pessoas em cena são regra quando houver cliente, profissional, decisor, problema vivido ou ação humana; para Reels, isso significa exatamente UMA pessoa, nunca grupo.
- Proibido: distorções anatômicas, texto dentro da imagem, logomarca inventada, interfaces irreais, gráficos flutuantes, lâmpadas, setas como símbolo de crescimento, Post-it com ícones de negócios, engrenagens e handshake genérico.
- Regra de dispositivos digitais (notebook, celular, tablet etc.) no imagePrompt e na leituraCenica: ver "REGRA DE DISPOSITIVOS DIGITAIS" acima — vale igualmente aqui.
- Estático e Carrossel: composição vertical 1080x1350.
- Estático Final: composição vertical 1080x1350, com mais respiro, menos ruído e foco centralizado.
${!isVisualOrExperimentacao ? '- Reels: composição vertical 1080x1920, imagem pura sem texto, sem logo, sem colagem e com somente uma pessoa no quadro.' : ''}
- Sufixo técnico OBRIGATÓRIO ao final de cada imagePrompt (substitui qualquer sufixo genérico): "${getMoodSignature(data.mood)}".

INEDITISMO CONTROLADO:
- Não repetir estruturas de abertura.
- Alternar pergunta, afirmação, contraste, exemplo cotidiano e micro narrativa.
- Priorizar linguagem concreta, cotidiana e específica da atividade.
- Substituir tecnicismos, estrangeirismos e jargões por palavras populares e de fácil entendimento, mantendo clareza, naturalidade e impacto. Ex.: "expertise" → "experiência", "briefing" → "orientação", "saúde laboral" → "saúde do trabalho", "otimização" → "melhoria", "engajamento" → "envolvimento", "performance" → "desempenho", "branding" → "identidade de marca", "networking" → "contatos", "feedback" → "retorno", "ROI" → "retorno do investimento".
- Evitar clichês: descubra, saiba mais, transforme, segredo, incrível.

FORMATO DE SAÍDA:
Retorne EXCLUSIVAMENTE estas chaves: ${outputKeys}.
`;
}

function buildSummary(result: Pick<MethodOpResult, 'feed' | 'carousel' | 'reels' | 'stories'>): GenerationSummary {
  const feed = result.feed || [];
  const estaticos = feed.filter(f => f.formato === 'Estático').length;
  const estaticosFinais = feed.filter(f => f.formato === 'Estático Final').length;

  const carouselCards = result.carousel?.length || 0;
  const carrosseis = Math.ceil(carouselCards / 5);

  const reels = result.reels?.length || 0;
  const stories = result.stories?.length || 0;

  return { estaticos, carrosseis, reels, estaticosFinais, stories };
}

// Filtro defensivo. Se a IA desobedeceu e retornou reels numa trilha que
// não pede reels (Visual ou Experimentação), descartamos silenciosamente.
// Um aviso é gravado no console para você monitorar via DevTools sem poluir a UI do usuário.
function shouldDiscardReels(track: Track | undefined, hasReels: boolean): boolean {
  if (!hasReels) return false;
  return track === 'visual' || track === 'experimentacao';
}

export function normalizeMethodResult(raw: any, track?: Track, sequenceSize?: 3 | 6 | 9, keyInfo?: string): MethodOpResult {
  const isExperimentacao = track === 'experimentacao';
  const effectiveSize: 3 | 6 | 9 = isExperimentacao ? 3 : ((sequenceSize || 6) as 3 | 6 | 9);
  const comp = SEQUENCE_COMPOSITION[effectiveSize];
  let carousel: import('../types').CarouselCard[] | undefined;
  if (Array.isArray(raw?.carousel)) {
    if (raw.carousel[0]?.cards) {
      carousel = raw.carousel.flatMap((seq: any) => {
        const cards = (seq.cards || []).map((c: any, i: number) => ({ ...c, card: i + 1 }));
        if (cards.length > 0 && seq.legenda) {
          cards[cards.length - 1].legenda = seq.legenda;
        }
        return cards;
      });
    } else {
      carousel = raw.carousel.slice(0, 5);
    }
  }

  let reels: import('../types').ReelsGuide[] | undefined;
  if (Array.isArray(raw?.reels)) {
    reels = raw.reels.filter(Boolean) as import('../types').ReelsGuide[];
  } else if (raw?.reels) {
    reels = [raw.reels as import('../types').ReelsGuide];
  }

  // Defesa em profundidade: se a trilha pedida não comporta reels e a IA mandou,
  // descartamos silenciosamente. Aviso fica registrado no DevTools.
  if (shouldDiscardReels(track, !!(reels && reels.length))) {
    console.warn(
      `[Método OP] A IA retornou "reels" na trilha "${track}". Descartado para preservar coerência da trilha pedida.`,
      { trackPedida: track, reelsDescartado: reels }
    );
    reels = undefined;
  }

  let feed: FeedItem[] | undefined = Array.isArray(raw?.feed) ? raw.feed : undefined;
  if (Array.isArray(raw?.estaticoFinal) && raw.estaticoFinal.length > 0) {
    const extras: FeedItem[] = raw.estaticoFinal.map((item: any, idx: number) => ({
      dia: item.dia ?? ((feed?.length || 0) + idx + 1),
      formato: 'Estático Final' as const,
      titulo: item.titulo || '',
      texto: item.texto || '',
      legenda: item.legenda || '',
      imagem: item.imagem || item.imagePrompt || '',
      ...(item.leituraCenica ? { leituraCenica: item.leituraCenica } : {}),
    }));
    feed = [...(feed || []), ...extras];
  }

  // Filtro defensivo adicional: se a trilha não comporta reels, remove qualquer
  // item de feed com formato "Reels" que tenha vindo embutido.
  if (track === 'visual' || track === 'experimentacao') {
    if (feed) {
      const before = feed.length;
      feed = feed.filter(f => f.formato !== ('Reels' as any));
      if (feed.length < before) {
        console.warn(
          `[Método OP] Itens com formato "Reels" foram filtrados do feed na trilha "${track}".`
        );
      }
    }
  }

  // Cap estrutural pela composição da trilha/tamanho — evita "4ª peça" quando a IA gera além.
  if (feed) {
    const estaticos = feed.filter(f => f.formato !== 'Estático Final').slice(0, comp.estatico);
    const finais = feed.filter(f => f.formato === 'Estático Final').slice(0, comp.fechamento);
    feed = [...estaticos, ...finais];
  }
  if (carousel) {
    const maxCards = comp.carrossel * 5;
    carousel = carousel.slice(0, maxCards);
  }
  if (reels) {
    if (comp.fechamento === 0) {
      reels = undefined;
    } else {
      reels = reels.slice(0, comp.fechamento);
      if (reels.length === 0) reels = undefined;
    }
  }

  // Guard de limite de palavras: garante que texto nunca ultrapasse os limites
  // definidos no prompt, independente do que o LLM retornou. Mesmos limites do
  // prompt. Título NÃO é truncado aqui — cortar geraria fragmento ("...o
  // motor"); título fora da faixa de palavras é flagado por validateTitulo
  // (abaixo) e regenerado via E3/E4. Legenda passa por normalizeLegenda:
  // remove CTA duplicado no fim do corpo e CTA indireto (bio/site) extra no
  // parágrafo de CTA (ver REGRA DE LEGENDA).
  if (feed) {
    feed = feed.map(item => ({
      ...item,
      titulo: correctPortugueseSpelling((item.titulo || '').trim()),
      texto: correctPortugueseSpelling(truncateWords(item.texto || '', 15)),
      legenda: item.legenda ? correctPortugueseSpelling(enforceLegendaLimits(normalizeLegenda(item.legenda))) : item.legenda,
    }));
  }
  if (carousel) {
    carousel = carousel.map((card: any) => ({
      ...card,
      titulo: correctPortugueseSpelling((card.titulo || '').trim()),
      texto: correctPortugueseSpelling(truncateWords(card.texto || '', 12)),
      ...(card.legenda ? { legenda: correctPortugueseSpelling(enforceLegendaLimits(normalizeLegenda(card.legenda))) } : {}),
    }));
  }
  if (reels) {
    reels = reels.map(r => ({
      ...r,
      hook: correctPortugueseSpelling(r.hook || ''),
      script: correctPortugueseSpelling(r.script || ''),
      screenText: correctPortugueseSpelling(r.screenText || ''),
      ...(r.legenda ? { legenda: correctPortugueseSpelling(enforceLegendaLimits(normalizeLegenda(r.legenda))) } : {}),
    }));
  }

  // D1 — validação heurística pós-geração (palavra cortada, pontuação
  // pendente, repetição morfológica, promessa numérica sem respaldo na
  // keyInfo). Não bloqueia a entrega — fica marcada em `flags` para
  // regeneração pontual via regenerate-block (E3).
  const flags: ValidationFlag[] = [];
  if (feed) {
    feed.forEach((item, i) => {
      flags.push(...validatePieceFields(`feed[${i}]`, { titulo: item.titulo, texto: item.texto, legenda: item.legenda }, keyInfo));
    });
  }
  if (carousel) {
    carousel.forEach((card: any, i) => {
      flags.push(...validatePieceFields(`carousel[${i}]`, { titulo: card.titulo, texto: card.texto, legenda: card.legenda }, keyInfo));
    });
  }
  if (reels) {
    reels.forEach((r, i) => {
      flags.push(...validatePieceFields(`reels[${i}]`, { titulo: r.hook, texto: r.script, legenda: r.legenda }, keyInfo));
    });
  }

  // Medida C — "rótulo do leitor" (gestores/decisores/equipe/time) como
  // sujeito do título: checkObserverSubject flaga qualquer ocorrência;
  // checkCrossPieceLabelRepeat flaga repetição do mesmo rótulo entre peças
  // da sequência (ver item 11 / FUNÇÕES COMUNICATIVAS POR PEÇA acima).
  const allTitles: { campo: string; titulo: string }[] = [];
  if (feed) feed.forEach((item, i) => { if (item.titulo) allTitles.push({ campo: `feed[${i}]`, titulo: item.titulo }); });
  if (carousel) carousel.forEach((card: any, i) => { if (card.titulo) allTitles.push({ campo: `carousel[${i}]`, titulo: card.titulo }); });
  if (reels) reels.forEach((r, i) => { if (r.hook) allTitles.push({ campo: `reels[${i}]`, titulo: r.hook }); });
  for (const { campo, titulo } of allTitles) {
    const observerSubject = checkObserverSubject(titulo);
    if (observerSubject) flags.push({ campo: `${campo}.titulo`, motivo: observerSubject });
  }
  flags.push(...checkCrossPieceLabelRepeat(allTitles));

  // Validação de completude — detecta componentes esperados mas ausentes/incompletos.
  if (comp.carrossel > 0 && (!carousel || carousel.length === 0)) {
    console.warn('[Método OP] SEQUÊNCIA INCOMPLETA: carrossel esperado mas ausente ou vazio.',
      { esperados: comp.carrossel * 5, recebidos: carousel?.length ?? 0, rawCarousel: raw?.carousel });
  } else if (comp.carrossel > 0 && carousel && carousel.length < comp.carrossel * 5) {
    console.warn('[Método OP] SEQUÊNCIA INCOMPLETA: carrossel com cards faltando.',
      { esperados: comp.carrossel * 5, recebidos: carousel.length });
  }
  if (carousel && carousel.length > 0) {
    const cardsVazios = carousel.filter((c: any) => !c.titulo || !c.texto || !c.imagePrompt);
    if (cardsVazios.length > 0) {
      console.warn('[Método OP] SEQUÊNCIA INCOMPLETA: cards de carrossel com campos vazios.',
        { cardsVazios: cardsVazios.length, cards: cardsVazios.map((c: any) => c.card) });
    }
  }
  if (feed) {
    const estaticosRecebidos = feed.filter(f => f.formato === 'Estático').length;
    const finaisRecebidos = feed.filter(f => f.formato === 'Estático Final').length;
    if (estaticosRecebidos < comp.estatico) {
      console.warn('[Método OP] SEQUÊNCIA INCOMPLETA: estáticos faltando.',
        { esperados: comp.estatico, recebidos: estaticosRecebidos });
    }
    if ((track === 'visual' || track === 'experimentacao') && finaisRecebidos < comp.fechamento) {
      console.warn('[Método OP] SEQUÊNCIA INCOMPLETA: estático final faltando.',
        { esperados: comp.fechamento, recebidos: finaisRecebidos });
    }
  }
  if (track === 'cinematica' || !track) {
    if (comp.fechamento > 0 && (!reels || reels.length === 0)) {
      console.warn('[Método OP] SEQUÊNCIA INCOMPLETA: reels esperado mas ausente.',
        { esperados: comp.fechamento, recebidos: reels?.length ?? 0 });
    }
  }

  const partial = { feed, carousel, reels, stories: Array.isArray(raw?.stories) ? raw.stories : undefined };
  const summary = buildSummary(partial);

  return {
    ...partial,
    raw,
    summary,
    ...(flags.length > 0 ? { flags } : {}),
  };
}
