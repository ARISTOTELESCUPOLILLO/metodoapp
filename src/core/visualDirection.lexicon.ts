// Léxico interno por Mood × Segmento — extraído de visualDirection.ts (Fase 8).
// ⚠️ NÃO EXIBIR em UI, PDF, tooltip, export ou qualquer canal acessível ao usuário.
//
// CAMADA 1 — Tensão visual canônica (vocabulário Dondis): nomeia a tensão
//   inegociável do mood usando técnicas reconhecidas (Equilíbrio/Instabilidade,
//   Sutileza/Audácia, Simetria/Assimetria, etc.). O modelo de imagem reconhece
//   esse vocabulário e responde com mais precisão do que a "estética" sozinha.
//
// CAMADA 2 — Gramática visual por Mood (luz, paleta, composição, câmera): como
//   antes, governa COMO a cena é fotografada.
//
// CAMADA 3 — Modulação por Segmento (Serviços/Varejo/Marca): referência de
//   mercado e proibições prioritárias selecionadas conforme mood + segmento.
//   Não enviar integralmente — apenas negativas relevantes ao caso.

import { MoodCode, Segment } from "../types";

export interface VisualDirection {
  nome: string;
  // Tensão visual canônica (técnicas Dondis nomeadas, frase única).
  tensaoDondis: string;
  luz: string;
  paleta: string;
  composicao: string;
  camera: string;
  // Detalhe criativo discreto, característico do mood — um pequeno gesto
  // gráfico/cênico que assina a peça sem competir com o sujeito.
  detalheCriativo: string;
  // Assinatura técnica que SUBSTITUI o sufixo genérico de fotografia.
  assinatura: string;
}

export interface SegmentLayer {
  // Conceito de mercado em 1-2 frases — referência interna de direção.
  referenciaConcreta: string;
  // Vícios visuais e stock genérico a evitar — compacto, contextual.
  evitar: string;
}

export const VISUAL_DIRECTIONS: Record<MoodCode, VisualDirection> = {
  "OP-01": {
    nome: "CLAREZA",
    tensaoDondis:
      "Equilíbrio + Simetria + Regularidade + Previsibilidade — ordem visual que comunica controle e confiança no primeiro olhar",
    luz: 'luz natural difusa e suave, sem sombras duras; sensação de manhã clara e estável — a fonte exata (janela lateral única, alta-chave envolvente ou natural somada a luminária em quadro) é sorteada a cada geração (ver bloco "VARIAÇÕES SORTEADAS")',
    paleta:
      "paleta fria controlada (azuis, cinzas, branco quente) com UM único acento de cor saturada no elemento-chave",
    composicao:
      "composição simétrica e organizada, espaço negativo amplo e equilibrado, hierarquia limpa, alinhamento ortogonal",
    camera:
      'lente 35-85mm, enquadramento frontal ou 3/4 lateral suave, composição limpa e leitura imediata — distância, altura, lente e profundidade de campo exatas sorteadas a cada geração (ver bloco "VARIAÇÕES SORTEADAS"); PROIBIDO ângulo dramático em qualquer hipótese: nada de dutch angle, plongée mergulhado nem contra-plongée forte',
    detalheCriativo:
      "um único elemento-assinatura sutil em cena (linha geométrica fina, sombra projetada limpa, reflexo controlado em superfície polida ou objeto cotidiano alinhado com precisão milimétrica) que marca autoria sem atrapalhar a leitura",
    assinatura:
      "fotografia editorial luminosa, luz natural difusa, paleta fria com acento pontual, composição simétrica e respirada, lente 35-85mm",
  },
  "OP-02": {
    nome: "IMPACTO",
    tensaoDondis:
      "Audácia + Ênfase + Acento + Instabilidade controlada — UM elemento gritando sobre o resto, tensão dramática que para o scroll",
    luz: "luz focal direcional sobre fundo escuro médio, contraste pronunciado com alguma gradação, sombras recortadas sem extremismo — dramaticidade presente sem apagar completamente o fundo",
    paleta:
      "paleta low-key dominada por preto/grafete com UMA cor quente saturada (amarelo, laranja, vermelho) como acento dramático",
    composicao:
      "composição assimétrica com tensão, sujeito recortado pela luz, vazios escuros generosos, foco único concentrado",
    camera:
      "câmera 35mm, ângulo baixo leve (contra-plongée) ou 3/4 dinâmico, perspectiva forte mas natural, sensação cinematográfica — PROIBIDO câmera frontal reta na altura dos olhos, PROIBIDO plongée de cima para baixo, dutch angle apenas se muito sutil; câmera de cima para baixo enfraquece o impacto e diminui o personagem/produto",
    detalheCriativo:
      "um sinal gráfico mínimo nascido da luz (haste de luz cortando o quadro, partícula de poeira no facho, reflexo metálico recortado, contorno luminoso em uma única borda do sujeito) — pequeno, mas inconfundivelmente autoral",
    assinatura:
      "fotografia cinematográfica, luz focal direcional sobre fundo escuro médio, contraste pronunciado, paleta com acento quente saturado, lente 35mm, contra-plongée leve ou 3/4 dinâmico",
  },
  "OP-03": {
    nome: "INSTANTE",
    tensaoDondis:
      "Espontaneidade + Acaso + Atividade + Episodicidade — flagrante real, sem pose, momento que parece capturado por acidente",
    luz: "luz ambiente quente real, hora dourada ou interior natural sem estúdio, com pequenos vazamentos de luz",
    paleta:
      "paleta terrosa quente (âmbar, ocre, terracota, marrons), saturação orgânica, sem cor digital",
    composicao:
      "composição assimétrica capturada, sem pose, enquadramento de bastidor, elementos cotidianos no quadro, sensação de flagrante",
    camera:
      'câmera 35mm com leve grão de filme, autofoco em movimento, textura visível — altura e distância exatas sorteadas a cada geração (ver bloco "VARIAÇÕES SORTEADAS")',
    detalheCriativo:
      "um detalhe de bastidor verdadeiro deixado em cena (xícara desfocada em primeiro plano, mão cortada pela borda, anotação manuscrita parcial, fio de cabelo solto, lens flare orgânico) que comprova captura real",
    assinatura:
      "fotografia documental quente, luz ambiente da hora dourada, paleta terrosa, captura espontânea sem pose, lente 35mm com grão sutil",
  },
  "OP-04": {
    nome: "FRAGMENTO",
    tensaoDondis:
      "Fragmentação + Profusão + Complexidade + Justaposição — múltiplas unidades distintas costuradas pela mesma paleta, ritmo de catálogo editorial",
    luz: "luz neutra uniforme, sem direção dramática, sombras suaves e curtas, sensação de catálogo organizado",
    paleta:
      "paleta unificada em 3 tons máximos que amarram blocos visuais distintos, sem ruído cromático",
    composicao:
      "composição em grade implícita com 3 a 5 blocos visuais, múltiplos focos pequenos coexistindo, ritmo modular",
    camera:
      "câmera macro/detalhe alternando com plano médio, ponto de vista zenital ou frontal direto, vários planos colados",
    detalheCriativo:
      "um símbolo gráfico discreto repetido como assinatura editorial em UM dos blocos (ícone simples desenhado a traço fino, etiqueta numerada minúscula, marcação de catálogo, símbolo geométrico recorrente) costurando os fragmentos",
    assinatura:
      "fotografia editorial em grade modular, luz neutra uniforme, paleta de 3 tons unificados, blocos justapostos com ritmo de catálogo, planos macro e médio",
  },
  "OP-05": {
    nome: "DESVIO",
    tensaoDondis:
      "Instabilidade + Distorção + Acaso + Audácia — composição sem centro óbvio, escala ou perspectiva alteradas, ruptura simbólica que se descobre no segundo olhar",
    luz: "luz teatral em direção inesperada (de baixo, atrás, lateral extrema), iluminação que cria estranhamento controlado sem encobrir o sujeito",
    paleta:
      "paleta incomum mas legível, com combinações inesperadas e controladas: verde frio + magenta, azul profundo + ferrugem, lilás seco + mostarda, petróleo + coral queimado, vinho + azul elétrico suave — evitar excesso carnavalesco",
    composicao:
      "composição com elemento metafórico fora de lugar como ponto focal, escala alterada, sujeito principal sempre nítido e legível",
    camera:
      'ângulo e distância exatos sorteados a cada geração (ver bloco "VARIAÇÕES SORTEADAS") — sempre não-neutro, lente 28-35mm, distorção de perspectiva visível, foco no sujeito mantido',
    detalheCriativo:
      "UMA pequena ruptura simbólica embutida na cena (objeto flutuando levemente, sombra de algo que não está no quadro, escala trocada de um elemento, cor inesperada num único item cotidiano) — discreta, descoberta no segundo olhar",
    assinatura:
      "fotografia conceitual com luz teatral em direção inesperada, paleta incomum mas legível, elemento metafórico deslocado, perspectiva angulada lente 28-35mm",
  },
  "OP-06": {
    nome: "SILÊNCIO",
    tensaoDondis:
      "Sutileza + Neutralidade + Economia + Estase — quase ausência, contemplação retida, mínimo absoluto de elementos com vasto espaço respirando",
    luz: "luz suave alta-chave, vinda de fonte ampla e difusa, sombras quase ausentes, atmosfera serena",
    paleta:
      "paleta suave de baixa saturação e contraste contido: areia, off-white, cinza quente, bege rosado, verde sálvia claro, azul névoa, taupe, marfim envelhecido — evitar branco puro dominante e excesso de luminosidade",
    composicao:
      "composição com vasto espaço negativo, sujeito pequeno dentro do quadro, equilíbrio estático, mínimo absoluto de elementos",
    camera:
      'lente 50mm ou 70mm — ângulo e distância exatos sorteados a cada geração (ver bloco "VARIAÇÕES SORTEADAS"), composição sempre limpa, sem grão, acabamento suave e silencioso',
    detalheCriativo:
      "um único traço de assinatura premium (linha fina horizontal, ponto de cor minúsculo, sombra suave isolada, textura de papel sutil) flutuando no espaço negativo como gesto autoral mínimo",
    assinatura:
      "fotografia premium minimalista alta-chave, luz suave difusa, paleta suave areia/cinza quente/sálvia, vasto espaço negativo, lente 50-70mm sem grão",
  },
};

// Modulação por segmento — referência interna compacta.
// Apenas as negativas prioritárias devem ser enviadas ao prompt final —
// não enviar a tabela inteira. Quando um elemento fizer sentido real para
// o negócio e o tema, pode aparecer desde que não contrarie a gramática do mood.
export const SEGMENT_LAYERS: Record<MoodCode, Partial<Record<Segment, SegmentLayer>>> = {
  "OP-01": {
    SERVIÇOS: {
      referenciaConcreta:
        "Editorial de serviço com identidade de nicho: profissional em ato real do ofício, ambiente funcional e reconhecível, gesto derivado da atividade declarada no kit de marca.",
      evitar:
        "executivo/a de blazer posado como solução automática, laptop como barreira visual, sorriso largo institucional, headset genérico, aperto de mãos, equipe em reunião de banco de imagem, ambiente corporativo genérico quando o serviço é presencial, técnico, operacional ou local.",
    },
    VAREJO: {
      referenciaConcreta:
        "Editorial de varejo com identidade de produto: produto em uso real ou no contexto onde vive, pessoa em gesto de compra, uso ou produção derivado do universo real do produto.",
      evitar:
        "produto isolado em fundo branco de e-commerce, vitrine genérica sem contexto de uso, modelo posando neutro sem relação com o produto, exposição limpa demais sem vida real, composição fria demais a ponto de parecer SILÊNCIO.",
    },
    MARCA: {
      referenciaConcreta:
        "Manifesto visual de marca com identidade própria: símbolo ou território da marca em composição simétrica respirada, elemento coerente com o posicionamento declarado no kit.",
      evitar:
        "collage de diversidade corporativa genérica, grupo posando sorrindo para câmera, abstrato genérico sem ligação com a atividade real, símbolo solto desconectado do contexto, imagem institucional sem ação, sem objeto claro e sem leitura de marca.",
    },
  },
  "OP-02": {
    SERVIÇOS: {
      referenciaConcreta:
        "Fotografia de serviço com dramaticidade: profissional no momento de máxima intensidade do ofício, luz focal recortando gesto e expressão, ambiente pertencente ao espaço real.",
      evitar:
        "executivo em sala de reunião como padrão, dashboard de fundo como solução automática, headset genérico, pose de apresentação para clientes, personagem parado em autoridade artificial, escritório escuro repetido.",
    },
    VAREJO: {
      referenciaConcreta:
        "Fotografia de produto com dramaticidade cinematográfica: produto ou sujeito recortado pela luz como protagonista absoluto, fundo dramático que serve o produto.",
      evitar:
        "produto em fundo branco, vitrine sem tensão visual, modelo posando neutro, mosaico de produtos lado a lado, composição de catálogo comum.",
    },
    MARCA: {
      referenciaConcreta:
        "Manifesto visual de marca com dramaticidade: símbolo ou território da marca recortado pela luz dramática, atitude inconfundível derivada do posicionamento real da marca.",
      evitar:
        "pessoa posando institucional, fundo de gráfico como recurso genérico, cena de reunião, símbolo abstrato sem força, imagem corporativa escura sem tensão real.",
    },
  },
  "OP-03": {
    VAREJO: {
      referenciaConcreta:
        "Fotografia documental de varejo real: flagrante genuíno do momento — dono, atendente ou cliente em interação, produto sendo usado ou escolhido.",
      evitar:
        "modelo sorrindo para câmera, cena posada, produto isolado em superfície limpa, fundo branco, vitrine arrumada demais sem ação, fotografia com cara de catálogo.",
    },
    SERVIÇOS: {
      referenciaConcreta:
        "Fotografia documental de serviço em ação real: profissional flagrado em momento real de trabalho sem pose, gesto e ambiente pertencentes ao ofício específico.",
      evitar:
        "executivo posado, sorriso institucional, sala de reunião cenográfica, personagem olhando para câmera, cena limpa e montada demais, papel, bolsa ou caderno como solução automática.",
    },
    MARCA: {
      referenciaConcreta:
        "Fotografia documental da marca em seu território real: pessoas reais, momento espontâneo que revela o propósito sem precisar declarar.",
      evitar:
        'collage stock "people of the world", grupo posando, iluminação de estúdio, cena institucional montada, diversidade corporativa genérica, sorriso forçado.',
    },
  },
  "OP-04": {
    SERVIÇOS: {
      referenciaConcreta:
        "Editorial modular de serviço: grade costurando 3-5 blocos heterogêneos que revelam o universo do serviço — mãos, instrumentos, ambiente, textura de material.",
      evitar:
        "collage genérica de stock empilhada, infográfico flat com ícones óbvios, moodboard amador estilo Pinterest, blocos visuais sem hierarquia, excesso de imagens sem narrativa.",
    },
    VAREJO: {
      referenciaConcreta:
        "Editorial de varejo curado: grade costurando produto em detalhe, ambiente onde vive, gesto e textura — cada bloco revela um aspecto do universo do produto.",
      evitar:
        "grid de produtos em fundo branco de e-commerce, mosaico de Instagram com filtro, catálogo visual sem ritmo, repetição de produtos sem leitura editorial.",
    },
    MARCA: {
      referenciaConcreta:
        "Manifesto visual modular de marca: grade costurando gente real, lugar, gesto e símbolo — blocos heterogêneos que revelam o território da marca específica.",
      evitar:
        "grid de pessoas felizes posando, mosaico abstrato de formas geométricas sem narrativa, colagem corporativa genérica, múltiplos elementos sem assinatura editorial.",
    },
  },
  "OP-05": {
    MARCA: {
      referenciaConcreta:
        "Campanha conceitual de marca com metáfora visual: objeto real do universo da marca fora de lugar com intenção clara, leitura de duas camadas que revela o propósito.",
      evitar:
        "executivo em sala de reunião com paleta diferente, abstrato corporativo genérico, executivo sentado de blazer com mãos cruzadas mesmo com cena conceitual ao redor, símbolo solto sem relação com a atividade, surrealismo exagerado, excesso de metáforas simultâneas.",
    },
    SERVIÇOS: {
      referenciaConcreta:
        "Campanha de serviço com twist conceitual: profissional em situação real do ofício com desvio de escala, perspectiva ou objeto que cria estranhamento legível.",
      evitar:
        "executivo posado, dashboard de fundo como solução automática, headset genérico, pose institucional com mãos cruzadas mesmo com cor incomum, escritório corporativo como padrão, metáfora óbvia demais sem ângulo de câmera.",
    },
    VAREJO: {
      referenciaConcreta:
        "Campanha de varejo conceitual: produto em escala ou contexto inesperado como ponto focal, objeto do universo da loja fora de lugar com intenção clara.",
      evitar:
        "produto em fundo branco, vitrine genérica, composição de e-commerce padrão, produto flutuando sem conceito, metáfora visual exagerada sem relação com o tema.",
    },
  },
  "OP-06": {
    MARCA: {
      referenciaConcreta:
        "Editorial contemplativo de marca com presença mínima: objeto único ou fragmento humano em vasto espaço negativo. Se aparecer pessoa, fragmento parcial — nunca personagem central.",
      evitar:
        "pessoa posando, sorriso institucional, executiva/o de blazer, modelo corporativo, coworking, cena minimalista de Pinterest empresarial, símbolo genérico sem densidade.",
    },
    SERVIÇOS: {
      referenciaConcreta:
        "Editorial contemplativo de serviço: objeto único do ofício em vasto espaço, fragmento humano apenas se necessário (mão tocando o instrumento, sombra projetada).",
      evitar:
        "rosto inteiro posado, executivo de blazer em escritório clean, headset, coworking, reunião, mais de 1 objeto principal em foco, cena minimalista corporativa genérica.",
    },
    VAREJO: {
      referenciaConcreta:
        "Editorial contemplativo de produto: produto único em luz de janela e vasto espaço negativo, textura de superfície natural visível.",
      evitar:
        "produto em fundo branco de e-commerce, modelo posando, vitrine cheia, mais de 1 produto principal em foco, composição de catálogo minimalista genérico.",
    },
  },
};

export function getVisualDirection(mood: MoodCode): VisualDirection {
  return VISUAL_DIRECTIONS[mood] || VISUAL_DIRECTIONS["OP-01"];
}

// Variações de personagem por mood — o código sorteia uma a cada geração
// e injeta como instrução mandatória, impedindo repetição de padrão.
// INSTANTE: objeto capturado no flagrante deve ser coerente com o cotidiano real
// do personagem e o tema da mensagem. Proibido dispositivo digital nas mãos.
// Cada variação especifica AMBIENTE diferente para forçar diversidade de cenário
// — o ambiente desta variação SOBREPÕE o leituraCenica.ambiente original.
export const INSTANTE_CHARACTER_VARIATIONS: string[] = [
  "MOVIMENTO NATURAL EM AMBIENTE DE ATENDIMENTO OU PONTO DE VENDA, plano médio ou mais aberto: pessoa em movimento real dentro de loja, balcão, recepção ou espaço de atendimento — pegando produto, organizando prateleira, abrindo vitrine, chegando ao caixa, conferindo estoque visível. Ação interrompida no meio, sem pose. Olhar nunca para câmera. AMBIENTE: interior de loja, balcão ou espaço de atendimento com elementos visíveis do negócio ao fundo.",
  "MICRO-MOMENTO EM ÁREA DE PRODUÇÃO OU BASTIDOR, plano próximo ou médio: pessoa concentrada em tarefa manual real — preparando produto, ajustando equipamento, organizando bancada de trabalho, conferindo material, montando algo, finalizando produção. Proibido papel, caderno, documento, celular, tablet ou notebook. Expressão de concentração, flagrada sem posar. APLICAR SOMENTE quando o ofício real do negócio envolve produção, preparo ou manuseio físico (gastronomia, estética, oficina, comércio, manutenção, artesanato). Para serviços consultivos, analíticos, jurídicos, administrativos ou de orientação — sem produção física —, substituir por cena de análise de material, reunião de orientação ou revisão de documento no ambiente real do escritório, NUNCA inventar bancada de produção ou avental. AMBIENTE: cozinha profissional, oficina, área de preparo, estoque organizado ou bastidor de serviço — elementos do processo visíveis.",
  'REAÇÃO ESPONTÂNEA EM TRANSIÇÃO ENTRE AMBIENTES, plano médio: pessoa em situação real numa transição entre o interno e o externo (ou entre setores) — chegando, saindo, conversando com alguém fora de quadro, recebendo algo, verificando entorno, reagindo a algo específico. Reação natural e incompleta, sem pose. PROIBIDO gesto largo, centralizado, de braço aberto e olhar para cima como quem posa para anúncio publicitário — o gesto deve ser pequeno, incompleto e motivado por uma ação real (cumprimentar alguém fora de quadro com a mão a meio caminho, segurar a porta, ajustar a manga, apontar rapidamente para algo específico), nunca um gesto teatral de apresentação repetido entre gerações. PROIBIDO usar esta transição como tradução visual de palavras metafóricas do título ("rumo", "caminho", "direção", "passo", "virada") — o deslocamento nasce do cotidiano físico real do negócio, não da semântica do título. AMBIENTE: definido pela natureza real do negócio — pode ser entrada/fachada/calçada quando o negócio for físico e voltado à rua, ou recepção, hall, sala de reunião informal, corredor de acesso, varanda ou área comum quando o negócio for um escritório, estúdio ou agência; luz natural ambiente.',
  'TRANSIÇÃO OU DESLOCAMENTO ENTRE AMBIENTES, plano médio ou aberto: pessoa atravessando corredor, subindo ou descendo escada, passando por vão de porta, carregando algo de um setor a outro — capturada em pleno deslocamento real, nunca parada à espera do clique. Corpo em diagonal, passo em curso, olhar direcionado ao trajeto. APLICAR SOMENTE quando o ofício real do negócio envolve movimentação física entre espaços (comércio, produção, logística, serviço presencial). PROIBIDO usar este deslocamento como tradução visual de palavras metafóricas do título ("rumo", "caminho", "direção", "passo", "virada") — essas palavras descrevem intenção estratégica da mensagem, não ação física; para empresas de serviço cujo texto falar de campanha, estratégia, orientação ou decisão, substituir por cena de análise de material, revisão de peças ou conversa de orientação. AMBIENTE: corredor interno, escada, vão de porta, passagem entre setores ou ambientes do mesmo negócio — sensação de lugar vivo e em uso.',
  "PAUSA REAL NO MEIO DA TAREFA, plano próximo ou médio: pessoa interrompida por algo fora de quadro — vira a cabeça ao ouvir um som, pausa segurando um objeto a meio gesto, olha de relance para o lado, suspende um movimento por um instante. Expressão de interrupção genuína e breve, não de pose para retrato. AMBIENTE: balcão, mesa de trabalho, prateleira, vitrine, bancada — qualquer ponto do cotidiano real do negócio onde a pausa faça sentido.",
  'PAUSA SENTADA NO MEIO DA REVISÃO, plano próximo ou médio: pessoa sentada à mesa, bancada, estação de trabalho ou balcão, momentaneamente interrompida enquanto revisa, organiza ou confere algo — pausa breve e genuína, corpo relaxado mas atento, olhar desviado para algo fora de quadro. Sem pose de retrato corporativo. PROIBIDO papel, caderno, bloco de notas, documento, caneta, celular, tablet ou notebook como elemento obrigatório — o gesto e o ambiente pertencem ao ofício real do negócio, não à representação genérica de "quem escreve ou anota". AMBIENTE: mesa de trabalho, sala compartilhada, balcão de atendimento ou estação real do ofício — qualquer lugar onde sentar para revisar faça sentido no cotidiano do negócio.',
  "DIREÇÃO OU ALINHAMENTO EM PÉ, plano médio ou aberto: pessoa (ou duas) flagrada num momento de orientação ou decisão em pé — diante de mural com referências afixadas, quadro branco com anotações, parede com provas de arte ou impressões organizadas, OU conduzindo/apresentando algo a um interlocutor presente. Gesto de apontar, comparar, afixar ou explicar, capturado no meio da ação, sem pose. Olhar nunca para câmera. APLICAR PREFERENCIALMENTE quando o negócio é consultivo, criativo, de marketing, comunicação ou agência, sem ofício físico nem ponto de venda. PROIBIDO: dispositivo digital com tela visível, executivo de blazer posado, gesto teatral de apresentação publicitária — o material é físico (impresso, post-it, recorte, prova de arte), a parede ou mural é o ambiente. AMBIENTE: parede de referências, sala de criação, mural, espaço de agência real com material visível — vivo, não cenográfico.",
  // Índice 8 — acrescentada em 11/08/2026 no FIM do array de propósito: o pool
  // reduzido de SERVIÇOS/MARCA seleciona por índice ([2], [5], [6]), então
  // inserir no meio trocaria silenciosamente qual pose cada índice aponta.
  // Preenche a lacuna relacional do pool reduzido: das 3 opções que
  // SERVIÇOS/MARCA tinham, nenhuma garantia dois sujeitos em cena, enquanto o
  // TEMA_DERIVATION_RULE exige que a cena não negue um título relacional.
  "CONVERSA DE TRABALHO A DOIS, plano médio ou aberto: duas pessoas numa troca real de orientação, alinhamento ou explicação — de pé, ou apoiadas em superfície alta (peitoril, bancada, aparador, quina de mesa), NUNCA as duas sentadas frente a frente numa mesa de reunião. Uma conduz a conversa com gesto pequeno e a outra escuta e reage; a troca está no meio, não no começo nem no fim. Olhar entre as duas, nunca para a câmera. APLICAR quando o título ou o texto for relacional (menciona cliente, equipe, interação, escuta, orientação ou decisão conjunta) — a cena precisa ter dois sujeitos para não negar o que a peça diz. PROIBIDO aperto de mãos, sorriso institucional para a câmera, crachá, e material físico obrigatório nas mãos — a conversa se sustenta sozinha. AMBIENTE: qualquer ponto do espaço real de trabalho onde duas pessoas parariam para conversar — corredor, copa, canto de sala, junto a uma parede de referências, recepção.",
];

// A câmera do CLAREZA saiu daqui em 12/08/2026. Eram 2 variações que diziam a
// MESMA coisa em quase tudo — 50mm, plano médio ou americano, altura dos olhos —
// variando só frontal × 3/4 lateral. Distância, altura, lente, profundidade e
// luz ficavam congeladas, que é o conjunto que o olho lê como "de novo a mesma
// foto". Agora a linha é COMPOSTA por cinco eixos independentes, cada um com
// fila própria: ver buildClarezaCameraLine em core/cameraAxes.ts.
// O eixo horizontal (frontal × 3/4 lateral), única coisa que variava antes,
// continua declarado no campo `camera` de VISUAL_DIRECTIONS["OP-01"].

// Pool reduzido de INSTANTE para MARCA e SERVIÇOS — segmentos sem ponto de
// venda físico. As variações 0, 1, 3 e 4 carregam léxico de PDV/loja/prateleira
// que vazava para títulos e cenas mesmo com guardas textuais, então ficam de
// fora. VAREJO continua usando o pool completo.
//
// Centralizado aqui em 11/08/2026: os mesmos índices estavam escritos à mão em
// visualDirection.ts E em imageVariationPicker.ts, e qualquer inserção no meio
// do array trocaria silenciosamente a pose de um dos lados sem erro de
// compilação. Agora há uma definição só.
export const INSTANTE_POOL_SEM_PDV: string[] = [
  INSTANTE_CHARACTER_VARIATIONS[2], // reação espontânea em transição
  INSTANTE_CHARACTER_VARIATIONS[5], // pausa sentada na revisão
  INSTANTE_CHARACTER_VARIATIONS[6], // direção/alinhamento em pé
  INSTANTE_CHARACTER_VARIATIONS[7], // conversa de trabalho a dois
].filter(Boolean);

// Variação de câmera sorteada para INSTANTE. Até 11/08/2026 a câmera deste mood
// era UMA string fixa ("35mm levemente alta, distância natural, grão sutil") —
// sem sorteio nenhum. Combinada com o corte de pool em SERVIÇOS/MARCA (ver
// INSTANTE_CHARACTER_VARIATIONS), isso deixava o INSTANTE de uma empresa de
// serviço com 3 resultados possíveis no total, e o enquadramento era sempre o
// mesmo. Todas as variações mantêm 35mm e o grão sutil de propósito: a
// `assinatura` do mood, anexada ao fim de cada imagePrompt, declara "lente 35mm
// com grão sutil" — variar a lente aqui contradiria o fecho do próprio prompt.
// O que varia é ALTURA e DISTÂNCIA, que é o que estava travado.
// Câmera e estrutura de pose são sorteadas de forma independente e AMBAS citam
// plano — a pose porque sempre citou ("plano próximo ou médio"), a câmera porque
// variar distância era o objetivo da mudança. Em cerca de 1 de cada 4
// combinações as duas discordam.
//
// Valia só para o INSTANTE até 12/08/2026: o CLAREZA não precisava porque
// CLAREZA_PLANO_MEDIO_SENTENCE travava o plano no nível do mood. Com a câmera
// do CLAREZA passando a variar a distância (core/cameraAxes.ts) e a trava
// virando regra de rosto inteiro, o CLAREZA caiu no MESMO conflito — e as três
// poses dele também citam plano ("plano médio ou americano", "plano médio ou
// médio próximo", "plano próximo ou plano-detalhe"). Por isso a constante
// deixou de ter dono e passou a ser compartilhada pelos dois moods.
export const PRECEDENCIA_PLANO_SOBRE_POSE =
  "PRECEDÊNCIA DE ENQUADRAMENTO NESTA PEÇA: se a câmera sorteada e a estrutura de pose citarem planos diferentes, vale a DISTÂNCIA DA CÂMERA — a estrutura de pose entra com a ação, o gesto, a expressão e o ambiente, não com o enquadramento. A ALTURA da câmera é inegociável em qualquer hipótese. Exceção única: se a estrutura de pose exigir dois sujeitos em cena, recue o quanto for preciso para os dois caberem no quadro — aí a distância cede, a altura não. Quando esta peça pertencer a uma sequência que declare ARCO VISUAL, a ordem completa é: arco > câmera > pose. ";

// O prompt do MOP declara DUAS regras sobre distância de câmera ao mesmo tempo:
// o ARCO VISUAL DA SEQUÊNCIA e o ARCO VISUAL INTERNO DO CARROSSEL
// (organizaMethodEngine.ts), que obrigam cada peça a mudar de enquadramento —
// aberto na abertura, fechando até close no card 5, proibido repetir em cards
// consecutivos —, e a câmera sorteada, que vale para a geração inteira e diz
// "SEGUIR EXATAMENTE, SEM SUBSTITUIÇÃO". As duas citam plano; prompt que manda
// duas coisas opostas deixa o modelo escolher um lado (achado 12/08/2026, a
// mesma classe de bug do avatar que sumiu em 06/08).
//
// A distância fica com o ARCO: é narrativa da sequência e regra deliberada do
// produto, anterior a qualquer sorteio. O sorteio entra com o que o arco NÃO
// diz — altura, lente, luz e textura —, que é exatamente o eixo que não variava
// e fazia as peças parecerem a mesma foto refotografada.
export const ARCO_PRECEDENCIA_CAMERA =
  "PRECEDÊNCIA ENTRE A CÂMERA SORTEADA E O ARCO VISUAL: a câmera acima governa ALTURA, LENTE, LUZ, PROFUNDIDADE DE CAMPO e TEXTURA — e todas permanecem constantes em TODAS as peças desta geração, porque são o que dá unidade à sequência. A DISTÂNCIA não vem dela: o plano de cada peça (aberto, médio, médio-fechado, close) é o que o ARCO VISUAL DA SEQUÊNCIA e o ARCO VISUAL INTERNO DO CARROSSEL determinam, peça a peça. Onde a linha de câmera acima mencionar distância, plano ou enquadramento, essa parte específica CEDE ao arco — o resto dela continua valendo integralmente. Em resumo: altura, lente, luz e profundidade de campo não mudam ao longo da sequência; a distância muda a cada peça.";

export const INSTANTE_CAMERA_VARIATIONS: string[] = [
  "35mm levemente alta, distância natural, grão sutil — ponto de vista de quem passa pelo local e registra sem preparar a cena",
  "35mm na altura dos olhos, distância curta — enquadramento próximo, ombro e rosto ocupando boa parte do quadro, grão sutil, sensação de estar dentro da conversa",
  "35mm levemente baixa, distância natural — câmera um pouco abaixo da linha dos olhos, como quem registra sentado enquanto a ação acontece em pé, grão sutil",
  "35mm afastada, plano aberto — a pessoa ocupa parte menor do quadro e o ambiente de trabalho entra inteiro ao redor dela, grão sutil, flagrante visto de longe",
  "35mm na altura do peito, distância média com leve desvio lateral — enquadramento imperfeito de quem levantou a câmera sem mirar direito, grão sutil",
];

// FRAGMENTO: até 11/08/2026 este mood não entrava em NENHUM sorteio — nem
// personagem, nem câmera —, então a grade dos 3-5 blocos saía sempre com o
// mesmo arranjo e o mesmo ponto de vista. Sorteia-se aqui o ARRANJO da grade e
// o ponto de vista dominante, que é o que o olho lê como "outra peça". O
// conteúdo de cada bloco continua vindo do tema e do ofício real (MOOD_RULES).
// Todas as opções respeitam as duas leis do mood: 3 a 5 blocos
// (FRAGMENTO_BLOCOS_SENTENCE) e nenhum bloco encostando nas bordas do canvas.
export const FRAGMENTO_GRID_VARIATIONS: string[] = [
  "GRADE DE 3 BLOCOS ASSIMÉTRICA: um bloco dominante ocupando cerca de metade do quadro e 2 blocos menores empilhados ao lado. O bloco dominante traz o plano mais aberto (ambiente ou ação); os menores, detalhe e textura. Ponto de vista alternando frontal direto no maior e macro nos menores.",
  "GRADE DE 4 BLOCOS EM QUADRANTES: quatro blocos de área semelhante, separados por linha divisória sutil — visível ou apenas sugerida pelo alinhamento. Cada quadrante em uma distância E um ângulo diferentes — um macro zenital, um detalhe próximo lateral, um plano médio frontal, um de ambiente em três-quartos —, mantendo a mesma luz neutra uniforme entre eles.",
  "GRADE DE 5 BLOCOS EM RITMO EDITORIAL: uma faixa horizontal larga no topo, com o plano mais aberto, e 4 blocos menores em fileira abaixo, com detalhes e materiais. Os blocos pequenos alternam zenital e lateral rasante entre si — nunca todos no mesmo ângulo, porque o que costura a peça é a paleta, não a repetição do ponto de vista.",
  "TRÍPTICO VERTICAL: 3 blocos verticais de larguras diferentes, lado a lado, como colunas de página de revista. O bloco mais largo carrega a cena principal em plano médio frontal; os estreitos, recortes verticais de textura, material ou fragmento de gesto, cada um de um ângulo próprio (um de cima, um rasante) — as três colunas registram o mesmo universo de pontos de vista distintos.",
  "MOSAICO COM BLOCO CENTRAL: um bloco central menor e destacado, cercado por 3 ou 4 blocos periféricos maiores. O centro traz o detalhe macro mais específico do ofício; a periferia, ambiente e contexto em plano médio. Ponto de vista misto, com o centro em macro frontal e a periferia em ângulos variados.",
];

// Variação de câmera sorteada para IMPACTO (contra-plongée vs. 3/4 dinâmico).
export const IMPACTO_CAMERA_VARIATIONS: string[] = [
  "contra-plongée leve, lente 35mm, distância média — câmera ligeiramente abaixo da linha dos olhos, ângulo ascendente sutil que amplifica o impacto",
  "ângulo 3/4 dinâmico, lente 35mm, distância média — câmera levemente lateral, perspectiva cinematográfica sem ser extrema",
];

// CLAREZA: 3 opções sorteáveis. Sem objeto obrigatório na mão.
// A 3ª opção retira o rosto do centro — aumenta diversidade de enquadramento.
// Segmento e atividade podem orientar gesto e ambiente sem obrigar representação literal.
export const CLAREZA_CHARACTER_VARIATIONS: string[] = [
  "EM PÉ, plano médio ou americano — rosto e cabeça SEMPRE inteiramente dentro do quadro (nunca cortar no pescoço, queixo ou testa): postura natural, profissional, estável. Gesto funcional — atendimento, organização, observação, apresentação discreta, operação ou interação leve com o ambiente. Não obrigar objeto na mão. Personagem, gesto e ambiente podem refletir o segmento quando necessário, sem ser obrigatório nem literal.",
  "SENTADO, plano médio ou médio próximo — rosto e cabeça SEMPRE inteiramente dentro do quadro (nunca cortar no pescoço, queixo ou testa): postura organizada, calma, objetiva. A cena pode ocorrer em mesa, balcão, bancada, recepção, estação de trabalho, área de atendimento, ponto de venda, ambiente operacional limpo ou outro contexto adequado. Não depender de papel, caneta, caderno, tablet, celular ou notebook como elemento obrigatório. Personagem, gesto e ambiente podem refletir o segmento quando necessário, sem ser obrigatório nem literal.",
  "DETALHE CONTEXTUAL, plano próximo ou plano-detalhe: rosto não é dominante — a cena mostra mãos, gesto, objeto, produto, ferramenta, bancada, textura de material, documento discreto ou detalhe do ambiente de trabalho. O personagem existe pela presença parcial (mão, braço, silhueta). A cena continua clara, organizada, arejada e coerente com o segmento. Não transformar em stock genérico de fundo branco.",
];

// Gênero do personagem — sorteado para os moods com personagem central
// (CLAREZA, IMPACTO, INSTANTE), evitando que a informação-chave do conteúdo
// (ex.: "gestores, empresários") vicie a geração sempre para o masculino.
export const PERSONAGEM_GENDER_VARIATIONS: string[] = ["mulher", "homem"];

// IMPACTO: 7 opções sorteáveis, aplicáveis a múltiplos segmentos.
// Variações cobrindo ambientes, enquadramentos, posturas e tons emocionais
// distintos para garantir diversidade visual real entre gerações consecutivas.
// PROIBIDO personagem de costas/dorso para o observador em qualquer variação —
// a força dramática vem do rosto, perfil ou postura, nunca da nuca.
// Contra-plongée obrigatório — preferir objetos não-digitais nas poses com pessoa.
export const IMPACTO_CHARACTER_VARIATIONS: string[] = [
  "PESSOA EM AÇÃO, plano americano ou médio: movimento controlado — avanço, giro 3/4, deslocamento, gesto de decisão ou atitude de comando. Personagem ativo, determinado, sem pose publicitária. Não obrigar objeto na mão. Ambiente interior: escritório, loja, clínica, oficina ou espaço do ofício real com fundo escuro controlado.",
  "PESSOA COM ELEMENTO CONTEXTUAL, plano médio ou americano: interagindo com elemento simples e coerente com o contexto — produto, ferramenta, embalagem, material de trabalho, peça, equipamento, balcão, vitrine ou objeto simbólico do tema. Não obrigar papel, prancheta, tablet, celular ou notebook. Tom: concentração intensa.",
  "SUJEITO SEM PERSONAGEM DOMINANTE: produto, objeto, detalhe de operação, elemento da marca, serviço em execução ou cena contextual com presença humana secundária ou parcial. Foco único, luz recortada, composição dramática intensa. Usar quando produto, objeto ou marca for protagonista mais forte do que uma pessoa.",
  "PESSOA EM AMBIENTE EXTERNO OU INDUSTRIAL, plano americano ou médio: personagem em movimento ou ato do ofício em espaço aberto (rua, fachada, pátio, entrada) ou ambiente de produção (oficina, galpão, estoque, cozinha profissional). Câmera contra-plongée leve, luz focal de fonte externa ou artificial industrial. Tom: intensidade e garra.",
  "PERFIL EM CONTRA-LUZ, plano americano ou médio: personagem de PERFIL ou em ângulo 3/4 recortado por fonte de luz dramática (janela, porta, foco artificial), traços do rosto parcialmente visíveis mesmo em contraluz, postura e gesto identificáveis. PROIBIDO mostrar o personagem de costas ou dorso para o observador — o perfil ou o 3/4 é o que sustenta a força dramática. Fundo com fonte de luz visível ou desfoque de ambiente escuro.",
  "PESSOA SENTADA EM MOMENTO DECISIVO, plano médio ou médio próximo: postura de concentração intensa ou pausa tensa em mesa, bancada, estação de trabalho ou balcão real do ofício — gesto de decisão, análise ou espera carregada de tensão. Luz focal recortando rosto e mãos, fundo escuro controlado. Rosto sempre voltado em direção legível pela câmera (frontal 3/4 ou perfil) — nunca de costas. Tom: intensidade contida.",
  "CLOSE OU PLANO PRÓXIMO, busto ou face próxima: câmera bem próxima ao personagem, detalhe de expressão de determinação ou concentração, fundo escuro com luz recortando traços do rosto ou ombros. Nenhuma ação física necessária — a proximidade e a expressão criam a intensidade. Tom: autoridade calma.",
];

// SILÊNCIO: sorteia o tipo de sujeito/objeto isolado no espaço negativo.
// PROIBIDO: laptop ou notebook aberto como objeto principal, rosto inteiro posado,
// dispositivos digitais com tela visível, cenas com múltiplos elementos.
//
// ⚠️ LISTA DESLIGADA DE PROPÓSITO — declarada e não importada. Ela chegou a ser
// ligada em 11/08/2026 e foi DESLIGADA DE NOVO em 12/08/2026 por decisão do
// Aristóteles: sortear o sujeito é decidir a condição do mood (fragmento humano
// × objeto isolado × silhueta × macro), e o SILÊNCIO deve continuar como
// sempre foi. O que a Fase 1 podia destravar era posição e distância de câmera,
// luz e pose — a repetição que ela atacava era "pessoas sempre sentadas".
// Some-se a isso que as seis variações mandam a peça sair sem rosto: com avatar
// marcado, a de "mão ou fragmento de braço" apagou a pessoa numa peça real.
// Não religar sem decisão de produto explícita.
export const SILENCIO_OBJECT_VARIATIONS: string[] = [
  "OBJETO DO OFÍCIO ISOLADO, plano próximo: um único instrumento, ferramenta, material ou peça representativa do ofício REAL da empresa — definido pela leituraCenica e pelo kit de marca, nunca um item de outro ofício ou segmento (não inventar tesoura, pincel ou ferramenta de ofício alheio ao negócio descrito). Pode ser embalagem única centralizada, frasco de produto, peça de papelaria, objeto de papelaria de marca ou ferramenta manual coerente com a atividade real. Sem tecnologia, sem laptop, sem notebook. Vasto espaço negativo ao redor. Luz de janela natural, sombra suave e curta.",
  "FRAGMENTO HUMANO COM OBJETO, plano próximo: mão ou fragmento de braço tocando delicadamente um objeto do ofício real da empresa — mão aberta sobre superfície, ponta do dedo próxima a produto, palma em material de trabalho, dedos segurando objeto simples e coerente com o negócio. Sem rosto, sem corpo completo. Vasto espaço negativo acima e ao redor. Composição centralizada. Luz alta-chave suave de janela lateral.",
  "OBJETO EM SUPERFÍCIE TEXTURIZADA, plano próximo ou médio-próximo: um único objeto sobre superfície com textura visível e natural — mármore branco, madeira clara, tecido linho, papel artesanal, concreto suave. O contraste entre o objeto e a textura da superfície é a composição inteira. Sem presença humana, sem outros elementos. Luz difusa de janela.",
  "SILHUETA OU NUCA CONTEMPLATIVA, plano médio: personagem de costas ou de perfil extremo, ocupando menos de 25% da área total da imagem — o espaço vazio é o protagonista. Pessoa pequena diante de janela grande, parede ampla ou fundo neutro. Sem gesto significativo, sem ação — apenas presença silenciosa. Luz traseira ou lateral de janela. Sem rosto visível.",
  "DETALHE MÍNIMO EM MACRO, plano muito próximo: textura ou detalhe de material, produto ou ambiente do negócio — grão de café, fibra de tecido, superfície de embalagem, detalhe de ferramenta, textura de material de trabalho. Sem rosto, sem texto, sem logo. Fundo desfocado em paleta suave. A beleza está no detalhe ampliado. Composição centralizada ou em regra dos terços.",
  "QUADRO OU MOLDURA NA PAREDE, plano médio ou aberto: uma única peça emoldurada — quadro, fotografia, certificado, ilustração simples — pendurada em parede neutra e ampla, ocupando proporção pequena da composição e cercada de vasto espaço de parede vazia. Pode haver fragmento humano discreto por perto (mão, ombro, nuca), fora de foco ou de costas — nunca rosto em destaque. Sem texto legível na peça emoldurada. Luz lateral suave de janela revelando a textura da parede. Composição assimétrica e respirada — o quadro humaniza o ambiente sem se tornar o centro literal da mensagem.",
  "LIVRO OU MATERIAL DE LEITURA EM REPOUSO, plano próximo: um único livro fechado, caderno encadernado ou material de leitura pousado sobre mesa, banco ou prateleira — capa simples e neutra, sem texto legível em destaque, sem pilha excessiva. Pode estar ao lado de um objeto pessoal mínimo (xícara, óculos), desde que o conjunto permaneça enxuto. Vasto espaço negativo ao redor. Luz difusa de janela, sombra suave e curta. Sem presença humana — o objeto sugere a pausa de alguém que esteve ali.",
  "ÓCULOS OU OBJETO PESSOAL DELICADO SOBRE SUPERFÍCIE, plano próximo ou macro: um par de óculos, um relógio de pulso ou uma caneta pousados sozinhos sobre mesa, livro ou tecido — a presença humana é sugerida pelo objeto pessoal, nunca por uma pessoa em quadro. Composição centralizada ou em regra dos terços, fundo desfocado em paleta suave, luz alta-chave lateral. Um único objeto — nunca uma composição de vários itens pessoais espalhados.",
  "EQUIPAMENTO ANALÓGICO ATEMPORAL, plano próximo ou médio: um único equipamento não digital de caráter atemporal — câmera fotográfica analógica, rádio antigo, toca-discos, luminária de mesa clássica, relógio de parede, instrumento musical — pousado em repouso, desligado, sem tela e sem indicador luminoso. Comprova humanidade e história sem recorrer a tecnologia digital ou dispositivos com tela. Vasto espaço negativo ao redor, luz suave lateral de janela, sombra curta e natural.",
];

// Variação de câmera sorteada exclusivamente para SILÊNCIO — extraída dos
// objetos para evitar repetição: as menções de câmera embutidas em algumas
// variações (zenital, frontal) faziam o enquadramento convergir sempre para
// o mesmo padrão. Agora distância e ângulo são sorteados à parte, como no CLAREZA.
export const SILENCIO_CAMERA_VARIATIONS: string[] = [
  "CÂMERA PRÓXIMA: lente 50mm, enquadramento próximo, distância curta — o objeto ocupa proporção discreta do quadro com vasto entorno respirado",
  "CÂMERA ABERTA: lente 70mm, enquadramento médio-aberto, distância maior — o objeto fica ainda menor no quadro, espaço negativo dominante e sereno",
  "CÂMERA ZENITAL: vista de cima, lente 50mm, distância média — composição plana e geométrica, sombra curta projetada sobre a superfície",
  "CÂMERA EM ÂNGULO BAIXO SUAVE: lente 50mm, leve inclinação a partir de baixo, distância curta — o objeto ganha presença discreta sem dramaticidade, mantendo a serenidade do mood",
];

// DESVIO: sorteia tipo de ruptura simbólica (não personagem).
// 4 tipos distintos sem sobreposição — escala e posição/lugar são tipos separados.
// "Perspectiva impossível" removida: OP-05 já exige câmera angulada com distorção
// de perspectiva visível — duplicar isso via ruptura gera geometria quebrada.
// REGRA INEGOCIÁVEL DE INTEGRAÇÃO: o objeto simbólico DEVE estar integrado
// fisicamente na cena — sobre superfície, nas mãos do personagem ou embutido
// no ambiente. NUNCA flutuante nem sobreposto como recorte ou prop de fundo.
export const DESVIO_SYMBOLIC_RUPTURE_VARIATIONS: string[] = [
  'OBJETO DESLOCADO: objeto comum colocado em lugar inesperado dentro da cena — item de trabalho pousado em superfície incomum, peça cotidiana em posição estranha mas fisicamente apoiada no ambiente (sobre mesa, chão, parede, balcão). O objeto ESTÁ na cena, não voa nem flutua. O personagem se relaciona com o objeto deslocado — percebe-o, observa-o, toca-o, segura-o ou está fisicamente próximo dele — o estranhamento nasce do objeto estar fora de lugar, não da distância entre personagem e objeto. PROIBIDO posicionar os dois isolados em extremos opostos do quadro sem qualquer relação visual. Não usar como objeto da ruptura: livro, megafone, notebook, porta, chave solta, dashboard — nem clichês genéricos de "estratégia/ideia" (cobertos pela regra CONCEITO-FIRST). AMBIENTE: espaço doméstico com elemento profissional infiltrado — sala de estar, cozinha residencial, varanda, quarto — onde o contraste entre o cenário pessoal e o objeto de trabalho É o estranhamento; nunca escritório corporativo.',
  "SOMBRA OU AUSÊNCIA: a cena mostra a SOMBRA ou o REFLEXO projetado de algo que não está presente no quadro — sombra caindo sobre superfície real (chão, parede, mesa), nunca flutuante. O personagem e o ambiente estão nítidos; apenas a sombra revela o elemento ausente. A ausência sugere o problema ou a oportunidade da peça. Composição diagonal que destaca a sombra. AMBIENTE: espaço industrial ou de produção — galpão, oficina, estoque, fábrica, área de carga — com luz dura lateral de fonte única projetando a sombra do elemento ausente sobre piso ou parede real.",
  "ESCALA ALTERADA: um elemento cotidiano aparece MAIOR ou MENOR do que o esperado — mas integrado ao ambiente, fisicamente presente na cena. Objeto desproporcional pousado (enorme sobre a mesa, minúsculo nas mãos do personagem, gigante apoiado ao fundo). Personagem interage ou está próximo revelando a desproporção por comparação. AMBIENTE: espaço externo urbano — rua, calçada, fachada, pátio, marquise — onde a comparação de escala fica evidente à luz do dia, ao ar livre.",
  "COR INESPERADA: um único item cotidiano presente fisicamente na cena recebe cor incomum dentro da paleta do mood — objeto está na mão do personagem, sobre superfície ou integrado ao ambiente, não flutuante. Luz teatral lateral ou de baixo salienta o contraste cromático. Apenas esse elemento tem a cor conceitual; o restante da cena segue a paleta fria/escura do mood. AMBIENTE: galeria, vitrine, espaço expositivo ou fundo neutro de tom escuro controlado — onde o item de cor inesperada se isola visualmente sem concorrência de outros elementos.",
];

// Variação de câmera sorteada exclusivamente para DESVIO — extraída das rupturas
// para evitar repetição: antes, quase toda ruptura forçava o mesmo eixo
// contra-plongée/abaixo da cintura, fazendo o ângulo e a distância da câmera
// se repetirem entre gerações (inclusive em "Gerar outra"). Agora ângulo e
// distância são sorteados de forma independente da ruptura, como no CLAREZA.
export const DESVIO_CAMERA_VARIATIONS: string[] = [
  "CONTRA-PLONGÉE SUAVE: câmera ligeiramente abaixo da linha dos olhos do personagem ou objeto — inclinação discreta, NUNCA extrema ou caricata —, lente 35mm, distância média. O leve ângulo ascendente sugere o estranhamento de forma sutil, percebida no segundo olhar, sem dramatizar a perspectiva.",
  "PLONGÉE ACENTUADA: câmera nitidamente acima da cabeça do personagem ou do objeto, lente 28-35mm, enquadramento médio — observador olha de cima, sensação de distanciamento que revela o estranhamento",
  "LATERAL RASANTE AO CHÃO: câmera quase ao nível do piso, ângulo lateral extremo, lente 28mm, distância curta — composição diagonal que distorce a perspectiva sem recorrer ao eixo vertical",
  "DIAGONAL HOLANDESA (DUTCH ANGLE): câmera na altura dos olhos, porém o quadro inteiro rotacionado em diagonal (10-15°), lente 35mm, distância média — o desequilíbrio nasce da inclinação do enquadramento (horizonte e linhas verticais visivelmente tortos), não da posição vertical da câmera — uma forma de estranhamento sem recorrer a contra-plongée ou plongée",
  "PLANO FECHADO ANGULADO: câmera próxima — enquadramento de rosto, mãos ou detalhe do personagem com o objeto da ruptura no entorno imediato —, levemente angulada a partir de um lado (nunca frontal neutra), lente 50mm, profundidade de campo rasa. A proximidade aumenta a tensão e a leitura íntima do estranhamento, rompendo o padrão de planos médios/abertos das demais variações.",
];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Sentenças de dispositivo de CLAREZA e FRAGMENTO, extraídas para permitir
// substituição quando este prompt já tem a regra global de "PROIBIDO qualquer
// dispositivo" ativa (produto físico referenciado, ou ofício não-digital —
// ver buildDeviceRule/buildNoDeviceProdutoFisicoRule em promptRules.ts). Sem
// essa reconciliação, o mesmo prompt continha "PROIBIDO incluir... qualquer
// dispositivo digital" (regra global) E "notebook/laptop/tablet SÃO
// BEM-VINDOS... DEVE coexistir com pelo menos 1 dispositivo digital" (CLAREZA)
// ao mesmo tempo — achado real (Loja Rocha, PU, CLAREZA + terno referenciado).
export const CLAREZA_DEVICE_WELCOME_SENTENCE =
  "DISPOSITIVOS EM CLAREZA — REGRA DO SÉCULO DIGITAL: notebook, laptop e tablet SÃO BEM-VINDOS e representam trabalho real. PROIBIDO APENAS: mostrar imagem, conteúdo, interface ou qualquer elemento visual NA TELA FRONTAL, NA TAMPA ou NA CARCAÇA do dispositivo — tela deve estar neutra/escura ou com brilho difuso sem conteúdo legível; tampa e carcaça lisas. O dispositivo pode estar em qualquer ângulo (aberto sobre a mesa em plongée, lateral, em mãos, de lado) — a restrição é o CONTEÚDO visível, não a posição nem o ângulo. NEGATIVE: image on laptop screen, visible screen content, image on laptop lid or casing. ";

// A obrigação de "coexistir com pelo menos 1 dispositivo digital" saiu em
// 12/08/2026, por decisão do Aristóteles: era ela que punha notebook/tablet em
// quase toda peça de CLAREZA — o modelo lia a exigência positiva e resolvia
// sempre pelo mesmo móvel, ainda mais porque a própria frase listava "notebook"
// como primeiro exemplo. O dispositivo continua BEM-VINDO em qualquer negócio
// (decisão dele: o ofício de agência/serviço passa por tela e precisa mostrar
// tecnologia — ver CLAREZA_DEVICE_WELCOME_SENTENCE, intocada, que é onde mora a
// proibição de conteúdo em tela/tampa/carcaça). O que muda é só o regime:
// deixa de ser OBRIGAÇÃO e vira OPÇÃO condicionada a ter função na cena.
// O resto da frase — papel não pode ser o único material, e nada de grafismo
// flutuante no lugar de objeto real — permanece.
export const CLAREZA_MATERIAL_TRABALHO_SENTENCE =
  "MATERIAL DE TRABALHO EM CLAREZA: papel ou documento físico NUNCA pode ser o ÚNICO elemento de trabalho visível na cena — mesa coberta de folhas como único sinal de trabalho é clichê de banco de imagem. Ao lado do material físico deve haver OBJETO REAL DO OFÍCIO da empresa: ferramenta, equipamento, insumo, produto, instrumento, mostruário, superfície ou material do próprio negócio. Um dispositivo digital (celular, tablet, monitor de desktop, notebook) é UMA das opções válidas e continua bem-vindo sempre que tiver função na ação que está acontecendo — mas NÃO é obrigatório, NÃO precisa entrar só porque há papel na cena e NÃO é preenchimento automático de mesa. PROIBIDO tratar notebook ou laptop como mobiliário padrão que reaparece em toda peça: sem função na ação, ele fica fora do quadro. Cor abstrata, ícone ou imagem decorativa no lugar de objetos reais são igualmente inadequados — a cena deve ter objetos reconhecíveis do ofício real, não elementos gráficos flutuantes. ";

// Versão para quando a regra global já baniu dispositivo digital nesta peça.
// Antes, esse caso simplesmente APAGAVA a frase inteira (replace por ""), o que
// levava junto a exigência de objeto real do ofício e a proibição de grafismo
// flutuante — nada disso tem a ver com dispositivo. Agora só a opção digital sai.
export const CLAREZA_MATERIAL_TRABALHO_SUPPRESSED =
  "MATERIAL DE TRABALHO EM CLAREZA — SEM DISPOSITIVO NESTA PEÇA: papel ou documento físico NUNCA pode ser o ÚNICO elemento de trabalho visível na cena. Ao lado do material físico deve haver OBJETO REAL DO OFÍCIO da empresa: ferramenta, equipamento, insumo, produto, instrumento, mostruário, superfície ou material do próprio negócio — nunca um dispositivo digital, que está proibido nesta peça (ver regra de dispositivos digitais no início deste prompt). Cor abstrata, ícone ou imagem decorativa no lugar de objetos reais são igualmente inadequados — a cena deve ter objetos reconhecíveis do ofício real, não elementos gráficos flutuantes. ";

export const CLAREZA_DEVICE_CLAUSE_SUPPRESSED =
  "DISPOSITIVOS EM CLAREZA — EXCEÇÃO NESTA PEÇA: há um produto físico referenciado (ou o ofício real não passa por tela) que já é o elemento concreto e o foco da composição — ver regra de dispositivos digitais no início deste prompt. Por isso NENHUM dispositivo digital aparece nesta cena, mesmo que CLAREZA normalmente os receba bem. ";

export const FRAGMENTO_DEVICE_CONDITIONAL_SENTENCE =
  "OBJETO CONDICIONAL NESTE MOOD: notebook ou laptop FECHADO, de lado, de costas ou com tela apagada/escura PODE aparecer como UM dos blocos — mas SOMENTE se o ofício real do negócio (definido pela leituraCenica e pelo kit de marca) genuinamente envolve trabalho de escritório, computador ou tela no dia a dia (ex.: consultoria, agência, administrativo, design, programação, atendimento remoto). Em segmentos cujo ofício real é manual, físico, presencial ou de produção (ex.: salão de beleza, gastronomia, oficina, obra, estética, comércio de balcão, saúde, bem-estar), o notebook NÃO PERTENCE ao universo real da cena e NÃO deve ser incluído — nesses casos, o bloco deve trazer um objeto do ofício real, não um item de escritório genérico. Quando aparecer, seguir sempre a regra geral de dispositivos digitais (sem tela visível, sem conteúdo, máximo 1 por cena). ";

export const FRAGMENTO_DEVICE_CLAUSE_SUPPRESSED =
  "OBJETO CONDICIONAL NESTE MOOD — SUSPENSO NESTA PEÇA: há um produto físico referenciado (ou o ofício real não passa por tela) que já é o elemento concreto e o foco da composição — ver regra de dispositivos digitais no início deste prompt. Por isso NENHUM bloco desta peça inclui notebook, laptop ou qualquer dispositivo digital, mesmo que FRAGMENTO normalmente permita um bloco condicional de escritório. ";

// Trecho do MOOD_RULES["OP-01"] que garante a integridade do rosto, e que é
// substituído em resolveMoodRuleText quando há produto-herói — no mesmo padrão
// das sentenças de dispositivo acima. A troca nasceu de um achado real
// (06/08/2026, PU Atrevidinha Modas): a versão antiga travava o enquadramento
// no corpo da pessoa e impedia a câmera de chegar perto do produto, contra os
// "30-40% do quadro" que a hierarquia de produto exige no MESMO prompt.
//
// Era CLAREZA_PLANO_MEDIO_SENTENCE, "PLANO MÉDIO EM CLAREZA — OBRIGATÓRIO":
// fixava o enquadramento "da cintura ou quadril ao TOPO DA CABEÇA". Ela existia
// para proteger o ROSTO de ser decapitado (cortado no pescoço, queixo ou
// testa), mas fazia isso travando a DISTÂNCIA — e com isso eliminava close e
// plano geral do CLAREZA por definição, deixando o mood com uma distância só.
// Reescrita em 12/08/2026 para proteger exatamente o que ela protegia, sem
// congelar a câmera: a integridade da cabeça vira a regra, a distância passa a
// ser dos cinco eixos (core/cameraAxes.ts). Mesmo movimento que
// CLAREZA_ENQUADRAMENTO_PRODUTO_HERO abaixo já fazia no caso do produto-herói.
export const CLAREZA_ROSTO_INTEIRO_SENTENCE =
  'ROSTO INTEIRO EM CLAREZA — INEGOCIÁVEL: sempre que o rosto da pessoa estiver na cena, a CABEÇA aparece INTEIRAMENTE dentro do quadro. PROIBIDO cortar no pescoço, no queixo, na testa ou em qualquer ponto acima dos ombros — em QUALQUER distância de câmera, inclusive nos planos mais fechados: se o enquadramento fechado não couber a cabeça inteira, recue a câmera até caber. O que NÃO está travado é a DISTÂNCIA: o plano desta peça é o que a câmera sorteada determina (ver bloco "VARIAÇÕES SORTEADAS"), e pode ir do plano próximo ao plano geral. A variação DETALHE CONTEXTUAL é a única em que não há rosto em cena (mãos ou fragmento) — só nela esta regra não se aplica. ';

export const CLAREZA_ENQUADRAMENTO_PRODUTO_HERO =
  "ENQUADRAMENTO EM CLAREZA COM PRODUTO-HERÓI — REGRA DESTA PEÇA: existe produto referenciado que deve ocupar 30-40% do quadro (ver REGRA DE PROTAGONISMO DO PRODUTO). A distância da câmera cede a essa exigência: aproxime do produto e componha a pessoa como o quadro permitir — plano americano, três-quartos, de corpo inteiro, mais recuada ou ocupando uma faixa lateral —, o que for preciso para o produto crescer. O que permanece INEGOCIÁVEL é que o ROSTO e a CABEÇA da pessoa apareçam INTEIRAMENTE dentro do quadro, nunca cortados no pescoço, queixo, testa ou em qualquer ponto acima dos ombros: aproximar do produto JAMAIS significa decapitar ou cortar fora do quadro a pessoa. Se produto grande e rosto inteiro não couberem no mesmo enquadramento, recue a câmera e componha os dois lado a lado — nunca sacrifique nenhum dos dois. ";

// ── LOOK BOOK × MOOD ────────────────────────────────────────────────────────
// O modo look book (core/lookBook.ts) fixa pose de modelo, câmera 50-85mm na
// altura do peito/quadril e enquadramento ditado pelo tipo da peça. Cinco dos
// seis moods trazem, na própria REGRA INEGOCIÁVEL, uma instrução de câmera ou
// de pose que contradiz isso — e contradição dentro do mesmo prompt é
// exatamente a classe de bug que fez o avatar sumir em 06/08: o modelo escolhe
// um dos lados por conta própria.
//
// A divisão adotada: o look book governa POSE, CÂMERA e ENQUADRAMENTO; o mood
// mantém LUZ, PALETA, CLIMA, composição do entorno e detalhe criativo. Cada par
// abaixo é a sentença original do mood e o que ela vira no modo look book.
export const IMPACTO_CAMERA_SENTENCE =
  "CÂMERA EM IMPACTO: OBRIGATÓRIO contra-plongée leve ou ângulo 3/4 dinâmico. PROIBIDO câmera frontal reta na altura dos olhos. PROIBIDO plongée de cima para baixo — câmera de cima para baixo enfraquece o impacto e diminui o personagem/produto. ";

export const IMPACTO_CAMERA_LOOKBOOK =
  "CÂMERA EM IMPACTO — LOOK BOOK NESTA PEÇA: a câmera é a definida no bloco de variação (50-85mm, altura entre peito e quadril, frontal ou três-quartos), porque contra-plongée deforma o caimento da peça e é justamente o caimento que esta peça precisa mostrar. Fica SUSPENSA, só aqui, a exigência de contra-plongée e a proibição de enquadramento frontal. O IMPACTO continua inteiro no resto: luz focal direcional recortando a modelo sobre fundo escuro médio, paleta low-key com UMA cor quente saturada de acento, vazios escuros generosos e foco único concentrado na peça vestida. PROIBIDO plongée de cima para baixo. ";

export const INSTANTE_POSE_SENTENCE =
  "INSTANTE exige captura documental genuína — personagem NUNCA olha para câmera com pose intencional, NUNCA sorri institucionalmente, NUNCA está estático esperando o clique. A cena deve parecer flagrada. ";

export const INSTANTE_POSE_LOOKBOOK =
  "INSTANTE COM MODELO — LOOK BOOK NESTA PEÇA: a modelo POSA (é um look book, ver bloco de variação), então fica suspensa a proibição de pose intencional e de olhar para a câmera. O que o mood exige aqui é o JEITO da pose: nada de rigidez de estúdio nem sorriso institucional — prefira a pose em movimento (passo, giro, gesto em transição, peso mudando de perna), como se a foto tivesse sido feita entre uma pose e outra. A captura continua parecendo real: luz ambiente quente, paleta terrosa, grão sutil, detalhe de bastidor no quadro. ";

export const FRAGMENTO_BLOCOS_SENTENCE =
  "FRAGMENTO exige EXATAMENTE 3 a 5 blocos visuais distintos costurados pela mesma paleta de 3 tons máximos. Menos de 3 blocos não é FRAGMENTO — vira CLAREZA ou SILÊNCIO. Mais de 5 blocos vira ruído visual sem ritmo. ";

export const FRAGMENTO_BLOCOS_LOOKBOOK =
  "FRAGMENTO COM LOOK BOOK NESTA PEÇA: a composição modular permanece, com 3 a 5 blocos costurados pela mesma paleta de 3 tons — mas o BLOCO PRINCIPAL, o de maior área, é a modelo vestindo a peça no enquadramento obrigatório definido no bloco de variação, e é ele que precisa ser lido primeiro. Os demais blocos trazem DETALHES DA MESMA PEÇA (textura do tecido, costura, etiqueta, caimento da barra, acabamento da gola, movimento do tecido) — nunca um segundo produto, nunca objeto de escritório, nunca fragmento sem relação com a peça. PROIBIDO fragmentar a modelo em blocos que a cortem (um bloco com a cabeça, outro com o tronco): a figura aparece inteira dentro do seu bloco. ";

export const DESVIO_CAMERA_SENTENCE =
  'CÂMERA DESVIO: a variação de ângulo e distância desta geração está no bloco "VARIAÇÕES SORTEADAS" — seguir exatamente, sem alterar. Em qualquer variação sorteada, a câmera NUNCA pode estar na altura dos olhos em enquadramento neutro — PROIBIDO câmera frontal neutra em qualquer hipótese, essa é a assinatura inegociável do mood. ';

export const DESVIO_CAMERA_LOOKBOOK =
  "CÂMERA DESVIO — LOOK BOOK NESTA PEÇA: a câmera é a definida no bloco de variação (50-85mm, altura entre peito e quadril, frontal ou três-quartos), sem distorção de perspectiva — lente angular deforma corpo e caimento, e a peça precisa ser lida como ela é. Fica suspensa, só aqui, a proibição de enquadramento frontal neutro. O DESVIO não desaparece: ele se expressa pela RUPTURA SIMBÓLICA em cena, pela paleta incomum e pela luz teatral em direção inesperada — nunca por deformar a modelo ou a peça. ";

export const SILENCIO_ESCALA_SENTENCE =
  "ESPAÇO NEGATIVO OBRIGATÓRIO: o objeto ou fragmento humano deve ocupar NO MÁXIMO 30% da área total da composição. O restante é fundo neutro, vasto e respirado — esse espaço vazio É a mensagem. ";

export const SILENCIO_ESCALA_LOOKBOOK =
  "ESPAÇO NEGATIVO EM LOOK BOOK: o limite de 30% NÃO se aplica à modelo nesta peça — a peça vestida precisa ser lida em cor, corte e caimento, e isso exige presença no quadro. O silêncio se expressa pelo ENTORNO: fundo vasto, liso e vazio, sem nenhum outro elemento além da modelo, com amplo espaço respirando ao redor da figura e composição estática e contemplativa. Nada de props, mobiliário, texturas concorrentes ou segundo ponto de interesse. ";

export const SILENCIO_PESSOA_SENTENCE =
  "Se aparecer pessoa: fragmento parcial APENAS (mão, sombra, nuca, silhueta pequena) — NUNCA rosto inteiro posado, NUNCA corpo completo. ";

export const SILENCIO_PESSOA_LOOKBOOK =
  "PESSOA EM LOOK BOOK: a modelo aparece INTEIRA e com o rosto visível, no enquadramento definido pelo tipo da peça — fica suspensa, só nesta peça, a exigência de fragmento parcial. Em troca ela obedece o resto da gramática do mood sem exceção: luz alta-chave suave e difusa, sombras quase ausentes, paleta de baixa saturação, expressão contida e serena, postura calma e estática. PROIBIDO luz dramática, fundo escuro ou pose de energia alta. ";

// Regras inegociáveis específicas por mood — corrigem desvios observados em
// geração real e expandem aplicação para múltiplos segmentos. Fonte canônica
// única da gramática de cada mood: tanto o motor MOP (buildVisualDirectionBlock)
// quanto o PU (buildMoodGrammarBlock) leem daqui — evita duas descrições
// paralelas do mesmo mood divergindo ao longo do tempo.
export const MOOD_RULES: Partial<Record<MoodCode, string>> = {
  "OP-01":
    "CLAREZA exige EXATAMENTE 1 acento de cor saturada em 1 único elemento da cena. Não 0, não 2. A peça inteiramente monocromática NÃO é CLAREZA — vira SILÊNCIO. " +
    CLAREZA_DEVICE_WELCOME_SENTENCE +
    "VÍCIOS VISUAIS A EVITAR EM CLAREZA: personagem sempre olhando papel, personagem sempre escrevendo, personagem sempre segurando documento, executivo genérico em escritório, mesa cheia de papéis, cenário corporativo de banco de imagem, plantas e vasos como recurso decorativo recorrente, notebook ou laptop presente em todas as peças como recurso automático, cena fria demais a ponto de parecer outro mood, repetição visual entre gerações, representação literal demais do segmento quando não for necessária. " +
    CLAREZA_MATERIAL_TRABALHO_SENTENCE +
    CLAREZA_ROSTO_INTEIRO_SENTENCE +
    'A variação de câmera e posição desta geração está no bloco "VARIAÇÕES SORTEADAS" — seguir sem alterar. ' +
    "CLAREZA se aplica a qualquer segmento (veterinária, padaria, advocacia, ferramentas, consultório, pet shop). O ambiente pertence ao espaço real da empresa, o objeto ao ofício real, o gesto ao trabalho real. A leituraCenica determina o conteúdo; a direção visual determina COMO é fotografado.",
  "OP-02":
    "IMPACTO exige EXATAMENTE 1 cor quente saturada (amarelo, laranja, vermelho) recortada sobre fundo escuro médio (preto/grafite). Sem essa única explosão cromática, a peça não para o scroll. " +
    IMPACTO_CAMERA_SENTENCE +
    "VÍCIOS VISUAIS A EVITAR EM IMPACTO: personagem sempre segurando papel ou prancheta, executivo genérico de terno como padrão automático, olhar lateral repetido em todas as imagens, mesma postura rígida de autoridade, mesa escura com objetos decorativos, plantas e vasos como recurso visual recorrente, luz quente lateral repetida sempre do mesmo jeito, fundo corporativo genérico, repetição visual entre gerações, representação literal demais do segmento quando não for necessária. " +
    'Quando a variação sorteada for "SUJEITO SEM PERSONAGEM DOMINANTE", construir a cena a partir do produto, objeto ou detalhe de operação como protagonista — sem forçar presença humana central. ' +
    'A variação desta geração está no bloco "VARIAÇÕES SORTEADAS" — seguir sem alterar. ' +
    "DISPOSITIVOS EM IMPACTO: o contra-plongée coloca a câmera de frente para o personagem, do lado OPOSTO à tela (ver FÍSICA DA TELA na regra de dispositivos) — a câmera vê o VERSO LISO do aparelho, sem nenhum conteúdo, enquanto o personagem olha para baixo, para a própria tela. Essa geometria é correta e natural; NÃO torça o aparelho para a tela 'aparecer' neste ângulo — isso violaria a física da cena. Preferir variações sem dispositivo digital nas mãos quando ele não tiver papel narrativo na peça. " +
    "IMPACTO se aplica a qualquer segmento. O ambiente e o gesto pertencem ao espaço e ofício reais. A leituraCenica determina o conteúdo; a direção visual determina COMO é fotografado.",
  "OP-03":
    INSTANTE_POSE_SENTENCE +
    "VÍCIOS VISUAIS A EVITAR EM INSTANTE: personagem sempre olhando papel, personagem sempre segurando caderno ou documento, personagem sempre caminhando com bolsa como solução automática, executivo genérico em escritório ou corredor, cena com aparência de pose publicitária, olhar direto para câmera, sorriso institucional, composição limpa demais, fundo cenográfico perfeito, luz dourada exageradamente dramática, plantas e vasos como recurso decorativo recorrente, repetição visual entre gerações, representação literal demais do segmento quando não for necessária. " +
    'PROIBIDO ESPECÍFICO — METÁFORA DO TÍTULO NÃO VIRA CENA LITERAL: palavras do título com sentido estratégico ou metafórico ("rumo", "caminho", "direção", "passo", "virada", "sentido", "movimento") NUNCA devem ser traduzidas como cena física de deslocamento — pessoa andando, saindo pela porta, caminhando com pasta, personagem de costas indo embora, corredor ou porta como elemento principal. O que define a cena é o que a empresa CONCRETAMENTE FAZ, derivado do texto de apoio, da atividade real e da informação-chave, não da leitura literal de uma palavra do título. Para empresas de serviço: quando o texto mencionar campanha, estratégia, orientação, decisão, clientes ou melhoria de ações, ancorar a cena no ofício real — para consultoria, gestão, RH ou financeiro: análise de relatório ou planilha impressa com o cliente, apresentação de diagnóstico em material físico, reunião de alinhamento com pauta visível, sessão de orientação 1:1; para jurídico ou contábil: revisão de documento, contrato ou processo sobre a mesa, entrega de documento assinado, conversa de aconselhamento; para agência, comunicação, marketing ou consultoria de marketing: a cena pode ser QUALQUER UMA destas — e deve VARIAR entre as peças da sequência, nunca repetir a mesma ação entre Estático 1, Carrossel e Estático Final: direcionar uma produção de conteúdo ou sessão de fotos (apontando referência, ajustando enquadramento, orientando quem produz); apresentar um plano, calendário ou resultado a um interlocutor presente, com material físico sobre a mesa ou afixado na parede; organizar ou comparar referências e provas afixadas em mural, parede ou quadro, em pé; brainstorm em pé diante de quadro branco ou painel com anotações e recortes; momento de chegada ou recepção do cliente — cumprimento, condução à sala, início de conversa; ou revisão de peças e provas de arte com o cliente (no máximo UMA peça da sequência pode usar esta última opção — é a cena já saturada em gerações anteriores). Nunca movimentação genérica. PROIBIDO cena de produção manual, artesanato, cozinha ou bancada de fabricação quando o ofício real da empresa for consultivo, analítico, jurídico ou administrativo. ' +
    "AMBIENTES PERMITIDOS EM INSTANTE: loja, balcão, corredor de atendimento, recepção, bastidor, estoque organizado, oficina, clínica, escola, restaurante, área de preparo, área de serviço, mesa de trabalho real, ponto de venda, rua, entrada ou fachada quando fizer sentido — ambiente como bastidor vivo, não cenário montado. " +
    "QUANDO A ATIVIDADE NÃO DECLARAR UM OFÍCIO CONCRETO (consultoria genérica, holding, grupo, fundação, associação ou atividade B2B abstrata sem produto físico): a cena recorre a pessoas da equipe em ambiente corporativo real flagrado sem pose — reunião de alinhamento, conversa de orientação, apresentação ou momento de decisão à mesa. PROIBIDO inventar ofício manual não declarado (artesão, cozinheiro, mecânico, produção). " +
    'O micro-momento desta geração está no bloco "VARIAÇÕES SORTEADAS" — a câmera captura aquele momento específico. ' +
    "INSTANTE se aplica a qualquer segmento. O ambiente e o gesto pertencem ao cotidiano real do negócio. A leituraCenica determina o conteúdo do flagrante; a direção visual determina COMO é fotografado.",
  // "kit papelaria genérico" abaixo reforça o mesmo item de CONCEITO_FIRST_RULE
  // (promptRules.ts) — propositalmente, só para o mood FRAGMENTO, que tende a
  // recorrer a montagens de escritório genéricas. Ver comentário lá antes de mesclar.
  "OP-04":
    FRAGMENTO_BLOCOS_SENTENCE +
    "OPERAÇÃO CUBISTA OBRIGATÓRIA: cada bloco decompõe o tema do título em um ângulo/faceta distinta — perspectivas simultâneas de um mesmo conceito, não flat lay de catálogo nem grade de fotos de banco de imagens. Os blocos coexistem como se múltiplas câmeras registrassem o mesmo momento de ângulos diferentes. PROIBIDO: kit papelaria genérico (cartões, caneta, clipe, bloco de notas) como conteúdo principal dos fragmentos — os objetos nascem do tema do título e do ofício real. " +
    "FRAGMENTO se aplica a qualquer segmento. Os fragmentos pertencem ao universo real do negócio (objetos do ofício, ambiente, gesto, textura de material). A leituraCenica determina o conteúdo de cada bloco; a direção visual determina COMO os blocos são fotografados e costurados. " +
    "OBJETO CONDICIONAL NESTE MOOD: notebook ou laptop FECHADO, de lado, de costas ou com tela apagada/escura PODE aparecer como UM dos blocos — mas SOMENTE se o ofício real do negócio (definido pela leituraCenica e pelo kit de marca) genuinamente envolve trabalho de escritório, computador ou tela no dia a dia (ex.: consultoria, agência, administrativo, design, programação, atendimento remoto). Em segmentos cujo ofício real é manual, físico, presencial ou de produção (ex.: salão de beleza, gastronomia, oficina, obra, estética, comércio de balcão, saúde, bem-estar), o notebook NÃO PERTENCE ao universo real da cena e NÃO deve ser incluído — nesses casos, o bloco deve trazer um objeto do ofício real, não um item de escritório genérico. Quando aparecer, seguir sempre a regra geral de dispositivos digitais (sem tela visível, sem conteúdo, máximo 1 por cena). " +
    "⚠ MARGEM EM COMPOSIÇÃO MODULAR: mesmo com a grade dividindo a peça em blocos, NENHUM bloco pode encostar nas bordas externas do canvas — a margem de respiro das bordas (ver regra de zona segura) vale para a composição inteira, não apenas para o texto. As linhas externas da grade ficam sempre dentro da área segura.",
  // "porta luminosa" abaixo reforça o mesmo item de CONCEITO_FIRST_RULE
  // (promptRules.ts) e de OBJETIVO_VISUAL_EXCLUSIONS.oportunidade
  // (objetivoConfig.ts) — propositalmente, só para o mood DESVIO. Ver
  // comentário em CONCEITO_FIRST_RULE antes de mesclar.
  "OP-05":
    DESVIO_CAMERA_SENTENCE +
    "PALETA DESVIO — INEGOCIÁVEL: a combinação de cores DEVE ser claramente INCOMUM e imediatamente diferente dos outros moods. Combinações obrigatórias (escolher uma): verde frio com acento magenta; azul-royal profundo com ferrugem oxidada; lilás seco com mostarda; petróleo com coral queimado; vinho escuro com azul elétrico suave. PROIBIDO paleta corporativa azul+cinza, paleta escura+laranja (que é IMPACTO), paleta azul+branco (que é CLAREZA). Se a paleta puder ser confundida com outro mood, refazer. " +
    "AMBIENTE DESVIO — PROIBIÇÃO ABSOLUTA: NUNCA escritório corporativo genérico, sala de reunião padrão ou ambiente de trabalho convencional como cenário principal. O ambiente deve ser incomum, fora do contexto esperado ou ter elemento deslocado que amplifique o estranhamento. Exemplos válidos: área de produção com objeto fora de lugar, espaço externo com ruptura visual, ambiente doméstico com elemento profissional deslocado, galeria, espaço industrial, rua com detalhe simbólico. O ambiente AMPLIFICA o desvio — nunca o neutraliza. " +
    'RUPTURA SIMBÓLICA: usar EXATAMENTE o tipo sorteado no bloco "VARIAÇÕES SORTEADAS". Uma ruptura por cena. PROIBIDO recorrer a clichês visuais de "estratégia/ideia/decisão" (proibições completas na regra CONCEITO-FIRST, acima) — o objeto da ruptura precisa ser derivado do título e do texto desta geração, nunca símbolo genérico de banco de imagens. ' +
    "PROIBIDO: executivo de blazer em escritório, personagem sentado atrás de mesa em pose neutra, notebook como centro da cena, dashboard, livro voando, megafone, porta luminosa, mini pessoas sobre objetos, surrealismo carnavalesco. Esta proibição de 'notebook como centro da cena' vale para composições clichê inventadas pelo mood — NUNCA se aplica a um produto de referência selecionado pelo usuário, que sempre aparece normalmente (ver regra de dispositivos digitais no início do prompt).",
  "OP-06":
    'SILÊNCIO — CÂMERA DESTA GERAÇÃO: a câmera está definida no bloco "VARIAÇÕES SORTEADAS" — seguir exatamente a distância e o ângulo. ' +
    "OBJETO DESTA GERAÇÃO — DERIVAR DO OFÍCIO REAL: o objeto ou sujeito isolado nasce da leituraCenica, da atividade real e do tema da peça — um único instrumento, ferramenta, material ou produto que pertença genuinamente ao negócio. PROIBIDO objeto genérico desconectado do ofício (livro de leitura, caderno de escrita, óculos soltos, caneta sem contexto). PROIBIDO laptop, notebook aberto, smartphone ou qualquer dispositivo digital como elemento principal — esta proibição vale apenas para o objeto isolado que o mood escolhe autonomamente; NUNCA se aplica a um produto de referência selecionado pelo usuário, que sempre aparece normalmente (ver regra de dispositivos digitais no início do prompt). " +
    SILENCIO_ESCALA_SENTENCE +
    "POSIÇÃO DO OBJETO — FORA DA ZONA DO TÍTULO: o objeto, produto, equipamento ou fragmento humano pode ocupar qualquer posição da composição — centralizada, à esquerda, em regra dos terços — DESDE QUE não fique sob nem atrás da metade DIREITA do quadro, reservada para o título. Se a variação sorteada abaixo indicar posição centralizada ou que invadiria essa zona, desloque a composição para a esquerda mantendo o mesmo espírito da variação. " +
    "AMBIENTE: pode ser INTERNO ou EXTERNO — campo aberto com horizonte limpo, superfície de água calma, caminho desaparecendo na névoa, arquitetura minimalista ao ar livre são todos válidos e incentivados para quebrar a repetição de mesa+interior. O critério é: fundo vasto, neutro e respirado. " +
    SILENCIO_PESSOA_SENTENCE +
    "SILÊNCIO se aplica a qualquer segmento. A leituraCenica determina O QUE aparece na cena; a direção visual determina COMO é fotografado.",
};
