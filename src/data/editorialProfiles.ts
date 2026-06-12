/**
 * Perfis Editoriais do Método OP
 *
 * Cada perfil ancora a geração da Informação-chave no território real de uma
 * categoria de negócio, preservando a progressão do método:
 *   SERVIÇOS B2C → ENTENDIMENTO → SEGURANÇA → CONFIANÇA → AUTORIDADE → AGIR
 *   VAREJO B2C   → IDENTIFICAÇÃO → DESEJO → SEGURANÇA → CONFIANÇA → AGIR
 *   MARCA B2C    → RECONHECIMENTO → IDENTIFICAÇÃO → SEGURANÇA → CONFIANÇA → AGIR
 *   B2B          → ENTENDIMENTO → CONFIANÇA → SEGURANÇA → AUTORIDADE → AGIR
 *
 * O perfil NÃO substitui segmento/público — ele ESPECIALIZA o ângulo dentro
 * desse par, tornando a Informação-chave "method-ready": já carregando a
 * tensão ou aspiração que alimenta a sequência seed-to-action.
 */

export interface EditorialProfile {
  id: string;
  nome: string;
  keywords: string[];
  segmentos: ('SERVIÇOS' | 'VAREJO' | 'MARCA')[];
  audiencias: ('B2C' | 'B2B')[];
  territorio: string;
  angulosTensao: string[];
  angulosMotivacao: string[];
  vocabularioProibido: string[];
  notaMetodo: string;
}

export const editorialProfiles: EditorialProfile[] = [

  // ── SERVIÇOS B2C ──────────────────────────────────────────────────────────

  {
    id: 'beleza_estetica',
    nome: 'Beleza & Estética',
    keywords: ['salão', 'estética', 'cabelo', 'barbearia', 'nail', 'sobrancelha', 'depilação',
               'spa', 'massagem', 'cabeleireiro', 'maquiagem', 'micropigmentação', 'lash',
               'beleza', 'estetic', 'dermato', 'pele', 'corporal'],
    segmentos: ['SERVIÇOS'],
    audiencias: ['B2C'],
    territorio: 'autocuidado, presença, autoestima e o impacto visível da aparência no estado interno do cliente',
    angulosTensao: [
      'postergar o cuidado até chegar no limite',
      'sentir que a aparência não reflete quem você é por dentro',
      'perder oportunidades por não se sentir bem consigo mesmo',
      'volta ao espelho com insatisfação após tentativas malfeitas',
    ],
    angulosMotivacao: [
      'o momento em que a pessoa se vê e sente que voltou a si mesma',
      'autocuidado como prioridade, não como luxo',
      'aparência que comunica confiança antes de você falar uma palavra',
      'ritual que reinicia a semana com energia diferente',
    ],
    vocabularioProibido: ['empreendedor', 'empresário', 'gestor', 'lead', 'conversão', 'funil',
                          'ROI', 'tráfego', 'métricas', 'cliente B2B', 'decisor'],
    notaMetodo: 'Semeia a sequência no estado interno do cliente (tensão/desejo) antes de mostrar a solução estética. A venda acontece quando a pessoa se vê refletida no post.',
  },

  {
    id: 'saude_bem_estar',
    nome: 'Saúde & Bem-estar',
    keywords: ['nutrição', 'nutri', 'psicologia', 'psico', 'fisioterapia', 'fisio', 'academia',
               'personal', 'pilates', 'yoga', 'médico', 'clínica', 'odonto', 'dentista',
               'saúde', 'bem-estar', 'wellness', 'terapia', 'acupuntura', 'quiropraxia',
               'fonoaudiologia', 'farmácia', 'farmacêutico'],
    segmentos: ['SERVIÇOS'],
    audiencias: ['B2C'],
    territorio: 'qualidade de vida, saúde como investimento contínuo e o custo do adiamento de cuidados preventivos',
    angulosTensao: [
      'ignorar sintomas até virarem problema sério',
      'hábitos que minam a energia sem que a pessoa perceba',
      'tratar sintoma sem chegar na causa',
      'resultado que demora porque a base não está certa',
    ],
    angulosMotivacao: [
      'corpo que responde quando você finalmente cuida da base',
      'energia constante ao longo do dia sem depender de estimulante',
      'anos de vida com qualidade, não apenas anos a mais',
      'evolução consistente quando o profissional e o paciente trabalham juntos',
    ],
    vocabularioProibido: ['empreendedor', 'empresário', 'ROI', 'funil', 'tráfego', 'lead',
                          'conversão', 'métricas', 'cliente corporativo'],
    notaMetodo: 'A progressão vai de entendimento do risco/oportunidade → segurança de que é possível mudar → confiança no profissional → autoridade pelo resultado → ação de agendar.',
  },

  {
    id: 'educacao_cursos',
    nome: 'Educação & Cursos',
    keywords: ['escola', 'curso', 'aula', 'professor', 'ensino', 'treinamento', 'capacitação',
               'idioma', 'inglês', 'reforço', 'vestibular', 'concurso', 'faculdade',
               'pedagogia', 'educação', 'formação', 'workshop', 'mentoria'],
    segmentos: ['SERVIÇOS'],
    audiencias: ['B2C'],
    territorio: 'aprendizado que transforma competência em oportunidade real de vida',
    angulosTensao: [
      'saber que falta algo mas não saber como preencher',
      'oportunidade perdida por falta de preparo',
      'conteúdo que não gera resultado prático',
      'tempo investido em aprendizado sem retorno visível',
    ],
    angulosMotivacao: [
      'habilidade nova que muda o que você pode oferecer ao mundo',
      'aprender na prática o que outros só conhecem na teoria',
      'evolução que aparece no dia a dia, não só no currículo',
    ],
    vocabularioProibido: ['empreendedor', 'ROI', 'funil', 'lead', 'conversão', 'tráfego',
                          'métricas', 'C-suite', 'decisor corporativo'],
    notaMetodo: 'O aprendizado é o caminho; o que muda na vida real é a chegada. Semeie com a tensão do despreparo ou o desejo de crescer.',
  },

  {
    id: 'alimentacao_gastronomia',
    nome: 'Alimentação & Gastronomia',
    keywords: ['restaurante', 'lanchonete', 'confeitaria', 'delivery', 'buffet', 'food',
               'cozinha', 'chef', 'gastronomia', 'bistrô', 'café', 'cafeteria', 'pizzaria',
               'sushi', 'churrasco', 'padaria', 'doceria', 'quitanda', 'comida'],
    segmentos: ['SERVIÇOS', 'VAREJO'],
    audiencias: ['B2C'],
    territorio: 'prazer, convivência e o papel da comida nos momentos que importam na vida de alguém',
    angulosTensao: [
      'rotina de comida sem prazer nem presença',
      'almoço repetido que vira obrigação e não refeição',
      'ocasião especial mal aproveitada por falta de opção que combinasse',
    ],
    angulosMotivacao: [
      'refeição que vira memória afetiva',
      'sabor que reconnecta com o melhor da semana',
      'lugar onde o ambiente e o prato se completam',
    ],
    vocabularioProibido: ['empreendedor', 'funil', 'ROI', 'lead', 'tráfego', 'métricas', 'B2B'],
    notaMetodo: 'Gastronomia vende pela sensação antes pelo produto. Semear com o estado emocional que a comida cria.',
  },

  {
    id: 'casa_manutencao',
    nome: 'Casa & Manutenção',
    keywords: ['eletricista', 'encanador', 'pintor', 'pedreiro', 'marceneiro', 'jardineiro',
               'limpeza', 'reforma', 'construção', 'hidráulica', 'elétrica', 'ar-condicionado',
               'dedetização', 'impermeabilização', 'serralheiro', 'vidraçaria'],
    segmentos: ['SERVIÇOS'],
    audiencias: ['B2C'],
    territorio: 'conforto, segurança e o custo real de adiar manutenção em casa',
    angulosTensao: [
      'problema pequeno ignorado que vira transtorno grande',
      'tentar resolver sozinho e piorar o que já estava ruim',
      'conviver com incômodo porque parece que "não é urgente"',
    ],
    angulosMotivacao: [
      'casa funcionando sem preocupação no fundo da cabeça',
      'reforma que entrega exatamente o que estava na cabeça',
      'profissional que resolve uma vez, certo, e não volta mais',
    ],
    vocabularioProibido: ['empreendedor', 'ROI', 'funil', 'lead', 'tráfego', 'B2B', 'decisor'],
    notaMetodo: 'O medo do custo alto e do transtorno é a entrada; a paz de uma casa funcionando é a chegada. Use os dois.',
  },

  // ── SERVIÇOS B2B ──────────────────────────────────────────────────────────

  {
    id: 'comunicacao_marketing',
    nome: 'Comunicação & Marketing',
    keywords: ['agência', 'propaganda', 'marketing', 'publicidade', 'mídia', 'branding',
               'comunicação', 'social media', 'conteúdo', 'criação', 'design', 'criativo',
               'inbound', 'performance', 'anúncio', 'campanha'],
    segmentos: ['SERVIÇOS'],
    audiencias: ['B2B'],
    territorio: 'presença de marca, geração de demanda e o custo de comunicação sem estratégia em empresas que precisam crescer',
    angulosTensao: [
      'empresa visível para si mesma mas invisível para o mercado que importa',
      'investimento em presença digital sem retorno rastreável',
      'comunicação que parece certa por dentro mas não converte por fora',
      'dependência de indicação sem construir canal próprio de demanda',
    ],
    angulosMotivacao: [
      'marca que finalmente comunica o que entrega e para quem importa',
      'presença digital que gera demanda previsível, não acidental',
      'empresa reconhecida no seu território antes do cliente pedir orçamento',
    ],
    vocabularioProibido: ['empreendedor isolado', 'consumidor final', 'cliente pessoa física',
                          'gatilho emocional de compra por impulso'],
    notaMetodo: 'B2B: semear com o risco operacional ou estratégico de comunicação ineficaz, não com dor emocional pessoal.',
  },

  {
    id: 'tecnologia_digital',
    nome: 'Tecnologia & Digital',
    keywords: ['software', 'tech', 'desenvolvimento', 'TI', 'sistemas', 'automação', 'digital',
               'app', 'aplicativo', 'plataforma', 'cloud', 'dados', 'inteligência artificial',
               'IA', 'cibersegurança', 'ERP', 'CRM', 'DevOps', 'startup'],
    segmentos: ['SERVIÇOS'],
    audiencias: ['B2B'],
    territorio: 'eficiência operacional, previsibilidade de processo e o custo de manter sistema legado ou processo manual',
    angulosTensao: [
      'processo manual que esconde custo invisível e limita crescimento',
      'dado que existe mas não gera decisão porque está disperso',
      'tecnologia implementada sem adoção real do time',
      'sistema que já não escala mas está demais entranhado para trocar',
    ],
    angulosMotivacao: [
      'operação que cresce sem aumentar proporcionalmente o time',
      'decisão baseada em dado real, não em intuição de gestor sobrecarregado',
      'processo automatizado que devolve tempo para o que a empresa faz melhor',
    ],
    vocabularioProibido: ['consumidor final', 'cliente pessoa física', 'impulso de compra',
                          'autocuidado', 'emocional pessoal'],
    notaMetodo: 'B2B tech: a progressão vai de custo operacional visível → segurança na solução → confiança no fornecedor → autoridade técnica → decisão de implementar.',
  },

  {
    id: 'consultoria_gestao',
    nome: 'Consultoria & Gestão',
    keywords: ['consultoria', 'gestão', 'estratégia', 'RH', 'recursos humanos', 'processos',
               'financeiro', 'contabilidade gerencial', 'planejamento', 'mentoria empresarial',
               'coaching executivo', 'M&A', 'due diligence', 'governança'],
    segmentos: ['SERVIÇOS'],
    audiencias: ['B2B'],
    territorio: 'decisão estratégica, risco calculado e o custo de crescer sem estrutura de gestão compatível',
    angulosTensao: [
      'empresa que cresce no faturamento mas não na margem',
      'liderança sobrecarregada que opera no dia a dia em vez de na estratégia',
      'decisão tomada com dado insuficiente porque o processo não gera o relatório certo',
      'estrutura que funcionava quando era pequeno e hoje é o gargalo',
    ],
    angulosMotivacao: [
      'empresa que passa a crescer com previsibilidade porque o processo sustenta a escala',
      'gestores que voltaram a fazer o que sabem porque o operacional está resolvido',
      'decisão estratégica tomada com dado, não com percepção de corredor',
    ],
    vocabularioProibido: ['consumidor final', 'cliente pessoa física', 'emocional de compra',
                          'autocuidado', 'autoestima'],
    notaMetodo: 'O decisor B2B precisa de segurança antes de confiança. Mostre que você entende o risco antes de mostrar a solução.',
  },

  {
    id: 'juridico_contabil',
    nome: 'Jurídico & Contábil',
    keywords: ['advocacia', 'advogado', 'contabilidade', 'contador', 'jurídico', 'tributário',
               'compliance', 'fiscal', 'trabalhista', 'imobiliário', 'previdenciário',
               'contratos', 'LGPD', 'direito', 'escritório jurídico', 'auditoria'],
    segmentos: ['SERVIÇOS'],
    audiencias: ['B2B'],
    territorio: 'certeza jurídica e fiscal, redução de risco passivo e o custo de decisão tomada sem base legal ou contábil sólida',
    angulosTensao: [
      'passivo trabalhista ou fiscal acumulado sem que a empresa perceba',
      'contrato que não protege porque foi feito sem análise de risco real',
      'decisão tributária tomada pela opção mais barata, não pela mais segura',
      'empresa exposta a risco legal por não ter acompanhamento preventivo',
    ],
    angulosMotivacao: [
      'empresa que opera com segurança porque o jurídico/fiscal está coberto',
      'decisão de expansão tomada com análise de risco prévia',
      'carga tributária otimizada dentro da lei com revisão especializada',
    ],
    vocabularioProibido: ['consumidor final', 'emocional', 'autocuidado', 'impulso', 'sensorial'],
    notaMetodo: 'Segurança vem antes de confiança para B2B jurídico. Mostre o risco primeiro, depois a proteção, depois a autoridade.',
  },

  // ── VAREJO ────────────────────────────────────────────────────────────────

  {
    id: 'moda_vestuario',
    nome: 'Moda & Vestuário',
    keywords: ['moda', 'roupa', 'loja', 'boutique', 'calçados', 'acessórios', 'vestuário',
               'ateliê', 'alfaiataria', 'grife', 'streetwear', 'roupas', 'bolsa', 'tênis',
               'coleção', 'fashion', 'look', 'estilo'],
    segmentos: ['VAREJO'],
    audiencias: ['B2C'],
    territorio: 'identidade pessoal, expressão através da aparência e o impacto do look na percepção de si e do outro',
    angulosTensao: [
      'guarda-roupa cheio de roupas e a sensação de não ter nada para usar',
      'peça certa que falta para o look funcionar do jeito que estava na cabeça',
      'usar o mesmo padrão por hábito e sentir que a imagem ficou para trás',
    ],
    angulosMotivacao: [
      'look que comunica quem você é antes de você abrir a boca',
      'peça que funciona em mais de um contexto e resolve a semana',
      'estilo construído com intenção, não por acumulação',
    ],
    vocabularioProibido: ['empreendedor', 'ROI', 'lead', 'funil', 'tráfego', 'B2B', 'decisor'],
    notaMetodo: 'Moda vende identificação antes de produto. A sequência vai da tensão de imagem → aspiração de estilo → autoridade da loja/curadoria → ação de comprar.',
  },

  {
    id: 'casa_decoracao',
    nome: 'Casa & Decoração',
    keywords: ['decoração', 'móveis', 'casa', 'lar', 'utensílios', 'design de interiores',
               'arquitetura', 'reforma decoração', 'iluminação', 'revestimento', 'piso',
               'colchão', 'sofá', 'cama', 'ambientação', 'jardim', 'varanda'],
    segmentos: ['VAREJO', 'SERVIÇOS'],
    audiencias: ['B2C'],
    territorio: 'sensação de pertencimento ao próprio espaço, casa como extensão da identidade e o custo emocional de viver em ambiente que não reflete quem você é',
    angulosTensao: [
      'espaço que nunca ficou do jeito que estava na cabeça',
      'comprar peça por peça sem critério e o resultado que não combina',
      'ambiente que cansa em vez de recuperar',
    ],
    angulosMotivacao: [
      'casa que recepciona bem antes do visitante sentar',
      'ambiente que faz você querer ficar, não sair',
      'espaço construído com intenção que atravessa tendências',
    ],
    vocabularioProibido: ['empreendedor', 'ROI', 'funil', 'lead', 'tráfego', 'B2B'],
    notaMetodo: 'Sensorial e identitário. A progressão vai do desconforto com o espaço atual → aspiração pelo espaço certo → confiança na curadoria/expertise → decisão de renovar.',
  },

  // ── MARCA ─────────────────────────────────────────────────────────────────

  {
    id: 'marca_pessoal',
    nome: 'Marca Pessoal',
    keywords: ['personal brand', 'personal branding', 'influencer', 'especialista', 'autoridade',
               'profissional liberal', 'speaker', 'palestrante', 'escritor', 'criador',
               'terapeuta holístico', 'coach', 'mentor', 'produtor', 'artista'],
    segmentos: ['MARCA'],
    audiencias: ['B2C', 'B2B'],
    territorio: 'posicionamento pessoal, autoridade construída por consistência e o espaço que uma voz própria ocupa no mercado',
    angulosTensao: [
      'especialista reconhecido por quem já o conhece mas invisível para quem precisa dele',
      'presença digital que não reflete o nível real de entrega',
      'reputação construída offline que não aparece no digital',
    ],
    angulosMotivacao: [
      'marca que faz o mercado certo chegar sem precisar prospectar',
      'presença digital que amplifica o que a pessoa já é',
      'voz própria que atrai pelo que representa, não só pelo que entrega',
    ],
    vocabularioProibido: ['gatilho de escassez', 'urgência forçada', 'oferta por tempo limitado',
                          'venda a qualquer custo'],
    notaMetodo: 'Marca pessoal: identidade antes de entrega. A sequência constrói quem é a pessoa → o que defende → como ajuda → por que agir agora.',
  },

  {
    id: 'marca_institucional',
    nome: 'Marca Institucional',
    keywords: ['institucional', 'corporativo', 'empresa', 'organização', 'fundação', 'associação',
               'cooperativa', 'holding', 'grupo', 'rede', 'franquia', 'marca regional'],
    segmentos: ['MARCA'],
    audiencias: ['B2C', 'B2B'],
    territorio: 'posicionamento institucional, legado e o papel da marca no seu território de atuação',
    angulosTensao: [
      'empresa com história rica mas narrativa fraca no digital',
      'marca bem-estabelecida que não comunica o que representa para a nova geração',
      'reputação que existe no boca a boca mas não na presença digital',
    ],
    angulosMotivacao: [
      'marca que pertence ao lugar e é reconhecida como parte da cultura local',
      'empresa que atravessou gerações e segue relevante por saber o que representa',
      'presença institucional que inspira confiança antes da primeira conversa',
    ],
    vocabularioProibido: ['gatilho de urgência', 'oferta', 'promoção', 'desconto', 'venda agressiva'],
    notaMetodo: 'Institucional: posicionamento antes de produto. A sequência vai de identidade → repertório → relevância → reconhecimento → pertencimento.',
  },
];

/**
 * Detecta o perfil editorial mais adequado para a atividade/segmento informados.
 * Usa correspondência de palavras-chave sem custo de API.
 *
 * Exige fronteira de palavra (evita "lar" casar dentro de "escolares", "ia"
 * dentro de "veterinária" etc.) e uma pontuação mínima — abaixo disso,
 * nenhum perfil é mais seguro do que um perfil mal-encaixado.
 */
const MIN_PROFILE_SCORE = 5;

export function detectEditorialProfile(
  mainActivity: string,
  segment: 'SERVIÇOS' | 'VAREJO' | 'MARCA',
  audience: 'B2C' | 'B2B',
): EditorialProfile | null {
  if (!mainActivity.trim()) return null;

  const haystack = mainActivity.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  let bestProfile: EditorialProfile | null = null;
  let bestScore = 0;

  for (const profile of editorialProfiles) {
    if (!profile.segmentos.includes(segment)) continue;
    if (!profile.audiencias.includes(audience)) continue;

    let score = 0;
    for (const kw of profile.keywords) {
      const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const escaped = kwNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`).test(haystack)) score += kwNorm.length; // keywords mais longas pesam mais
    }
    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
    }
  }

  return bestScore >= MIN_PROFILE_SCORE ? bestProfile : null;
}
