import {
  BrandKit,
  LogoPosition,
  MoodCode,
  PostUnicoDirecao,
  PostUnicoFormData,
  PostUnicoObjetivo,
  Segment,
  ValidationFlag,
} from "../types";
import { composeFeedPng } from "../utils/canvasComposer";
import type { FeedItem } from "../types";
import { generateImageAsync } from "./imageGeneration";
import {
  buildTypographyBlock,
  buildTypographyShortRule,
  buildScriptAccentBlock,
} from "../utils/typography";
import { getAuthHeaders } from "./authHeaders";
import {
  buildMoodGrammarBlock,
  pickImageVariationBlock,
  buildSceneRoleRule,
  buildProductHierarchyBlock,
  PersonagemGender,
} from "../core/visualDirection";
import {
  buildDeviceRule,
  AMBIENTES_RULE,
  HUMANIZACAO_RULE,
  FORBIDDEN_MOOD_WORDS,
  CONCEITO_FIRST_RULE,
} from "../utils/promptRules";
import { buildClothingPool } from "../core/clothingPool";

const OBJETIVO_LABEL: Record<PostUnicoObjetivo, string> = {
  promocao: "Promoção comercial — gerar desejo e ação",
  homenagem: "Homenagem — celebrar pessoa, data ou conquista com emoção",
  aviso: "Aviso institucional — comunicar com clareza e autoridade",
  oportunidade: "Oportunidade — sinalizar momento único, urgência elegante",
  institucional: "Institucional — reforçar posicionamento, propósito e autoridade da marca",
  fatos: "Fatos — registrar o evento como aconteceu, com fidelidade total ao real",
  venda: "Venda — apresentar produto/serviço em uso real, com fidelidade total à foto",
  nenhum: "Criação livre — sem objetivo definido",
};

const OBJETIVO_TONE: Record<PostUnicoObjetivo, string> = {
  promocao: "energia comercial, desejo, movimento",
  homenagem: "afeto, luz quente, respeito, contemplação",
  aviso: "clareza institucional, autoridade tranquila",
  oportunidade:
    "urgência contida antes da ação, contraste entre espera e movimento, energia direcionada, tensão antes do clique",
  institucional: "sobriedade contemporânea, autoridade calma, identidade de marca, atemporalidade",
  fatos:
    "documental, fidelidade ao momento, autenticidade, registro visual limpo, sem dramatização",
  venda: "comercial, prático, demonstrativo, autêntico, sem dramatização",
  nenhum: "neutro, totalmente livre",
};

const MOOD_NAMES: Record<MoodCode, string> = {
  "OP-01": "CLAREZA",
  "OP-02": "IMPACTO",
  "OP-03": "INSTANTE",
  "OP-04": "FRAGMENTO",
  "OP-05": "DESVIO",
  "OP-06": "SILÊNCIO",
};

// Sensação visual desejada por objetivo — orienta a direção emocional da peça livre.
// "nenhum" não entra aqui: é tratado à parte em direcaoBlock (combinação Livre+Nenhum
// é a mais aberta do sistema e não deve herdar a obrigação "conectar ao negócio").
const OBJETIVO_SENSACAO: Record<Exclude<PostUnicoObjetivo, "nenhum">, string> = {
  institucional: "confiança, credibilidade, estabilidade, pertencimento ou profissionalismo",
  promocao: "energia, dinamismo, entusiasmo ou movimento comercial",
  oportunidade: "descoberta, possibilidade, renovação ou decisão estratégica",
  aviso: "atenção, orientação, segurança ou alerta controlado",
  homenagem: "gratidão, carinho, reconhecimento ou solenidade discreta",
  fatos: "autenticidade, realidade, fidelidade ao registro",
  venda: "confiança prática, demonstração real, proximidade comercial",
};

// Orientação criativa compacta por objetivo — 1 frase de direção positiva.
const OBJETIVO_ORIENTACAO: Record<Exclude<PostUnicoObjetivo, "nenhum">, string> = {
  institucional: "Conectar à atividade real da empresa. Não virar prédio, parede lisa ou skyline.",
  promocao: "Valorizar produto, benefício ou resultado sem símbolos promocionais óbvios.",
  oportunidade:
    "Tensão de escolha, gesto decisivo ou atmosfera de possibilidade — sem clichê literal de caminho aberto.",
  aviso: "Hierarquia visual clara e leitura rápida, mas elegante, humano e contextual.",
  homenagem: "Humana, respeitosa, contextual — pode ser discreta, simbólica ou documental.",
  fatos: "Preservar o registro real. Melhoria técnica apenas: clareza, nitidez, balanço de branco.",
  venda:
    "Preservar a foto do colaborador com o produto. Melhoria técnica apenas: clareza, nitidez, balanço de branco.",
};

// Exclusões visuais compactas por objetivo.
const OBJETIVO_VISUAL_EXCLUSIONS: Record<Exclude<PostUnicoObjetivo, "nenhum">, string> = {
  institucional:
    "Evitar skyline, prédio genérico, pessoa olhando janela e stock corporativo sem personalidade. ROSTO HUMANO É PERMITIDO E BEM-VINDO: a peça institucional pode mostrar pessoa com rosto visível — profissional com olhar direto ou contextual — quando isso comunicar melhor identidade e valores da marca.",
  promocao:
    "Evitar sacola genérica, carrinho de supermercado, etiqueta flutuante, porcentagem como elemento principal e aparência de panfleto.",
  oportunidade:
    'PROIBIDO ABSOLUTO: porta entreaberta com feixe de luz dourada, portal luminoso, arco com luz, luz no fim do túnel, corredor de qualquer tipo (concreto, madeira, luminoso ou arquitetônico), pôr do sol como metáfora, pessoa correndo, lâmpada isolada como símbolo de ideia, seta apontando para cima, Post-it com ícones de negócios, mosquetão/carabiner/corda de escalada/equipamento de montanhismo como metáfora de conexão ou parceria, degraus/pódio/palco vazio como metáfora de avanço. Esses elementos são clichês motivacionais banidos — não aparecem mesmo que o briefing não os cite. SE O TÍTULO TEM "PESSOAS" COMO SUJEITO, PESSOAS REAIS APARECEM — nunca espaço vazio/decorativo. NEGATIVE: glowing doorway, corridor, hallway, architectural passageway, lightbulb, upward arrow, carabiner, climbing rope, post-it icons, running person, empty podium, empty stage.',
  aviso: "Evitar alerta exagerado, placa genérica, triângulo de perigo e visual burocrático.",
  homenagem: "Evitar buquê isolado, confete solto, vela genérica e pose sentimental stock.",
  fatos:
    "Preservar registro real. Não inventar cena, pessoas, ambiente ou atmosfera. PERMITIDO APENAS: melhorias técnicas de luminosidade, contraste, balanço de branco, nitidez e resolução.",
  venda:
    "Preservar registro real. Não inventar cena, pessoas, produto ou ambiente. PERMITIDO APENAS: melhorias técnicas de luminosidade, contraste, balanço de branco, nitidez e resolução.",
};

// Arquétipos para a combinação mais aberta do sistema — Direção Livre + Objetivo Nenhum.
// Ao contrário dos arquétipos por objetivo (abaixo), estes NÃO amarram a cena ao negócio:
// servem apenas para variar a composição entre gerações sem reduzir a liberdade criativa.
const LIVRE_TOTAL_ARCHETYPES: string[] = [
  "CONCEITO DESTA GERAÇÃO — LUZ COMO PROTAGONISTA: construa a peça em torno de uma fonte de luz marcante (natural ou dramática) — ela é quem dá personalidade à cena, não apenas a ilumina.",
  "CONCEITO DESTA GERAÇÃO — GESTO E DETALHE: close em um gesto, textura ou objeto que carregue atmosfera própria — composição macro ou meio-corpo, qualidade editorial, sem necessidade de explicar um produto ou serviço.",
  "CONCEITO DESTA GERAÇÃO — INSTANTE CAPTURADO: um momento real em andamento, espontâneo, não posado — a força da imagem vem da autenticidade do instante, não da encenação.",
  "CONCEITO DESTA GERAÇÃO — LINGUAGEM GRÁFICA OU CONCEITUAL: abordagem predominantemente gráfica, abstrata ou conceitual — cor, forma, ritmo e luz como linguagem própria, sem depender de uma cena literal.",
  "CONCEITO DESTA GERAÇÃO — ATMOSFERA DE AMBIENTE: o espaço/cenário como protagonista — luz, textura e profundidade construindo um universo visual com identidade própria.",
];

// Arquétipos visuais mutuamente distintos por objetivo — sorteados a cada geração livre
// para garantir diversidade de conceito entre chamadas sequenciais com o mesmo keyInfo.
// Não inclui "nenhum": ver LIVRE_TOTAL_ARCHETYPES e o branch dedicado em direcaoBlock.
const OBJETIVO_ARCHETYPES: Record<Exclude<PostUnicoObjetivo, "nenhum">, string[]> = {
  oportunidade: [
    "CONCEITO DESTA GERAÇÃO — RELÓGIO / TEMPO: construa a peça em torno de um relógio analógico, detalhe de ponteiros ou ampulheta. A tensão visual vem do tempo que passa, não de movimento corporal. Composição com close preciso, luz controlada sobre o objeto.",
    "CONCEITO DESTA GERAÇÃO — GESTO DECISIVO: close de mão no gesto exato de decisão do ofício real da empresa — o instante de comprometer-se com a ação que o negócio entrega. O objeto ou instrumento na mão pertence ao ofício real descrito na ATIVIDADE (ferramenta, instrumento, material de trabalho). A urgência está no gesto suspenso, não no movimento do corpo inteiro.",
    "CONCEITO DESTA GERAÇÃO — TENSÃO ESPACIAL: pessoa, produto ou objeto em posição de decisão dentro de um ambiente real — postura ou composição que sugere escolha, avanço ou momento favorável. A tensão vem da luz e do enquadramento. PROIBIDO: porta aberta como metáfora, portal, arco, limiar luminoso, luz no fim do túnel, pôr do sol, corredor de concreto ou estrutura industrial.",
    "CONCEITO DESTA GERAÇÃO — OBJETO SIMBÓLICO: um único elemento físico concreto que representa decisão e momento único, derivado do ofício real descrito na ATIVIDADE — ferramenta, produto característico, instrumento ou material de trabalho do negócio. Composição limpa, objeto isolado, sem pessoa como foco principal.",
    'CONCEITO DESTA GERAÇÃO — ABSTRAÇÃO CROMÁTICA: tensão visual construída por planos de cor, gradiente, reflexo ou textura em close — NÃO corredor, NÃO porta, NÃO espaço arquitetônico ou estrutura de passagem. A geometria é de superfícies e materiais abstratos ligados ao ofício da empresa (sombra projetada, reflexo em vidro ou metal de ferramenta ou equipamento do negócio, textura de material de trabalho real), não de objetos genéricos de "novidade" (caderno limpo, página em branco, objeto brilhante impessoal). Sem figura humana em movimento. Paleta audaciosa, energia pela cor e contraste puros.',
  ],
  promocao: [
    "CONCEITO DESTA GERAÇÃO — PRODUTO EM CONTEXTO: o produto ou serviço em uso real, integrado à vida cotidiana de quem o usa. Cena natural, não estúdio.",
    "CONCEITO DESTA GERAÇÃO — DETALHE SENSORIAL: close extremo em textura, superfície ou detalhe do produto/serviço que desperta desejo. Composição macro, qualidade editorial.",
    "CONCEITO DESTA GERAÇÃO — PESSOA E RESULTADO: avatar ou pessoa representando o benefício já conquistado — expressão, postura ou ambiente que comunica a transformação após a compra/contratação.",
    "CONCEITO DESTA GERAÇÃO — COMPOSIÇÃO GRÁFICA: abordagem predominantemente gráfica/tipográfica, com o produto representado de forma estilizada ou como elemento de design. Sem fotografia literal.",
    "CONCEITO DESTA GERAÇÃO — AMBIENTE DE MARCA: o cenário ou contexto da marca com atmosfera forte — sem foco em produto isolado, mas no universo que ele habita.",
  ],
  homenagem: [
    "CONCEITO DESTA GERAÇÃO — RETRATO COM LUZ: close de rosto ou perfil com luz quente e suave, expressão genuína, fundo desfocado com bokeh orgânico.",
    "CONCEITO DESTA GERAÇÃO — DETALHE SIMBÓLICO: objeto ou detalhe que representa a pessoa ou conquista homenageada — sem rosto, mas com identidade clara.",
    "CONCEITO DESTA GERAÇÃO — CENA DE CELEBRAÇÃO DISCRETA: momento de encontro ou conquista capturado de forma documental, sem pose, com emoção verdadeira.",
    "CONCEITO DESTA GERAÇÃO — COMPOSIÇÃO TIPOGRÁFICA: homenagem construída predominantemente pelo texto com fundo fotográfico suave e emocional.",
    "CONCEITO DESTA GERAÇÃO — NATUREZA E SÍMBOLO: elemento natural (luz, planta, água) como metáfora visual da celebração — sem clichê de flores isoladas.",
  ],
  aviso: [
    "CONCEITO DESTA GERAÇÃO — TIPOGRAFIA PROTAGONISTA: o comunicado como design — texto é o elemento visual principal, fundo limpo e autoridade na hierarquia.",
    "CONCEITO DESTA GERAÇÃO — ÍCONE DE AUTORIDADE: detalhe institucional (carimbo, papel oficial, detalhe arquitetônico da marca) que comunica credibilidade.",
    "CONCEITO DESTA GERAÇÃO — PESSOA INFORMANDO: avatar ou representante da empresa em postura de autoridade tranquila, comunicando diretamente.",
    "CONCEITO DESTA GERAÇÃO — AMBIENTE INSTITUCIONAL: espaço físico ou digital da marca como contexto do aviso — sem figura humana como foco.",
    "CONCEITO DESTA GERAÇÃO — COMPOSIÇÃO MINIMALISTA: peça com máxima economia visual — uma cor, um elemento, hierarquia cristalina.",
  ],
  institucional: [
    "CONCEITO DESTA GERAÇÃO — PROPÓSITO ABSTRATO: composição que traduz o valor da marca em cor, forma e luz — escolha UM elemento visual concreto como âncora (textura de material do ofício, gradiente de cor institucional, detalhe fotográfico específico do negócio) para ancorar a abstração e evitar resultado genérico.",
    'CONCEITO DESTA GERAÇÃO — LUGAR DE PERTENCIMENTO: ambiente que comunica o universo da marca — espaço editorial caloroso, sala iluminada com textura humana, atelier de criação, escritório com personalidade, ambiente de trabalho real com vida. PROIBIDO neste conceito: concreto aparente, galpão industrial, corredor vazio ou qualquer estrutura fria — o "pertencimento" é humano e caloroso, não arquitetônico e frio.',
    "CONCEITO DESTA GERAÇÃO — PESSOA E IDENTIDADE: avatar ou representante da marca como incorporação dos seus valores — postura, olhar e contexto comunicam o posicionamento.",
    "CONCEITO DESTA GERAÇÃO — DETALHE DE OFÍCIO: close em ferramenta, material ou gesto específico do negócio — artesania, especialização, autoria.",
    "CONCEITO DESTA GERAÇÃO — TIPOGRAFIA DE MARCA: identidade visual construída pela tipografia e cor como protagonistas, com elemento fotográfico discreto de suporte.",
  ],
  fatos: [
    "CONCEITO DESTA GERAÇÃO — REGISTRO DOCUMENTAL FIEL: esta peça é um documento visual do evento. Preserve absolutamente: pessoas (mesmos rostos, posições, roupas), ambiente (mesma arquitetura, móveis, espaço), composição original. Melhore apenas: clareza, nitidez, balanço de branco, contraste para legibilidade. NÃO crie luz nova, NÃO mude atmosfera. O local e as pessoas devem ser reconhecíveis e idênticos ao original.",
    "CONCEITO DESTA GERAÇÃO — EVIDÊNCIA VISUAL DO MOMENTO: a imagem é prova de que o evento aconteceu. Pessoas em posições naturais originais, ambiente real preservado, luz ambiente respeitada. Calibração técnica permitida (brilho, contraste, nitidez). PROIBIDO: alterar qualquer pessoa, remover elementos, adicionar figuras, dramatizar visualmente. Resultado: o mesmo evento, visualmente mais claro e legível.",
    "CONCEITO DESTA GERAÇÃO — MOMENTO AUTÊNTICO REGISTRADO: capture a essência do evento sem interferência criativa. Preserve exatamente as pessoas presentes, o espaço onde ocorreu, a luz ambiente real. Apenas refinamento técnico é permitido. A peça final é o evento como aconteceu — não uma reinterpretação artística dele.",
  ],
  venda: [
    "CONCEITO DESTA GERAÇÃO — APRESENTAÇÃO REAL DO PRODUTO: esta peça é um registro fiel do colaborador apresentando ou usando o produto. Preserve absolutamente: pessoa (mesmo rosto, postura, roupas), produto (mesma cor, formato, rótulo), ambiente original. Melhore apenas: clareza, nitidez, balanço de branco, contraste. NÃO crie cena nova, NÃO troque o produto.",
    "CONCEITO DESTA GERAÇÃO — DEMONSTRAÇÃO AUTÊNTICA: a imagem comprova o uso real do produto pelo colaborador. Pessoa e produto em posição natural original, luz ambiente respeitada. Calibração técnica permitida. PROIBIDO: alterar pessoa, trocar produto, dramatizar visualmente. Resultado: a mesma cena, visualmente mais clara e legível.",
    "CONCEITO DESTA GERAÇÃO — MOMENTO COMERCIAL REGISTRADO: capture a apresentação do produto sem interferência criativa. Preserve exatamente o colaborador, o produto e o espaço da foto original. Apenas refinamento técnico é permitido.",
  ],
};

function direcaoBlock(
  direcao: PostUnicoDirecao,
  mood?: MoodCode,
  objetivo?: PostUnicoObjetivo,
  hasProdutos?: boolean,
): string {
  if (direcao === "mood" && mood) {
    return `DIREÇÃO (mood ${mood} ${MOOD_NAMES[mood]}):\n${buildMoodGrammarBlock(mood)}\n\nIMPORTANTE: esta peça é mood ${MOOD_NAMES[mood]} — NÃO use estética dos outros moods. Respeite rigorosamente a paleta, luz e composição descritas acima.\n\nPROIBIDO: aparência de Canva/template/panfleto, faixa/barra/painel de cor sólida na base ou no topo da composição (mesmo decorativa, mesmo antes de aplicar a logo), gradient banal, ícones flat, estética de stock genérico. O fundo é contínuo de borda a borda — NÃO divida a peça em blocos, faixas ou painéis de cor.`;
  }
  const obj = objetivo ?? "nenhum";

  // Quando há produtos referenciados (Kit Imagem / MIX), eles já são o "conceito"
  // da geração — sortear um arquétipo adicional (ex.: RELÓGIO/TEMPO) cria um
  // segundo elemento-herói que disputa protagonismo e espaço com o produto real,
  // degradando sua geometria. Por isso o sorteio é substituído por esta nota.
  const PRODUTOS_CONCEITO_NOTE =
    "\n\nPRODUTOS REFERENCIADOS SÃO O CONCEITO DESTA GERAÇÃO: não introduza objeto-conceito adicional (relógio, ampulheta, ferramenta simbólica isolada, elemento gráfico abstrato, etc.) que possa competir em protagonismo ou espaço com os produtos reais — a personalidade da peça vem de como os produtos são compostos na cena, com o PAPEL DA EMPRESA e a ATIVIDADE REAL como contexto.";

  // Livre + Nenhum é a combinação mais aberta do sistema (sem mood, sem objetivo).
  // Tratada à parte: os mapas OBJETIVO_* pressupõem conexão obrigatória com o negócio,
  // o que contradiz e neutraliza a "liberdade total" — daí a falta de ousadia observada.
  if (obj === "nenhum") {
    const archetypeHint = hasProdutos
      ? PRODUTOS_CONCEITO_NOTE
      : `\n\n${LIVRE_TOTAL_ARCHETYPES[Math.floor(Math.random() * LIVRE_TOTAL_ARCHETYPES.length)]}`;
    return `DIREÇÃO LIVRE — SEM TEMA OU OBJETIVO PRÉ-DEFINIDO: a IA tem liberdade total e real de direção de arte — não há mood, não há objetivo, não há obrigação de literalidade com o negócio.${archetypeHint}\n\nVarie ATIVAMENTE entre abordagens possíveis: luz natural OU dramática, paleta fria OU quente, fundo claro OU escuro, composição calma OU energética, predominantemente fotográfica OU gráfica OU conceitual. Escolha uma direção com personalidade própria, ouse e vá fundo nela — o critério é qualidade editorial e impacto visual, não utilidade comercial. Resultado: arte publicitária brasileira contemporânea de alto nível editorial. PROIBIDO: aparência de Canva/template/panfleto, gradient banal, ícones flat, estética de stock genérico, fórmula default "fundo escuro + luz dourada dramática" (essa é apenas UMA das opções, não a padrão).`;
  }

  const sensacao = OBJETIVO_SENSACAO[obj];
  const orientacao = OBJETIVO_ORIENTACAO[obj];
  const exclusion = OBJETIVO_VISUAL_EXCLUSIONS[obj];
  // Sorteia arquétipo visual para forçar diversidade entre gerações sequenciais
  // — substituído pela nota de protagonismo dos produtos quando há MIX (acima).
  const archetypes = OBJETIVO_ARCHETYPES[obj];
  const archetypeHint = hasProdutos
    ? PRODUTOS_CONCEITO_NOTE
    : archetypes && archetypes.length
      ? `\n\n${archetypes[Math.floor(Math.random() * archetypes.length)]}`
      : "";
  const derivacaoBlock = hasProdutos
    ? ""
    : "\n\nDERIVAÇÃO OBRIGATÓRIA: o objeto, gesto ou elemento visual do arquétipo acima é sempre derivado da ATIVIDADE REAL da empresa e do PAPEL DA EMPRESA neste prompt — nunca de uma lista padrão. A estrutura visual (enquadramento, câmera, nível de abstração) é do arquétipo; o conteúdo é do ofício real.";
  return `DIREÇÃO LIVRE — SENSAÇÃO DESEJADA: ${sensacao}.\nOrientação: ${orientacao}\n\n${exclusion}${archetypeHint}${derivacaoBlock}\n\nA IA tem liberdade de direção de arte dentro do objetivo informado. Varie ATIVAMENTE entre abordagens visuais possíveis: pode ser luz natural suave OU dramática, paleta fria OU quente, fundo claro OU escuro, composição calma OU energética, predominantemente fotográfica OU gráfica OU mista. Escolha uma direção com personalidade própria e vá fundo nela. Resultado: arte publicitária brasileira contemporânea de alto nível editorial. PROIBIDO: aparência de Canva/template/panfleto, gradient banal, ícones flat, estética de stock genérico, fórmula default "fundo escuro + luz dourada dramática" (essa é apenas UMA das opções, não a padrão).`;
}

function logoZoneDescription(position: LogoPosition | undefined): {
  reservaTopo: string;
  regraFinal: string;
} {
  const pos = position || "bottom-right";
  // IMPORTANTE: a "área da logo" deve ser PEQUENA (~10% da largura, ~6% da altura)
  // e parte natural da composição — NÃO um retângulo branco/vazio enorme.
  // Pode haver fundo, textura, fotografia ou cor de marca atrás; só evitamos
  // texto, rosto, objeto-foco e lettering exatamente sobre o ponto da logo,
  // mantendo contraste local suficiente para a marca ser legível.
  const base =
    "Área reservada inviolável (~18% × ~10%): PROIBIDO ABSOLUTO ali: texto, título, lettering, slogan, hashtag, número, rosto humano, mão, objeto-foco, gráfico, ícone, símbolo ou recorte de produto. NENHUM ELEMENTO IMPORTANTE PODE SER COBERTO PELA LOGO — ela será sobreposta depois. Área deve ser continuação natural da imagem (fundo, textura, céu, parede). PROIBIDO TAMBÉM: moldura, caixa, painel, badge, fundo de cor sólida, círculo, elipse, anel, halo, linha decorativa, pontilhado, tracejado, ornamento, vírgula, aspas, rabisco, swoosh, símbolo gráfico solto ou forma orgânica decorativa — em volta da zona e também na área imediatamente adjacente a ela. Apenas garanta contraste local suficiente para a logo ser legível. NEGATIVE: solid color block behind logo area, colored badge, colored panel, banner shape.";
  // Para logo centralizada (topo/base), o ponto da logo fica no MEIO de uma linha
  // que normalmente atravessa o canvas de ponta a ponta. Um "retângulo pequeno"
  // não basta: título/texto de apoio que ocupem essa linha colidem com a logo no
  // centro. Por isso a zona aqui é uma FAIXA HORIZONTAL COMPLETA — nenhuma linha
  // de texto pode cruzá-la, mesmo parcialmente.
  const faixa =
    "A logo ocupa uma FAIXA HORIZONTAL COMPLETA (de borda a borda do canvas), com ~14% da altura. PROIBIDO ABSOLUTO: qualquer texto, título, lettering, slogan, hashtag, número, rosto humano, mão, objeto-foco, gráfico, ícone, símbolo ou recorte de produto que cruze essa faixa — mesmo parcialmente, mesmo apenas uma palavra ou linha. TÍTULO e TEXTO DE APOIO (incluindo TODAS as linhas) devem terminar ANTES dessa faixa começar, ou começar DEPOIS dela terminar — NUNCA divididos ao redor dela, NUNCA com uma linha cruzando-a. A faixa deve ser continuação natural da imagem (fundo, textura, céu, parede). PROIBIDO TAMBÉM: moldura, caixa, painel, badge, fundo de cor sólida, círculo, elipse, anel, halo, linha decorativa, pontilhado, tracejado, ornamento, vírgula, aspas, rabisco, swoosh, símbolo gráfico solto ou forma orgânica decorativa — dentro da faixa e também na área imediatamente adjacente a ela. Apenas garanta contraste local suficiente para a logo ser legível dentro da faixa. NEGATIVE: solid color bar, bottom banner stripe, top banner stripe, flat color footer band, colored panel behind logo, navy or brand-color block at canvas edge.";
  if (pos === "top-center") {
    return {
      reservaTopo: `Ponto da logo: TOPO CENTRAL. ${faixa}`,
      regraFinal:
        "Faixa superior é continuação natural da cena — SEM barra, painel ou bloco de cor sólida, livre de texto, logo central legível, sem dead space.",
    };
  }
  if (pos === "bottom-center") {
    return {
      reservaTopo: `Ponto da logo: BASE CENTRAL. ${faixa}`,
      regraFinal:
        "Faixa inferior é continuação natural da cena — SEM barra, painel ou bloco de cor sólida, livre de texto, logo central legível, sem dead space.",
    };
  }
  return {
    reservaTopo: `Ponto da logo: CANTO INFERIOR DIREITO. ${base}`,
    regraFinal:
      "Canto inferior direito é continuação natural da cena — SEM badge, painel ou bloco de cor sólida atrás da logo, legível, sem dead space.",
  };
}

export interface PostUnicoCopy {
  titulo: string;
  texto: string;
  flags?: ValidationFlag[];
}

export async function generatePostUnicoCopy(
  data: PostUnicoFormData,
  brandVoice?: string,
  segment?: string,
  preferredSlot?: string,
): Promise<PostUnicoCopy> {
  const auth = await getAuthHeaders();
  const res = await fetch("/api/generate-pu-copy", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      companyName: data.companyName,
      mainActivity: data.mainActivity,
      objetivo: data.objetivo,
      keyInfo: data.keyInfo,
      brandVoice: brandVoice || "",
      segment: segment || "",
      ...(preferredSlot ? { preferredSlot } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao gerar título e texto (${res.status})`);
  }
  const json = await res.json();
  return {
    titulo: String(json.titulo || "").trim(),
    texto: String(json.texto || "").trim(),
    ...(Array.isArray(json.flags) && json.flags.length > 0
      ? { flags: json.flags as ValidationFlag[] }
      : {}),
  };
}

export interface PostUnicoReferences {
  avatar?: string;
  // Foto da fachada/frente do estabelecimento — slot próprio no Kit Imagem,
  // independente do cenário (antes era um "tipo" de cenário).
  fachada?: string;
  cenario?: string;
  produtos?: { num: number; dataUrl: string }[];
  // Foto do uniforme da empresa (kit.uniformeDataUrl) — veste o personagem
  // da peça com esta peça de roupa em vez do figurino livre sorteado.
  uniforme?: string;
  // Faixa etária do personagem sem avatar (ex.: "30–40 anos") — ver
  // PERSONAGEM OBRIGATÓRIO em referencesBlock.
  personagemIdade?: string;
  // Personagem sem avatar ativo — representa o público-alvo por padrão
  // (figurino livre); veste uniforme apenas quando refs.uniforme também
  // está presente (usuário escolheu que esse personagem é o emissor).
  personagemSemAvatarAtivo?: boolean;
  // Foto de um acontecimento (Kit Imagem, slot próprio) — objetivo "Fatos",
  // aplicação direta sem reinvenção pela IA.
  fato?: string;
  // Foto de colaborador com o produto (Kit Imagem, slot próprio) — objetivo
  // "Venda", mesmo tratamento de preservação do "Fato".
  venda?: string;
  // O(s) produto(s) referenciados são, eles mesmos, uma tela/dispositivo cujo
  // conteúdo exibido é a identidade do produto — suspende a regra global de
  // desfoque de tela (buildDeviceRule) para esta geração. Ver
  // PostUnicoVisualSelection.produtoTelaInformativa.
  produtoTelaInformativa?: boolean;
}

// isClothingFriendly/buildClothingPool agora moram em core/clothingPool.ts —
// compartilhadas com regenerateWithKit.ts (MOP) pra evitar duplicação literal.

// Ordem fixa das imagens de referência enviadas ao modelo: avatar -> uniforme
// -> fachada -> cenário -> fato -> venda -> produtos (por número) — espelha
// a sequência do Kit Imagem (Identidade: avatar/uniforme/fachada; depois
// Ambiente: cenário; depois Fato/Venda, documentais). Compartilhada entre PU
// e MOP — os rótulos "IMAGEM #N" só fazem sentido se essa ordem for idêntica
// nos dois motores, e antes cada um tinha sua própria cópia (refsToArray/buildRefs).
export function orderedReferenceImages(
  refs?: PostUnicoReferences,
  opts?: { withAvatar?: boolean },
): string[] {
  if (!refs) return [];
  const withAvatar = opts?.withAvatar ?? true;
  const imgs: string[] = [];
  if (withAvatar && refs.avatar) imgs.push(refs.avatar);
  if (refs.uniforme) imgs.push(refs.uniforme);
  if (refs.fachada) imgs.push(refs.fachada);
  if (refs.cenario) imgs.push(refs.cenario);
  if (refs.fato) imgs.push(refs.fato);
  if (refs.venda) imgs.push(refs.venda);
  if (refs.produtos?.length) {
    for (const p of [...refs.produtos].sort((a, b) => a.num - b.num)) {
      imgs.push(p.dataUrl);
    }
  }
  return imgs;
}

// "nenhum" não entra aqui: forçar uma paleta pré-definida (mesmo que "neutra")
// contradiz e neutraliza a liberdade cromática anunciada na combinação Livre+Nenhum
// — ver branch dedicado em buildColorBlock, que libera a escolha entre fria/quente.
const OBJETIVO_PALETAS: Record<Exclude<PostUnicoObjetivo, "nenhum">, string[]> = {
  institucional: [
    `PALETA DESTA PEÇA — CONFIANÇA: azul profundo, branco e cinza. Solidez institucional e credibilidade.`,
    `PALETA DESTA PEÇA — CREDIBILIDADE: azul petróleo, grafite e branco. Maturidade e autoridade discreta.`,
    `PALETA DESTA PEÇA — ESTABILIDADE: azul escuro, verde escuro e cinza. Presença de longo prazo.`,
    `PALETA DESTA PEÇA — PROFISSIONALISMO: azul marinho, prata e branco. Rigor e competência.`,
    `PALETA DESTA PEÇA — RESPEITO: grafite, azul profundo e bege claro. Sobriedade com calor humano.`,
  ],
  promocao: [
    `PALETA DESTA PEÇA — ENERGIA: laranja, amarelo e branco. Vitalidade que convida à ação imediata.`,
    `PALETA DESTA PEÇA — MOVIMENTO: vermelho moderado, laranja e cinza escuro. Dinamismo e urgência controlada.`,
    `PALETA DESTA PEÇA — OPORTUNIDADE CROMÁTICA: amarelo dourado, azul intenso e branco. Destaque e valorização da oferta.`,
    `PALETA DESTA PEÇA — ENTUSIASMO: coral, amarelo e azul claro. Animação e desejo de participação.`,
    `PALETA DESTA PEÇA — DINAMISMO: laranja vibrante, azul escuro e branco. Contraste que ativa o olhar.`,
  ],
  oportunidade: [
    `PALETA DESTA PEÇA — DESCOBERTA: turquesa, branco e azul céu. Abertura e novidade ao alcance.`,
    `PALETA DESTA PEÇA — RENOVAÇÃO: verde claro, branco e bege. Frescor e recomeço.`,
    `PALETA DESTA PEÇA — REALIZAÇÃO: dourado suave, laranja discreto e branco. Conquista e resultado concreto.`,
    `PALETA DESTA PEÇA — FUTURO: azul elétrico, violeta suave e prata. Inovação e antecipação.`,
    `PALETA DESTA PEÇA — POSSIBILIDADE: azul céu, turquesa e branco. Horizonte amplo e otimismo.`,
  ],
  aviso: [
    `PALETA DESTA PEÇA — ATENÇÃO: amarelo, grafite e branco. Sinalização clara sem alarme.`,
    `PALETA DESTA PEÇA — ORIENTAÇÃO: azul médio, branco e cinza. Clareza informativa e direção.`,
    `PALETA DESTA PEÇA — SEGURANÇA: azul profundo, branco e verde suave. Tranquilidade na comunicação.`,
    `PALETA DESTA PEÇA — ORGANIZAÇÃO VISUAL: cinza técnico, azul claro e branco. Precisão e ordem.`,
    `PALETA DESTA PEÇA — ALERTA CONTROLADO: laranja suave, azul escuro e branco. Destaque sem tensão excessiva.`,
  ],
  homenagem: [
    `PALETA DESTA PEÇA — GRATIDÃO: dourado suave, bege e branco. Celebração com elegância e afeto.`,
    `PALETA DESTA PEÇA — CARINHO: rosa queimado, creme e branco. Ternura e proximidade emocional.`,
    `PALETA DESTA PEÇA — RECONHECIMENTO: vinho, dourado e bege. Prestígio e valorização genuína.`,
    `PALETA DESTA PEÇA — RESPEITO SOLENE: azul profundo, dourado discreto e branco. Solenidade com calor.`,
    `PALETA DESTA PEÇA — PROXIMIDADE: terracota, areia e creme. Afeto terroso e pertencimento.`,
  ],
  fatos: [
    `PALETA DESTA PEÇA — AUTENTICIDADE: tons neutros (bege claro, cinza suave e branco). Paleta fiel ao real — sem saturação artificial, sem dramatização cromática. Preserva a atmosfera visual do momento registrado.`,
    `PALETA DESTA PEÇA — REALIDADE: azul claro dessaturado, cinza quente e branco. Registro limpo que respeita a luz e as cores originais do evento. Equilíbrio sem intervenção artificial.`,
    `PALETA DESTA PEÇA — FIDELIDADE: areia, cinza neutro e branco. Documental e honesto — a paleta não inventa atmosfera, apenas organiza o que estava presente no momento.`,
    `PALETA DESTA PEÇA — CLAREZA DOCUMENTAL: azul acinzentado, cinza claro e branco. Evidência visual limpa — contraste suficiente para legibilidade, sem distorção das cores reais.`,
    `PALETA DESTA PEÇA — NATURALIDADE: marrom claro, bege e branco. Contexto humano real preservado — a paleta acompanha a temperatura de cor do ambiente original do evento.`,
  ],
  venda: [
    `PALETA DESTA PEÇA — AUTENTICIDADE COMERCIAL: tons neutros (bege claro, cinza suave e branco). Paleta fiel ao real — sem saturação artificial, sem dramatização cromática. Preserva a atmosfera visual da foto registrada.`,
    `PALETA DESTA PEÇA — DEMONSTRAÇÃO REAL: azul claro dessaturado, cinza quente e branco. Registro limpo que respeita a luz e as cores originais da cena. Equilíbrio sem intervenção artificial.`,
    `PALETA DESTA PEÇA — FIDELIDADE AO PRODUTO: areia, cinza neutro e branco. Documental e honesto — a paleta não inventa atmosfera, apenas organiza o que estava presente na foto.`,
  ],
};

function buildColorBlock(
  primary: string,
  accent: string,
  isMood: boolean,
  objetivo?: PostUnicoObjetivo,
): string {
  if (isMood) {
    return `Referência cromática da marca (subordinada ao mood): primária ${primary}, apoio ${accent}.`;
  }

  const obj = objetivo ?? "nenhum";

  // Livre + Nenhum: liberar a cor por completo, coerente com a "liberdade total"
  // já anunciada em direcaoBlock — uma paleta pré-definida (mesmo "neutra") aqui
  // cancelaria a variação fria/quente prometida ali. Ver LIVRE_TOTAL_ARCHETYPES.
  if (obj === "nenhum") {
    return `PALETA DESTA PEÇA — LIVRE: a IA escolhe a combinação cromática que melhor sirva ao conceito visual desta geração — pode ser fria OU quente, suave OU saturada, clara OU escura, monocromática OU contrastante — desde que internamente coerente e harmônica. Não há sensação cromática pré-definida a comunicar: a paleta nasce do conceito escolhido para esta peça específica, não de uma fórmula fixa repetida entre gerações.
Referência cromática da marca (use apenas se houver harmonia natural com a paleta escolhida): primária ${primary}, apoio ${accent}.
COR DO LETTERING: escolha livremente a cor que garanta a melhor leitura visual sobre o fundo desta paleta — branco, preto, tom claro ou escuro conforme o contraste necessário. Legibilidade e destaque visual são prioritários.`;
  }

  const pool = OBJETIVO_PALETAS[obj];
  const palette = pool[Math.floor(Math.random() * pool.length)];

  return `${palette}
As cores são definidas pela intenção emocional da peça, não pelas cores institucionais como base da composição. Referência cromática da marca (use apenas se houver harmonia natural): primária ${primary}, apoio ${accent}.
COR DO LETTERING: escolha livremente a cor que garanta a melhor leitura visual sobre o fundo desta paleta — branco, preto, tom claro ou escuro conforme o contraste necessário. Legibilidade e destaque visual são prioritários.`;
}

function segmentRules(segment?: string, hasCenarioRef?: boolean): string {
  if (segment === "VAREJO") {
    return "CONTEXTO — SEGMENTO VAREJO: negócio de comercialização de produtos ao consumidor. Quando presentes, produtos comunicam desejo de compra e benefícios (apresentar de forma atraente, não como catálogo técnico); cenário cria atmosfera de experiência de compra ou lifestyle; avatar contextualiza atendimento ou uso do produto. O tom visual e textual é convidativo e orientado ao consumo.";
  }
  if (segment === "MARCA") {
    // "Cenário" só entra na frase quando há foto de cenário de fato enviada —
    // caso contrário o texto empurrava o modelo a inventar um ambiente/estilo
    // de vida mesmo sem referência, mesmo com a trava de fundo neutro ativa.
    const cenarioClause = hasCenarioRef
      ? "Cenário e avatar transmitem percepção, estilo de vida e valores da marca"
      : "Avatar transmite percepção e valores da marca";
    return `CONTEXTO — SEGMENTO MARCA: construção de identidade e posicionamento. ${cenarioClause}; a composição reforça aspiração e propósito; produtos, se presentes, são ícones da identidade. O tom visual e textual é aspiracional e alinhado ao posicionamento da marca.`;
  }
  return "CONTEXTO — SEGMENTO SERVIÇOS: prestação de serviços especializados. Avatar (quando presente) transmite autoridade, competência e confiança do profissional ou da equipe; cenário reforça o contexto profissional; a composição comunica expertise, credibilidade e entrega de valor. O tom visual e textual é confiante e orientado ao resultado.";
}

// Papel do personagem por segmento + objetivo — só relevante quando há avatar
// de referência ativo: nesse caso showConcreteAction fica false (a foto já
// ancora a composição), o que deixava nenhuma instrução sobre o que o avatar
// está fazendo ali (ver buildPostUnicoPrompt). Mapa pontual, começa só pelo
// caso reportado (MARCA + institucional); outras combinações seguem sem
// bloco específico até serem necessárias.
const AVATAR_ROLE_BY_SEGMENT_OBJETIVO: Partial<Record<string, string>> = {
  // Avatar = exceção deliberada ao personagem-padrão (público-alvo, ver
  // documento de princípios 1.1): o usuário marcou avatar de propósito, então
  // aqui é o emissor (quem representa a marca) que aparece. Quando há produto
  // na cena, os dois (avatar e produto) dividem o protagonismo em peso igual
  // — mesmo princípio 50/50 de buildProductHierarchyBlock (MARCA) — em vez de
  // o avatar "apresentar" o produto como um acessório da composição.
  "MARCA:institucional":
    "PAPEL DO PERSONAGEM: o avatar representa, por escolha deliberada do usuário, o emissor da marca — postura confiante e serena, presença que comunica autoridade e propósito institucional, não está executando uma tarefa operacional do dia a dia. Quando há produto na cena, ele e o avatar dividem o protagonismo em PESO VISUAL IGUAL — nenhum dos dois reduzido a acessório ou plano de fundo do outro; os dois juntos representam a identidade da marca.",
};

function avatarRoleBlock(
  segment?: string,
  objetivo?: PostUnicoObjetivo,
  hasAvatar?: boolean,
): string {
  if (!hasAvatar || !segment || !objetivo) return "";
  return AVATAR_ROLE_BY_SEGMENT_OBJETIVO[`${segment}:${objetivo}`] ?? "";
}

function referencesBlock(
  refs?: PostUnicoReferences,
  segment?: string,
  kitColors?: { primary: string; accent: string },
  objetivo?: PostUnicoObjetivo,
  forcedGender?: PersonagemGender,
): string {
  if (!refs) return "";
  const parts: string[] = [];
  const elementos: string[] = [];
  if (refs.avatar) elementos.push("AVATAR");
  if (refs.uniforme) elementos.push("UNIFORME");
  if (refs.fachada) elementos.push("FACHADA");
  if (refs.cenario) elementos.push("CENÁRIO");
  if (refs.fato) elementos.push("FATO");
  if (refs.venda) elementos.push("VENDA");
  if (refs.produtos && refs.produtos.length) elementos.push("PRODUTOS");
  if (!elementos.length) return "";

  parts.push(
    `ESTRUTURA VISUAL DA PEÇA — usar como REFERÊNCIA VISUAL (não copiar literalmente, não fazer colagem):`,
  );
  parts.push(`Elementos enviados: ${elementos.join(", ")}.`);
  parts.push(segmentRules(segment, !!refs.cenario));

  if (refs.avatar) {
    const clothingHint = refs.uniforme
      ? " VESTUÁRIO: vista o avatar com o uniforme obrigatório da próxima imagem de referência — não escolha figurino livre."
      : kitColors
        ? (() => {
            const pool = buildClothingPool(kitColors.primary, kitColors.accent);
            return ` VESTUÁRIO: ${pool[Math.floor(Math.random() * pool.length)]}`;
          })()
        : "";
    parts.push(
      `AVATAR: a primeira imagem de referência é o avatar. Use como personagem da peça mantendo semelhança visual (rosto, perfil físico, faixa etária, gênero, expressão e características predominantes). Adapte postura e linguagem corporal ao contexto da atividade da empresa e ao mood. Aparência publicitária e realista — sem caricatura, sem distorção facial, sem clonagem exata da foto original.${clothingHint} REPERTÓRIO DE POSE/ENQUADRAMENTO (escolha conscientemente — NÃO caia automaticamente em "sentado à mesa com notebook olhando para a câmera"): pode estar em pé, andando, de perfil, de costas parcial, em meio gesto, em conversa com alguém fora de quadro, com material/produto em mãos, encostado em parede, em ambiente externo. NÃO é obrigatório olhar para a câmera. NÃO é obrigatório estar atrás de mesa com notebook. Enquadramento pode variar: close de rosto, meio corpo, corpo inteiro, três-quartos, OU peça sem rosto visível (mãos trabalhando, detalhe de gesto, ambiente com presença implícita). Escolha a combinação que melhor serve à mensagem desta peça específica.`,
    );
  }
  if (refs.uniforme) {
    const personagemClause = refs.avatar
      ? " NÃO copie a pessoa do uniforme; aplique somente a roupa ao personagem já definido pelo avatar."
      : ` NÃO copie a pessoa do uniforme — ela é só referência de roupa.`;
    parts.push(
      `UNIFORME OBRIGATÓRIO: uma das imagens de referência enviadas é o uniforme da empresa — vista o personagem da peça EXATAMENTE com esta peça de roupa: mesma cor, mesmo modelo/corte e mesma posição da logomarca aplicada ao tecido. IGNORE COMPLETAMENTE quem aparece nesta foto de referência — rosto, corpo, idade, pose e identidade dessa pessoa NÃO importam, apenas a peça de roupa em si.${personagemClause}`,
    );
  }
  // Personagem sem avatar — representa o público-alvo por padrão (figurino
  // livre); só veste o uniforme acima quando o usuário marcou explicitamente
  // que esse personagem é o emissor (comUniforme + refs.uniforme presente).
  if (!refs.avatar && refs.personagemSemAvatarAtivo) {
    const idadeClause = refs.personagemIdade ? `, aparentando ${refs.personagemIdade}` : "";
    const generoClause = forcedGender ? forcedGender : "homem ou mulher";
    const roupaClause = refs.uniforme
      ? "vestindo o uniforme descrito acima"
      : "com roupa coerente com a cena e o contexto da empresa (figurino livre, sem uniforme)";
    const papelClause = refs.uniforme
      ? "EMISSOR — representa a empresa"
      : "PÚBLICO-ALVO — representa quem recebe a comunicação, NÃO a empresa";
    parts.push(
      `PERSONAGEM OBRIGATÓRIO (sem avatar — ${papelClause}): esta peça DEVE ter um personagem humano claramente visível${idadeClause}, gênero: ${generoClause}, ${roupaClause}. Aparência publicitária e realista, sem caricatura. Invente o personagem livremente (rosto, etnia, expressão)${refs.uniforme ? " — apenas a roupa é fixa (a do uniforme)" : ""}.`,
    );
  }
  if (refs.fachada) {
    parts.push(
      `FACHADA OBRIGATÓRIA: preserve FIELMENTE este espaço como ele é na imagem de referência. Mantenha a arquitetura, letreiros, identidade visual do local e ângulo da câmera reconhecíveis. A pessoa ou produto deve aparecer à frente, na entrada ou com a fachada claramente visível ao fundo. Quem conhece o local deve reconhecê-lo na peça. É PERMITIDO limpar a composição de elementos visuais indesejados — fios elétricos, postes, cabos aéreos, lixo ou poluição visual cruzando a fachada — e, se o céu aparecer, substituí-lo por um céu mais bonito e coerente com o mood/horário (azul limpo, entardecer dourado, nublado suave), desde que a arquitetura, os letreiros e a identidade visual permaneçam plenamente reconhecíveis e a peça não pareça artificial ou colada. NÃO invente outro lugar, NÃO substitua a arquitetura, NÃO mude o ângulo. O local deve ser reconhecível na imagem final.`,
    );
  }
  if (refs.cenario) {
    const temProduto = !!(refs.produtos && refs.produtos.length);
    // Só avisa pra desfocar/excluir mercadoria do CENÁRIO quando NÃO há produto
    // de referência selecionado — esse aviso existe pra evitar que um item
    // qualquer visível na foto do cenário seja confundido com "o produto".
    // Quando HÁ produto de referência real, esse mesmo texto ("desfoque,
    // exclua...") competia com o bloco PRODUTOS SELECIONADOS + a regra de
    // hierarquia (que já define o papel do produto por segmento), e o modelo
    // às vezes "cumpria" o aviso do cenário excluindo o produto inteiro da
    // cena — visto no caso real em que o produto referenciado simplesmente
    // não apareceu na peça.
    const produtoGuard =
      segment !== "VAREJO" && !temProduto
        ? " Itens de mercadoria, produtos de terceiros ou embalagens com marcas visíveis em primeiro plano NÃO devem ser reproduzidos como elementos centrais da composição — desfoque, exclua ou mantenha discretos ao fundo, priorizando o avatar e a ação de serviço."
        : "";
    const ambienteClause = temProduto
      ? "preserve a arquitetura, paredes, piso, iluminação geral e identidade visual do ambiente — móveis e objetos do cenário aparecem apenas como FUNDO de apoio, atrás e ao redor do produto referenciado, nunca à frente dele nem maiores ou mais nítidos que ele"
      : "preserve a sala, móveis, equipamentos, paredes e ponto de vista";
    // "Dar protagonismo ao produto" só faz sentido em VAREJO — em SERVIÇOS
    // (produto-apoio) e MARCA (equilíbrio 50/50) isso contradiria a regra de
    // hierarquia já definida no bloco PRODUTOS SELECIONADOS abaixo.
    const anguloClause = temProduto
      ? segment === "VAREJO"
        ? "Pode reposicionar ÂNGULO e DISTÂNCIA da câmera para dar protagonismo ao produto referenciado — mas o ambiente deve continuar reconhecível como o mesmo local."
        : "Pode reposicionar ÂNGULO e DISTÂNCIA da câmera para integrar o produto à cena com naturalidade — mas o ambiente deve continuar reconhecível como o mesmo local."
      : "NÃO mude o ângulo.";
    parts.push(
      `CENÁRIO OBRIGATÓRIO — AMBIENTE: preserve FIELMENTE este espaço como ele é na imagem de referência. ${ambienteClause.charAt(0).toUpperCase()}${ambienteClause.slice(1)}. Adicione personagem e ação dentro deste espaço real sem inventar novos elementos.${produtoGuard} NÃO invente outro lugar, NÃO substitua a arquitetura. ${anguloClause} O local deve ser reconhecível na imagem final.`,
    );
  }
  if (refs.fato) {
    parts.push(`⚠ FATO OBRIGATÓRIO — PRESERVAÇÃO TOTAL DA FOTO DO EVENTO:
Esta peça é um REGISTRO DOCUMENTAL. A foto enviada é o evento real — preserve-a fielmente.
PESSOAS: não altere rostos, poses, roupas nem número de pessoas. Mantenha exatamente como estão.
AMBIENTE: preserve arquitetura, móveis, decoração e espaço físico. O local deve ser reconhecível e idêntico.
LUZ: respeite a luz real do evento (sol, lâmpada, luz de janela). PERMITIDO melhorar tecnicamente: balanço de branco, contraste equilibrado, nitidez, clareza. PROIBIDO: criar luz cinematográfica artificial, mudar temperatura de cor radicalmente, dramatizar atmosfera.
COMPOSIÇÃO: respeite o enquadramento e ponto de vista originais.
PROIBIDO ABSOLUTAMENTE: alterar ou substituir pessoas, mudar ambiente, adicionar/remover elementos, dramatizar cores, inventar atmosfera, aplicar efeitos especiais.
A imagem final deve ser reconhecidamente o MESMO evento — apenas mais clara, nítida e tecnicamente melhorada.`);
  }
  if (refs.venda) {
    parts.push(`⚠ VENDA OBRIGATÓRIA — PRESERVAÇÃO TOTAL DA FOTO DO COLABORADOR COM O PRODUTO:
Esta peça é um REGISTRO REAL de apresentação/uso do produto. A foto enviada é a cena real — preserve-a fielmente.
PESSOA: não altere rosto, pose, roupa. Mantenha exatamente como está.
PRODUTO: preserve cor, formato, rótulo e embalagem — não troque, não invente outra versão.
AMBIENTE: preserve o espaço físico onde a foto foi tirada.
LUZ: respeite a luz real da foto. PERMITIDO melhorar tecnicamente: balanço de branco, contraste equilibrado, nitidez, clareza. PROIBIDO: criar luz cinematográfica artificial, dramatizar atmosfera.
PROIBIDO ABSOLUTAMENTE: alterar ou substituir a pessoa, trocar o produto, mudar ambiente, adicionar/remover elementos, dramatizar cores, aplicar efeitos especiais.
A imagem final deve ser reconhecidamente a MESMA cena — apenas mais clara, nítida e tecnicamente melhorada.`);
  }
  if (refs.produtos && refs.produtos.length) {
    const lista = refs.produtos.map((p) => `Produto ${p.num}`).join(", ");
    const telaClause = refs.produtoTelaInformativa
      ? " A TELA deste produto exibe conteúdo que É a identidade do produto — reproduza esse conteúdo de tela com NITIDEZ e LEGIBILIDADE total, sem desfoque, sem apagar, sem substituir por outra interface."
      : "";
    parts.push(
      `PRODUTOS SELECIONADOS (${lista}): elementos principais da composição. Preservar embalagem, formato, cores principais e características físicas. Apresentar de forma integrada à cena, evitando aparência de catálogo técnico ou montagem artificial.${telaClause}`,
    );
    parts.push(
      buildProductHierarchyBlock({
        produtosCount: refs.produtos.length,
        hasCenario: !!refs.cenario,
        hasAvatar: !!refs.avatar,
        segment: segment as Segment | undefined,
      }),
    );
  }
  // Quando há avatar mas NENHUMA referência de ambiente real (cenário,
  // fachada, fato ou venda): suprimir construção de ambiente pelo modelo —
  // sem isso, a edição de imagem tende a reaproveitar/estender o fundo da
  // própria foto do avatar como cenário, ou (em MARCA) inventar um ambiente
  // de "estilo de vida" para ilustrar o segmento. Antes essa trava também
  // desligava quando havia produto selecionado, deixando o caso avatar+produto
  // sem cenário sem nenhuma instrução de fundo.
  const hasAmbienteRef = !!(refs.cenario || refs.fachada || refs.fato || refs.venda);
  if (refs.avatar && !hasAmbienteRef) {
    const temProduto = !!(refs.produtos && refs.produtos.length);
    parts.push(
      `FUNDO NEUTRO OBRIGATÓRIO: nenhuma imagem de cenário foi enviada como referência. ` +
        `Usar FUNDO LIMPO, SUAVE e DESFOCADO: bokeh suave, gradiente neutro, textura vaga ou superfície indefinida atrás do avatar${temProduto ? " e do produto" : ""}. ` +
        `NÃO construir ambiente físico específico, sala, escritório, local identificável ou cenário de "estilo de vida" como fundo — mesmo que outras partes deste prompt mencionem contexto, atividade ou segmento.` +
        `${temProduto ? " O produto continua nítido e em destaque conforme a regra de protagonismo acima — apenas o ambiente ao redor fica neutro." : ""} ` +
        `NEGATIVE: detailed background, specific room interior, identifiable location behind person, lifestyle environment, sharp background, busy background, office furniture behind subject.`,
    );
  }
  parts.push(
    `INTEGRAÇÃO: combinar os elementos de forma natural, elegante e coerente — adapte iluminação, profundidade e atmosfera ao mood. Resultado deve parecer campanha visual profissional, não colagem.`,
  );
  return parts.join("\n\n");
}

export function buildPostUnicoPrompt(params: {
  data: PostUnicoFormData;
  kit: BrandKit;
  copy?: PostUnicoCopy;
  references?: PostUnicoReferences;
  forcedGender?: PersonagemGender;
  /** true quando é "Gerar outra imagem" — força execução visual diferente da anterior. */
  variationHint?: boolean;
}): string {
  const { data, kit, copy, references, forcedGender, variationHint } = params;
  const isNenhum = data.objetivo === "nenhum";
  const objetivo = isNenhum ? null : OBJETIVO_LABEL[data.objetivo];
  const tom = isNenhum ? null : OBJETIVO_TONE[data.objetivo];
  const direcao = direcaoBlock(
    data.direcao,
    data.mood,
    data.objetivo,
    !!references?.produtos?.length,
  );
  const variationBlock =
    data.direcao === "mood"
      ? pickImageVariationBlock(
          data.mood,
          !!references?.avatar,
          copy?.titulo,
          copy?.texto,
          forcedGender,
        )
      : "";
  // "Gerar outra imagem": mantém o MESMO título/texto, mas exige uma execução
  // visual claramente diferente da anterior (enquadramento, ângulo, composição,
  // cor de fundo, cena) — evita a peça sair idêntica na regeneração.
  const regenVariationBlock = variationHint
    ? `\n\n♻ NOVA VERSÃO: gere uma execução visual CLARAMENTE DIFERENTE da anterior — mude enquadramento, ângulo de câmera, composição, paleta de fundo e cena, mantendo o MESMO título e o MESMO texto de apoio. Não repita a imagem anterior.`
    : "";
  const primary = kit.primaryColor || "#123a63";
  const accent = kit.accentColor || kit.secondaryColor || "#f4b000";
  const zona = logoZoneDescription(kit.logoPosition);

  const typographyBlock = buildTypographyBlock(kit.fontPair);
  const typographyShort = buildTypographyShortRule(kit.fontPair);
  const scriptAccentBlock = kit.secondaryFont
    ? `\n${buildScriptAccentBlock(kit.secondaryFont, copy?.titulo || data.keyInfo || "")}\n`
    : "";

  const hasCopy = copy && (copy.titulo || copy.texto);
  const copyBlock = hasCopy
    ? `TÍTULO E TEXTO OBRIGATÓRIOS (use EXATAMENTE estas palavras como tipografia da peça — NÃO invente outros, NÃO traduza, NÃO reescreva):
TÍTULO: "${copy.titulo.toUpperCase()}"
TEXTO DE APOIO: "${copy.texto}"

Hierarquia tipográfica: título DOMINANTE em CAIXA ALTA — renderizado em tamanho grande e impactante (pense em outdoor, não em editorial compacto; o título deve ocupar ao menos 35-45% da altura útil do canvas). Texto de apoio como SUBTÍTULO DE REVISTA com corpo entre 55% e 70% do título — claramente legível a distância normal de celular, nunca tamanho de legenda ou rodapé. POSIÇÃO do bloco é livre — explore ancoragens (topo, lateral, base, barra inferior, dividido em zonas).
ACENTO DE COR NO TÍTULO: aplique a cor de acento da paleta (ou tom vibrante da paleta desta peça) em 1 palavra-chave ou na linha mais impactante do título — o restante fica em branco ou neutro. Este contraste de cor cria hierarquia visual e personalidade. Não obrigatório se a composição já tiver energia cromática suficiente, mas fortemente recomendado.
⚠ TÍTULO FIXO — ANTI-TRADUÇÃO LITERAL: o título acima é texto tipográfico a renderizar. "Conceito do título" = INTENÇÃO EMOCIONAL da mensagem (urgência, decisão, transformação, conquista), NÃO tradução de cada palavra em objeto visual. A CENA nasce do PAPEL DA EMPRESA e da ATIVIDADE REAL — nunca de palavras abstratas do título. Proibições diretas: "novo"/"novidade" ≠ caderno limpo, página em branco, objeto novo genérico; "ação"/"agir" ≠ seta, figura em movimento, objeto cinético; "rumo"/"caminho"/"direção" ≠ corredor, estrada, passagem, bússola, mapa, GPS, placa de sinalização; "hoje"/"agora" ≠ relógio, ampulheta, pôr do sol; "escolha"/"decisão" ≠ encruzilhada, bifurcação; "novo" ≠ porta se abrindo. A imagem APOIA a mensagem do título sem ILUSTRÁ-LA objeto por objeto.`
    : `TEXTO — CRIADO PELA IA A PARTIR DA INFORMAÇÃO-CHAVE (obrigatório em todas as peças):
A peça DEVE ter lettering — texto é SEMPRE obrigatório na composição visual.
Crie livremente: um TÍTULO curto em CAIXA ALTA (impacto direto, 3 a 6 palavras) + TEXTO DE APOIO breve (1-2 frases), inspirados na informação-chave${data.keyInfo.trim() ? ` "${data.keyInfo.trim()}"` : " fornecida"} e na atividade da empresa${objetivo ? ` com objetivo: ${objetivo}` : ""}.
⚠ REGRA ABSOLUTA DE TEXTO NA IMAGEM: a imagem contém EXATAMENTE 2 elementos de texto — (1) o TÍTULO em caixa alta e (2) o TEXTO DE APOIO. NENHUM outro texto, frase, citação ou trecho deve aparecer na imagem. A informação-chave é contexto criativo para INSPIRAR o título e o texto — JAMAIS deve aparecer escrita, citada ou resumida como terceiro elemento tipográfico na peça.
NÃO copie a informação-chave literalmente — interprete-a criativamente com tom publicitário.
PROIBIDO usar o nome da empresa ou da marca como título ou texto — inspire-se na mensagem, na atividade e na informação-chave, nunca no nome da empresa. O nome da marca é representado pela logomarca, não pelo texto da arte.
A IA tem TOTAL LIBERDADE de posição, estilo tipográfico e ancoragem do bloco de texto — pode estar em qualquer região da peça, EXCETO na zona reservada da logomarca. Explore ancoragens além do "bloco encostado na borda esquerda". A liberdade é de POSIÇÃO e ESTILO, não de ESCALA: o título não deve invadir nem dominar visualmente a peça inteira — deve sobrar respiro e espaço para a cena/imagem ao redor do bloco de texto.
Hierarquia tipográfica obrigatória:
• TÍTULO: DOMINANTE — renderizado em tamanho grande e impactante (pense em outdoor), ocupando entre 30% e 45% da altura útil do canvas (nunca mais que isso). A âncora é o CORPO da fonte permanecer grande e legível, não preencher área a qualquer custo: se o título tiver 4 ou mais palavras, quebre em 2-3 linhas para manter o corpo grande; se tiver 1-3 palavras, mantenha em 1-2 linhas — não infle artificialmente o corpo nem espalhe poucas palavras em muitas linhas só para preencher altura. Título curto ocupa naturalmente menos área, e isso é correto.
• TEXTO DE APOIO: SUBTÍTULO DE REVISTA — corpo entre 55% e 70% do título, facilmente legível a distância normal de celular (nunca tamanho de legenda ou rodapé; se o texto tiver 2-3 linhas, cada linha deve ser claramente lida sem aproximar o olho da tela).
• ACENTO DE COR: aplique a cor de acento da paleta em 1 palavra-chave ou linha do título para criar hierarquia e personalidade visual.
⚠ ANTI-TRADUÇÃO LITERAL DO TÍTULO CRIADO: ao criar o título e o texto acima, NÃO os transforme em objeto visual literal da cena. "Conceito do título" = INTENÇÃO EMOCIONAL da mensagem (urgência, decisão, transformação, conquista), NÃO tradução de cada palavra em objeto visual. A CENA nasce do PAPEL DA EMPRESA e da ATIVIDADE REAL — nunca de palavras do título que você mesmo escrever. Proibições diretas: "novo"/"novidade" ≠ caderno limpo, página em branco, objeto novo genérico; "ação"/"agir" ≠ seta, figura em movimento, objeto cinético; "rumo"/"caminho"/"direção" ≠ corredor, estrada, passagem, bússola, mapa, GPS, placa de sinalização; "hoje"/"agora" ≠ relógio, ampulheta, pôr do sol; "escolha"/"decisão" ≠ encruzilhada, bifurcação. A imagem APOIA a mensagem do título sem ILUSTRÁ-LA objeto por objeto.`;

  // Instrução de referência (avatar/cenário/produtos) com PRIORIDADE MÁXIMA —
  // posicionada junto das demais regras invioláveis, ANTES da descrição da peça
  // e da leitura de cena, para não competir e perder força para elas (mesma
  // estratégia aplicada no MOP — ver referenceAnchorBlock em api.ts).
  const refsBlock = referencesBlock(
    references,
    kit.segment,
    { primary, accent },
    data.objetivo,
    forcedGender,
  );
  const referenceAnchorBlock = refsBlock
    ? `⚠ REFERÊNCIA VISUAL ENVIADA — PRIORIDADE MÁXIMA: as instruções abaixo sobre a(s) imagem(ns) de referência têm PRECEDÊNCIA sobre qualquer elemento, ambiente, figurino ou personagem descrito no restante deste prompt, em caso de conflito.\n${refsBlock}\n\n`
    : "";

  // papelBlock usa buildSceneRoleRule() — fonte canônica em visualDirection.ts.
  //
  // "ação concreta" (includeConcreteAction: true) ativa apenas quando:
  //   - sem Kit Imagem ativo (refsBlock) — referência ancora e domina a cena;
  //   - objetivo não simbólico (homenagem/aviso — sem ação operacional clara);
  //   - mood não intencionalmente abstrato (OP-04/05/06 — fragmento/desvio/minimalismo).
  //
  // Trava anti-metáfora sempre ativa — buildSceneRoleRule({ includeConcreteAction: false })
  // retorna só a trava, sem "mostre ação concreta". Quando Kit Imagem ativo, a referência
  // domina avatar/produto/cenário; a trava anti-metáfora não conflita e permanece.
  const OBJETIVOS_SIMBOLICOS = new Set(["homenagem", "aviso"]);
  const MOODS_SIMBOLICOS = new Set(["OP-04", "OP-05", "OP-06"]);
  const moodEhSimbolico = data.direcao === "mood" && MOODS_SIMBOLICOS.has(data.mood ?? "");
  const showConcreteAction =
    !refsBlock && !OBJETIVOS_SIMBOLICOS.has(data.objetivo ?? "") && !moodEhSimbolico;
  // Quando a ação concreta é omitida (Kit Imagem ativo), preenche o vácuo com
  // um papel específico de segmento+objetivo, se houver um mapeado — ver
  // avatarRoleBlock acima.
  const roleBlock = !showConcreteAction
    ? avatarRoleBlock(kit.segment, data.objetivo, !!references?.avatar)
    : "";
  const papelBlock = `\n${buildSceneRoleRule({ includeConcreteAction: showConcreteAction })}${roleBlock ? `\n${roleBlock}` : ""}\n`;

  return `${buildDeviceRule(data.mainActivity || kit.mainActivity, references?.produtoTelaInformativa)}

${AMBIENTES_RULE}

${HUMANIZACAO_RULE}

${referenceAnchorBlock}Peça publicitária ÚNICA para Instagram, formato NATIVO 1080x1350px (4:5). NÃO carrossel, NÃO série — standalone.

ZONA SEGURA INVIOLÁVEL DE 110 PX em todas as bordas do canvas 1080x1350. Nada importante (rosto, olhos, mãos, produto-foco, lettering, gráficos, logo) entra nesse perímetro — bordas são continuação natural do fundo (ver regra específica de margem para título e texto de apoio nas REGRAS, abaixo).
IMAGEM FULL BLEED — REGRA ABSOLUTA: a imagem preenche o canvas 1080x1350 completamente de borda a borda. PROIBIDO: moldura externa, frame decorativo, borda de cor sólida ao redor da arte, vinheta escura periférica como contentor, margem vazia ou espaço branco/preto separando a imagem das bordas do canvas. A composição começa e termina nas bordas — sem nenhum container ou enquadramento ao redor.

⚠ REGRA INVIOLÁVEL — ZONA DA LOGOMARCA: ${zona.reservaTopo}
NENHUM ELEMENTO IMPORTANTE PODE SER COBERTO OU FICAR ATRÁS DA LOGOMARCA — planeje a composição já respeitando essa área antes de posicionar qualquer elemento.

EMPRESA: ${data.companyName || kit.companyName || "Marca"}
ATIVIDADE: ${data.mainActivity || kit.mainActivity || ""}
${objetivo ? `OBJETIVO: ${objetivo}\nTOM: ${tom}` : ""}

${
  data.keyInfo.trim()
    ? `INFORMAÇÃO-CHAVE (contexto criativo — USE APENAS para gerar o conceito e o texto da peça, PROIBIDO renderizar esta informação como texto, lettering, citação ou qualquer tipografia na imagem):\n"${data.keyInfo.trim()}"`
    : `INFORMAÇÃO-CHAVE: não fornecida. Crie a peça com base apenas na empresa, atividade, objetivo e kit visual — a IA tem TOTAL LIBERDADE para inventar o tema e a mensagem mais pertinente para esta marca e este objetivo.`
}

${copyBlock}
${CONCEITO_FIRST_RULE}
${papelBlock}
${direcao}${variationBlock}${regenVariationBlock}

${buildColorBlock(primary, accent, data.direcao === "mood", data.objetivo)}

${typographyBlock}
${scriptAccentBlock}
REGRAS:
- Esta peça é STANDALONE — não precisa parecer parte de uma série. Evite a fórmula visual mais óbvia para o briefing; escolha uma execução com personalidade própria dentro da direção definida.
- Todo texto em PORTUGUÊS, sem inglês
- ⚠ MARGEM DE 110 PX para título e texto de apoio (zona segura definida no topo do prompt) — texto que não caiba dentro da margem deve ser reduzido ou reposicionado, nunca cortado
- Alta resolução, estética editorial/publicitária brasileira
- Direção de arte humana, nunca arte automática
- Sem watermarks, sem logo fictícia, sem assinatura textual
- PROIBIDO ABSOLUTO: renderizar o nome da empresa, nome da marca ou razão social como texto, lettering, título ou qualquer elemento tipográfico na imagem — o nome da marca é representado exclusivamente pela logomarca aplicada separadamente. Nunca escreva o nome da empresa na arte.
- PROIBIDO ABSOLUTO: escrever, citar ou transcrever a INFORMAÇÃO-CHAVE do briefing como texto na imagem — ela é contexto de criação, não conteúdo tipográfico. A imagem contém apenas o TÍTULO e o TEXTO DE APOIO definidos acima; qualquer texto adicional (terceiro bloco, rodapé, tagline extra, citação) é PROIBIDO.
- Regras absolutas (dispositivos digitais, ambientes, humanização): ver início deste prompt
- ${zona.regraFinal}

${FORBIDDEN_MOOD_WORDS}`;
}

export interface PostUnicoCaption {
  texto: string;
  cta: string;
  hashtags: string[];
  full: string;
}

export async function generatePostUnicoCaption(
  data: PostUnicoFormData,
  opts?: { debit?: boolean; brandVoice?: string; preferredSlot?: string; previousCaption?: string },
): Promise<PostUnicoCaption> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.debit) {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      /* sem sessão: segue sem Authorization, o servidor trata */
    }
  }
  const res = await fetch("/api/generate-caption", {
    method: "POST",
    headers,
    body: JSON.stringify({
      companyName: data.companyName,
      mainActivity: data.mainActivity,
      objetivo: data.objetivo,
      keyInfo: data.keyInfo,
      brandVoice: opts?.brandVoice || "",
      debit: opts?.debit === true,
      ...(opts?.preferredSlot ? { preferredSlot: opts.preferredSlot } : {}),
      ...(opts?.previousCaption ? { previousCaption: opts.previousCaption } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao gerar legenda (${res.status})`);
  }
  const json = await res.json();
  const texto: string = json.texto || "";
  const cta: string = json.cta || "";
  const hashtags: string[] = Array.isArray(json.hashtags) ? json.hashtags : [];
  const tagLine = hashtags.map((t) => `#${t}`).join(" ");
  const bodyParts = [texto, cta].filter(Boolean);
  const body = bodyParts.length === 2 ? `${bodyParts[0]}\n\n${bodyParts[1]}` : bodyParts[0] || "";
  const full = body + (tagLine ? `\n\n${tagLine}` : "");
  return { texto, cta, hashtags, full };
}

export async function generatePostUnico(params: {
  data: PostUnicoFormData;
  kit: BrandKit;
  copy?: PostUnicoCopy;
  references?: PostUnicoReferences;
  preferredSlot?: string;
  forcedGender?: PersonagemGender;
  /** true quando é "Gerar outra imagem" — força execução visual diferente. */
  variationHint?: boolean;
}): Promise<string> {
  const { data, kit, copy, references, preferredSlot, forcedGender, variationHint } = params;
  const prompt = buildPostUnicoPrompt({ data, kit, copy, references, forcedGender, variationHint });

  // Coleta refs ordenadas: avatar -> uniforme -> cenário -> produtos por número.
  // Uniforme não é removido no retry sem avatar (foto sem rosto, não deve
  // disparar a recusa de rosto do gpt-image que motiva esse retry).
  const buildRefs = (withAvatar: boolean): string[] =>
    orderedReferenceImages(references, { withAvatar });

  const referenceImages = buildRefs(true);

  let dataUrl: string;
  try {
    dataUrl = await generateImageAsync({
      prompt,
      format: "post",
      referenceImages: referenceImages.length ? referenceImages : undefined,
      modulo: "pu",
      preferredSlot,
    });
  } catch (e) {
    // Se falhou com avatar + downstream_service_error (GPT Image 2 recusa rostos),
    // tenta novamente sem o avatar mantendo os demais refs.
    const msg = (e as Error).message || "";
    const isDownstream = msg.includes("downstream_service_error") || msg.includes("500");
    const hasAvatar = !!references?.avatar;
    if (isDownstream && hasAvatar) {
      const refsWithoutAvatar = buildRefs(false);
      dataUrl = await generateImageAsync({
        prompt,
        format: "post",
        referenceImages: refsWithoutAvatar.length ? refsWithoutAvatar : undefined,
        modulo: "pu",
        preferredSlot,
      });
    } else {
      throw e;
    }
  }

  // Aplica a logomarca localmente via canvas (mesma lógica do Método OP)
  const placeholderItem: FeedItem = {
    dia: 1,
    formato: "Estático",
    titulo: "",
    texto: "",
    legenda: "",
    imagem: "",
  };
  try {
    return await composeFeedPng(kit, placeholderItem, dataUrl);
  } catch {
    return dataUrl;
  }
}
