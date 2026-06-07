// Direção Visual OP — léxico interno por Mood × Segmento.
// ⚠️ NÃO EXIBIR em UI, PDF, tooltip, export ou qualquer canal acessível ao usuário.
// Este módulo traduz cada Mood na gramática visual concreta (luz, paleta,
// composição, atitude da câmera) que o motor injeta no prompt da sugestão
// de imagem do Método OP.
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

import { MoodCode, Segment } from '../types';

interface VisualDirection {
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

interface SegmentLayer {
  // Conceito de mercado em 1-2 frases — referência interna de direção.
  referenciaConcreta: string;
  // Vícios visuais e stock genérico a evitar — compacto, contextual.
  evitar: string;
}

const VISUAL_DIRECTIONS: Record<MoodCode, VisualDirection> = {
  'OP-01': {
    nome: 'CLAREZA',
    tensaoDondis: 'Equilíbrio + Simetria + Regularidade + Previsibilidade — ordem visual que comunica controle e confiança no primeiro olhar',
    luz: 'luz natural difusa, vinda de lateral única, sem sombras duras; sensação de manhã clara e estável',
    paleta: 'paleta fria controlada (azuis, cinzas, branco quente) com UM único acento de cor saturada no elemento-chave',
    composicao: 'composição simétrica e organizada, espaço negativo amplo e equilibrado, hierarquia limpa, alinhamento ortogonal',
    camera: 'câmera 50mm, altura dos olhos, enquadramento frontal ou 3/4 lateral suave, composição limpa, leitura imediata, sem ângulos dramáticos',
    detalheCriativo: 'um único elemento-assinatura sutil em cena (linha geométrica fina, sombra projetada limpa, reflexo controlado em superfície polida ou objeto cotidiano alinhado com precisão milimétrica) que marca autoria sem atrapalhar a leitura',
    assinatura: 'fotografia editorial luminosa, luz natural difusa lateral, paleta fria com acento pontual, composição simétrica e respirada, lente 50mm',
  },
  'OP-02': {
    nome: 'IMPACTO',
    tensaoDondis: 'Audácia + Ênfase + Acento + Instabilidade controlada — UM elemento gritando sobre o resto, tensão dramática que para o scroll',
    luz: 'luz focal direcional sobre fundo escuro médio, contraste pronunciado com alguma gradação, sombras recortadas sem extremismo — dramaticidade presente sem apagar completamente o fundo',
    paleta: 'paleta low-key dominada por preto/grafete com UMA cor quente saturada (amarelo, laranja, vermelho) como acento dramático',
    composicao: 'composição assimétrica com tensão, sujeito recortado pela luz, vazios escuros generosos, foco único concentrado',
    camera: 'câmera 35mm, ângulo baixo leve (contra-plongée) ou 3/4 dinâmico, perspectiva forte mas natural, sensação cinematográfica — PROIBIDO câmera frontal reta na altura dos olhos, PROIBIDO plongée de cima para baixo, dutch angle apenas se muito sutil; câmera de cima para baixo enfraquece o impacto e diminui o personagem/produto',
    detalheCriativo: 'um sinal gráfico mínimo nascido da luz (haste de luz cortando o quadro, partícula de poeira no facho, reflexo metálico recortado, contorno luminoso em uma única borda do sujeito) — pequeno, mas inconfundivelmente autoral',
    assinatura: 'fotografia cinematográfica, luz focal direcional sobre fundo escuro médio, contraste pronunciado, paleta com acento quente saturado, lente 35mm, contra-plongée leve ou 3/4 dinâmico',
  },
  'OP-03': {
    nome: 'INSTANTE',
    tensaoDondis: 'Espontaneidade + Acaso + Atividade + Episodicidade — flagrante real, sem pose, momento que parece capturado por acidente',
    luz: 'luz ambiente quente real, hora dourada ou interior natural sem estúdio, com pequenos vazamentos de luz',
    paleta: 'paleta terrosa quente (âmbar, ocre, terracota, marrons), saturação orgânica, sem cor digital',
    composicao: 'composição assimétrica capturada, sem pose, enquadramento de bastidor, elementos cotidianos no quadro, sensação de flagrante',
    camera: 'câmera 35mm levemente alta, distância natural, leve grão filme, autofoco em movimento, textura visível',
    detalheCriativo: 'um detalhe de bastidor verdadeiro deixado em cena (xícara desfocada em primeiro plano, mão cortada pela borda, anotação manuscrita parcial, fio de cabelo solto, lens flare orgânico) que comprova captura real',
    assinatura: 'fotografia documental quente, luz ambiente da hora dourada, paleta terrosa, captura espontânea sem pose, lente 35mm com grão sutil',
  },
  'OP-04': {
    nome: 'FRAGMENTO',
    tensaoDondis: 'Fragmentação + Profusão + Complexidade + Justaposição — múltiplas unidades distintas costuradas pela mesma paleta, ritmo de catálogo editorial',
    luz: 'luz neutra uniforme, sem direção dramática, sombras suaves e curtas, sensação de catálogo organizado',
    paleta: 'paleta unificada em 3 tons máximos que amarram blocos visuais distintos, sem ruído cromático',
    composicao: 'composição em grade implícita com 3 a 5 blocos visuais, múltiplos focos pequenos coexistindo, ritmo modular',
    camera: 'câmera macro/detalhe alternando com plano médio, ponto de vista zenital ou frontal direto, vários planos colados',
    detalheCriativo: 'um símbolo gráfico discreto repetido como assinatura editorial em UM dos blocos (ícone simples desenhado a traço fino, etiqueta numerada minúscula, marcação de catálogo, símbolo geométrico recorrente) costurando os fragmentos',
    assinatura: 'fotografia editorial em grade modular, luz neutra uniforme, paleta de 3 tons unificados, blocos justapostos com ritmo de catálogo, planos macro e médio',
  },
  'OP-05': {
    nome: 'DESVIO',
    tensaoDondis: 'Instabilidade + Distorção + Acaso + Audácia — composição sem centro óbvio, escala ou perspectiva alteradas, ruptura simbólica que se descobre no segundo olhar',
    luz: 'luz teatral em direção inesperada (de baixo, atrás, lateral extrema), iluminação que cria estranhamento controlado sem encobrir o sujeito',
    paleta: 'paleta incomum mas legível, com combinações inesperadas e controladas: verde frio + magenta, azul profundo + ferrugem, lilás seco + mostarda, petróleo + coral queimado, vinho + azul elétrico suave — evitar excesso carnavalesco',
    composicao: 'composição com elemento metafórico fora de lugar como ponto focal, escala alterada, sujeito principal sempre nítido e legível',
    camera: 'ângulo e distância exatos sorteados a cada geração (ver bloco "VARIAÇÕES SORTEADAS") — sempre não-neutro, lente 28-35mm, distorção de perspectiva visível, foco no sujeito mantido',
    detalheCriativo: 'UMA pequena ruptura simbólica embutida na cena (objeto flutuando levemente, sombra de algo que não está no quadro, escala trocada de um elemento, cor inesperada num único item cotidiano) — discreta, descoberta no segundo olhar',
    assinatura: 'fotografia conceitual com luz teatral em direção inesperada, paleta incomum mas legível, elemento metafórico deslocado, perspectiva angulada lente 28-35mm',
  },
  'OP-06': {
    nome: 'SILÊNCIO',
    tensaoDondis: 'Sutileza + Neutralidade + Economia + Estase — quase ausência, contemplação retida, mínimo absoluto de elementos com vasto espaço respirando',
    luz: 'luz suave alta-chave, vinda de fonte ampla e difusa, sombras quase ausentes, atmosfera serena',
    paleta: 'paleta suave de baixa saturação e contraste contido: areia, off-white, cinza quente, bege rosado, verde sálvia claro, azul névoa, taupe, marfim envelhecido — evitar branco puro dominante e excesso de luminosidade',
    composicao: 'composição com vasto espaço negativo, sujeito pequeno dentro do quadro, equilíbrio estático, mínimo absoluto de elementos',
    camera: 'lente 50mm ou 70mm — ângulo e distância exatos sorteados a cada geração (ver bloco "VARIAÇÕES SORTEADAS"), composição sempre limpa, sem grão, acabamento suave e silencioso',
    detalheCriativo: 'um único traço de assinatura premium (linha fina horizontal, ponto de cor minúsculo, sombra suave isolada, textura de papel sutil) flutuando no espaço negativo como gesto autoral mínimo',
    assinatura: 'fotografia premium minimalista alta-chave, luz suave difusa, paleta suave areia/cinza quente/sálvia, vasto espaço negativo, lente 50-70mm sem grão',
  },
};

// Modulação por segmento — referência interna compacta.
// Apenas as negativas prioritárias devem ser enviadas ao prompt final —
// não enviar a tabela inteira. Quando um elemento fizer sentido real para
// o negócio e o tema, pode aparecer desde que não contrarie a gramática do mood.
const SEGMENT_LAYERS: Record<MoodCode, Partial<Record<Segment, SegmentLayer>>> = {
  'OP-01': {
    SERVIÇOS: {
      referenciaConcreta: 'Editorial de serviço com identidade de nicho: profissional em ato real do ofício, ambiente funcional e reconhecível, gesto derivado da atividade declarada no kit de marca.',
      evitar: 'executivo/a de blazer posado como solução automática, laptop como barreira visual, sorriso largo institucional, headset genérico, aperto de mãos, equipe em reunião de banco de imagem, ambiente corporativo genérico quando o serviço é presencial, técnico, operacional ou local.',
    },
    VAREJO: {
      referenciaConcreta: 'Editorial de varejo com identidade de produto: produto em uso real ou no contexto onde vive, pessoa em gesto de compra, uso ou produção derivado do universo real do produto.',
      evitar: 'produto isolado em fundo branco de e-commerce, vitrine genérica sem contexto de uso, modelo posando neutro sem relação com o produto, exposição limpa demais sem vida real, composição fria demais a ponto de parecer SILÊNCIO.',
    },
    MARCA: {
      referenciaConcreta: 'Manifesto visual de marca com identidade própria: símbolo ou território da marca em composição simétrica respirada, elemento coerente com o posicionamento declarado no kit.',
      evitar: 'collage de diversidade corporativa genérica, grupo posando sorrindo para câmera, abstrato genérico sem ligação com a atividade real, símbolo solto desconectado do contexto, imagem institucional sem ação, sem objeto claro e sem leitura de marca.',
    },
  },
  'OP-02': {
    SERVIÇOS: {
      referenciaConcreta: 'Fotografia de serviço com dramaticidade: profissional no momento de máxima intensidade do ofício, luz focal recortando gesto e expressão, ambiente pertencente ao espaço real.',
      evitar: 'executivo em sala de reunião como padrão, dashboard de fundo como solução automática, headset genérico, pose de apresentação para clientes, personagem parado em autoridade artificial, escritório escuro repetido.',
    },
    VAREJO: {
      referenciaConcreta: 'Fotografia de produto com dramaticidade cinematográfica: produto ou sujeito recortado pela luz como protagonista absoluto, fundo dramático que serve o produto.',
      evitar: 'produto em fundo branco, vitrine sem tensão visual, modelo posando neutro, mosaico de produtos lado a lado, composição de catálogo comum.',
    },
    MARCA: {
      referenciaConcreta: 'Manifesto visual de marca com dramaticidade: símbolo ou território da marca recortado pela luz dramática, atitude inconfundível derivada do posicionamento real da marca.',
      evitar: 'pessoa posando institucional, fundo de gráfico como recurso genérico, cena de reunião, símbolo abstrato sem força, imagem corporativa escura sem tensão real.',
    },
  },
  'OP-03': {
    VAREJO: {
      referenciaConcreta: 'Fotografia documental de varejo real: flagrante genuíno do momento — dono, atendente ou cliente em interação, produto sendo usado ou escolhido.',
      evitar: 'modelo sorrindo para câmera, cena posada, produto isolado em superfície limpa, fundo branco, vitrine arrumada demais sem ação, fotografia com cara de catálogo.',
    },
    SERVIÇOS: {
      referenciaConcreta: 'Fotografia documental de serviço em ação real: profissional flagrado em momento real de trabalho sem pose, gesto e ambiente pertencentes ao ofício específico.',
      evitar: 'executivo posado, sorriso institucional, sala de reunião cenográfica, personagem olhando para câmera, cena limpa e montada demais, papel, bolsa ou caderno como solução automática.',
    },
    MARCA: {
      referenciaConcreta: 'Fotografia documental da marca em seu território real: pessoas reais, momento espontâneo que revela o propósito sem precisar declarar.',
      evitar: 'collage stock "people of the world", grupo posando, iluminação de estúdio, cena institucional montada, diversidade corporativa genérica, sorriso forçado.',
    },
  },
  'OP-04': {
    SERVIÇOS: {
      referenciaConcreta: 'Editorial modular de serviço: grade costurando 3-5 blocos heterogêneos que revelam o universo do serviço — mãos, instrumentos, ambiente, textura de material.',
      evitar: 'collage genérica de stock empilhada, infográfico flat com ícones óbvios, moodboard amador estilo Pinterest, blocos visuais sem hierarquia, excesso de imagens sem narrativa.',
    },
    VAREJO: {
      referenciaConcreta: 'Editorial de varejo curado: grade costurando produto em detalhe, ambiente onde vive, gesto e textura — cada bloco revela um aspecto do universo do produto.',
      evitar: 'grid de produtos em fundo branco de e-commerce, mosaico de Instagram com filtro, catálogo visual sem ritmo, repetição de produtos sem leitura editorial.',
    },
    MARCA: {
      referenciaConcreta: 'Manifesto visual modular de marca: grade costurando gente real, lugar, gesto e símbolo — blocos heterogêneos que revelam o território da marca específica.',
      evitar: 'grid de pessoas felizes posando, mosaico abstrato de formas geométricas sem narrativa, colagem corporativa genérica, múltiplos elementos sem assinatura editorial.',
    },
  },
  'OP-05': {
    MARCA: {
      referenciaConcreta: 'Campanha conceitual de marca com metáfora visual: objeto real do universo da marca fora de lugar com intenção clara, leitura de duas camadas que revela o propósito.',
      evitar: 'executivo em sala de reunião com paleta diferente, abstrato corporativo genérico, executivo sentado de blazer com mãos cruzadas mesmo com cena conceitual ao redor, símbolo solto sem relação com a atividade, surrealismo exagerado, excesso de metáforas simultâneas.',
    },
    SERVIÇOS: {
      referenciaConcreta: 'Campanha de serviço com twist conceitual: profissional em situação real do ofício com desvio de escala, perspectiva ou objeto que cria estranhamento legível.',
      evitar: 'executivo posado, dashboard de fundo como solução automática, headset genérico, pose institucional com mãos cruzadas mesmo com cor incomum, escritório corporativo como padrão, metáfora óbvia demais sem ângulo de câmera.',
    },
    VAREJO: {
      referenciaConcreta: 'Campanha de varejo conceitual: produto em escala ou contexto inesperado como ponto focal, objeto do universo da loja fora de lugar com intenção clara.',
      evitar: 'produto em fundo branco, vitrine genérica, composição de e-commerce padrão, produto flutuando sem conceito, metáfora visual exagerada sem relação com o tema.',
    },
  },
  'OP-06': {
    MARCA: {
      referenciaConcreta: 'Editorial contemplativo de marca com presença mínima: objeto único ou fragmento humano em vasto espaço negativo. Se aparecer pessoa, fragmento parcial — nunca personagem central.',
      evitar: 'pessoa posando, sorriso institucional, executiva/o de blazer, modelo corporativo, coworking, cena minimalista de Pinterest empresarial, símbolo genérico sem densidade.',
    },
    SERVIÇOS: {
      referenciaConcreta: 'Editorial contemplativo de serviço: objeto único do ofício em vasto espaço, fragmento humano apenas se necessário (mão tocando o instrumento, sombra projetada).',
      evitar: 'rosto inteiro posado, executivo de blazer em escritório clean, headset, coworking, reunião, mais de 1 objeto principal em foco, cena minimalista corporativa genérica.',
    },
    VAREJO: {
      referenciaConcreta: 'Editorial contemplativo de produto: produto único em luz de janela e vasto espaço negativo, textura de superfície natural visível.',
      evitar: 'produto em fundo branco de e-commerce, modelo posando, vitrine cheia, mais de 1 produto principal em foco, composição de catálogo minimalista genérico.',
    },
  },
};

export function getVisualDirection(mood: MoodCode): VisualDirection {
  return VISUAL_DIRECTIONS[mood] || VISUAL_DIRECTIONS['OP-01'];
}

// Variações de personagem por mood — o código sorteia uma a cada geração
// e injeta como instrução mandatória, impedindo repetição de padrão.
// INSTANTE: objeto capturado no flagrante deve ser coerente com o cotidiano real
// do personagem e o tema da mensagem. Proibido dispositivo digital nas mãos.
// Cada variação especifica AMBIENTE diferente para forçar diversidade de cenário
// — o ambiente desta variação SOBREPÕE o leituraCenica.ambiente original.
const INSTANTE_CHARACTER_VARIATIONS: string[] = [
  'MOVIMENTO NATURAL EM AMBIENTE DE ATENDIMENTO OU PONTO DE VENDA, plano médio ou mais aberto: pessoa em movimento real dentro de loja, balcão, recepção ou espaço de atendimento — pegando produto, organizando prateleira, abrindo vitrine, chegando ao caixa, conferindo estoque visível. Ação interrompida no meio, sem pose. Olhar nunca para câmera. AMBIENTE: interior de loja, balcão ou espaço de atendimento com elementos visíveis do negócio ao fundo.',
  'MICRO-MOMENTO EM ÁREA DE PRODUÇÃO OU BASTIDOR, plano próximo ou médio: pessoa concentrada em tarefa manual real — preparando produto, ajustando equipamento, organizando bancada de trabalho, conferindo material, montando algo, finalizando produção. Proibido papel, caderno, documento, celular, tablet ou notebook. Expressão de concentração, flagrada sem posar. AMBIENTE: cozinha profissional, oficina, área de preparo, estoque organizado ou bastidor de serviço — elementos do processo visíveis.',
  'REAÇÃO ESPONTÂNEA EM TRANSIÇÃO ENTRE AMBIENTES, plano médio: pessoa em situação real numa transição entre o interno e o externo (ou entre setores) — chegando, saindo, conversando com alguém fora de quadro, recebendo algo, verificando entorno, reagindo a algo específico. Reação natural e incompleta, sem pose. PROIBIDO gesto largo, centralizado, de braço aberto e olhar para cima como quem posa para anúncio publicitário — o gesto deve ser pequeno, incompleto e motivado por uma ação real (cumprimentar alguém fora de quadro com a mão a meio caminho, segurar a porta, ajustar a manga, apontar rapidamente para algo específico), nunca um gesto teatral de apresentação repetido entre gerações. AMBIENTE: definido pela natureza real do negócio — pode ser entrada/fachada/calçada quando o negócio for físico e voltado à rua, ou recepção, hall, sala de reunião informal, corredor de acesso, varanda ou área comum quando o negócio for um escritório, estúdio ou agência; luz natural ambiente.',
  'TRANSIÇÃO OU DESLOCAMENTO ENTRE AMBIENTES, plano médio ou aberto: pessoa atravessando corredor, subindo ou descendo escada, passando por vão de porta, carregando algo de um setor a outro — capturada em pleno deslocamento real, nunca parada à espera do clique. Corpo em diagonal, passo em curso, olhar direcionado ao trajeto. AMBIENTE: corredor interno, escada, vão de porta, passagem entre setores ou ambientes do mesmo negócio — sensação de lugar vivo e em uso.',
  'PAUSA REAL NO MEIO DA TAREFA, plano próximo ou médio: pessoa interrompida por algo fora de quadro — vira a cabeça ao ouvir um som, pausa segurando um objeto a meio gesto, olha de relance para o lado, suspende um movimento por um instante. Expressão de interrupção genuína e breve, não de pose para retrato. AMBIENTE: balcão, mesa de trabalho, prateleira, vitrine, bancada — qualquer ponto do cotidiano real do negócio onde a pausa faça sentido.',
  'PAUSA SENTADA NO MEIO DA REVISÃO, plano próximo ou médio: pessoa sentada à mesa, bancada, estação de trabalho ou balcão, momentaneamente interrompida enquanto revisa, organiza ou confere algo — pausa breve e genuína, corpo relaxado mas atento, olhar desviado para algo fora de quadro. Sem pose de retrato corporativo. AMBIENTE: mesa de trabalho, sala compartilhada, balcão de atendimento ou estação real do ofício — qualquer lugar onde sentar para revisar faça sentido no cotidiano do negócio.',
];

// Variação de câmera sorteada exclusivamente para CLAREZA (frontal vs. lateral).
const CLAREZA_CAMERA_VARIATIONS: string[] = [
  'CÂMERA FRONTAL: lente 50mm, distância média, ponto de vista na altura dos olhos — personagem enquadrado de frente, composição simétrica e respirada',
  'CÂMERA LATERAL 3/4: lente 50mm, distância média, ponto de vista na altura dos olhos — personagem levemente de perfil (3/4 para a câmera), espaço negativo generoso à frente do olhar, composição com respiração direcional',
];

// CLAREZA: 3 opções sorteáveis. Sem objeto obrigatório na mão.
// A 3ª opção retira o rosto do centro — aumenta diversidade de enquadramento.
// Segmento e atividade podem orientar gesto e ambiente sem obrigar representação literal.
const CLAREZA_CHARACTER_VARIATIONS: string[] = [
  'EM PÉ, plano médio ou americano: postura natural, profissional, estável. Gesto funcional — atendimento, organização, observação, apresentação discreta, operação ou interação leve com o ambiente. Não obrigar objeto na mão. Personagem, gesto e ambiente podem refletir o segmento quando necessário, sem ser obrigatório nem literal.',
  'SENTADO, plano médio ou médio próximo: postura organizada, calma, objetiva. A cena pode ocorrer em mesa, balcão, bancada, recepção, estação de trabalho, área de atendimento, ponto de venda, ambiente operacional limpo ou outro contexto adequado. Não depender de papel, caneta, caderno, tablet, celular ou notebook como elemento obrigatório. Personagem, gesto e ambiente podem refletir o segmento quando necessário, sem ser obrigatório nem literal.',
  'DETALHE CONTEXTUAL, plano próximo ou plano-detalhe: rosto não é dominante — a cena mostra mãos, gesto, objeto, produto, ferramenta, bancada, textura de material, documento discreto ou detalhe do ambiente de trabalho. O personagem existe pela presença parcial (mão, braço, silhueta). A cena continua clara, organizada, arejada e coerente com o segmento. Não transformar em stock genérico de fundo branco.',
];

// Gênero do personagem — sorteado para os moods com personagem central
// (CLAREZA, IMPACTO, INSTANTE), evitando que a informação-chave do conteúdo
// (ex.: "gestores, empresários") vicie a geração sempre para o masculino.
const PERSONAGEM_GENDER_VARIATIONS: string[] = [
  'mulher',
  'homem',
];

// IMPACTO: 7 opções sorteáveis, aplicáveis a múltiplos segmentos.
// Variações cobrindo ambientes, enquadramentos, posturas e tons emocionais
// distintos para garantir diversidade visual real entre gerações consecutivas.
// PROIBIDO personagem de costas/dorso para o observador em qualquer variação —
// a força dramática vem do rosto, perfil ou postura, nunca da nuca.
// Contra-plongée obrigatório — preferir objetos não-digitais nas poses com pessoa.
const IMPACTO_CHARACTER_VARIATIONS: string[] = [
  'PESSOA EM AÇÃO, plano americano ou médio: movimento controlado — avanço, giro 3/4, deslocamento, gesto de decisão ou atitude de comando. Personagem ativo, determinado, sem pose publicitária. Não obrigar objeto na mão. Ambiente interior: escritório, loja, clínica, oficina ou espaço do ofício real com fundo escuro controlado.',
  'PESSOA COM ELEMENTO CONTEXTUAL, plano médio ou americano: interagindo com elemento simples e coerente com o contexto — produto, ferramenta, embalagem, material de trabalho, peça, equipamento, balcão, vitrine ou objeto simbólico do tema. Não obrigar papel, prancheta, tablet, celular ou notebook. Tom: concentração intensa.',
  'SUJEITO SEM PERSONAGEM DOMINANTE: produto, objeto, detalhe de operação, elemento da marca, serviço em execução ou cena contextual com presença humana secundária ou parcial. Foco único, luz recortada, composição dramática intensa. Usar quando produto, objeto ou marca for protagonista mais forte do que uma pessoa.',
  'PESSOA EM AMBIENTE EXTERNO OU INDUSTRIAL, plano americano ou médio: personagem em movimento ou ato do ofício em espaço aberto (rua, fachada, pátio, entrada) ou ambiente de produção (oficina, galpão, estoque, cozinha profissional). Câmera contra-plongée leve, luz focal de fonte externa ou artificial industrial. Tom: intensidade e garra.',
  'PERFIL EM CONTRA-LUZ, plano americano ou médio: personagem de PERFIL ou em ângulo 3/4 recortado por fonte de luz dramática (janela, porta, foco artificial), traços do rosto parcialmente visíveis mesmo em contraluz, postura e gesto identificáveis. PROIBIDO mostrar o personagem de costas ou dorso para o observador — o perfil ou o 3/4 é o que sustenta a força dramática. Fundo com fonte de luz visível ou desfoque de ambiente escuro.',
  'PESSOA SENTADA EM MOMENTO DECISIVO, plano médio ou médio próximo: postura de concentração intensa ou pausa tensa em mesa, bancada, estação de trabalho ou balcão real do ofício — gesto de decisão, análise ou espera carregada de tensão. Luz focal recortando rosto e mãos, fundo escuro controlado. Rosto sempre voltado em direção legível pela câmera (frontal 3/4 ou perfil) — nunca de costas. Tom: intensidade contida.',
  'CLOSE OU PLANO PRÓXIMO, busto ou face próxima: câmera bem próxima ao personagem, detalhe de expressão de determinação ou concentração, fundo escuro com luz recortando traços do rosto ou ombros. Nenhuma ação física necessária — a proximidade e a expressão criam a intensidade. Tom: autoridade calma.',
];

// SILÊNCIO: sorteia o tipo de sujeito/objeto isolado no espaço negativo.
// PROIBIDO: laptop ou notebook aberto como objeto principal, rosto inteiro posado,
// dispositivos digitais com tela visível, cenas com múltiplos elementos.
const SILENCIO_OBJECT_VARIATIONS: string[] = [
  'OBJETO DO OFÍCIO ISOLADO, plano próximo: um único instrumento, ferramenta, material ou peça representativa do ofício REAL da empresa — definido pela leituraCenica e pelo kit de marca, nunca um item de outro ofício ou segmento (não inventar tesoura, pincel ou ferramenta de ofício alheio ao negócio descrito). Pode ser embalagem única centralizada, frasco de produto, peça de papelaria, objeto de papelaria de marca ou ferramenta manual coerente com a atividade real. Sem tecnologia, sem laptop, sem notebook. Vasto espaço negativo ao redor. Luz de janela natural, sombra suave e curta.',
  'FRAGMENTO HUMANO COM OBJETO, plano próximo: mão ou fragmento de braço tocando delicadamente um objeto do ofício real da empresa — mão aberta sobre superfície, ponta do dedo próxima a produto, palma em material de trabalho, dedos segurando objeto simples e coerente com o negócio. Sem rosto, sem corpo completo. Vasto espaço negativo acima e ao redor. Composição centralizada. Luz alta-chave suave de janela lateral.',
  'OBJETO EM SUPERFÍCIE TEXTURIZADA, plano próximo ou médio-próximo: um único objeto sobre superfície com textura visível e natural — mármore branco, madeira clara, tecido linho, papel artesanal, concreto suave. O contraste entre o objeto e a textura da superfície é a composição inteira. Sem presença humana, sem outros elementos. Luz difusa de janela.',
  'SILHUETA OU NUCA CONTEMPLATIVA, plano médio: personagem de costas ou de perfil extremo, ocupando menos de 25% da área total da imagem — o espaço vazio é o protagonista. Pessoa pequena diante de janela grande, parede ampla ou fundo neutro. Sem gesto significativo, sem ação — apenas presença silenciosa. Luz traseira ou lateral de janela. Sem rosto visível.',
  'DETALHE MÍNIMO EM MACRO, plano muito próximo: textura ou detalhe de material, produto ou ambiente do negócio — grão de café, fibra de tecido, superfície de embalagem, detalhe de ferramenta, textura de material de trabalho. Sem rosto, sem texto, sem logo. Fundo desfocado em paleta suave. A beleza está no detalhe ampliado. Composição centralizada ou em regra dos terços.',
  'QUADRO OU MOLDURA NA PAREDE, plano médio ou aberto: uma única peça emoldurada — quadro, fotografia, certificado, ilustração simples — pendurada em parede neutra e ampla, ocupando proporção pequena da composição e cercada de vasto espaço de parede vazia. Pode haver fragmento humano discreto por perto (mão, ombro, nuca), fora de foco ou de costas — nunca rosto em destaque. Sem texto legível na peça emoldurada. Luz lateral suave de janela revelando a textura da parede. Composição assimétrica e respirada — o quadro humaniza o ambiente sem se tornar o centro literal da mensagem.',
  'LIVRO OU MATERIAL DE LEITURA EM REPOUSO, plano próximo: um único livro fechado, caderno encadernado ou material de leitura pousado sobre mesa, banco ou prateleira — capa simples e neutra, sem texto legível em destaque, sem pilha excessiva. Pode estar ao lado de um objeto pessoal mínimo (xícara, óculos), desde que o conjunto permaneça enxuto. Vasto espaço negativo ao redor. Luz difusa de janela, sombra suave e curta. Sem presença humana — o objeto sugere a pausa de alguém que esteve ali.',
  'ÓCULOS OU OBJETO PESSOAL DELICADO SOBRE SUPERFÍCIE, plano próximo ou macro: um par de óculos, um relógio de pulso ou uma caneta pousados sozinhos sobre mesa, livro ou tecido — a presença humana é sugerida pelo objeto pessoal, nunca por uma pessoa em quadro. Composição centralizada ou em regra dos terços, fundo desfocado em paleta suave, luz alta-chave lateral. Um único objeto — nunca uma composição de vários itens pessoais espalhados.',
  'EQUIPAMENTO ANALÓGICO ATEMPORAL, plano próximo ou médio: um único equipamento não digital de caráter atemporal — câmera fotográfica analógica, rádio antigo, toca-discos, luminária de mesa clássica, relógio de parede, instrumento musical — pousado em repouso, desligado, sem tela e sem indicador luminoso. Comprova humanidade e história sem recorrer a tecnologia digital ou dispositivos com tela. Vasto espaço negativo ao redor, luz suave lateral de janela, sombra curta e natural.',
];

// Variação de câmera sorteada exclusivamente para SILÊNCIO — extraída dos
// objetos para evitar repetição: as menções de câmera embutidas em algumas
// variações (zenital, frontal) faziam o enquadramento convergir sempre para
// o mesmo padrão. Agora distância e ângulo são sorteados à parte, como no CLAREZA.
const SILENCIO_CAMERA_VARIATIONS: string[] = [
  'CÂMERA PRÓXIMA: lente 50mm, enquadramento próximo, distância curta — o objeto ocupa proporção discreta do quadro com vasto entorno respirado',
  'CÂMERA ABERTA: lente 70mm, enquadramento médio-aberto, distância maior — o objeto fica ainda menor no quadro, espaço negativo dominante e sereno',
  'CÂMERA ZENITAL: vista de cima, lente 50mm, distância média — composição plana e geométrica, sombra curta projetada sobre a superfície',
  'CÂMERA EM ÂNGULO BAIXO SUAVE: lente 50mm, leve inclinação a partir de baixo, distância curta — o objeto ganha presença discreta sem dramaticidade, mantendo a serenidade do mood',
];

// DESVIO: sorteia tipo de ruptura simbólica (não personagem).
// 4 tipos distintos sem sobreposição — escala e posição/lugar são tipos separados.
// "Perspectiva impossível" removida: OP-05 já exige câmera angulada com distorção
// de perspectiva visível — duplicar isso via ruptura gera geometria quebrada.
// REGRA INEGOCIÁVEL DE INTEGRAÇÃO: o objeto simbólico DEVE estar integrado
// fisicamente na cena — sobre superfície, nas mãos do personagem ou embutido
// no ambiente. NUNCA flutuante nem sobreposto como recorte ou prop de fundo.
const DESVIO_SYMBOLIC_RUPTURE_VARIATIONS: string[] = [
  'OBJETO DESLOCADO: objeto comum colocado em lugar inesperado dentro da cena — item de trabalho pousado em superfície incomum, peça cotidiana em posição estranha mas fisicamente apoiada no ambiente (sobre mesa, chão, parede, balcão). O objeto ESTÁ na cena, não voa nem flutua. Personagem de um lado; objeto deslocado no outro extremo ou em primeiro plano. Não usar livro, megafone, notebook, porta, chave solta ou dashboard. AMBIENTE: espaço doméstico com elemento profissional infiltrado — sala de estar, cozinha residencial, varanda, quarto — onde o contraste entre o cenário pessoal e o objeto de trabalho É o estranhamento; nunca escritório corporativo.',
  'SOMBRA OU AUSÊNCIA: a cena mostra a SOMBRA ou o REFLEXO projetado de algo que não está presente no quadro — sombra caindo sobre superfície real (chão, parede, mesa), nunca flutuante. O personagem e o ambiente estão nítidos; apenas a sombra revela o elemento ausente. A ausência sugere o problema ou a oportunidade da peça. Composição diagonal que destaca a sombra. AMBIENTE: espaço industrial ou de produção — galpão, oficina, estoque, fábrica, área de carga — com luz dura lateral de fonte única projetando a sombra do elemento ausente sobre piso ou parede real.',
  'ESCALA ALTERADA: um elemento cotidiano aparece MAIOR ou MENOR do que o esperado — mas integrado ao ambiente, fisicamente presente na cena. Objeto desproporcional pousado (enorme sobre a mesa, minúsculo nas mãos do personagem, gigante apoiado ao fundo). Personagem interage ou está próximo revelando a desproporção por comparação. AMBIENTE: espaço externo urbano — rua, calçada, fachada, pátio, marquise — onde a comparação de escala fica evidente à luz do dia, ao ar livre.',
  'COR INESPERADA: um único item cotidiano presente fisicamente na cena recebe cor incomum dentro da paleta do mood — objeto está na mão do personagem, sobre superfície ou integrado ao ambiente, não flutuante. Luz teatral lateral ou de baixo salienta o contraste cromático. Apenas esse elemento tem a cor conceitual; o restante da cena segue a paleta fria/escura do mood. AMBIENTE: galeria, vitrine, espaço expositivo ou fundo neutro de tom escuro controlado — onde o item de cor inesperada se isola visualmente sem concorrência de outros elementos.',
];

// Variação de câmera sorteada exclusivamente para DESVIO — extraída das rupturas
// para evitar repetição: antes, quase toda ruptura forçava o mesmo eixo
// contra-plongée/abaixo da cintura, fazendo o ângulo e a distância da câmera
// se repetirem entre gerações (inclusive em "Gerar outra"). Agora ângulo e
// distância são sorteados de forma independente da ruptura, como no CLAREZA.
const DESVIO_CAMERA_VARIATIONS: string[] = [
  'CONTRA-PLONGÉE SUAVE: câmera ligeiramente abaixo da linha dos olhos do personagem ou objeto — inclinação discreta, NUNCA extrema ou caricata —, lente 35mm, distância média. O leve ângulo ascendente sugere o estranhamento de forma sutil, percebida no segundo olhar, sem dramatizar a perspectiva.',
  'PLONGÉE ACENTUADA: câmera nitidamente acima da cabeça do personagem ou do objeto, lente 28-35mm, enquadramento médio — observador olha de cima, sensação de distanciamento que revela o estranhamento',
  'LATERAL RASANTE AO CHÃO: câmera quase ao nível do piso, ângulo lateral extremo, lente 28mm, distância curta — composição diagonal que distorce a perspectiva sem recorrer ao eixo vertical',
  'DIAGONAL HOLANDESA (DUTCH ANGLE): câmera na altura dos olhos, porém o quadro inteiro rotacionado em diagonal (10-15°), lente 35mm, distância média — o desequilíbrio nasce da inclinação do enquadramento (horizonte e linhas verticais visivelmente tortos), não da posição vertical da câmera — uma forma de estranhamento sem recorrer a contra-plongée ou plongée',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Bloco pronto para injeção no prompt do motor.
// Reforça a regra inegociável: a gramática visual GOVERNA luz, paleta,
// composição e câmera de TODA peça da sequência (estático, carrossel,
// estático final e reels), sem alterar a Matriz psicológica.
export function buildVisualDirectionBlock(mood: MoodCode, segment?: Segment): string {
  const v = getVisualDirection(mood);
  const seg = segment ? SEGMENT_LAYERS[mood]?.[segment] : undefined;

  const segmentBlock = seg
    ? `

CONTEXTO DE SEGMENTO (${segment}):
- Referência: ${seg.referenciaConcreta}
- Não usar como padrão automático: ${seg.evitar}
Permitir apenas quando estiver explicitamente ligado à informação-chave, ao segmento ou à natureza real do negócio — e desde que não contrarie a gramática do mood.`
    : '';

  // OP-01, OP-02, OP-03 sorteia variação de personagem (+ gênero, + câmera no CLAREZA).
  const characterVariationMap: Partial<Record<MoodCode, string[]>> = {
    'OP-01': CLAREZA_CHARACTER_VARIATIONS,
    'OP-02': IMPACTO_CHARACTER_VARIATIONS,
    'OP-03': INSTANTE_CHARACTER_VARIATIONS,
  };

  // Cada mood combina seus próprios sorteios independentes — mesmo padrão do
  // CLAREZA (personagem + câmera sorteados separadamente). DESVIO combina
  // ruptura + câmera; SILÊNCIO combina objeto + câmera; OP-01/02/03 combinam
  // personagem + gênero (+ câmera apenas no CLAREZA).
  let variacaoBlock = '';
  const TEMA_DERIVATION_RULE = 'ANTES de aplicar a estrutura sorteada abaixo, identifique em UMA palavra ou ação concreta o que o título e o texto desta peça comunicam (ex.: título sobre "atendimento ágil" → ação de responder/atender; título sobre "transparência" → ação de mostrar/revisar/explicar documento ou processo; título sobre "comunicação e design" → ação de revisar peças, provas ou material visual; título sobre "ignorar retorno do cliente" → símbolo ligado a voz, escuta ou feedback). Essa ação ou símbolo concreto é o que preenche a estrutura sorteada — a estrutura é a moldura (pose/câmera/composição), o tema da peça é o que vai dentro dela.';

  if (mood === 'OP-05') {
    const ruptura = pickRandom(DESVIO_SYMBOLIC_RUPTURE_VARIATIONS);
    const camera = pickRandom(DESVIO_CAMERA_VARIATIONS);
    variacaoBlock = `\n\nVARIAÇÕES SORTEADAS PARA ESTA GERAÇÃO — SEGUIR EXATAMENTE, SEM SUBSTITUIÇÃO:\n• Câmera: ${camera}\n• Estrutura da ruptura simbólica: ${ruptura}\n${TEMA_DERIVATION_RULE} Aqui, o objeto, gesto ou elemento deslocado que ENCARNA a ruptura deve ser esse símbolo derivado do tema da peça — não um conceito surreal genérico solto. Uma ruptura por cena, sem acumular.`;
  } else if (mood === 'OP-06') {
    const objeto = pickRandom(SILENCIO_OBJECT_VARIATIONS);
    const camera = pickRandom(SILENCIO_CAMERA_VARIATIONS);
    variacaoBlock = `\n\nVARIAÇÕES SORTEADAS PARA ESTA GERAÇÃO — SEGUIR EXATAMENTE, SEM SUBSTITUIÇÃO:\n• Câmera: ${camera}\n• Estrutura do objeto/sujeito isolado: ${objeto}\n${TEMA_DERIVATION_RULE} Aqui, o objeto específico (sempre dentro do ofício real da empresa) deve ser esse símbolo derivado do tema da peça — não um objeto genérico do ofício desconectado da mensagem. Não substituir por laptop, notebook ou dispositivo.`;
  } else if (characterVariationMap[mood]) {
    const variation = pickRandom(characterVariationMap[mood]!);
    const camera = mood === 'OP-01' ? pickRandom(CLAREZA_CAMERA_VARIATIONS) : null;
    const gender = pickRandom(PERSONAGEM_GENDER_VARIATIONS);
    variacaoBlock = `\n\nVARIAÇÕES SORTEADAS PARA ESTA GERAÇÃO — SEGUIR EXATAMENTE, SEM SUBSTITUIÇÃO:${camera ? `\n• Câmera: ${camera}` : ''}\n• Gênero do personagem: ${gender} — manter coerência com segmento e leituraCenica, sem estereótipo\n• Estrutura de pose/enquadramento/ambiente: ${variation}\n${TEMA_DERIVATION_RULE} Aqui, o GESTO e A AÇÃO do personagem dentro dessa estrutura devem ser exatamente essa ação concreta derivada do tema — nunca uma pose dramática genérica de "executivo" sem relação com o que a peça comunica.`;
  }

  // Regras inegociáveis específicas por mood — corrigem desvios observados
  // em geração real e expandem aplicação para múltiplos segmentos.
  const moodRules: Partial<Record<MoodCode, string>> = {
    'OP-01':
      'CLAREZA exige EXATAMENTE 1 acento de cor saturada em 1 único elemento da cena. Não 0, não 2. A peça inteiramente monocromática NÃO é CLAREZA — vira SILÊNCIO. ' +
      'PROIBIDO ESPECÍFICO EM CLAREZA: laptop/notebook aberto voltado frontalmente para câmera com personagem posicionado atrás — essa composição "barreira de laptop" destrói o espaço negativo e a simetria respirada do mood. Se houver tecnologia em cena: detalhe lateral, desfocado em primeiro plano ou em ângulo plongée. ' +
      'VÍCIOS VISUAIS A EVITAR EM CLAREZA: personagem sempre olhando papel, personagem sempre escrevendo, personagem sempre segurando documento, executivo genérico em escritório, mesa cheia de papéis, cenário corporativo de banco de imagem, plantas e vasos como recurso decorativo recorrente, cena fria demais a ponto de parecer outro mood, repetição visual entre gerações, representação literal demais do segmento quando não for necessária. ' +
      'A variação de câmera e posição desta geração está no bloco "VARIAÇÕES SORTEADAS" — seguir sem alterar. ' +
      'CLAREZA se aplica a qualquer segmento (veterinária, padaria, advocacia, ferramentas, consultório, pet shop). O ambiente pertence ao espaço real da empresa, o objeto ao ofício real, o gesto ao trabalho real. A leituraCenica determina o conteúdo; a direção visual determina COMO é fotografado.',
    'OP-02':
      'IMPACTO exige EXATAMENTE 1 cor quente saturada (amarelo, laranja, vermelho) recortada sobre fundo escuro médio (preto/grafite). Sem essa única explosão cromática, a peça não para o scroll. ' +
      'CÂMERA EM IMPACTO: OBRIGATÓRIO contra-plongée leve ou ângulo 3/4 dinâmico. PROIBIDO câmera frontal reta na altura dos olhos. PROIBIDO plongée de cima para baixo — câmera de cima para baixo enfraquece o impacto e diminui o personagem/produto. ' +
      'VÍCIOS VISUAIS A EVITAR EM IMPACTO: personagem sempre segurando papel ou prancheta, executivo genérico de terno como padrão automático, olhar lateral repetido em todas as imagens, mesma postura rígida de autoridade, mesa escura com objetos decorativos, plantas e vasos como recurso visual recorrente, luz quente lateral repetida sempre do mesmo jeito, fundo corporativo genérico, repetição visual entre gerações, representação literal demais do segmento quando não for necessária. ' +
      'Quando a variação sorteada for "SUJEITO SEM PERSONAGEM DOMINANTE", construir a cena a partir do produto, objeto ou detalhe de operação como protagonista — sem forçar presença humana central. ' +
      'A variação desta geração está no bloco "VARIAÇÕES SORTEADAS" — seguir sem alterar. ' +
      'DISPOSITIVOS EM IMPACTO: o contra-plongée faz a tela ficar voltada para o personagem e carcaça traseira para a câmera. Preferir variações sem dispositivo digital nas mãos. Se houver: tela visível ao observador, carcaça traseira NUNCA visível. ' +
      'IMPACTO se aplica a qualquer segmento. O ambiente e o gesto pertencem ao espaço e ofício reais. A leituraCenica determina o conteúdo; a direção visual determina COMO é fotografado.',
    'OP-03':
      'INSTANTE exige captura documental genuína — personagem NUNCA olha para câmera com pose intencional, NUNCA sorri institucionalmente, NUNCA está estático esperando o clique. A cena deve parecer flagrada. ' +
      'VÍCIOS VISUAIS A EVITAR EM INSTANTE: personagem sempre olhando papel, personagem sempre segurando caderno ou documento, personagem sempre caminhando com bolsa como solução automática, executivo genérico em escritório ou corredor, cena com aparência de pose publicitária, olhar direto para câmera, sorriso institucional, composição limpa demais, fundo cenográfico perfeito, luz dourada exageradamente dramática, plantas e vasos como recurso decorativo recorrente, repetição visual entre gerações, representação literal demais do segmento quando não for necessária. ' +
      'AMBIENTES PERMITIDOS EM INSTANTE: loja, balcão, corredor de atendimento, recepção, bastidor, estoque organizado, oficina, clínica, escola, restaurante, área de preparo, área de serviço, mesa de trabalho real, ponto de venda, rua, entrada ou fachada quando fizer sentido — ambiente como bastidor vivo, não cenário montado. ' +
      'O micro-momento desta geração está no bloco "VARIAÇÕES SORTEADAS" — a câmera captura aquele momento específico. ' +
      'INSTANTE se aplica a qualquer segmento. O ambiente e o gesto pertencem ao cotidiano real do negócio. A leituraCenica determina o conteúdo do flagrante; a direção visual determina COMO é fotografado.',
    'OP-04':
      'FRAGMENTO exige EXATAMENTE 3 a 5 blocos visuais distintos costurados pela mesma paleta de 3 tons máximos. Menos de 3 blocos não é FRAGMENTO — vira CLAREZA ou SILÊNCIO. Mais de 5 blocos vira ruído visual sem ritmo. ' +
      'FRAGMENTO se aplica a qualquer segmento. Os fragmentos pertencem ao universo real do negócio (objetos do ofício, ambiente, gesto, textura de material). A leituraCenica determina o conteúdo de cada bloco; a direção visual determina COMO os blocos são fotografados e costurados.',
    'OP-05':
      'CÂMERA DESVIO: a variação de ângulo e distância desta geração está no bloco "VARIAÇÕES SORTEADAS" — seguir exatamente, sem alterar. Em qualquer variação sorteada, a câmera NUNCA pode estar na altura dos olhos em enquadramento neutro — PROIBIDO câmera frontal neutra em qualquer hipótese, essa é a assinatura inegociável do mood. ' +
      'PALETA DESVIO — INEGOCIÁVEL: a combinação de cores DEVE ser claramente INCOMUM e imediatamente diferente dos outros moods. Combinações obrigatórias (escolher uma): verde frio com acento magenta; azul-royal profundo com ferrugem oxidada; lilás seco com mostarda; petróleo com coral queimado; vinho escuro com azul elétrico suave. PROIBIDO paleta corporativa azul+cinza, paleta escura+laranja (que é IMPACTO), paleta azul+branco (que é CLAREZA). Se a paleta puder ser confundida com outro mood, refazer. ' +
      'AMBIENTE DESVIO — PROIBIÇÃO ABSOLUTA: NUNCA escritório corporativo genérico, sala de reunião padrão ou ambiente de trabalho convencional como cenário principal. O ambiente deve ser incomum, fora do contexto esperado ou ter elemento deslocado que amplifique o estranhamento. Exemplos válidos: área de produção com objeto fora de lugar, espaço externo com ruptura visual, ambiente doméstico com elemento profissional deslocado, galeria, espaço industrial, rua com detalhe simbólico. O ambiente AMPLIFICA o desvio — nunca o neutraliza. ' +
      'RUPTURA SIMBÓLICA: usar EXATAMENTE o tipo sorteado no bloco "VARIAÇÕES SORTEADAS". Uma ruptura por cena. ' +
      'PROIBIDO: executivo de blazer em escritório, personagem sentado atrás de mesa em pose neutra, notebook como centro da cena, dashboard, livro voando, megafone, porta luminosa, mini pessoas sobre objetos, surrealismo carnavalesco.',
    'OP-06':
      'SILÊNCIO — CÂMERA E OBJETO DESTA GERAÇÃO: a câmera e o objeto/sujeito desta geração estão definidos no bloco "VARIAÇÕES SORTEADAS" — seguir exatamente, sem alterar a distância/ângulo nem substituir o objeto. Não substituir o objeto por laptop, notebook aberto, smartphone ou qualquer dispositivo digital — esses objetos são PROIBIDOS como elemento principal do SILÊNCIO. ' +
      'ESPAÇO NEGATIVO OBRIGATÓRIO: o objeto ou fragmento humano deve ocupar NO MÁXIMO 30% da área total da composição. O restante é fundo neutro, vasto e respirado — esse espaço vazio É a mensagem. ' +
      'Se aparecer pessoa: fragmento parcial APENAS (mão, sombra, nuca, silhueta pequena) — NUNCA rosto inteiro posado, NUNCA corpo completo. ' +
      'SILÊNCIO se aplica a qualquer segmento. O objeto pertence ao ofício real da empresa. A leituraCenica orienta o tema; o objeto desta geração determina O QUE aparece na cena.',
  };
  const moodRuleBlock = moodRules[mood]
    ? `\n\nREGRA INEGOCIÁVEL DO MOOD ${v.nome}:\n${moodRules[mood]}`
    : '';

  return `
DIREÇÃO VISUAL DOMINANTE — INEGOCIÁVEL:

TENSÃO VISUAL CANÔNICA (técnicas Dondis, vocabulário inegociável):
${v.tensaoDondis}.
Toda peça da sequência DEVE expressar essa tensão visual de forma reconhecível — não como rótulo escrito, mas como sensação ao olhar.

GRAMÁTICA VISUAL DO MOOD:
Toda imagePrompt e toda leituraCenica de TODA peça (estáticos, cards de carrossel, estáticos finais e reels) DEVE ser fotografada conforme esta gramática única:
- Luz: ${v.luz}
- Paleta: ${v.paleta}
- Composição: ${v.composicao}
- Atitude da câmera: ${v.camera}
- Detalhe criativo (obrigatório, sutil): ${v.detalheCriativo}${variacaoBlock}${moodRuleBlock}${segmentBlock}

TIPOGRAFIA NA IMAGEM — INEGOCIÁVEL (vale para QUALQUER mood × segmento):
- O TÍTULO renderizado na peça deve ser BOLD e GRANDE — ocupando no mínimo 35% da altura vertical da peça, SEMPRE dentro da margem de respiro das bordas (ver regra de zona segura) — o tamanho nunca pode ser motivo para a letra tocar ou ultrapassar essa margem; ajuste a quebra de linha e a posição do bloco para caber inteiramente dentro da área segura. Letras claramente legíveis a distância.
- O TEXTO DE APOIO deve ter em torno de 55% do tamanho do título — menor que o título, mas NÃO é legenda de rodapé nem texto decorativo pequeno. É um bloco de texto SECUNDÁRIO E LEGÍVEL, equivalente a um subtítulo de revista — corpo grande o suficiente para ser lido sem aproximar o celular.
- PROIBIDO: texto de apoio com menos de 40% do tamanho do título, texto miniatura, corpo tipo "legenda", qualquer tipografia que exija zoom para ler.
- Regra prática: ao ver a peça no celular em tamanho normal, o texto de apoio deve ser lido de imediato, sem esforço.

REGRA DE DISPOSITIVOS DIGITAIS — INEGOCIÁVEL (vale para QUALQUER mood × segmento):
- PROIBIDO qualquer tela visível com conteúdo em notebook, laptop, tablet, iPad, celular, iPhone, monitor ou qualquer dispositivo digital — tela frontal OU traseira.
- CONTEÚDO PROIBIDO EM TELA: gráfico, dashboard, imagem, interface, site, app, texto legível ou qualquer elemento visual.
- DISPOSITIVO PERMITIDO APENAS COMO OBJETO CONTEXTUAL: fechado, de lado, de costas, desfocado ou com tela apagada/escura/neutra sem conteúdo identificável.
- MÁXIMO 1 DISPOSITIVO por cena — duplicação proibida.
- POSICIONAMENTO PROIBIDO: laptop aberto com tela voltada frontalmente para o observador e personagem posicionado ATRÁS — essa "barreira de laptop" é banida em TODOS os moods e segmentos.
- NEGATIVE: no visible screen content, no laptop screen facing viewer, no charts on screen, no dashboard on screen, no UI on screen, no app interface, no readable text on devices, no duplicated laptops, no extra devices, screen must be blank dark off turned away or out of focus.

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

// Sorteia uma variação de personagem/ruptura para injetar no prompt de IMAGEM a cada geração.
// Garante que "Gerar outra" nunca reuse a mesma pose — chame a cada vez que o prompt for construído.
export function pickImageVariationBlock(mood: MoodCode | undefined): string {
  if (!mood) return '';

  const TEMA_DERIVATION_RULE = 'ANTES de aplicar a estrutura abaixo, identifique em UMA ação ou símbolo concreto o que o Título e o Texto desta peça comunicam (ex.: título sobre "atendimento ágil" → ação de responder/atender; título sobre "transparência" → ação de mostrar/revisar/explicar; título sobre "comunicação e design" → ação de revisar peças/provas/material visual; título sobre "ignorar retorno do cliente" → símbolo ligado a voz, escuta ou feedback). Essa ação ou símbolo concreto preenche a estrutura sorteada — a estrutura é a moldura (pose/câmera/composição), o tema da peça é o que vai dentro dela.';

  if (mood === 'OP-05') {
    const ruptura = pickRandom(DESVIO_SYMBOLIC_RUPTURE_VARIATIONS);
    const camera = pickRandom(DESVIO_CAMERA_VARIATIONS);
    return `\n⚠ VARIAÇÃO DESTA GERAÇÃO — ESTRUTURA DE CÂMERA E RUPTURA (define COMO a cena é fotografada — sobrepõe o campo "Composição" da CENA DETALHADA acima quanto a câmera e estrutura conceitual; seguir exatamente, não substituir por outra câmera): Câmera: ${camera}. Estrutura da ruptura: ${ruptura}. ${TEMA_DERIVATION_RULE} Aqui, o objeto, gesto ou elemento deslocado que ENCARNA a ruptura deve ser esse símbolo derivado do tema — não um conceito surreal genérico solto. Uma ruptura por cena.`;
  }

  if (mood === 'OP-06') {
    const objeto = pickRandom(SILENCIO_OBJECT_VARIATIONS);
    const camera = pickRandom(SILENCIO_CAMERA_VARIATIONS);
    return `\n⚠ VARIAÇÃO DESTA GERAÇÃO — ESTRUTURA DE CÂMERA E OBJETO/SUJEITO DO SILÊNCIO (define COMO a cena é fotografada e a natureza do elemento principal — sobrepõe os campos "Personagem" e "Composição" da CENA DETALHADA acima; seguir exatamente, não substituir por laptop ou dispositivo): Câmera: ${camera}. Estrutura do objeto: ${objeto}. ${TEMA_DERIVATION_RULE} Aqui, o objeto específico (sempre dentro do ofício real da empresa) deve ser esse símbolo derivado do tema — não um objeto genérico desconectado da mensagem.`;
  }

  const characterMap: Partial<Record<MoodCode, string[]>> = {
    'OP-01': CLAREZA_CHARACTER_VARIATIONS,
    'OP-02': IMPACTO_CHARACTER_VARIATIONS,
    'OP-03': INSTANTE_CHARACTER_VARIATIONS,
  };

  const variations = characterMap[mood];
  if (!variations) return '';

  const variation = pickRandom(variations);
  const camera = mood === 'OP-01' ? `Câmera: ${pickRandom(CLAREZA_CAMERA_VARIATIONS)}. ` : '';
  const gender = pickRandom(PERSONAGEM_GENDER_VARIATIONS);
  return `\n⚠ VARIAÇÃO DESTA GERAÇÃO — ESTRUTURA DE POSE, CÂMERA E AMBIENTE (define COMO a cena é construída e fotografada — sobrepõe os campos "Composição" e "Ambiente" da CENA DETALHADA acima quanto a pose, enquadramento e tipo de ambiente; seguir sem trocar por uma composição mais genérica): ${camera}Gênero do personagem: ${gender} — manter coerência com segmento e cena, sem estereótipo. Estrutura: ${variation} ${TEMA_DERIVATION_RULE} Aqui, o GESTO e A AÇÃO do personagem dentro dessa estrutura devem ser exatamente essa ação concreta derivada do tema — nunca uma pose dramática genérica de "executivo" sem relação com o que a peça comunica.`;
}
