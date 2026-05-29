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
// CAMADA 3 — Modulação por Segmento (Serviços/Varejo/Marca): cada combinação
//   ativa carrega uma referência concreta de mercado e uma proibição literal
//   contra a "fórmula preguiçosa default" daquele segmento. Sem essa camada,
//   o motor cai no clichê neutro (executiva no escritório, produto em fundo
//   branco, abstrato corporativo) sempre que o brief não tem direção forte.

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
  // 2-3 referências reais de mercado brasileiro/global que ilustram o que
  // VENDE naquele segmento com aquela tensão visual.
  referenciaConcreta: string;
  // Descrição literal da fórmula preguiçosa default que o modelo entrega
  // quando o prompt está fraco — proibida.
  proibicaoStock: string;
}

const VISUAL_DIRECTIONS: Record<MoodCode, VisualDirection> = {
  'OP-01': {
    nome: 'CLAREZA',
    tensaoDondis: 'Equilíbrio + Simetria + Regularidade + Previsibilidade — ordem visual que comunica controle e confiança no primeiro olhar',
    luz: 'luz natural difusa, vinda de lateral única, sem sombras duras; sensação de manhã clara e estável',
    paleta: 'paleta fria controlada (azuis, cinzas, branco quente) com UM único acento de cor saturada no elemento-chave',
    composicao: 'composição simétrica e organizada, espaço negativo amplo e equilibrado, hierarquia limpa, alinhamento ortogonal',
    camera: 'câmera frontal lente 50mm, distância média, ponto de vista na altura dos olhos, foco nítido e textura limpa',
    detalheCriativo: 'um único elemento-assinatura sutil em cena (linha geométrica fina, sombra projetada limpa, reflexo controlado em superfície polida ou objeto cotidiano alinhado com precisão milimétrica) que marca autoria sem atrapalhar a leitura',
    assinatura: 'fotografia editorial luminosa, luz natural difusa lateral, paleta fria com acento pontual, composição simétrica e respirada, lente 50mm frontal',
  },
  'OP-02': {
    nome: 'IMPACTO',
    tensaoDondis: 'Audácia + Ênfase + Acento + Instabilidade controlada — UM elemento gritando sobre o resto, tensão dramática que para o scroll',
    luz: 'luz dura focal sobre fundo escuro, claro/escuro extremo, sombras profundas e recortadas',
    paleta: 'paleta low-key dominada por preto/grafete com UMA cor quente saturada (amarelo, laranja, vermelho) como acento dramático',
    composicao: 'composição assimétrica com tensão, sujeito recortado pela luz, vazios escuros generosos, foco único concentrado',
    camera: 'câmera 35mm angulada, distância próxima, contraste extremo, micro-grão sutil, sensação cinematográfica',
    detalheCriativo: 'um sinal gráfico mínimo nascido da luz (haste de luz cortando o quadro, partícula de poeira no facho, reflexo metálico recortado, contorno luminoso em uma única borda do sujeito) — pequeno, mas inconfundivelmente autoral',
    assinatura: 'fotografia cinematográfica low-key, luz dura focal sobre fundo escuro, contraste extremo, paleta com acento quente saturado, lente 35mm',
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
    paleta: 'paleta incomum mas legível (combinação de cores não óbvia, ex.: verde frio + magenta, azul profundo + ferrugem), contraste deliberado',
    composicao: 'composição com elemento metafórico fora de lugar como ponto focal, escala alterada, sujeito principal sempre nítido e legível',
    camera: 'câmera baixa (contra-plongée) ou alta (plongée), lente 28-35mm, distorção sutil de perspectiva, foco no sujeito mantido',
    detalheCriativo: 'UMA pequena ruptura simbólica embutida na cena (objeto flutuando levemente, sombra de algo que não está no quadro, escala trocada de um elemento, cor inesperada num único item cotidiano) — discreta, descoberta no segundo olhar',
    assinatura: 'fotografia conceitual com luz teatral em direção inesperada, paleta incomum mas legível, elemento metafórico deslocado, perspectiva angulada lente 28-35mm',
  },
  'OP-06': {
    nome: 'SILÊNCIO',
    tensaoDondis: 'Sutileza + Neutralidade + Economia + Estase — quase ausência, contemplação retida, mínimo absoluto de elementos com vasto espaço respirando',
    luz: 'luz suave alta-chave, vinda de fonte ampla e difusa, sombras quase ausentes, atmosfera serena',
    paleta: 'paleta quase monocromática (branco, areia, off-white, cinza muito claro), saturação mínima, premium',
    composicao: 'composição com vasto espaço negativo, sujeito pequeno dentro do quadro, equilíbrio estático, mínimo absoluto de elementos',
    camera: 'câmera frontal lente 85mm, distância respeitosa, foco preciso, sem grão, acabamento premium e limpo',
    detalheCriativo: 'um único traço de assinatura premium (linha fina horizontal, ponto de cor minúsculo, sombra suave isolada, textura de papel sutil) flutuando no espaço negativo como gesto autoral mínimo',
    assinatura: 'fotografia premium minimalista alta-chave, luz suave difusa, paleta quase monocromática branco/areia, vasto espaço negativo, lente 85mm sem grão',
  },
};

// Modulação por segmento — só preenche as combinações ATIVAS conforme
// recommendedFor do templateCatalog. Combinação ausente = fallback silencioso.
const SEGMENT_LAYERS: Record<MoodCode, Partial<Record<Segment, SegmentLayer>>> = {
  'OP-01': {
    SERVIÇOS: {
      referenciaConcreta: 'editoriais institucionais de consultoria/finanças/saúde de alto padrão (linha visual McKinsey Insights, Mayo Clinic, Itaú Personnalité) — pessoa real fotografada com seriedade calma, ambiente arquitetônico legível, gesto de trabalho concreto',
      proibicaoStock: 'PROIBIDO: executivo/a de blazer posado para câmera com laptop, sorriso largo institucional, escritório cenográfico clean, headset, pessoa apontando para gráfico imaginário, aperto de mãos, equipe diversa em volta de mesa de reunião',
    },
    VAREJO: {
      referenciaConcreta: 'campanha de varejo institucional clara (linha Renner editorial, Centauro inverno, Magalu institucional) — produto bem iluminado em ambiente arquitetônico legível, gesto humano de uso real',
      proibicaoStock: 'PROIBIDO: produto em fundo branco de e-commerce, vitrine genérica, modelo posando neutra com etiqueta de preço.',
    },
    MARCA: {
      referenciaConcreta: 'manifesto de marca institucional luminoso (linha Itaú "Isso Muda o Mundo", Vivo institucional clean, Apple keynote slides) — território da marca em composição simétrica respirada, símbolo central legível',
      proibicaoStock: 'PROIBIDO: collage de "diversidade corporativa", grupo posando sorrindo, abstrato genérico institucional sem narrativa.',
    },
  },
  'OP-02': {
    SERVIÇOS: {
      referenciaConcreta: 'campanhas de serviço com peso conceitual (linha BMW Films, Squarespace, Nubank manifesto) — profissional em ação real, gesto de domínio técnico, ambiente com personalidade arquitetônica, luz contando a história',
      proibicaoStock: 'PROIBIDO: executivo posado em sala de reunião, gráfico/dashboard como cenário de fundo, modelo de stock de blazer com headset, pose de "apresentação para clientes"',
    },
    VAREJO: {
      referenciaConcreta: 'campanhas de varejo cinematográficas (linha Nike, Centauro Black Friday, Magalu liquidação, Riachuelo editorial) — produto recortado pela luz como herói, gesto humano no auge da ação, fundo dramático que serve o produto',
      proibicaoStock: 'PROIBIDO: produto em fundo branco de e-commerce, vitrine genérica, modelo posando neutra com produto na mão, etiqueta de preço gigante, mosaico de produtos lado a lado',
    },
    MARCA: {
      referenciaConcreta: 'manifesto de marca cinematográfico de alto contraste (linha Nike "Just Do It", Adidas "Impossible is Nothing", Heineken cinematográfico) — símbolo da marca recortado pela luz dramática, atitude inconfundível',
      proibicaoStock: 'PROIBIDO: pessoa posando institucional, fundo de gráfico, qualquer cena de reunião corporativa.',
    },
  },
  'OP-03': {
    VAREJO: {
      referenciaConcreta: 'fotografia documental de varejo de bairro/autoral (linha Apple "Shot on iPhone", Granado, padarias de São Paulo, lojas de Pinheiros e Vila Madalena fotografadas com afeto) — cliente real no momento real, dono atendendo, mão tocando produto, vapor da máquina, movimento da rua entrando pela porta',
      proibicaoStock: 'PROIBIDO: cena posada com modelo sorrindo para câmera, vitrine arrumada perfeitamente, produto isolado em superfície limpa, fundo branco, "look book" de moda padrão',
    },
    SERVIÇOS: {
      referenciaConcreta: 'documental de serviço autoral (linha Airbnb "Belong Anywhere", Stripe Sessions documental, reportagem revista premium) — profissional pego em flagrante de trabalho real, sem pose, captura espontânea',
      proibicaoStock: 'PROIBIDO: executivo posado, sorriso institucional, sala de reunião cenográfica, qualquer cena montada para câmera.',
    },
    MARCA: {
      referenciaConcreta: 'documental de marca autoral (linha Heineken "Cidades", Itaú "Feito de Brasil" documental, Coca-Cola flagrantes reais) — pessoas reais no território da marca, momento espontâneo, sem pose',
      proibicaoStock: 'PROIBIDO: collage de stock "people of the world", grupo posando, qualquer cena montada de "diversidade corporativa".',
    },
  },
  'OP-04': {
    SERVIÇOS: {
      referenciaConcreta: 'editorial modular de consultoria/educação/saúde (linha Monocle Magazine, Harvard Business Review impresso, relatório anual premium) — grade de 4 blocos costurando: pessoa em trabalho real + ferramenta/objeto macro + dado/anotação manuscrita + textura de ambiente',
      proibicaoStock: 'PROIBIDO: collage genérica de fotos de stock empilhadas, infográfico digital com ícones flat, "moodboard" Pinterest amador, blocos com pessoas diferentes sorrindo cada uma pra câmera',
    },
    VAREJO: {
      referenciaConcreta: 'editorial de varejo curado (linha Kinfolk, Cereal Magazine, lookbook Farm/Osklen, catálogo Tok&Stok premium) — grade unindo produto detalhado + ambiente onde ele vive + mão usando + textura de material',
      proibicaoStock: 'PROIBIDO: grid de produtos em fundo branco de e-commerce, mosaico de Instagram com filtro, collage de modelo posando em 4 ângulos diferentes',
    },
    MARCA: {
      referenciaConcreta: 'manifesto visual modular de marca guarda-chuva (linha relatório de marca da Natura, campanha institucional Itaú "Feito de Brasil", livro de marca Heineken) — blocos heterogêneos amarrando território da marca: gente, lugar, gesto, símbolo',
      proibicaoStock: 'PROIBIDO: collage genérica de "diversidade corporativa", grid de pessoas felizes posando, mosaico abstrato de cores e formas geométricas sem narrativa, infográfico institucional flat',
    },
  },
  'OP-05': {
    MARCA: {
      referenciaConcreta: 'campanhas conceituais autorais de marca (linha Apple "Think Different", Volkswagen DDB clássico, Havaianas Almap, Skol "Redondo", Heineken "The Cliché") — metáfora visual concreta como peça central, objeto real fora de lugar, escala trocada com intenção, leitura de duas camadas',
      proibicaoStock: 'PROIBIDO: executivo posado em sala de reunião com paleta diferente, abstrato corporativo genérico, "people-of-the-world" sorrindo, fundo de gráfico/dashboard, pessoa apresentando para câmera, qualquer cena institucional padrão maquiada com cor estranha. PROIBIDO TAMBÉM: executivo sentado de blazer atrás de mesa com mãos cruzadas/entrelaçadas, mesmo que a cena ao redor seja conceitual — essa pose anula o mood DESVIO instantaneamente.',
    },
    SERVIÇOS: {
      referenciaConcreta: 'campanha de serviço com twist conceitual (linha Squarespace manifesto, Slack "Work Forward", Mailchimp ilustrado-fotográfico) — profissional em situação real porém deslocada (escala, perspectiva ou objeto fora de lugar), metáfora visível no primeiro segundo',
      proibicaoStock: 'PROIBIDO: executivo posado em sala de reunião, dashboard de fundo, headset, aperto de mãos. PROIBIDO TAMBÉM: pose institucional sentada com mãos cruzadas, mesmo com cor incomum.',
    },
    VAREJO: {
      referenciaConcreta: 'campanha de varejo conceitual com metáfora visual (linha Diesel "Be Stupid", IKEA absurdista, Burger King provocativo) — produto em escala/contexto inesperado, objeto fora de lugar como ponto focal',
      proibicaoStock: 'PROIBIDO: produto em fundo branco, vitrine genérica, modelo posando neutra, qualquer composição de e-commerce padrão.',
    },
  },
  'OP-06': {
    MARCA: {
      referenciaConcreta: 'editorial de marca premium contemplativa (linha Aesop, Le Labo, Báthory, Carcel, COS magazine, livro institucional Fasano) — objeto único isolado, textura de papel/linho/pedra, luz de janela única, FRAGMENTO humano apenas (mão tocando, sombra projetada, nuca, silhueta parcial) — nunca rosto inteiro posado',
      proibicaoStock: 'PROIBIDO ABSOLUTAMENTE: pessoa posando para câmera, sorriso institucional, executiva de blazer em escritório clean, modelo de stock corporativo, ambiente de coworking, qualquer cena que pareça "minimalista de Pinterest empresarial". Se aparecer pessoa, deve ser fragmento parcial recortado, nunca personagem central.',
    },
    SERVIÇOS: {
      referenciaConcreta: 'editorial premium contemplativo aplicado a serviço (linha Aesop institucional, COS magazine, relatório anual minimalista) — objeto/ferramenta do serviço isolado em luz de janela, fragmento humano apenas (mão, sombra, silhueta parcial)',
      proibicaoStock: 'PROIBIDO: rosto inteiro posado, executivo de blazer em escritório clean, headset, sorriso institucional, qualquer cena de coworking ou reunião.',
    },
    VAREJO: {
      referenciaConcreta: 'editorial de varejo premium contemplativo (linha Aesop, Le Labo, Officine Universelle Buly) — produto único isolado em luz de janela, textura de superfície natural, fragmento de mão tocando',
      proibicaoStock: 'PROIBIDO: produto em fundo branco de e-commerce, modelo posando, vitrine cheia, qualquer cena com mais de 1 produto principal em foco.',
    },
  },
};

export function getVisualDirection(mood: MoodCode): VisualDirection {
  return VISUAL_DIRECTIONS[mood] || VISUAL_DIRECTIONS['OP-01'];
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

MODULAÇÃO POR SEGMENTO (${segment}) — INEGOCIÁVEL:
- Referência concreta de mercado: ${seg.referenciaConcreta}
- ${seg.proibicaoStock}
A imagePrompt DEVE evocar a referência concreta acima e DEVE evitar literalmente a fórmula proibida. Esta camada não é decorativa — ela é o que separa a peça de uma foto de banco genérica do segmento.`
    : '';

  // Regras inegociáveis específicas por mood — corrigem desvios observados
  // em geração real (modelo ignorando instruções da Camada 2).
  const moodRules: Partial<Record<MoodCode, string>> = {
    'OP-01':
      'CLAREZA exige EXATAMENTE 1 acento de cor saturada presente em UM único elemento da cena (objeto, peça de roupa, detalhe gráfico). Não 0, não 2. A peça inteira monocromática NÃO é CLAREZA — vira SILÊNCIO. Verifique antes de finalizar a imagePrompt. PROIBIDO ESPECÍFICO EM CLAREZA: laptop/notebook aberto voltado frontalmente para a câmera com personagem posicionado atrás — essa composição "barreira de laptop" destrói o espaço negativo e a simetria respirada do mood. Se houver tecnologia em cena, integre como detalhe lateral, desfocado em primeiro plano, ou em ângulo plongée.',
    'OP-02':
      'IMPACTO exige EXATAMENTE 1 cor quente saturada (amarelo, laranja, vermelho) recortada sobre fundo low-key dominado por preto/grafite. Sem essa única explosão cromática, a peça não para o scroll.',
    'OP-05':
      'DESVIO exige câmera angulada OBRIGATÓRIA: contra-plongée (câmera baixa olhando para cima) OU plongée (câmera alta olhando para baixo), com lente 28-35mm que cause distorção de perspectiva visível. PROIBIDO câmera frontal neutra na altura dos olhos — sem o ângulo, a peça não é DESVIO mesmo que a metáfora visual esteja presente. PROIBIDO TAMBÉM pose de executivo sentado de blazer atrás de mesa com mãos cruzadas/entrelaçadas — essa pose anula o mood instantaneamente, mesmo que o resto da cena seja conceitual.',
    'OP-06':
      'SILÊNCIO permite no máximo 1 traço de assinatura premium flutuando no espaço negativo. Se aparecer pessoa, é fragmento parcial (mão, sombra, nuca, silhueta) — NUNCA rosto inteiro posado.',
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
- Detalhe criativo (obrigatório, sutil): ${v.detalheCriativo}${moodRuleBlock}${segmentBlock}

REGRA DE DISPOSITIVOS DIGITAIS — INEGOCIÁVEL (vale para QUALQUER mood × segmento):
- TELA FRONTAL de notebook, laptop, tablet, iPad, celular, computador ou monitor deve mostrar SEMPRE conteúdo real e coerente com o tema (gráfico, dashboard, app, mensagem, foto, planilha). Proibido: tela apagada, preta, branca, lockscreen, wallpaper de fábrica, placeholder. A imagePrompt DEVE descrever literalmente o que aparece na tela.
- PROIBIDO renderizar conteúdo de tela (dashboard, app, interface, gráfico, ícone, qualquer display) sobre a TAMPA TRASEIRA ou CARCAÇA de qualquer equipamento. A carcaça traseira é superfície SÓLIDA, OPACA, lisa e na cor do equipamento: não tem tela, não emite luz, não exibe conteúdo.
- POSICIONAMENTO DE NOTEBOOK/LAPTOP — PROIBIDO ABSOLUTO: a composição onde o laptop está aberto com tela E teclado ambos voltados frontalmente para o observador, com o personagem posicionado ATRÁS do equipamento. Essa pose genérica de "pessoa atrás do notebook" é banida em TODOS os moods. Se houver notebook em cena: (a) mostrar em ângulo lateral ou vista superior (plongée) de forma que tela e teclado não fiquem simultaneamente na linha de visão do observador, OU (b) mostrar apenas a tela OU apenas o teclado/base no quadro, com personagem ao lado ou em primeiro plano. O personagem NUNCA fica aprisionado atrás do laptop como se fosse uma barreira entre ele e a câmera.

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
