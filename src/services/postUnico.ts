import { BrandKit, LogoPosition, MoodCode, PostUnicoDirecao, PostUnicoFormData, PostUnicoObjetivo } from '../types';
import { composeFeedPng } from '../utils/canvasComposer';
import type { FeedItem } from '../types';
import { generateImageAsync } from './imageGeneration';
import { buildTypographyBlock, buildTypographyShortRule } from '../utils/typography';
import { getAuthHeaders } from './authHeaders';
import { buildMoodGrammarBlock, pickImageVariationBlock } from '../core/visualDirection';

const OBJETIVO_LABEL: Record<PostUnicoObjetivo, string> = {
  promocao: 'Promoção comercial — gerar desejo e ação',
  homenagem: 'Homenagem — celebrar pessoa, data ou conquista com emoção',
  aviso: 'Aviso institucional — comunicar com clareza e autoridade',
  oportunidade: 'Oportunidade — sinalizar momento único, urgência elegante',
  institucional: 'Institucional — reforçar posicionamento, propósito e autoridade da marca',
  fatos: 'Fatos — registrar o evento como aconteceu, com fidelidade total ao real',
  nenhum: 'Criação livre — sem objetivo definido',
};

const OBJETIVO_TONE: Record<PostUnicoObjetivo, string> = {
  promocao: 'energia comercial, desejo, movimento',
  homenagem: 'afeto, luz quente, respeito, contemplação',
  aviso: 'clareza institucional, autoridade tranquila',
  oportunidade: 'urgência contida antes da ação, contraste entre espera e movimento, energia direcionada, tensão antes do clique',
  institucional: 'sobriedade contemporânea, autoridade calma, identidade de marca, atemporalidade',
  fatos: 'documental, fidelidade ao momento, autenticidade, registro visual limpo, sem dramatização',
  nenhum: 'neutro, totalmente livre',
};

const MOOD_NAMES: Record<MoodCode, string> = {
  'OP-01': 'CLAREZA',
  'OP-02': 'IMPACTO',
  'OP-03': 'INSTANTE',
  'OP-04': 'FRAGMENTO',
  'OP-05': 'DESVIO',
  'OP-06': 'SILÊNCIO',
};

const FORBIDDEN_MOOD_WORDS = `PALAVRAS PROIBIDAS NA IMAGEM: NUNCA escreva, desenhe ou renderize como texto/lettering/título/etiqueta, em nenhum lugar da peça, as palavras CLAREZA, IMPACTO, INSTANTE, FRAGMENTO, DESVIO, SILÊNCIO, MOOD, OP-01, OP-02, OP-03, OP-04, OP-05, OP-06 — são códigos internos do sistema e nunca devem aparecer na arte final.`;

// Sensação visual desejada por objetivo — orienta a direção emocional da peça livre.
// "nenhum" não entra aqui: é tratado à parte em direcaoBlock (combinação Livre+Nenhum
// é a mais aberta do sistema e não deve herdar a obrigação "conectar ao negócio").
const OBJETIVO_SENSACAO: Record<Exclude<PostUnicoObjetivo, 'nenhum'>, string> = {
  institucional: 'confiança, credibilidade, estabilidade, pertencimento ou profissionalismo',
  promocao: 'energia, dinamismo, entusiasmo ou movimento comercial',
  oportunidade: 'descoberta, possibilidade, renovação ou decisão estratégica',
  aviso: 'atenção, orientação, segurança ou alerta controlado',
  homenagem: 'gratidão, carinho, reconhecimento ou solenidade discreta',
  fatos: 'autenticidade, realidade, fidelidade ao registro',
};

// Orientação criativa compacta por objetivo — 1 frase de direção positiva.
const OBJETIVO_ORIENTACAO: Record<Exclude<PostUnicoObjetivo, 'nenhum'>, string> = {
  institucional: 'Conectar à atividade real da empresa. Não virar prédio, parede lisa ou skyline.',
  promocao: 'Valorizar produto, benefício ou resultado sem símbolos promocionais óbvios.',
  oportunidade: 'Tensão de escolha, gesto decisivo ou atmosfera de possibilidade — sem clichê literal de caminho aberto.',
  aviso: 'Hierarquia visual clara e leitura rápida, mas elegante, humano e contextual.',
  homenagem: 'Humana, respeitosa, contextual — pode ser discreta, simbólica ou documental.',
  fatos: 'Preservar o registro real. Melhoria técnica apenas: clareza, nitidez, balanço de branco.',
};

// Exclusões visuais compactas por objetivo.
const OBJETIVO_VISUAL_EXCLUSIONS: Record<Exclude<PostUnicoObjetivo, 'nenhum'>, string> = {
  institucional: 'Evitar concreto aparente, parede lisa genérica, skyline, pessoa olhando janela e institucional stock.',
  promocao: 'Evitar sacola genérica, carrinho de supermercado, etiqueta flutuante, porcentagem como elemento principal e aparência de panfleto.',
  oportunidade: 'Evitar portais, portas abertas, arcos, pôr do sol, luz no fim do túnel, pessoa correndo e corredor de concreto.',
  aviso: 'Evitar alerta exagerado, placa genérica, triângulo de perigo e visual burocrático.',
  homenagem: 'Evitar buquê isolado, confete solto, vela genérica e pose sentimental stock.',
  fatos: 'Preservar registro real. Não inventar cena, pessoas, ambiente ou atmosfera. PERMITIDO APENAS: melhorias técnicas de luminosidade, contraste, balanço de branco, nitidez e resolução.',
};

// Arquétipos para a combinação mais aberta do sistema — Direção Livre + Objetivo Nenhum.
// Ao contrário dos arquétipos por objetivo (abaixo), estes NÃO amarram a cena ao negócio:
// servem apenas para variar a composição entre gerações sem reduzir a liberdade criativa.
const LIVRE_TOTAL_ARCHETYPES: string[] = [
  'CONCEITO DESTA GERAÇÃO — LUZ COMO PROTAGONISTA: construa a peça em torno de uma fonte de luz marcante (natural ou dramática) — ela é quem dá personalidade à cena, não apenas a ilumina.',
  'CONCEITO DESTA GERAÇÃO — GESTO E DETALHE: close em um gesto, textura ou objeto que carregue atmosfera própria — composição macro ou meio-corpo, qualidade editorial, sem necessidade de explicar um produto ou serviço.',
  'CONCEITO DESTA GERAÇÃO — INSTANTE CAPTURADO: um momento real em andamento, espontâneo, não posado — a força da imagem vem da autenticidade do instante, não da encenação.',
  'CONCEITO DESTA GERAÇÃO — LINGUAGEM GRÁFICA OU CONCEITUAL: abordagem predominantemente gráfica, abstrata ou conceitual — cor, forma, ritmo e luz como linguagem própria, sem depender de uma cena literal.',
  'CONCEITO DESTA GERAÇÃO — ATMOSFERA DE AMBIENTE: o espaço/cenário como protagonista — luz, textura e profundidade construindo um universo visual com identidade própria.',
];

// Arquétipos visuais mutuamente distintos por objetivo — sorteados a cada geração livre
// para garantir diversidade de conceito entre chamadas sequenciais com o mesmo keyInfo.
// Não inclui "nenhum": ver LIVRE_TOTAL_ARCHETYPES e o branch dedicado em direcaoBlock.
const OBJETIVO_ARCHETYPES: Record<Exclude<PostUnicoObjetivo, 'nenhum'>, string[]> = {
  oportunidade: [
    'CONCEITO DESTA GERAÇÃO — RELÓGIO / TEMPO: construa a peça em torno de um relógio analógico, detalhe de ponteiros ou ampulheta. A tensão visual vem do tempo que passa, não de movimento corporal. Composição com close preciso, luz controlada sobre o objeto.',
    'CONCEITO DESTA GERAÇÃO — GESTO DECISIVO: foco em close de mão em ação — assinando, apontando, segurando um objeto significativo, prestes a pressionar algo. Sem figura correndo. A urgência está no detalhe do gesto, não no movimento geral do corpo.',
    'CONCEITO DESTA GERAÇÃO — TENSÃO ESPACIAL: pessoa, produto ou objeto em posição de decisão dentro de um ambiente real — postura ou composição que sugere escolha, avanço ou momento favorável. A tensão vem da luz e do enquadramento. PROIBIDO: porta aberta como metáfora, portal, arco, limiar luminoso, luz no fim do túnel, pôr do sol, corredor de concreto ou estrutura industrial.',
    'CONCEITO DESTA GERAÇÃO — OBJETO SIMBÓLICO: elemento físico concreto que representa decisão e momento único (chave sobre superfície, carta fechada, aparelho em pausa, item característico do negócio). Composição limpa, sem pessoa como foco principal.',
    'CONCEITO DESTA GERAÇÃO — ABSTRAÇÃO CROMÁTICA: tensão visual construída por contraste de cor, luz e sombra, sem figura humana em movimento. Paleta audaciosa, composição geométrica, sensação de urgência pela energia visual — não pela narrativa de personagem.',
  ],
  promocao: [
    'CONCEITO DESTA GERAÇÃO — PRODUTO EM CONTEXTO: o produto ou serviço em uso real, integrado à vida cotidiana de quem o usa. Cena natural, não estúdio.',
    'CONCEITO DESTA GERAÇÃO — DETALHE SENSORIAL: close extremo em textura, superfície ou detalhe do produto/serviço que desperta desejo. Composição macro, qualidade editorial.',
    'CONCEITO DESTA GERAÇÃO — PESSOA E RESULTADO: avatar ou pessoa representando o benefício já conquistado — expressão, postura ou ambiente que comunica a transformação após a compra/contratação.',
    'CONCEITO DESTA GERAÇÃO — COMPOSIÇÃO GRÁFICA: abordagem predominantemente gráfica/tipográfica, com o produto representado de forma estilizada ou como elemento de design. Sem fotografia literal.',
    'CONCEITO DESTA GERAÇÃO — AMBIENTE DE MARCA: o cenário ou contexto da marca com atmosfera forte — sem foco em produto isolado, mas no universo que ele habita.',
  ],
  homenagem: [
    'CONCEITO DESTA GERAÇÃO — RETRATO COM LUZ: close de rosto ou perfil com luz quente e suave, expressão genuína, fundo desfocado com bokeh orgânico.',
    'CONCEITO DESTA GERAÇÃO — DETALHE SIMBÓLICO: objeto ou detalhe que representa a pessoa ou conquista homenageada — sem rosto, mas com identidade clara.',
    'CONCEITO DESTA GERAÇÃO — CENA DE CELEBRAÇÃO DISCRETA: momento de encontro ou conquista capturado de forma documental, sem pose, com emoção verdadeira.',
    'CONCEITO DESTA GERAÇÃO — COMPOSIÇÃO TIPOGRÁFICA: homenagem construída predominantemente pelo texto com fundo fotográfico suave e emocional.',
    'CONCEITO DESTA GERAÇÃO — NATUREZA E SÍMBOLO: elemento natural (luz, planta, água) como metáfora visual da celebração — sem clichê de flores isoladas.',
  ],
  aviso: [
    'CONCEITO DESTA GERAÇÃO — TIPOGRAFIA PROTAGONISTA: o comunicado como design — texto é o elemento visual principal, fundo limpo e autoridade na hierarquia.',
    'CONCEITO DESTA GERAÇÃO — ÍCONE DE AUTORIDADE: detalhe institucional (carimbo, papel oficial, detalhe arquitetônico da marca) que comunica credibilidade.',
    'CONCEITO DESTA GERAÇÃO — PESSOA INFORMANDO: avatar ou representante da empresa em postura de autoridade tranquila, comunicando diretamente.',
    'CONCEITO DESTA GERAÇÃO — AMBIENTE INSTITUCIONAL: espaço físico ou digital da marca como contexto do aviso — sem figura humana como foco.',
    'CONCEITO DESTA GERAÇÃO — COMPOSIÇÃO MINIMALISTA: peça com máxima economia visual — uma cor, um elemento, hierarquia cristalina.',
  ],
  institucional: [
    'CONCEITO DESTA GERAÇÃO — PROPÓSITO ABSTRATO: composição abstrata que traduz o valor da marca em cor, forma e luz — sem literalidade.',
    'CONCEITO DESTA GERAÇÃO — LUGAR DE PERTENCIMENTO: ambiente que comunica o universo da marca — espaço editorial caloroso, sala iluminada com textura humana, atelier de criação, escritório com personalidade, ambiente de trabalho real com vida. PROIBIDO neste conceito: concreto aparente, galpão industrial, corredor vazio ou qualquer estrutura fria — o "pertencimento" é humano e caloroso, não arquitetônico e frio.',
    'CONCEITO DESTA GERAÇÃO — PESSOA E IDENTIDADE: avatar ou representante da marca como incorporação dos seus valores — postura, olhar e contexto comunicam o posicionamento.',
    'CONCEITO DESTA GERAÇÃO — DETALHE DE OFÍCIO: close em ferramenta, material ou gesto específico do negócio — artesania, especialização, autoria.',
    'CONCEITO DESTA GERAÇÃO — TIPOGRAFIA DE MARCA: identidade visual construída pela tipografia e cor como protagonistas, com elemento fotográfico discreto de suporte.',
  ],
  fatos: [
    'CONCEITO DESTA GERAÇÃO — REGISTRO DOCUMENTAL FIEL: esta peça é um documento visual do evento. Preserve absolutamente: pessoas (mesmos rostos, posições, roupas), ambiente (mesma arquitetura, móveis, espaço), composição original. Melhore apenas: clareza, nitidez, balanço de branco, contraste para legibilidade. NÃO crie luz nova, NÃO mude atmosfera. O local e as pessoas devem ser reconhecíveis e idênticos ao original.',
    'CONCEITO DESTA GERAÇÃO — EVIDÊNCIA VISUAL DO MOMENTO: a imagem é prova de que o evento aconteceu. Pessoas em posições naturais originais, ambiente real preservado, luz ambiente respeitada. Calibração técnica permitida (brilho, contraste, nitidez). PROIBIDO: alterar qualquer pessoa, remover elementos, adicionar figuras, dramatizar visualmente. Resultado: o mesmo evento, visualmente mais claro e legível.',
    'CONCEITO DESTA GERAÇÃO — MOMENTO AUTÊNTICO REGISTRADO: capture a essência do evento sem interferência criativa. Preserve exatamente as pessoas presentes, o espaço onde ocorreu, a luz ambiente real. Apenas refinamento técnico é permitido. A peça final é o evento como aconteceu — não uma reinterpretação artística dele.',
  ],
};

function direcaoBlock(direcao: PostUnicoDirecao, mood?: MoodCode, objetivo?: PostUnicoObjetivo): string {
  if (direcao === 'mood' && mood) {
    return `DIREÇÃO (mood ${mood} ${MOOD_NAMES[mood]}):\n${buildMoodGrammarBlock(mood)}\n\nIMPORTANTE: esta peça é mood ${MOOD_NAMES[mood]} — NÃO use estética dos outros moods. Respeite rigorosamente a paleta, luz e composição descritas acima.`;
  }
  const obj = objetivo ?? 'nenhum';

  // Livre + Nenhum é a combinação mais aberta do sistema (sem mood, sem objetivo).
  // Tratada à parte: os mapas OBJETIVO_* pressupõem conexão obrigatória com o negócio,
  // o que contradiz e neutraliza a "liberdade total" — daí a falta de ousadia observada.
  if (obj === 'nenhum') {
    const archetypeHint = `\n\n${LIVRE_TOTAL_ARCHETYPES[Math.floor(Math.random() * LIVRE_TOTAL_ARCHETYPES.length)]}`;
    return `DIREÇÃO LIVRE — SEM TEMA OU OBJETIVO PRÉ-DEFINIDO: a IA tem liberdade total e real de direção de arte — não há mood, não há objetivo, não há obrigação de literalidade com o negócio.${archetypeHint}\n\nVarie ATIVAMENTE entre abordagens possíveis: luz natural OU dramática, paleta fria OU quente, fundo claro OU escuro, composição calma OU energética, predominantemente fotográfica OU gráfica OU conceitual. Escolha uma direção com personalidade própria, ouse e vá fundo nela — o critério é qualidade editorial e impacto visual, não utilidade comercial. Resultado: arte publicitária brasileira contemporânea de alto nível editorial. PROIBIDO: aparência de Canva/template/panfleto, gradient banal, ícones flat, estética de stock genérico, fórmula default "fundo escuro + luz dourada dramática" (essa é apenas UMA das opções, não a padrão).`;
  }

  const sensacao = OBJETIVO_SENSACAO[obj];
  const orientacao = OBJETIVO_ORIENTACAO[obj];
  const exclusion = OBJETIVO_VISUAL_EXCLUSIONS[obj];
  // Sorteia arquétipo visual para forçar diversidade entre gerações sequenciais.
  const archetypes = OBJETIVO_ARCHETYPES[obj];
  const archetypeHint = archetypes && archetypes.length
    ? `\n\n${archetypes[Math.floor(Math.random() * archetypes.length)]}`
    : '';
  return `DIREÇÃO LIVRE — SENSAÇÃO DESEJADA: ${sensacao}.\nOrientação: ${orientacao}\n\n${exclusion}${archetypeHint}\n\nA IA tem liberdade de direção de arte dentro do objetivo informado. Varie ATIVAMENTE entre abordagens visuais possíveis: pode ser luz natural suave OU dramática, paleta fria OU quente, fundo claro OU escuro, composição calma OU energética, predominantemente fotográfica OU gráfica OU mista. Escolha uma direção com personalidade própria e vá fundo nela. Resultado: arte publicitária brasileira contemporânea de alto nível editorial. PROIBIDO: aparência de Canva/template/panfleto, gradient banal, ícones flat, estética de stock genérico, fórmula default "fundo escuro + luz dourada dramática" (essa é apenas UMA das opções, não a padrão).`;
}

function logoZoneDescription(position: LogoPosition | undefined): { reservaTopo: string; regraFinal: string } {
  const pos = position || 'bottom-right';
  // IMPORTANTE: a "área da logo" deve ser PEQUENA (~10% da largura, ~6% da altura)
  // e parte natural da composição — NÃO um retângulo branco/vazio enorme.
  // Pode haver fundo, textura, fotografia ou cor de marca atrás; só evitamos
  // texto, rosto, objeto-foco e lettering exatamente sobre o ponto da logo,
  // mantendo contraste local suficiente para a marca ser legível.
  const base =
    'Área reservada inviolável (~18% × ~10%): PROIBIDO ABSOLUTO ali: texto, título, lettering, slogan, hashtag, número, rosto humano, mão, objeto-foco, gráfico, ícone, símbolo ou recorte de produto. NENHUM ELEMENTO IMPORTANTE PODE SER COBERTO PELA LOGO — ela será sobreposta depois. Área deve ser continuação natural da imagem (fundo, textura, céu, parede). PROIBIDO TAMBÉM: moldura, caixa, painel, badge, fundo de cor sólida, círculo, elipse, anel, halo, linha decorativa, pontilhado, tracejado ou ornamento em volta da zona. Apenas garanta contraste local suficiente para a logo ser legível.';
  if (pos === 'top-center') {
    return {
      reservaTopo: `Ponto da logo: TOPO CENTRAL. ${base}`,
      regraFinal: 'Topo central legível para a logo, sem dead space',
    };
  }
  if (pos === 'bottom-center') {
    return {
      reservaTopo: `Ponto da logo: BASE CENTRAL. ${base}`,
      regraFinal: 'Base central legível para a logo, sem dead space',
    };
  }
  return {
    reservaTopo: `Ponto da logo: CANTO INFERIOR DIREITO. ${base}`,
    regraFinal: 'Canto inferior direito legível para a logo, sem dead space',
  };
}

export interface PostUnicoCopy {
  titulo: string;
  texto: string;
}

export async function generatePostUnicoCopy(data: PostUnicoFormData, brandVoice?: string, segment?: string, preferredSlot?: string): Promise<PostUnicoCopy> {
  const auth = await getAuthHeaders();
  const res = await fetch('/api/generate-pu-copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      companyName: data.companyName,
      mainActivity: data.mainActivity,
      objetivo: data.objetivo,
      keyInfo: data.keyInfo,
      brandVoice: brandVoice || '',
      segment: segment || '',
      ...(preferredSlot ? { preferredSlot } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao gerar título e texto (${res.status})`);
  }
  const json = await res.json();
  return {
    titulo: String(json.titulo || '').trim(),
    texto: String(json.texto || '').trim(),
  };
}

export interface PostUnicoReferences {
  avatar?: string;
  cenario?: string;
  produtos?: { num: number; dataUrl: string }[];
}

function isClothingFriendly(hex: string): boolean {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  if (l < 0.35) return true;   // cores escuras: navy, vinho, verde-escuro → OK
  if (s < 0.25) return true;   // muito dessaturadas: cinzas, pastéis neutros → OK
  return false;                 // vivas + claras: laranja, amarelo, coral → não para roupa
}

function buildClothingPool(primary: string, accent: string): string[] {
  const pool = [
    'Roupa branca — neutra e limpa; cores da marca reservadas para fundo, grafismos ou tipografia.',
    'Roupa preta — neutra e forte; cores da marca em outros elementos da composição.',
    'Cinza claro ou chumbo — versátil, harmoniza com qualquer paleta de marca.',
    'Bege ou creme — neutro quente que complementa qualquer paleta.',
  ];
  if (isClothingFriendly(primary)) {
    pool.push(`Peça principal (camisa, blazer ou jaqueta) na cor primária da marca (${primary}).`);
  }
  if (isClothingFriendly(accent) && accent.toLowerCase() !== primary.toLowerCase()) {
    pool.push(`Destaque da cor de acento da marca (${accent}) em detalhe ou peça secundária sobre base neutra.`);
  }
  return pool;
}

// "nenhum" não entra aqui: forçar uma paleta pré-definida (mesmo que "neutra")
// contradiz e neutraliza a liberdade cromática anunciada na combinação Livre+Nenhum
// — ver branch dedicado em buildColorBlock, que libera a escolha entre fria/quente.
const OBJETIVO_PALETAS: Record<Exclude<PostUnicoObjetivo, 'nenhum'>, string[]> = {
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
    `PALETA DESTA PEÇA — CRESCIMENTO: verde médio, dourado suave e branco. Evolução e prosperidade.`,
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
};

function buildColorBlock(primary: string, accent: string, isMood: boolean, objetivo?: PostUnicoObjetivo): string {
  if (isMood) {
    return `Referência cromática da marca (subordinada ao mood): primária ${primary}, apoio ${accent}.`;
  }

  const obj = objetivo ?? 'nenhum';

  // Livre + Nenhum: liberar a cor por completo, coerente com a "liberdade total"
  // já anunciada em direcaoBlock — uma paleta pré-definida (mesmo "neutra") aqui
  // cancelaria a variação fria/quente prometida ali. Ver LIVRE_TOTAL_ARCHETYPES.
  if (obj === 'nenhum') {
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

function segmentRules(segment?: string): string {
  if (segment === 'VAREJO') {
    return 'CONTEXTO — SEGMENTO VAREJO: negócio de comercialização de produtos ao consumidor. Quando presentes, produtos comunicam desejo de compra e benefícios (apresentar de forma atraente, não como catálogo técnico); cenário cria atmosfera de experiência de compra ou lifestyle; avatar contextualiza atendimento ou uso do produto. O tom visual e textual é convidativo e orientado ao consumo.';
  }
  if (segment === 'MARCA') {
    return 'CONTEXTO — SEGMENTO MARCA: construção de identidade e posicionamento. Cenário e avatar transmitem percepção, estilo de vida e valores da marca; a composição reforça aspiração e propósito; produtos, se presentes, são ícones da identidade. O tom visual e textual é aspiracional e alinhado ao posicionamento da marca.';
  }
  return 'CONTEXTO — SEGMENTO SERVIÇOS: prestação de serviços especializados. Avatar (quando presente) transmite autoridade, competência e confiança do profissional ou da equipe; cenário reforça o contexto profissional; a composição comunica expertise, credibilidade e entrega de valor. O tom visual e textual é confiante e orientado ao resultado.';
}

function referencesBlock(refs?: PostUnicoReferences, segment?: string, kitColors?: { primary: string; accent: string }, objetivo?: PostUnicoObjetivo): string {
  if (!refs) return '';
  const parts: string[] = [];
  const elementos: string[] = [];
  if (refs.avatar) elementos.push('AVATAR');
  if (refs.cenario) elementos.push('CENÁRIO');
  if (refs.produtos && refs.produtos.length) elementos.push('PRODUTOS');
  if (!elementos.length) return '';

  parts.push(`ESTRUTURA VISUAL DA PEÇA — usar como REFERÊNCIA VISUAL (não copiar literalmente, não fazer colagem):`);
  parts.push(`Elementos enviados: ${elementos.join(', ')}.`);
  parts.push(segmentRules(segment));

  if (refs.avatar) {
    const clothingHint = kitColors
      ? (() => {
          const pool = buildClothingPool(kitColors.primary, kitColors.accent);
          return ` VESTUÁRIO: ${pool[Math.floor(Math.random() * pool.length)]}`;
        })()
      : '';
    parts.push(`AVATAR: a primeira imagem de referência é o avatar. Use como personagem da peça mantendo semelhança visual (rosto, perfil físico, faixa etária, gênero, expressão e características predominantes). Adapte postura e linguagem corporal ao contexto da atividade da empresa e ao mood. Aparência publicitária e realista — sem caricatura, sem distorção facial, sem clonagem exata da foto original.${clothingHint} REPERTÓRIO DE POSE/ENQUADRAMENTO (escolha conscientemente — NÃO caia automaticamente em "sentado à mesa com notebook olhando para a câmera"): pode estar em pé, andando, de perfil, de costas parcial, em meio gesto, em conversa com alguém fora de quadro, com material/produto em mãos, encostado em parede, em ambiente externo. NÃO é obrigatório olhar para a câmera. NÃO é obrigatório estar atrás de mesa com notebook. Enquadramento pode variar: close de rosto, meio corpo, corpo inteiro, três-quartos, OU peça sem rosto visível (mãos trabalhando, detalhe de gesto, ambiente com presença implícita). Escolha a combinação que melhor serve à mensagem desta peça específica.`);
  }
  if (refs.cenario) {
    if (objetivo === 'fatos') {
      parts.push(`⚠ OBJETIVO FATOS — PRESERVAÇÃO TOTAL DA FOTO DO EVENTO:
Esta peça é um REGISTRO DOCUMENTAL. A foto do cenário é o evento real — preserve-a fielmente.
PESSOAS: não altere rostos, poses, roupas nem número de pessoas. Mantenha exatamente como estão.
AMBIENTE: preserve arquitetura, móveis, decoração e espaço físico. O local deve ser reconhecível e idêntico.
LUZ: respeite a luz real do evento (sol, lâmpada, luz de janela). PERMITIDO melhorar tecnicamente: balanço de branco, contraste equilibrado, nitidez, clareza. PROIBIDO: criar luz cinematográfica artificial, mudar temperatura de cor radicalmente, dramatizar atmosfera.
COMPOSIÇÃO: respeite o enquadramento e ponto de vista originais.
PROIBIDO ABSOLUTAMENTE: alterar ou substituir pessoas, mudar ambiente, adicionar/remover elementos, dramatizar cores, inventar atmosfera, aplicar efeitos especiais.
A imagem final deve ser reconhecidamente o MESMO evento — apenas mais clara, nítida e tecnicamente melhorada.`);
    } else {
      parts.push(`CENÁRIO OBRIGATÓRIO: preserve FIELMENTE este espaço como ele é na imagem de referência.\n- Se for FACHADA, FRENTE DE LOJA ou EXTERIOR: mantenha a arquitetura, letreiros, identidade visual do local e ângulo da câmera reconhecíveis. A pessoa ou produto deve aparecer à frente, na entrada ou com a fachada claramente visível ao fundo. Quem conhece o local deve reconhecê-lo na peça. É PERMITIDO limpar a composição de elementos visuais indesejados — fios elétricos, postes, cabos aéreos, lixo ou poluição visual cruzando a fachada — e, se o céu aparecer, substituí-lo por um céu mais bonito e coerente com o mood/horário (azul limpo, entardecer dourado, nublado suave), desde que a arquitetura, os letreiros e a identidade visual permaneçam plenamente reconhecíveis e a peça não pareça artificial ou colada.\n- Se for AMBIENTE INTERNO: preserve a sala, móveis, equipamentos, paredes e ponto de vista. Adicione personagem e ação dentro deste espaço real sem inventar novos elementos.\nNÃO invente outro lugar, NÃO substitua a arquitetura, NÃO mude o ângulo. O local deve ser reconhecível na imagem final.`);
    }
  }
  if (refs.produtos && refs.produtos.length) {
    const lista = refs.produtos.map((p) => `Produto ${p.num}`).join(', ');
    parts.push(`PRODUTOS SELECIONADOS (${lista}): elementos principais da composição. Preservar embalagem, formato, cores principais e características físicas. Apresentar de forma integrada à cena, evitando aparência de catálogo técnico ou montagem artificial.`);
  }
  parts.push(`INTEGRAÇÃO: combinar os elementos de forma natural, elegante e coerente — adapte iluminação, profundidade e atmosfera ao mood. Resultado deve parecer campanha visual profissional, não colagem.`);
  return parts.join('\n\n');
}

export function buildPostUnicoPrompt(params: {
  data: PostUnicoFormData;
  kit: BrandKit;
  copy?: PostUnicoCopy;
  references?: PostUnicoReferences;
}): string {
  const { data, kit, copy, references } = params;
  const isNenhum = data.objetivo === 'nenhum';
  const objetivo = isNenhum ? null : OBJETIVO_LABEL[data.objetivo];
  const tom = isNenhum ? null : OBJETIVO_TONE[data.objetivo];
  const direcao = direcaoBlock(data.direcao, data.mood, data.objetivo);
  const variationBlock = data.direcao === 'mood' ? pickImageVariationBlock(data.mood, !!references?.avatar) : '';
  const primary = kit.primaryColor || '#123a63';
  const accent = kit.accentColor || kit.secondaryColor || '#f4b000';
  const zona = logoZoneDescription(kit.logoPosition);

  const typographyBlock = buildTypographyBlock(kit.fontPair);
  const typographyShort = buildTypographyShortRule(kit.fontPair);

  const hasCopy = copy && (copy.titulo || copy.texto);
  const copyBlock = hasCopy
    ? `TÍTULO E TEXTO OBRIGATÓRIOS (use EXATAMENTE estas palavras como tipografia da peça — NÃO invente outros, NÃO traduza, NÃO reescreva):
TÍTULO: "${copy.titulo}"
TEXTO DE APOIO: "${copy.texto}"

Hierarquia tipográfica: título dominante em CAIXA ALTA e texto de apoio com corpo em torno de 55% do título — menor que o título mas ainda legível sem zoom no celular — mas a POSIÇÃO do bloco é livre. Pode estar no topo, na lateral esquerda, na lateral direita, na base, sobreposto à imagem, em barra inferior, dividido em duas zonas da peça, ou ancorado em um canto. EVITE a fórmula default "bloco amarelo+branco encostado na borda esquerda ocupando metade da peça" se ela não for a melhor para esta composição específica — explore outras ancoragens. O fundo/cenário deve ter calor visual, textura orgânica ou composição cromática — NUNCA parede de concreto, estrutura industrial fria ou corredor vazio como solução para destacar o texto.`
    : `TEXTO — CRIADO PELA IA A PARTIR DA INFORMAÇÃO-CHAVE (obrigatório em todas as peças):
A peça DEVE ter lettering — texto é SEMPRE obrigatório na composição visual.
Crie livremente: um TÍTULO curto em CAIXA ALTA (impacto direto, até 6 palavras) + TEXTO DE APOIO breve (1-2 frases), inspirados na informação-chave${data.keyInfo.trim() ? ` "${data.keyInfo.trim()}"` : ' fornecida'} e na atividade da empresa${objetivo ? ` com objetivo: ${objetivo}` : ''}.
NÃO copie a informação-chave literalmente — interprete-a criativamente com tom publicitário.
PROIBIDO usar o nome da empresa ou da marca como título ou texto — inspire-se na mensagem, na atividade e na informação-chave, nunca no nome da empresa. O nome da marca é representado pela logomarca, não pelo texto da arte.
A IA tem TOTAL LIBERDADE de posição, estilo tipográfico e ancoragem do bloco de texto — pode estar em qualquer região da peça, em qualquer peso/fonte dentro da tipografia da marca, EXCETO na zona reservada da logomarca. Explore ancoragens além do "bloco encostado na borda esquerda".
Hierarquia tipográfica: título dominante em CAIXA ALTA e texto de apoio com corpo em torno de 55% do título — menor que o título mas ainda legível sem zoom no celular.`;

  // Instrução de referência (avatar/cenário/produtos) com PRIORIDADE MÁXIMA —
  // posicionada junto das demais regras invioláveis, ANTES da descrição da peça
  // e da leitura de cena, para não competir e perder força para elas (mesma
  // estratégia aplicada no MOP — ver referenceAnchorBlock em api.ts).
  const refsBlock = referencesBlock(references, kit.segment, { primary, accent }, data.objetivo);
  const referenceAnchorBlock = refsBlock
    ? `⚠ REFERÊNCIA VISUAL ENVIADA — PRIORIDADE MÁXIMA: as instruções abaixo sobre a(s) imagem(ns) de referência têm PRECEDÊNCIA sobre qualquer elemento, ambiente, figurino ou personagem descrito no restante deste prompt, em caso de conflito.\n${refsBlock}\n\n`
    : '';

  // Suprimido quando: (a) há Kit Imagem ativo (refsBlock) — a referência já ancora a
  // cena; ou (b) objetivo simbólico (homenagem/aviso) — "ação operacional" seria
  // inadequada para registros e comunicados.
  const OBJETIVOS_SIMBOLICOS = new Set(['homenagem', 'aviso']);
  const papelBlock = (!refsBlock && !OBJETIVOS_SIMBOLICOS.has(data.objetivo ?? ''))
    ? `\nASSUNTO DA CENA: mostre o que a empresa concretamente faz ou entrega nesta mensagem (com base no título, texto e informação-chave acima) — uma cena específica dessa atividade, não um retrato genérico do segmento. O mood define luz, clima e estética; nunca o assunto da cena.\n`
    : '';

  return `⚠ DISPOSITIVOS DIGITAIS — REGRA GLOBAL INVIOLÁVEL: PROIBIDO qualquer tela visível com conteúdo em notebook, laptop, tablet, iPad, celular, iPhone, monitor ou qualquer dispositivo — tela frontal ou traseira. CONTEÚDO PROIBIDO: gráfico, dashboard, imagem, interface, app, texto legível. DISPOSITIVO PERMITIDO APENAS COMO OBJETO: fechado, de lado, de costas, desfocado ou com tela apagada/neutra. MÁXIMO 1 DISPOSITIVO por cena — duplicação proibida. NEGATIVE: no visible screen content, no laptop screen facing viewer, no charts on screen, no dashboard, no UI, no app interface, no readable text on devices, no duplicated devices, screen must be blank dark off or out of focus.

⚠ AMBIENTES VISUAIS: PROIBIDO paredes de concreto aparente, galpões industriais, estruturas arquitetônicas frias, corredores vazios como elemento dominante ou fundo para tipografia. Use fundos coloridos, texturas orgânicas, desfoque, gradiente ou fotografia quente. PROIBIDO TAMBÉM: formas geométricas abstratas flutuando (círculos, esferas, polígonos, espirais) sem propósito narrativo. A composição deve ter TEMA CONCRETO — humano, objeto real, natureza, tipografia ou cenário com sentido.

⚠ HUMANIZAÇÃO: imagens devem parecer humanas, autênticas e reais. PROIBIDO inserir vasos, plantas ornamentais, folhas ou flores apenas para preencher cantos — todo elemento deve contribuir para a mensagem.

${referenceAnchorBlock}Peça publicitária ÚNICA para Instagram, formato NATIVO 1080x1350px (4:5). NÃO carrossel, NÃO série — standalone.

ZONA SEGURA INVIOLÁVEL DE 110 PX em todas as bordas do canvas 1080x1350. Nada importante (rosto, olhos, mãos, produto-foco, lettering, gráficos, logo) entra nesse perímetro — bordas são continuação natural do fundo (ver regra específica de margem para título e texto de apoio nas REGRAS, abaixo).
IMAGEM FULL BLEED — REGRA ABSOLUTA: a imagem preenche o canvas 1080x1350 completamente de borda a borda. PROIBIDO: moldura externa, frame decorativo, borda de cor sólida ao redor da arte, vinheta escura periférica como contentor, margem vazia ou espaço branco/preto separando a imagem das bordas do canvas. A composição começa e termina nas bordas — sem nenhum container ou enquadramento ao redor.

⚠ REGRA INVIOLÁVEL — ZONA DA LOGOMARCA: ${zona.reservaTopo}
NENHUM ELEMENTO IMPORTANTE PODE SER COBERTO OU FICAR ATRÁS DA LOGOMARCA — planeje a composição já respeitando essa área antes de posicionar qualquer elemento.

EMPRESA: ${data.companyName || kit.companyName || 'Marca'}
ATIVIDADE: ${data.mainActivity || kit.mainActivity || ''}
${objetivo ? `OBJETIVO: ${objetivo}\nTOM: ${tom}` : ''}

${data.keyInfo.trim()
  ? `INFORMAÇÃO-CHAVE (contexto — pode interpretar com liberdade visual):\n"${data.keyInfo.trim()}"`
  : `INFORMAÇÃO-CHAVE: não fornecida. Crie a peça com base apenas na empresa, atividade, objetivo e kit visual — a IA tem TOTAL LIBERDADE para inventar o tema e a mensagem mais pertinente para esta marca e este objetivo.`}

${copyBlock}
${papelBlock}
${direcao}${variationBlock}

${buildColorBlock(primary, accent, data.direcao === 'mood', data.objetivo)}

${typographyBlock}

REGRAS:
- Esta peça é STANDALONE — não precisa parecer parte de uma série. Evite a fórmula visual mais óbvia para o briefing; escolha uma execução com personalidade própria dentro da direção definida.
- Todo texto em PORTUGUÊS, sem inglês
- ⚠ MARGEM DE 110 PX INVIOLÁVEL PARA TÍTULO E TEXTO DE APOIO: o bloco de texto inteiro (título + texto de apoio, todas as linhas) fica DENTRO da área segura, a pelo menos 110 px de QUALQUER borda — topo, base, esquerda e direita. PROIBIDO letra, palavra ou linha tocando, cortando ou ultrapassando esse perímetro em qualquer direção. ANTES DE FINALIZAR A COMPOSIÇÃO: meça mentalmente a distância entre cada lado do bloco de texto (topo, base, esquerda, direita) e a borda mais próxima — se qualquer uma dessas distâncias for menor que 110 px, diminua o tamanho do bloco inteiro ou desloque sua posição até que TODAS as distâncias sejam iguais ou maiores que 110 px. A margem nunca pode ser sacrificada para acomodar o texto — reduzir ou reposicionar o texto é sempre a solução correta.
- Alta resolução, estética editorial/publicitária brasileira
- Direção de arte humana, nunca arte automática
- Sem watermarks, sem logo fictícia, sem assinatura textual
- PROIBIDO ABSOLUTO: renderizar o nome da empresa, nome da marca ou razão social como texto, lettering, título ou qualquer elemento tipográfico na imagem — o nome da marca é representado exclusivamente pela logomarca aplicada separadamente. Nunca escreva o nome da empresa na arte.
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
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.debit) {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {}
  }
  const res = await fetch('/api/generate-caption', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      companyName: data.companyName,
      mainActivity: data.mainActivity,
      objetivo: data.objetivo,
      keyInfo: data.keyInfo,
      brandVoice: opts?.brandVoice || '',
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
  const texto: string = json.texto || '';
  const cta: string = json.cta || '';
  const hashtags: string[] = Array.isArray(json.hashtags) ? json.hashtags : [];
  const tagLine = hashtags.map((t) => `#${t}`).join(' ');
  const bodyParts = [texto, cta].filter(Boolean);
  const body = bodyParts.length === 2
    ? `${bodyParts[0]}\n\n${bodyParts[1]}`
    : bodyParts[0] || '';
  const full = body + (tagLine ? `\n\n${tagLine}` : '');
  return { texto, cta, hashtags, full };
}

export async function generatePostUnico(params: {
  data: PostUnicoFormData;
  kit: BrandKit;
  copy?: PostUnicoCopy;
  references?: PostUnicoReferences;
  preferredSlot?: string;
}): Promise<string> {
  const { data, kit, copy, references, preferredSlot } = params;
  const prompt = buildPostUnicoPrompt({ data, kit, copy, references });

  // Coleta refs ordenadas: avatar -> cenário -> produtos por número.
  const buildRefs = (withAvatar: boolean): string[] => {
    const imgs: string[] = [];
    if (withAvatar && references?.avatar) imgs.push(references.avatar);
    if (references?.cenario) imgs.push(references.cenario);
    if (references?.produtos?.length) {
      for (const p of [...references.produtos].sort((a, b) => a.num - b.num)) {
        imgs.push(p.dataUrl);
      }
    }
    return imgs;
  };

  const referenceImages = buildRefs(true);

  let dataUrl: string;
  try {
    dataUrl = await generateImageAsync({
      prompt,
      format: 'post',
      referenceImages: referenceImages.length ? referenceImages : undefined,
      modulo: 'pu',
      preferredSlot,
    });
  } catch (e) {
    // Se falhou com avatar + downstream_service_error (GPT Image 2 recusa rostos),
    // tenta novamente sem o avatar mantendo os demais refs.
    const msg = (e as Error).message || '';
    const isDownstream = msg.includes('downstream_service_error') || msg.includes('500');
    const hasAvatar = !!references?.avatar;
    if (isDownstream && hasAvatar) {
      const refsWithoutAvatar = buildRefs(false);
      dataUrl = await generateImageAsync({
        prompt,
        format: 'post',
        referenceImages: refsWithoutAvatar.length ? refsWithoutAvatar : undefined,
        modulo: 'pu',
        preferredSlot,
      });
    } else {
      throw e;
    }
  }

  // Aplica a logomarca localmente via canvas (mesma lógica do Método OP)
  const placeholderItem: FeedItem = {
    dia: 1,
    formato: 'Estático',
    titulo: '',
    texto: '',
    legenda: '',
    imagem: '',
  };
  try {
    return await composeFeedPng(kit, placeholderItem, dataUrl);
  } catch {
    return dataUrl;
  }
}
