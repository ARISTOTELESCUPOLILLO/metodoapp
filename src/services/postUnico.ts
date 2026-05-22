import { BrandKit, LogoPosition, MoodCode, PostUnicoDirecao, PostUnicoFormData, PostUnicoObjetivo } from '../types';
import { composeFeedPng } from '../utils/canvasComposer';
import type { FeedItem } from '../types';
import { generateImageAsync } from './imageGeneration';
import { buildTypographyBlock, buildTypographyShortRule } from '../utils/typography';

const OBJETIVO_LABEL: Record<PostUnicoObjetivo, string> = {
  promocao: 'Promoção comercial — gerar desejo e ação',
  homenagem: 'Homenagem — celebrar pessoa, data ou conquista com emoção',
  aviso: 'Aviso institucional — comunicar com clareza e autoridade',
  oportunidade: 'Oportunidade — sinalizar momento único, urgência elegante',
  institucional: 'Institucional — reforçar posicionamento, propósito e autoridade da marca',
};

const OBJETIVO_TONE: Record<PostUnicoObjetivo, string> = {
  promocao: 'energia comercial, desejo, movimento',
  homenagem: 'afeto, luz quente, respeito, contemplação',
  aviso: 'clareza institucional, autoridade tranquila',
  oportunidade: 'momento decisivo, contraste dramático, sensação de janela rara',
  institucional: 'sobriedade contemporânea, autoridade calma, identidade de marca, atemporalidade',
};

const MOOD_NAMES: Record<MoodCode, string> = {
  'OP-01': 'CLAREZA',
  'OP-02': 'IMPACTO',
  'OP-03': 'INSTANTE',
  'OP-04': 'FRAGMENTO',
  'OP-05': 'DESVIO',
  'OP-06': 'SILÊNCIO',
};

const MOOD_INSTRUCTIONS: Record<MoodCode, string> = {
  'OP-01': 'Direção visual: composição organizada e arejada, luz natural difusa, simetria, paleta fria e clara (azuis, cinzas suaves, branco), destaque pontual de cor. Sensação de explicação calma e didática. PROIBIDO: contraste extremo, fundo escuro dramático, paleta quente saturada (isso é IMPACTO).',
  'OP-02': 'Direção visual IMPACTO: peça que para o scroll por contraste extremo. Escolha UMA das sub-estéticas a seguir (não combine, vá fundo em uma só) e EVITE repetir a fórmula mais óbvia (escritório escuro com luminária âmbar) se ela já é a primeira que vem à mente: (a) cinematográfico quente — fundo escuro, luz focal âmbar/dourada, sombras profundas; (b) frio cortante — paleta azul/ciano/aço, luz dura branca, atmosfera tech/editorial, alto contraste sem ser quente; (c) urbano de alto contraste — rua, neon, luz mista colorida, sombra dura, granulação; (d) gráfico saturado — fundo de cor sólida chapada (vermelho, magenta, verde elétrico, azul-rei), sujeito recortado com sombra dura, estética pôster contemporâneo. Em todas: contraste alto, leitura imediata, sensação de campanha que interrompe o feed.',
  'OP-03': 'Direção visual: estética DOCUMENTAL/REPORTAGEM, captura espontânea como foto de bastidor real. Luz ambiente NEUTRA (luz de janela, luz de dia, fluorescente de escritório, luz urbana plana). Cores levemente DESSATURADAS, granulação fotográfica sutil, leve imperfeição (foco aproximado, enquadramento espontâneo, ângulos não-publicitários). Sensação de "registrei agora com o celular", não de campanha produzida. PROIBIDO terminantemente: contraste extremo, sombras profundas dramáticas, paleta quente âmbar/dourada/laranja saturada, fundo escuro de estúdio, luz focal cinematográfica — tudo isso é IMPACTO, não INSTANTE.',
  'OP-04': 'Direção visual: colagem com 3-5 blocos visuais distintos lado a lado, grid implícito, paleta unificada mas com texturas variadas, canto inferior direito limpo. Sensação de comparação/justaposição de ideias.',
  'OP-05': 'Direção visual: imagem-conceito com elemento inesperado, metáfora visual surreal, paleta incomum (verdes, lilás, ciano, combinações não-óbvias), sujeito sempre legível. Sensação de provocação intelectual. PROIBIDO: paleta âmbar/dourada óbvia (isso é IMPACTO).',
  'OP-06': 'Direção visual: fundo quase branco ou tom pastel muito claro, espaço vazio dominante, tipografia protagonista, detalhe mínimo de cor pontual, estética premium minimalista (estilo editorial de luxo). PROIBIDO: fundo escuro, contraste alto, paleta quente saturada (isso é IMPACTO).',
};

const FORBIDDEN_MOOD_WORDS = `PALAVRAS PROIBIDAS NA IMAGEM: NUNCA escreva, desenhe ou renderize como texto/lettering/título/etiqueta, em nenhum lugar da peça, as palavras CLAREZA, IMPACTO, INSTANTE, FRAGMENTO, DESVIO, SILÊNCIO, MOOD, OP-01, OP-02, OP-03, OP-04, OP-05, OP-06 — são códigos internos do sistema e nunca devem aparecer na arte final.`;

function direcaoBlock(direcao: PostUnicoDirecao, mood?: MoodCode): string {
  if (direcao === 'mood' && mood) {
    return `DIREÇÃO (mood ${mood} ${MOOD_NAMES[mood]}): ${MOOD_INSTRUCTIONS[mood]}\n\nIMPORTANTE: esta peça é mood ${MOOD_NAMES[mood]} — NÃO use estética dos outros moods. Respeite rigorosamente a paleta, luz e composição descritas acima.`;
  }
  return `DIREÇÃO LIVRE: a IA tem liberdade total de direção de arte — NÃO há mood pré-definido. Varie ATIVAMENTE entre abordagens visuais possíveis: pode ser luz natural suave OU dramática, paleta fria OU quente, fundo claro OU escuro, composição calma OU energética, predominantemente fotográfica OU gráfica OU mista. Evite repetir a mesma fórmula visual de peças anteriores. Escolha uma direção com personalidade própria e vá fundo nela. Resultado: arte publicitária brasileira contemporânea de alto nível editorial. PROIBIDO: aparência de Canva/template/panfleto, gradient banal, ícones flat, estética de stock genérico, fórmula default "fundo escuro + luz dourada dramática" (essa é apenas UMA das opções, não a padrão).`;
}

function logoZoneDescription(position: LogoPosition | undefined): { reservaTopo: string; regraFinal: string } {
  const pos = position || 'bottom-right';
  // IMPORTANTE: a "área da logo" deve ser PEQUENA (~10% da largura, ~6% da altura)
  // e parte natural da composição — NÃO um retângulo branco/vazio enorme.
  // Pode haver fundo, textura, fotografia ou cor de marca atrás; só evitamos
  // texto, rosto, objeto-foco e lettering exatamente sobre o ponto da logo,
  // mantendo contraste local suficiente para a marca ser legível.
  const base =
    'A região onde a logomarca será aplicada depois é uma ÁREA RESERVADA INVIOLÁVEL de aproximadamente 18% da largura por 10% da altura. Dentro dessa área é PROIBIDO colocar: qualquer texto, lettering, número, título, palavra solta, rosto humano, mão, objeto-foco, gráfico, ícone, símbolo, recorte de produto ou elemento decorativo. A área deve ser uma CONTINUAÇÃO NATURAL E ORGÂNICA da imagem ao redor (fotografia de fundo, textura, céu, parede, superfície contínua). PROIBIDO TAMBÉM desenhar ali qualquer bloco, retângulo, painel, faixa, caixa, moldura, etiqueta, badge ou fundo de cor sólida (inclusive a cor da marca) para "marcar" ou "reservar" o espaço da logo — sem moldura, sem caixa, sem painel, sem fundo destacado de cor cheia. Apenas garanta contraste local suficiente para a logo ficar legível depois.';
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

export async function generatePostUnicoCopy(data: PostUnicoFormData, brandVoice?: string): Promise<PostUnicoCopy> {
  const res = await fetch('/api/generate-pu-copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: data.companyName,
      mainActivity: data.mainActivity,
      objetivo: data.objetivo,
      keyInfo: data.keyInfo,
      brandVoice: brandVoice || '',
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

function segmentRules(segment?: string): string {
  if (segment === 'VAREJO') {
    return 'SEGMENTO VAREJO: produtos são protagonistas quando presentes (com destaque visual sem virar catálogo); cenário cria ambiente de loja/experiência; avatar pode ser vendedor, atendente ou cliente em apoio.';
  }
  if (segment === 'MARCA') {
    return 'SEGMENTO MARCA: cenário e avatar constroem percepção, identidade e atmosfera; cenário reforça posicionamento; avatar é personagem representativo da marca.';
  }
  return 'SEGMENTO SERVIÇOS: avatar é o elemento mais importante quando presente — transmite autoridade, presença e confiança; cenário é apoio de contexto profissional; produtos, se houver, são materiais de apoio (não catálogo).';
}

function referencesBlock(refs?: PostUnicoReferences, segment?: string): string {
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
    parts.push(`AVATAR: a primeira imagem de referência é o avatar. Use como personagem da peça mantendo semelhança visual (rosto, perfil físico, faixa etária, gênero, expressão e características predominantes). Adapte roupas, postura e linguagem corporal ao contexto da atividade da empresa e ao mood. Aparência publicitária e realista — sem caricatura, sem distorção facial, sem clonagem exata da foto original. REPERTÓRIO DE POSE/ENQUADRAMENTO (escolha conscientemente — NÃO caia automaticamente em "sentado à mesa com notebook olhando para a câmera"): pode estar em pé, andando, de perfil, de costas parcial, em meio gesto, em conversa com alguém fora de quadro, com material/produto em mãos, encostado em parede, em ambiente externo. NÃO é obrigatório olhar para a câmera. NÃO é obrigatório estar atrás de mesa com notebook. Enquadramento pode variar: close de rosto, meio corpo, corpo inteiro, três-quartos, OU peça sem rosto visível (mãos trabalhando, detalhe de gesto, ambiente com presença implícita). Escolha a combinação que melhor serve à mensagem desta peça específica.`);
  }
  if (refs.cenario) {
    parts.push(`CENÁRIO: usar como ambientação, atmosfera e contexto. Aproveite estilo do ambiente, profundidade, iluminação e sensação espacial. Não deve competir visualmente com os elementos principais.`);
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
  const objetivo = OBJETIVO_LABEL[data.objetivo];
  const tom = OBJETIVO_TONE[data.objetivo];
  const direcao = direcaoBlock(data.direcao, data.mood);
  const primary = kit.primaryColor || '#123a63';
  const accent = kit.accentColor || kit.secondaryColor || '#f4b000';
  const zona = logoZoneDescription(kit.logoPosition);

  const typographyBlock = buildTypographyBlock(kit.fontPair);
  const typographyShort = buildTypographyShortRule(kit.fontPair);

  const copyBlock = copy && (copy.titulo || copy.texto)
    ? `TÍTULO E TEXTO OBRIGATÓRIOS (use EXATAMENTE estas palavras como tipografia da peça — NÃO invente outros, NÃO traduza, NÃO reescreva):
TÍTULO: "${copy.titulo}"
TEXTO DE APOIO: "${copy.texto}"

Hierarquia tipográfica: título dominante e texto de apoio menor — mas a POSIÇÃO do bloco é livre. Pode estar no topo, na lateral esquerda, na lateral direita, na base, sobreposto à imagem, em barra inferior, dividido em duas zonas da peça, ou ancorado em um canto. EVITE a fórmula default "bloco amarelo+branco encostado na borda esquerda ocupando metade da peça" se ela não for a melhor para esta composição específica — explore outras ancoragens.`
    : `TEXTO LIVRE — OBRIGATÓRIO (criado pela IA a partir da informação-chave):
A IA DEVE criar lettering na peça — texto É OBRIGATÓRIO, peça sem texto não é permitida.
Crie livremente: um TÍTULO curto em CAIXA ALTA (impacto direto, até 6 palavras) + um TEXTO DE APOIO breve (1-2 frases) inspirados na informação-chave "${data.keyInfo.trim()}".
NÃO copie a informação-chave literalmente — interprete-a criativamente com tom publicitário.
A IA tem TOTAL LIBERDADE de posição, estilo tipográfico e ancoragem do bloco — pode estar em qualquer região da peça, em qualquer peso/fonte dentro da tipografia da marca. Explore ancoragens além do "bloco encostado na borda esquerda".`;

  return `⚠ REGRA ABSOLUTA — DISPOSITIVOS DIGITAIS (leia antes de gerar qualquer elemento da cena):

NOTEBOOK / LAPTOP aberto sobre a mesa ou no colo:
→ ÂNGULO OBRIGATÓRIO: câmera posicionada FRONTALMENTE À TELA, 30°–50° na horizontal em relação ao eixo central da tela, altura dos olhos ou ligeiramente acima. Resultado: vê-se a TELA (com conteúdo real — gráfico, dashboard, app, planilha, texto), o TECLADO em perspectiva e UMA LATERAL. A tampa traseira é geometricamente INVISÍVEL porque a tela bloqueia o ângulo.
→ PROIBIDO: câmera atrás do monitor (que revelaria a tampa), top-down com laptop fechado, qualquer ângulo que mostre a superfície traseira da tampa.
→ DEFEITO FÍSICO PROIBIDO — TAMPA DO NOTEBOOK: a tampa traseira é uma superfície física sólida (plástico, alumínio, couro). NÃO tem tela. NÃO emite luz. NÃO exibe conteúdo.
  • PROIBIDO: brilho de tela ou emissão luminosa na tampa; imagem, interface, dashboard, ícone ou qualquer conteúdo visual sobre a tampa; duplicação ou espelho da tela frontal na parte externa; efeito "tela invertida" na tampa; aparência de monitor dos dois lados; qualquer elemento emissivo que simule display na carcaça traseira.
  • PERMITIDO: a tampa pode aparecer PARCIALMENTE na cena como superfície neutra — o que NUNCA pode existir é conteúdo visual aplicado sobre ela.
  • COMPORTAMENTO FÍSICO CORRETO: tampa sólida e neutra; tela exclusivamente na face interna; dispositivo fisicamente coerente; composição cinematográfica realista.

CELULAR / SMARTPHONE na mão ou sobre superfície:
→ ÂNGULO OBRIGATÓRIO: tela voltada diretamente para a câmera, inclinado 20°–40° em relação à vertical. Resultado: vê-se apenas a TELA (com conteúdo real — app, mensagem, mapa, feed) e as bordas laterais. O verso é fisicamente oculto.
→ PROIBIDO: celular com verso à mostra, câmera traseira voltada para quem fotografa.

TABLET sobre mesa ou na mão:
→ ÂNGULO OBRIGATÓRIO: tela inclinada 50°–70° em relação à horizontal, voltada para a câmera. Resultado: vê-se apenas a TELA (com conteúdo real) e as bordas.
→ PROIBIDO: tablet com verso à mostra, câmera atrás ou abaixo do aparelho.

MONITOR / DESKTOP:
→ ÂNGULO OBRIGATÓRIO: câmera ao nível dos olhos, 0°–30° horizontal — visão frontal. Vê-se apenas a TELA (com conteúdo real) e a moldura.
→ PROIBIDO: câmera atrás do monitor, mostrar a parte traseira como elemento principal.

REGRA UNIVERSAL: a TELA FRONTAL mostra SEMPRE conteúdo real (gráfico, dashboard, app, texto, foto — NUNCA tela preta ou em branco). A CARCAÇA / TAMPA / VERSO é superfície SÓLIDA e OPACA — ZERO interface, ZERO tela, ZERO reflexo de UI na tampa ou verso. Todo dispositivo deve ter comportamento físico coerente com a realidade — um notebook NÃO É um monitor dos dois lados.

Peça publicitária ÚNICA para Instagram, formato NATIVO 1080x1350px (4:5). NÃO carrossel, NÃO série — standalone.

ZONA SEGURA INVIOLÁVEL DE 110 PX em todas as bordas do canvas 1080x1350. Nada importante (rosto, olhos, mãos, produto-foco, lettering, gráficos, logo) entra nesse perímetro — bordas são continuação natural do fundo. ${zona.reservaTopo}

EMPRESA: ${data.companyName || kit.companyName || 'Marca'}
ATIVIDADE: ${data.mainActivity || kit.mainActivity || ''}
OBJETIVO: ${objetivo}
TOM: ${tom}

INFORMAÇÃO-CHAVE (contexto — pode interpretar com liberdade visual):
"${data.keyInfo.trim()}"

${copyBlock}

${direcao}

Cor primária: ${primary}. Cor de destaque: ${accent}. Use como ancoragem cromática, não como obrigação rígida.

${typographyBlock}

REGRAS:
- Esta peça é STANDALONE — não precisa parecer parte de uma série. Evite a fórmula visual mais óbvia para o briefing; escolha uma execução com personalidade própria dentro da direção definida.
- Todo texto em PORTUGUÊS, sem inglês
- Alta resolução, estética editorial/publicitária brasileira
- Direção de arte humana, nunca arte automática
- Sem watermarks, sem logo fictícia, sem assinatura textual
- DISPOSITIVOS DIGITAIS — INEGOCIÁVEL: ao aparecer notebook, tablet, celular, monitor ou TV, a TELA FRONTAL mostra conteúdo real e coerente (gráfico, dashboard, app, mensagem, foto, planilha, vídeo); a TAMPA TRASEIRA / VERSO / CARCAÇA é superfície SÓLIDA e OPACA, sem display — proibido renderizar ali interface, gráfico, ícone, app, brilho de tela, reflexo de UI, segunda tela, logo de SO ou vazamento da tela frontal; o aparelho deve aparecer em ângulo que naturalmente esconda ou minimize a tampa (em perfil/diagonal sobre a mesa, na mão em uso, no colo, câmera baixa, por cima do ombro de quem digita). Proibido: vista top-down de laptop fechado, foto frontal do verso de tablet/celular como elemento central, mockup plano da tampa.
- ${zona.regraFinal}
- ${typographyShort}

${referencesBlock(references, kit.segment)}

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
  opts?: { debit?: boolean; brandVoice?: string },
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
  const full = [texto, cta].filter(Boolean).join(' ') + (tagLine ? `\n\n${tagLine}` : '');
  return { texto, cta, hashtags, full };
}

export async function generatePostUnico(params: {
  data: PostUnicoFormData;
  kit: BrandKit;
  copy?: PostUnicoCopy;
  references?: PostUnicoReferences;
}): Promise<string> {
  const { data, kit, copy, references } = params;
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
