// Configuração estática por objetivo do Post Único — extraído de postUnico.ts (Fase 8).
// Dados puros (labels, tons, sensações, exclusões, arquétipos, paletas) consumidos
// por buildPuPrompt.ts.

import { MoodCode, PostUnicoObjetivo } from "../types";
import type { TonalidadeCandidata } from "../core/colorRotation";

export const OBJETIVO_LABEL: Record<PostUnicoObjetivo, string> = {
  promocao: "Promoção comercial — gerar desejo e ação",
  homenagem: "Homenagem — celebrar pessoa, data ou conquista com emoção",
  aviso: "Aviso institucional — comunicar com clareza e autoridade",
  oportunidade: "Oportunidade — sinalizar momento único, urgência elegante",
  institucional: "Institucional — reforçar posicionamento, propósito e autoridade da marca",
  fatos: "Fatos — registrar o evento como aconteceu, com fidelidade total ao real",
  venda: "Venda — apresentar produto/serviço em uso real, com fidelidade total à foto",
  nenhum: "Criação livre — sem objetivo definido",
};

export const OBJETIVO_TONE: Record<PostUnicoObjetivo, string> = {
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

export const MOOD_NAMES: Record<MoodCode, string> = {
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
export const OBJETIVO_SENSACAO: Record<Exclude<PostUnicoObjetivo, "nenhum">, string> = {
  institucional: "confiança, credibilidade, estabilidade, pertencimento ou profissionalismo",
  promocao: "energia, dinamismo, entusiasmo ou movimento comercial",
  oportunidade: "descoberta, possibilidade, renovação ou decisão estratégica",
  aviso: "atenção, orientação, segurança ou alerta controlado",
  homenagem: "gratidão, carinho, reconhecimento ou solenidade discreta",
  fatos: "autenticidade, realidade, fidelidade ao registro",
  venda: "confiança prática, demonstração real, proximidade comercial",
};

// Orientação criativa compacta por objetivo — 1 frase de direção positiva.
export const OBJETIVO_ORIENTACAO: Record<Exclude<PostUnicoObjetivo, "nenhum">, string> = {
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
export const OBJETIVO_VISUAL_EXCLUSIONS: Record<Exclude<PostUnicoObjetivo, "nenhum">, string> = {
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
export const LIVRE_TOTAL_ARCHETYPES: string[] = [
  "CONCEITO DESTA GERAÇÃO — LUZ COMO PROTAGONISTA: construa a peça em torno de uma fonte de luz marcante (natural ou dramática) — ela é quem dá personalidade à cena, não apenas a ilumina.",
  "CONCEITO DESTA GERAÇÃO — GESTO E DETALHE: close em um gesto, textura ou objeto que carregue atmosfera própria — composição macro ou meio-corpo, qualidade editorial, sem necessidade de explicar um produto ou serviço.",
  "CONCEITO DESTA GERAÇÃO — INSTANTE CAPTURADO: um momento real em andamento, espontâneo, não posado — a força da imagem vem da autenticidade do instante, não da encenação.",
  "CONCEITO DESTA GERAÇÃO — LINGUAGEM GRÁFICA OU CONCEITUAL: abordagem predominantemente gráfica, abstrata ou conceitual — cor, forma, ritmo e luz como linguagem própria, sem depender de uma cena literal.",
  "CONCEITO DESTA GERAÇÃO — ATMOSFERA DE AMBIENTE: o espaço/cenário como protagonista — luz, textura e profundidade construindo um universo visual com identidade própria.",
];

// Arquétipos visuais mutuamente distintos por objetivo — sorteados a cada geração livre
// para garantir diversidade de conceito entre chamadas sequenciais com o mesmo keyInfo.
// Não inclui "nenhum": ver LIVRE_TOTAL_ARCHETYPES e o branch dedicado em direcaoBlock.
export const OBJETIVO_ARCHETYPES: Record<Exclude<PostUnicoObjetivo, "nenhum">, string[]> = {
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

// "nenhum" não entra aqui: forçar uma paleta pré-definida (mesmo que "neutra")
// contradiz e neutraliza a liberdade cromática anunciada na combinação Livre+Nenhum
// — ver branch dedicado em buildColorBlock, que libera a escolha entre fria/quente.
// institucional/promocao/oportunidade também não entram aqui — migraram para
// OBJETIVO_TONALIDADES_ROTACAO (rodízio determinístico + observador, mesmo
// motivo do LIVRE_TONALIDADES abaixo). Os 4 objetivos restantes continuam com
// sorteio simples: não houve relato de convergência de cor para eles.
export const OBJETIVO_PALETAS: Record<
  Exclude<PostUnicoObjetivo, "nenhum" | "institucional" | "promocao" | "oportunidade">,
  string[]
> = {
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

// Tonalidades com rodízio determinístico + observador (ver pickTonalidade em
// core/colorRotation.ts) para os 3 objetivos com relato de convergência de cor
// no Direção Livre — mesmo texto de paleta que existia antes em OBJETIVO_PALETAS,
// agora com `hue` de referência para o observador de conflito com a cor de
// acento da marca. Os outros objetivos (aviso, homenagem, fatos, venda)
// continuam com sorteio simples em OBJETIVO_PALETAS, sem relato do problema.
export const OBJETIVO_TONALIDADES_ROTACAO: Record<
  "institucional" | "promocao" | "oportunidade",
  TonalidadeCandidata[]
> = {
  institucional: [
    {
      hue: 220,
      bloco: `PALETA DESTA PEÇA — CONFIANÇA: azul profundo, branco e cinza. Solidez institucional e credibilidade.`,
    },
    {
      hue: 195,
      bloco: `PALETA DESTA PEÇA — CREDIBILIDADE: azul petróleo, grafite e branco. Maturidade e autoridade discreta.`,
    },
    {
      hue: 185,
      bloco: `PALETA DESTA PEÇA — ESTABILIDADE: azul escuro, verde escuro e cinza. Presença de longo prazo.`,
    },
    {
      hue: 225,
      bloco: `PALETA DESTA PEÇA — PROFISSIONALISMO: azul marinho, prata e branco. Rigor e competência.`,
    },
    {
      hue: 215,
      bloco: `PALETA DESTA PEÇA — RESPEITO: grafite, azul profundo e bege claro. Sobriedade com calor humano.`,
    },
  ],
  promocao: [
    {
      hue: 35,
      bloco: `PALETA DESTA PEÇA — ENERGIA: laranja, amarelo e branco. Vitalidade que convida à ação imediata.`,
    },
    {
      hue: 12,
      bloco: `PALETA DESTA PEÇA — MOVIMENTO: vermelho moderado, laranja e cinza escuro. Dinamismo e urgência controlada.`,
    },
    {
      hue: 48,
      bloco: `PALETA DESTA PEÇA — OPORTUNIDADE CROMÁTICA: amarelo dourado, azul intenso e branco. Destaque e valorização da oferta.`,
    },
    {
      hue: 20,
      bloco: `PALETA DESTA PEÇA — ENTUSIASMO: coral, amarelo e azul claro. Animação e desejo de participação.`,
    },
    {
      hue: 28,
      bloco: `PALETA DESTA PEÇA — DINAMISMO: laranja vibrante, azul escuro e branco. Contraste que ativa o olhar.`,
    },
  ],
  oportunidade: [
    {
      hue: 185,
      bloco: `PALETA DESTA PEÇA — DESCOBERTA: turquesa, branco e azul céu. Abertura e novidade ao alcance.`,
    },
    {
      hue: 110,
      bloco: `PALETA DESTA PEÇA — RENOVAÇÃO: verde claro, branco e bege. Frescor e recomeço.`,
    },
    {
      hue: 42,
      bloco: `PALETA DESTA PEÇA — REALIZAÇÃO: dourado suave, laranja discreto e branco. Conquista e resultado concreto.`,
    },
    {
      hue: 235,
      bloco: `PALETA DESTA PEÇA — FUTURO: azul elétrico, violeta suave e prata. Inovação e antecipação.`,
    },
    {
      hue: 195,
      bloco: `PALETA DESTA PEÇA — POSSIBILIDADE: azul céu, turquesa e branco. Horizonte amplo e otimismo.`,
    },
  ],
};

// Tonalidades para Direção Livre + Objetivo "nenhum" (a combinação mais aberta
// do sistema — sem mood, sem objetivo, sem pool de cor até aqui). Rodízio
// determinístico por sessão (ver pickTonalidade em core/colorRotation.ts e
// postUnicoTonalidadeSeedRef em usePostUnicoGeneration.ts) substitui a escolha
// 100% delegada ao modelo de imagem, que convergia sempre nos mesmos 2
// atratores cromáticos (verde na primeira geração, azul na regeneração) para
// o mesmo briefing. `hue` (0-360) é usado apenas pelo observador de conflito
// com a cor de acento da marca — não aparece no prompt.
export const LIVRE_TONALIDADES: TonalidadeCandidata[] = [
  {
    hue: 210,
    bloco: `PALETA DESTA PEÇA — PROFUNDIDADE FRIA: azul petróleo profundo, grafite e branco. Sobriedade contemporânea, frieza sofisticada.`,
  },
  {
    hue: 30,
    bloco: `PALETA DESTA PEÇA — CALOR TERROSO: terracota, âmbar e areia clara. Autenticidade quente, energia contida.`,
  },
  {
    hue: 150,
    bloco: `PALETA DESTA PEÇA — FRESCOR NATURAL: verde esmeralda profundo, grafite e branco. Vitalidade sóbria, crescimento.`,
  },
  {
    hue: 330,
    bloco: `PALETA DESTA PEÇA — INTENSIDADE ELEGANTE: vinho borgonha, rosé queimado e creme. Presença marcante, sofisticação.`,
  },
  {
    hue: 270,
    bloco: `PALETA DESTA PEÇA — ORIGINALIDADE CRIATIVA: roxo ameixa profundo, malva e branco. Autoralidade discreta, personalidade própria.`,
  },
];

// Papel do personagem por segmento + objetivo — só relevante quando há avatar
// de referência ativo: nesse caso showConcreteAction fica false (a foto já
// ancora a composição), o que deixava nenhuma instrução sobre o que o avatar
// está fazendo ali (ver buildPostUnicoPrompt). Mapa pontual, começa só pelo
// caso reportado (MARCA + institucional); outras combinações seguem sem
// bloco específico até serem necessárias.
export const AVATAR_ROLE_BY_SEGMENT_OBJETIVO: Partial<Record<string, string>> = {
  // Avatar = exceção deliberada ao personagem-padrão (público-alvo, ver
  // documento de princípios 1.1): o usuário marcou avatar de propósito, então
  // aqui é o emissor (quem representa a marca) que aparece. Quando há produto
  // na cena, os dois (avatar e produto) dividem o protagonismo em peso igual
  // — mesmo princípio 50/50 de buildProductHierarchyBlock (MARCA) — em vez de
  // o avatar "apresentar" o produto como um acessório da composição.
  "MARCA:institucional":
    "PAPEL DO PERSONAGEM: o avatar representa, por escolha deliberada do usuário, o emissor da marca — postura confiante e serena, presença que comunica autoridade e propósito institucional, não está executando uma tarefa operacional do dia a dia. Quando há produto na cena, ele e o avatar dividem o protagonismo em PESO VISUAL IGUAL — nenhum dos dois reduzido a acessório ou plano de fundo do outro; os dois juntos representam a identidade da marca.",
  // Marca pessoal (documento de princípios, Parte 2.1): o dono/profissional É
  // a marca — não há equilíbrio 50/50 com o produto, o avatar é sempre quem
  // protagoniza, o produto (quando existir) fica em apoio.
  "MARCA:institucional:pessoal":
    "PAPEL DO PERSONAGEM: o avatar representa, por escolha deliberada do usuário, o emissor da marca — e nesta marca, que é pessoal, o profissional/dono É a própria marca. Postura confiante e serena, presença que comunica autoridade e propósito institucional. Quando há produto na cena, o avatar é o PROTAGONISTA absoluto e o produto fica em plano de apoio, secundário — sem disputar peso visual com a pessoa.",
};
