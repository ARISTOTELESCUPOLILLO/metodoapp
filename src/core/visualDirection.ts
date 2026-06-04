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
    camera: 'câmera lente 50mm, distância média, ponto de vista na altura dos olhos, foco nítido e textura limpa — ângulo (frontal ou 3/4 lateral) definido pelo sorteio de câmera desta geração',
    detalheCriativo: 'um único elemento-assinatura sutil em cena (linha geométrica fina, sombra projetada limpa, reflexo controlado em superfície polida ou objeto cotidiano alinhado com precisão milimétrica) que marca autoria sem atrapalhar a leitura',
    assinatura: 'fotografia editorial luminosa, luz natural difusa lateral, paleta fria com acento pontual, composição simétrica e respirada, lente 50mm',
  },
  'OP-02': {
    nome: 'IMPACTO',
    tensaoDondis: 'Audácia + Ênfase + Acento + Instabilidade controlada — UM elemento gritando sobre o resto, tensão dramática que para o scroll',
    luz: 'luz focal direcional sobre fundo escuro médio, contraste pronunciado com alguma gradação, sombras recortadas sem extremismo — dramaticidade presente sem apagar completamente o fundo',
    paleta: 'paleta low-key dominada por preto/grafete com UMA cor quente saturada (amarelo, laranja, vermelho) como acento dramático',
    composicao: 'composição assimétrica com tensão, sujeito recortado pela luz, vazios escuros generosos, foco único concentrado',
    camera: 'câmera 35mm em contra-plongée leve (câmera ligeiramente abaixo da linha dos olhos, apontando para cima) ou dutch angle (câmera inclinada lateralmente para instabilidade), distância próxima, contraste extremo, micro-grão sutil, sensação cinematográfica — PROIBIDO câmera frontal reta na altura dos olhos',
    detalheCriativo: 'um sinal gráfico mínimo nascido da luz (haste de luz cortando o quadro, partícula de poeira no facho, reflexo metálico recortado, contorno luminoso em uma única borda do sujeito) — pequeno, mas inconfundivelmente autoral',
    assinatura: 'fotografia cinematográfica, luz focal direcional sobre fundo escuro médio, contraste pronunciado, paleta com acento quente saturado, lente 35mm, contra-plongée leve ou dutch angle',
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
      referenciaConcreta: 'editorial de serviço profissional com personalidade de nicho (referência: consultório médico bem documentado, escritório de advocacia com caráter, clínica veterinária com calor humano, ateliê criativo, estúdio de arquitetura, clínica de estética, consultoria local) — profissional retratado em ato real do ofício específico, ambiente funcional e reconhecível do nicho, gesto e objeto derivados da atividade declarada no kit de marca; a leituraCenica desta peça determina o que o profissional faz e onde está — a câmera registra aquele momento real, não um ambiente corporativo genérico',
      proibicaoStock: 'PROIBIDO: executivo/a de blazer posado para câmera com laptop, sorriso largo institucional, escritório cenográfico clean, headset, pessoa apontando para gráfico imaginário, aperto de mãos, equipe diversa em volta de mesa de reunião. PROIBIDO TAMBÉM: ambiente de escritório genérico quando a atividade da empresa for um serviço presencial específico (clínica, consultório, ateliê, estúdio, oficina, salão) — o ambiente deve pertencer ao ofício real declarado no kit de marca',
    },
    VAREJO: {
      referenciaConcreta: 'editorial de varejo com identidade de nicho (referência: padaria artesanal fotografada com afeto, loja de ferramentas com ambiente de ofício, pet shop com calor humano, livraria com atmosfera de curadoria, loja de moda com lifestyle coerente ao produto, farmácia com cuidado, loja de cosméticos com ritual) — produto em uso real ou no contexto onde vive, ambiente da loja ou do universo do produto, pessoa em gesto de compra, uso ou produção derivado do tipo de produto; a leituraCenica desta peça determina produto, ambiente e gesto — a câmera registra aquele contexto real, não uma vitrine genérica',
      proibicaoStock: 'PROIBIDO: produto em fundo branco de e-commerce, vitrine genérica sem identidade, modelo posando neutra sem contexto de uso, etiqueta de preço gigante, ambiente de shopping genérico quando o negócio for de bairro ou especializado — o cenário deve pertencer ao universo real do produto e da empresa',
    },
    MARCA: {
      referenciaConcreta: 'manifesto visual de marca com identidade própria (referência: qualquer marca que usa imagem para comunicar propósito — padaria de bairro com manifesto de artesanato, clínica com manifesto de cuidado, loja com manifesto de curadoria, serviço local com propósito declarado) — símbolo ou território da marca em composição simétrica respirada, elemento humano ou de produto coerente com o posicionamento declarado no kit de marca; a leituraCenica desta peça determina o que representa a marca — a câmera registra esse símbolo com seriedade e limpeza',
      proibicaoStock: 'PROIBIDO: collage de "diversidade corporativa", grupo posando sorrindo, abstrato genérico sem narrativa, símbolo desconectado da atividade real da marca — o elemento visual deve ser reconhecível como pertencente ao universo específico dessa marca',
    },
  },
  'OP-02': {
    SERVIÇOS: {
      referenciaConcreta: 'fotografia de serviço com dramaticidade de nicho (qualquer ofício — cirurgião veterinário em procedimento, advogado saindo do tribunal, médico em diagnóstico urgente, chef no auge da produção, mecânico de precisão, professora em entrega máxima, fisioterapeuta em sessão intensa) — profissional no momento de máxima intensidade do ofício, luz focal recortando gesto e expressão, ambiente que pertence ao espaço real do serviço; a leituraCenica desta peça determina o profissional, o gesto e o ambiente — a câmera registra com dramaticidade, não com pose',
      proibicaoStock: 'PROIBIDO: executivo posado em sala de reunião, gráfico/dashboard como cenário de fundo, modelo de stock de blazer com headset, pose de "apresentação para clientes", ambiente corporativo genérico quando a atividade da empresa for presencial e específica — o ambiente deve pertencer ao ofício real',
    },
    VAREJO: {
      referenciaConcreta: 'fotografia de produto com dramaticidade cinematográfica (qualquer categoria — pão artesanal como herói contra fundo escuro, ferramenta técnica recortada pela luz focal, produto de pet em close dramático, peça de roupa com movimento congelado pela luz, produto de beleza com textura revelada pelo facho) — produto ou sujeito recortado pela luz como protagonista absoluto, fundo dramático que serve o produto, gesto humano derivado do universo real do produto; a leituraCenica desta peça determina o produto e o gesto — a câmera aplica dramaticidade cinematográfica sobre aquele universo específico',
      proibicaoStock: 'PROIBIDO: produto em fundo branco de e-commerce, vitrine genérica sem tensão visual, modelo posando neutra com produto na mão, etiqueta de preço gigante, mosaico de produtos lado a lado',
    },
    MARCA: {
      referenciaConcreta: 'manifesto visual de marca com dramaticidade cinematográfica (qualquer marca — padaria artesanal com manifesto de craft em alta intensidade, clínica com manifesto de urgência e cuidado, loja especializada com manifesto de posicionamento, serviço local com manifesto de propósito declarado com força) — símbolo ou território da marca recortado pela luz dramática, atitude inconfundível derivada do posicionamento real da marca; a leituraCenica desta peça determina o símbolo e a atitude — a câmera registra com intensidade cinematográfica',
      proibicaoStock: 'PROIBIDO: pessoa posando institucional, fundo de gráfico, qualquer cena de reunião corporativa, símbolo genérico desconectado da atividade real da marca',
    },
  },
  'OP-03': {
    VAREJO: {
      referenciaConcreta: 'fotografia documental de varejo real (qualquer tipo de loja — padaria de bairro com vapor da máquina, loja de ferramentas com cliente examinando produto, pet shop com animal no colo do atendente, livraria com frequentador absorto, farmácia com atendimento real, loja de roupas com cliente experimentando) — flagrante genuíno do momento real, dono ou atendente em ação, cliente interagindo, produto sendo usado ou escolhido; a leituraCenica desta peça determina o tipo de loja, produto e momento — a câmera captura aquele flagrante específico',
      proibicaoStock: 'PROIBIDO: cena posada com modelo sorrindo para câmera, vitrine arrumada perfeitamente, produto isolado em superfície limpa, fundo branco, qualquer cena que pareça fotografada para marketing',
    },
    SERVIÇOS: {
      referenciaConcreta: 'fotografia documental de serviço em ação real (qualquer nicho — veterinária examinando animal, médico em consulta real, advogado no corredor do fórum, cabeleireiro em movimento, chef em produção, professora explicando, fisioterapeuta em sessão, marceneiro na bancada, dentista em procedimento) — profissional flagrado em momento real de trabalho sem pose, gesto e ambiente pertencentes ao ofício específico; a leituraCenica desta peça determina o profissional, o gesto e o ambiente — a câmera captura aquele momento de trabalho real',
      proibicaoStock: 'PROIBIDO: executivo posado, sorriso institucional, sala de reunião cenográfica, qualquer cena montada para câmera, ambiente genérico que não pertença ao ofício específico declarado no kit de marca',
    },
    MARCA: {
      referenciaConcreta: 'fotografia documental da marca em seu território real (qualquer marca — padaria com sua produção real, clínica com seus momentos de cuidado, loja especializada com seus clientes reais, serviço com seus profissionais em flagrante de trabalho) — pessoas reais no território real da marca, momento espontâneo que revela o propósito sem precisar declarar; a leituraCenica desta peça determina o território e o momento — a câmera captura sem pose',
      proibicaoStock: 'PROIBIDO: collage de stock "people of the world", grupo posando, qualquer cena montada de "diversidade corporativa", cenas que pareçam publicidade padrão com iluminação de estúdio',
    },
  },
  'OP-04': {
    SERVIÇOS: {
      referenciaConcreta: 'editorial modular de serviço com identidade de nicho (qualquer ofício — grade costurando: mão do veterinário com animal + instrumento em detalhe macro + ambiente da clínica + textura de material de trabalho; ou chef em ação + ingrediente em macro + ambiente da cozinha + textura do prato; ou advogado em postura + objeto do processo em detalhe + ambiente do escritório + anotação manuscrita) — 3 a 5 blocos heterogêneos que juntos revelam o universo do serviço específico; a leituraCenica desta peça determina os fragmentos que compõem este ofício',
      proibicaoStock: 'PROIBIDO: collage genérica de fotos de stock empilhadas, infográfico digital com ícones flat, "moodboard" Pinterest amador, blocos com pessoas diferentes sorrindo cada uma pra câmera',
    },
    VAREJO: {
      referenciaConcreta: 'editorial de varejo curado com identidade de produto (qualquer categoria — grade costurando: produto em detalhe + ambiente onde ele vive + mão usando ou escolhendo + textura do material; funciona para ferramentas, alimentos artesanais, produtos de pet, cosméticos, livros, roupas, utilidades domésticas, materiais de construção) — cada bloco revela um aspecto do universo do produto específico; a leituraCenica desta peça determina os 3-5 fragmentos que compõem o universo deste produto',
      proibicaoStock: 'PROIBIDO: grid de produtos em fundo branco de e-commerce, mosaico de Instagram com filtro, collage de modelo posando em 4 ângulos diferentes',
    },
    MARCA: {
      referenciaConcreta: 'manifesto visual modular de marca (qualquer marca — grade costurando: gente real da marca + lugar onde a marca vive + gesto que define o propósito + símbolo ou objeto da marca; funciona para padaria local, clínica, loja especializada, consultoria, marca de produto artesanal, serviço de nicho) — blocos heterogêneos que juntos revelam o território da marca específica; a leituraCenica desta peça determina os fragmentos que definem esta marca',
      proibicaoStock: 'PROIBIDO: collage genérica de "diversidade corporativa", grid de pessoas felizes posando, mosaico abstrato de cores e formas geométricas sem narrativa, infográfico institucional flat',
    },
  },
  'OP-05': {
    MARCA: {
      referenciaConcreta: 'campanha conceitual de marca com metáfora visual (qualquer marca — padaria com objeto do ofício fora de lugar, clínica com ruptura simbólica no ambiente de cuidado, loja especializada com produto em escala ou contexto inesperado, serviço com profissional em situação deslocada mas legível) — metáfora visual concreta como peça central, objeto real do universo da marca fora de lugar com intenção clara, leitura de duas camadas que revela o propósito; a leituraCenica desta peça determina a metáfora e o objeto — a câmera aplica o desvio sobre o universo real desta marca específica',
      proibicaoStock: 'PROIBIDO: executivo posado em sala de reunião com paleta diferente, abstrato corporativo genérico, "people-of-the-world" sorrindo, fundo de gráfico/dashboard, pessoa apresentando para câmera, qualquer cena institucional padrão maquiada com cor estranha. PROIBIDO TAMBÉM: executivo sentado de blazer atrás de mesa com mãos cruzadas/entrelaçadas, mesmo que a cena ao redor seja conceitual — essa pose anula o mood DESVIO instantaneamente.',
    },
    SERVIÇOS: {
      referenciaConcreta: 'campanha de serviço com twist conceitual (qualquer nicho — veterinária com instrumento do ofício em escala alterada ou perspectiva inesperada, médico em situação real porém com desvio de perspectiva, advogado com objeto do processo fora de lugar, chef com ingrediente em contexto deslocado, dentista com instrumento em escala alterada) — profissional em situação real do ofício porém com desvio de escala, perspectiva ou objeto que cria estranhamento legível; a metáfora pertence ao universo do serviço específico; a leituraCenica desta peça determina o profissional, o gesto e o desvio concreto',
      proibicaoStock: 'PROIBIDO: executivo posado em sala de reunião, dashboard de fundo, headset, aperto de mãos. PROIBIDO TAMBÉM: pose institucional sentada com mãos cruzadas, mesmo com cor incomum.',
    },
    VAREJO: {
      referenciaConcreta: 'campanha de varejo conceitual com metáfora visual (qualquer produto — ferramenta técnica em contexto surpreendente, alimento artesanal em escala alterada, produto de pet em cena inesperada, peça de roupa em ambiente deslocado, livro em situação inusitada) — produto em escala ou contexto inesperado como ponto focal, objeto do universo da loja fora de lugar com intenção clara; a leituraCenica desta peça determina o produto e o desvio concreto sobre o universo real desta loja',
      proibicaoStock: 'PROIBIDO: produto em fundo branco, vitrine genérica, modelo posando neutra, qualquer composição de e-commerce padrão.',
    },
  },
  'OP-06': {
    MARCA: {
      referenciaConcreta: 'editorial contemplativo de marca com presença mínima (qualquer marca que queira comunicar cuidado, propósito ou qualidade com silêncio — padaria artesanal com um pão isolado em luz de janela, clínica com instrumento único do ofício sobre superfície neutra, loja especializada com produto singular em vasto espaço, serviço com objeto do ofício em isolamento premium) — objeto único ou fragmento humano (mão tocando, sombra projetada, silhueta parcial) em vasto espaço negativo; a leituraCenica desta peça determina o objeto ou fragmento que representa a marca — a câmera registra com silêncio e precisão',
      proibicaoStock: 'PROIBIDO ABSOLUTAMENTE: pessoa posando para câmera, sorriso institucional, executiva de blazer em escritório clean, modelo de stock corporativo, ambiente de coworking, qualquer cena que pareça "minimalista de Pinterest empresarial". Se aparecer pessoa, deve ser fragmento parcial recortado, nunca personagem central.',
    },
    SERVIÇOS: {
      referenciaConcreta: 'editorial contemplativo de serviço profissional (qualquer nicho — instrumento do veterinário isolado em luz de janela, ferramenta do ofício sobre superfície neutra, objeto da consultoria em isolamento limpo, material da clínica em detalhe mínimo, instrumento do dentista ou fisioterapeuta em luz natural) — objeto único do ofício específico em vasto espaço, fragmento humano apenas se necessário (mão tocando o instrumento, sombra projetada); a leituraCenica desta peça determina o objeto e o ambiente — a câmera registra com silêncio e minimalismo',
      proibicaoStock: 'PROIBIDO: rosto inteiro posado, executivo de blazer em escritório clean, headset, sorriso institucional, qualquer cena de coworking ou reunião, ambiente com mais de 1 objeto principal em foco',
    },
    VAREJO: {
      referenciaConcreta: 'editorial contemplativo de produto (qualquer categoria — ferramenta técnica isolada em luz de janela, produto de padaria em vasto espaço neutro, produto de pet sobre superfície natural, livro em isolamento clean, ingrediente artesanal em detalhe premium, peça de roupa em vasto espaço respirado) — produto único em luz de janela e vasto espaço negativo, textura de superfície natural visível; a leituraCenica desta peça determina o produto e a superfície — a câmera registra com silêncio e precisão',
      proibicaoStock: 'PROIBIDO: produto em fundo branco de e-commerce, modelo posando, vitrine cheia, qualquer cena com mais de 1 produto principal em foco',
    },
  },
};

export function getVisualDirection(mood: MoodCode): VisualDirection {
  return VISUAL_DIRECTIONS[mood] || VISUAL_DIRECTIONS['OP-01'];
}

// Variações de personagem por mood — o código sorteia uma a cada geração
// e injeta como instrução mandatória, impedindo repetição de padrão.
// Estrutura: POSIÇÃO, PLANO: descrição do gesto/objeto/uso.
// INSTANTE: objeto capturado no flagrante deve ser coerente com o cotidiano real
// do personagem e o tema da mensagem. Proibido dispositivo digital nas mãos
// (tela voltada para o personagem fica de costas para a câmera documental).
const INSTANTE_CHARACTER_VARIATIONS: string[] = [
  'EM MOVIMENTO, plano médio: personagem caminhando em espaço profissional real, flagrado em meio passo — olhar direcionado para frente, não para a câmera',
  'MICRO-MOMENTO, plano próximo/médio: personagem olhando para baixo, lendo algo em papel ou caderno aberto na mão — expressão de concentração, sem saber que está sendo fotografado',
  'EM CONVERSA, plano médio/americano: personagem de 3/4 para câmera, uma mão levantada em gesto de explicação, olhar dirigido a alguém fora do quadro',
  'CHEGADA/SAÍDA, plano americano: personagem em transição — tirando casaco, abrindo porta, colocando bolsa — momento de movimento puro capturado antes da pose',
  'REVISÃO EM MOVIMENTO, plano médio: personagem em pé folheando caderno, planilha impressa ou documentos em papel — lendo ou anotando algo, completamente absorto na tarefa; PROIBIDO tablet ou qualquer dispositivo digital nestas variações',
  'REAÇÃO ESPONTÂNEA, plano médio: personagem rindo, surpreso ou reagindo a algo fora do quadro — expressão genuína, não performada, rosto levemente de lado',
];

// Variação de câmera sorteada exclusivamente para CLAREZA (frontal vs. lateral).
const CLAREZA_CAMERA_VARIATIONS: string[] = [
  'CÂMERA FRONTAL: lente 50mm, distância média, ponto de vista na altura dos olhos — personagem enquadrado de frente, composição simétrica e respirada',
  'CÂMERA LATERAL 3/4: lente 50mm, distância média, ponto de vista na altura dos olhos — personagem levemente de perfil (3/4 para a câmera), espaço negativo generoso à frente do olhar, composição com respiração direcional',
];

// CLAREZA: as variações definem POSE e PLANO apenas.
// O objeto em cena, o ambiente e o gesto específico derivam da atividade da empresa
// (kit de marca) e do texto gerado para esta peça — não de defaults genéricos.
// Se houver dispositivo digital em cena: tela SEMPRE voltada para o observador.
const CLAREZA_CHARACTER_VARIATIONS: string[] = [
  'EM PÉ, plano médio (cintura para cima): gesto ativo de demonstração ou apresentação — uma mão estendida ou apontando para algo fora do quadro; objeto ou elemento em cena derivado do ofício real da empresa (ferramenta, produto, instrumento, material — conforme a atividade declarada no kit de marca)',
  'EM PÉ, plano americano (coxa para cima): postura de atendimento ou consulta, corpo levemente voltado para alguém fora do quadro — gesto de explicação ou entrega; ferramenta, produto ou material coerente com a atividade da empresa em mãos ou visível em cena',
  'SENTADO, plano médio (cintura para cima): em ato de trabalho focado — postura inclinada levemente para frente, mãos sobre objeto ou superfície de trabalho coerente com o ofício (mesa de exame, bancada, mesa de atendimento, balcão), expressão de concentração',
  'EM PÉ, plano médio: postura de organização ou revisão — mãos ocupadas com material do ofício que pertence ao universo real da empresa; o material (documento, produto, ferramenta, instrumento) deve ser coerente com a atividade declarada no kit de marca',
  'EM PÉ, plano americano: postura de autoridade confiante, sem objeto em destaque — braços ao lado do corpo ou um braço levemente dobrado, olhar sereno e direto; o ambiente ao redor deve pertencer ao espaço real da empresa (consultório, loja, ateliê, oficina, estúdio)',
  'EM PÉ, plano médio: em ato de trabalho com as mãos — gesto concreto do ofício (examinar, construir, servir, demonstrar, ajustar, criar, cuidar), coerente com a atividade declarada no kit de marca; a cena captura o profissional fazendo seu trabalho real, não posando',
];

// IMPACTO: objetos devem ser coerentes com o contexto da mensagem.
// Contra-plongée obrigatório — dispositivos digitais nas mãos criam risco de
// carcaça traseira voltada para câmera. Preferir objetos não-digitais nas poses
// de plano médio e americano em pé.
const IMPACTO_CHARACTER_VARIATIONS: string[] = [
  'EM PÉ, plano médio (cintura para cima): postura frontal com tensão contida, braços ao lado do corpo com energia concentrada — sem objeto, a presença é o elemento',
  'EM PÉ, plano americano (coxa para cima): em movimento — passo à frente ou giro de 3/4, roupa com movimento congelado pela câmera',
  'EM PÉ, plano médio: segurando prancheta física, bloco de anotações ou objeto não-digital do ofício à frente do corpo em ângulo — gesto de domínio técnico; objeto coerente com o segmento da mensagem',
  'EM PÉ, plano americano: perfil de 3/4 para a câmera, olhar para fora do quadro com determinação — composição com tensão direcional',
  'SENTADO sobre superfície elevada (bancada, beira de mesa, degrau), plano americano — postura ativa e inclinada levemente para frente, não atrás de mesa de trabalho',
  'SENTADO, plano médio: à mesa com notebook aberto em ângulo lateral (não como barreira frontal), dedos no teclado, olhar absorto na tela — luz recortando rosto e equipamento; com contra-plongée, posicionar o notebook de modo que a tela permaneça visível ao observador, tampa traseira NUNCA exposta',
  'EM PÉ, plano americano: posicionado de costas parcialmente (1/4 de costas), rosto virado em perfil — composição com tensão de saída do quadro',
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

MODULAÇÃO POR SEGMENTO (${segment}) — INEGOCIÁVEL:
- Referência concreta de mercado: ${seg.referenciaConcreta}
- ${seg.proibicaoStock}
A imagePrompt DEVE evocar a referência concreta acima e DEVE evitar literalmente a fórmula proibida. Esta camada não é decorativa — ela é o que separa a peça de uma foto de banco genérica do segmento.`
    : '';

  // Sorteio de variações — o código decide, a IA executa sem opção de escolha.
  // Para CLAREZA: sorteia câmera (frontal vs. lateral) + personagem independentemente.
  // Para IMPACTO e INSTANTE: sorteia apenas personagem.
  const characterVariationMap: Partial<Record<MoodCode, string[]>> = {
    'OP-01': CLAREZA_CHARACTER_VARIATIONS,
    'OP-02': IMPACTO_CHARACTER_VARIATIONS,
    'OP-03': INSTANTE_CHARACTER_VARIATIONS,
  };
  const pickedVariation = characterVariationMap[mood]
    ? pickRandom(characterVariationMap[mood]!)
    : null;
  const pickedCamera = mood === 'OP-01'
    ? pickRandom(CLAREZA_CAMERA_VARIATIONS)
    : null;
  const characterVariationBlock = pickedVariation
    ? `\n\nVARIAÇÕES SORTEADAS PARA ESTA GERAÇÃO — SEGUIR EXATAMENTE, SEM SUBSTITUIÇÃO:${pickedCamera ? `\n• Câmera: ${pickedCamera}` : ''}\n• Personagem: ${pickedVariation}\nEstas combinações foram definidas pelo sistema. Não substituir por variação mais comum, mais segura ou que já apareceu em outra peça da campanha.`
    : '';

  // Regras inegociáveis específicas por mood — corrigem desvios observados
  // em geração real (modelo ignorando instruções da Camada 2).
  const moodRules: Partial<Record<MoodCode, string>> = {
    'OP-01':
      'CLAREZA exige EXATAMENTE 1 acento de cor saturada presente em UM único elemento da cena (objeto, peça de roupa, detalhe gráfico). Não 0, não 2. A peça inteira monocromática NÃO é CLAREZA — vira SILÊNCIO. Verifique antes de finalizar a imagePrompt. PROIBIDO ESPECÍFICO EM CLAREZA: laptop/notebook aberto voltado frontalmente para a câmera com personagem posicionado atrás — essa composição "barreira de laptop" destrói o espaço negativo e a simetria respirada do mood. Se houver tecnologia em cena, integre como detalhe lateral, desfocado em primeiro plano, ou em ângulo plongée. A variação de câmera e posição desta geração está especificada no bloco "VARIAÇÕES SORTEADAS" acima — seguir sem alterar. CONTEXTO DE ATIVIDADE EM CLAREZA: a gramática visual do mood (luz natural difusa, paleta fria com acento, composição simétrica e respirada) se aplica a QUALQUER tipo de empresa — veterinária, padaria, advocacia, loja de ferramentas, consultório médico, estúdio criativo, pet shop, odontologia, farmácia. O que muda entre negócios é O QUÊ está em cena: o ambiente pertence ao espaço real da empresa, o objeto em cena é a ferramenta ou produto real do ofício, o gesto é o do trabalho real. A leituraCenica gerada para esta peça determina o conteúdo da cena; a direção visual determina COMO ela é fotografada.',
    'OP-02':
      'IMPACTO exige EXATAMENTE 1 cor quente saturada (amarelo, laranja, vermelho) recortada sobre fundo escuro médio dominado por preto/grafite. Sem essa única explosão cromática, a peça não para o scroll. CÂMERA EM IMPACTO: OBRIGATÓRIO contra-plongée leve (câmera abaixo da linha dos olhos apontando para cima, dando presença e poder ao sujeito) OU dutch angle (câmera inclinada lateralmente para instabilidade visual). PROIBIDO câmera frontal reta na altura dos olhos — sem o ângulo, a peça perde a dramaticidade cinematográfica mesmo que a luz e a paleta estejam corretas. A variação de posição e gesto desta geração está especificada no bloco "VARIAÇÕES SORTEADAS" acima — seguir sem alterar. A dramaticidade vem da câmera angulada (35mm) e da luz focal, não de pose forçada do personagem. DISPOSITIVOS EM IMPACTO: o contra-plongée faz a tela de qualquer dispositivo (tablet, notebook, celular) ficar voltada para o personagem e a carcaça traseira para a câmera. POR ISSO: prefira variações sem dispositivo digital em mãos; se houver dispositivo em cena, a tela DEVE estar visível ao observador e a tampa/carcaça traseira NUNCA é visível, independentemente do ângulo da câmera. As variações de personagem sorteadas NÃO cancelam esta proibição — ela é hierarquicamente superior a qualquer instrução de pose ou gesto. CONTEXTO DE ATIVIDADE EM IMPACTO: a gramática visual do mood (luz focal direcional, paleta low-key com 1 cor quente saturada, contra-plongée ou dutch angle) se aplica a QUALQUER tipo de empresa — veterinária, padaria, advocacia, loja de ferramentas, consultório médico, pet shop, odontologia. O que muda entre negócios é O QUÊ está em cena: o ambiente pertence ao espaço real da empresa, o gesto pertence ao ofício real. A leituraCenica gerada para esta peça determina o conteúdo; a direção visual determina COMO é fotografado.',
    'OP-03':
      'INSTANTE exige captura documental genuína — o personagem NUNCA olha para a câmera com pose intencional, NUNCA sorri institucionalmente, NUNCA está estático esperando o clique. A cena deve parecer flagrada sem que o sujeito soubesse. PROIBIDO: pose de stock, sorriso largo direto para câmera, composição arrumada simetricamente, fundo cenográfico limpo. O micro-momento desta geração está especificado no bloco "VARIAÇÕES SORTEADAS" acima — a câmera captura aquele momento específico, sem alterar. CONTEXTO DE ATIVIDADE EM INSTANTE: a gramática documental do mood (luz ambiente quente, captura espontânea, grão de filme) se aplica a QUALQUER tipo de empresa — veterinária, padaria, loja de ferramentas, consultório, advocacia, pet shop. O que muda é O QUÊ é flagrado: o ambiente e o gesto pertencem ao cotidiano real do negócio. A leituraCenica gerada determina o conteúdo do flagrante; a direção visual determina COMO é fotografado.',
    'OP-04':
      'FRAGMENTO exige EXATAMENTE 3 a 5 blocos visuais distintos costurados pela mesma paleta de 3 tons máximos. Menos de 3 blocos não é FRAGMENTO — vira CLAREZA ou SILÊNCIO. Mais de 5 blocos vira ruído visual sem ritmo. CONTEXTO DE ATIVIDADE EM FRAGMENTO: a grade modular do mood se aplica a QUALQUER tipo de empresa — veterinária, padaria, loja de ferramentas, consultório, advocacia, pet shop. O que muda são os fragmentos: cada bloco deve pertencer ao universo real do negócio (objetos do ofício, ambiente, gesto, textura de material). A leituraCenica gerada determina o conteúdo de cada bloco; a direção visual determina COMO os blocos são fotografados e costurados.',
    'OP-05':
      'DESVIO exige câmera angulada OBRIGATÓRIA: contra-plongée (câmera baixa olhando para cima) OU plongée (câmera alta olhando para baixo), com lente 28-35mm que cause distorção de perspectiva visível. PROIBIDO câmera frontal neutra na altura dos olhos — sem o ângulo, a peça não é DESVIO mesmo que a metáfora visual esteja presente. PROIBIDO TAMBÉM pose de executivo sentado de blazer atrás de mesa com mãos cruzadas/entrelaçadas — essa pose anula o mood instantaneamente, mesmo que o resto da cena seja conceitual. CONTEXTO DE ATIVIDADE EM DESVIO: a gramática conceitual do mood (câmera angulada, paleta incomum, elemento metafórico deslocado) se aplica a QUALQUER tipo de empresa — veterinária, padaria, advocacia, loja de ferramentas, clínica. O que muda é O QUÊ é deslocado: o objeto ou situação fora de lugar pertence ao universo real do negócio declarado no kit de marca. A leituraCenica gerada determina a metáfora e o desvio concreto; a direção visual determina COMO é fotografado.',
    'OP-06':
      'SILÊNCIO permite no máximo 1 traço de assinatura premium flutuando no espaço negativo. Se aparecer pessoa, é fragmento parcial (mão, sombra, nuca, silhueta) — NUNCA rosto inteiro posado. CONTEXTO DE ATIVIDADE EM SILÊNCIO: a gramática contemplativa do mood (alta-chave, espaço negativo vasto, mínimo de elementos) se aplica a QUALQUER tipo de empresa — veterinária, padaria, advocacia, loja de ferramentas, clínica, livraria, pet shop. O que muda é O QUÊ é isolado: o objeto ou fragmento pertence ao universo real do negócio. A leituraCenica gerada determina o objeto e a superfície; a direção visual determina COMO é fotografado.',
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
- Detalhe criativo (obrigatório, sutil): ${v.detalheCriativo}${characterVariationBlock}${moodRuleBlock}${segmentBlock}

REGRA DE DISPOSITIVOS DIGITAIS — INEGOCIÁVEL (vale para QUALQUER mood × segmento):
- TELA FRONTAL de notebook, laptop, tablet, iPad, celular, computador ou monitor deve mostrar SEMPRE conteúdo real e coerente com o tema (gráfico, dashboard, app, mensagem, foto, planilha). Proibido: tela apagada, preta, branca, lockscreen, wallpaper de fábrica, placeholder. A imagePrompt DEVE descrever literalmente o que aparece na tela.
- PROIBIDO renderizar conteúdo de tela (dashboard, app, interface, gráfico, ícone, qualquer display) sobre a TAMPA TRASEIRA ou CARCAÇA de qualquer equipamento. A carcaça traseira é superfície SÓLIDA, OPACA, lisa e na cor do equipamento: não tem tela, não emite luz, não exibe conteúdo.
- POSICIONAMENTO DE NOTEBOOK/LAPTOP — PROIBIDO ABSOLUTO: a composição onde o laptop está aberto com tela E teclado ambos voltados frontalmente para o observador, com o personagem posicionado ATRÁS do equipamento. Essa pose genérica de "pessoa atrás do notebook" é banida em TODOS os moods. Se houver notebook em cena: (a) mostrar em ângulo lateral ou vista superior (plongée) de forma que tela e teclado não fiquem simultaneamente na linha de visão do observador, OU (b) mostrar apenas a tela OU apenas o teclado/base no quadro, com personagem ao lado ou em primeiro plano. O personagem NUNCA fica aprisionado atrás do laptop como se fosse uma barreira entre ele e a câmera.
- ÂNGULO DE CÂMERA NÃO JUSTIFICA TAMPA TRASEIRA: independentemente do ângulo (contra-plongée, plongée, dutch angle) e da variação de personagem sorteada, a tampa traseira ou carcaça de qualquer dispositivo (notebook, computador, monitor, tablet, iPad, iPhone, celular, smartphone) NUNCA é visível ao observador. Se o gesto do personagem combinado com o ângulo da câmera tornar a tampa naturalmente visível, reposicionar o dispositivo até a tela estar visível, ou substituir o gesto por alternativa sem dispositivo digital. Esta regra é hierarquicamente superior a qualquer variação de personagem ou instrução de câmera do mood.

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
