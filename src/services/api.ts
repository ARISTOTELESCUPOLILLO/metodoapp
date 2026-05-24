import { buildMetodoOpPrompt, normalizeMethodResult } from '../core/organizaMethodEngine';
import { ContentFormData, LogoPosition, MethodOpResult, MoodCode } from '../types';
import { generateImageAsync } from './imageGeneration';
import { buildTypographyBlock, buildTypographyShortRule } from '../utils/typography';
import { supabase } from '@/integrations/supabase/client';
import { getImpersonation } from '@/hooks/useImpersonation';

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const imp = getImpersonation();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(imp ? { 'X-Impersonate-User-Id': imp.userId } : {}),
    };
  } catch {
    return {};
  }
}

export async function generateMethodContent(data: ContentFormData): Promise<MethodOpResult> {
  const prompt = buildMetodoOpPrompt(data);
  const auth = await authHeader();
  const res = await fetch('/api/generate-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ prompt }),
  });

  const ct = res.headers.get('content-type') || '';
  const isStream = ct.includes('text/event-stream') && res.body;

  // Caminho 1: stream SSE (caminho normal a partir de agora).
  if (res.ok && isStream) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let streamErr: string | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const evt = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of evt.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            if (j?.error) { streamErr = String(j.error); continue; }
            const d = j?.choices?.[0]?.delta?.content;
            if (typeof d === 'string') full += d;
          } catch { /* chunk parcial — ignora */ }
        }
      }
    }

    if (streamErr) {
      throw new Error('O servidor demorou demais pra responder. Tente novamente em alguns segundos.');
    }
    if (!full) {
      throw new Error('Resposta vazia do gerador. Tente novamente.');
    }

    let parsed: any;
    try { parsed = JSON.parse(full); } catch {
      throw new Error('Resposta do gerador veio incompleta. Tente novamente.');
    }
    return normalizeMethodResult(parsed, data.track, data.sequenceSize);
  }

  // Caminho 2 (fallback): resposta não-stream (erro JSON ou texto de gateway).
  const raw = await res.text();
  let payload: any = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { /* não-JSON */ }
  if (!res.ok || !payload) {
    const lower = (raw || '').toLowerCase();
    const msg =
      payload?.error ||
      (lower.includes('upstream') || lower.includes('timeout') || lower.includes('time-out') || lower.includes('524')
        ? 'O servidor demorou demais pra responder. Tente novamente em alguns segundos.'
        : (raw?.slice(0, 200) || `Erro ${res.status} ao gerar conteúdo`));
    throw new Error(msg);
  }
  // Compat: rota antiga devolvia { result }.
  return normalizeMethodResult(payload.result, data.track, data.sequenceSize);
}

// fal.ai removido — usamos diretamente OpenAI gpt-image-2 via /api/generate-image


const ESTATICO_FINAL_MODIFIER = `
MODULAÇÃO DE FECHAMENTO (formato Estático Final — peça de resolução narrativa):
- Composição mais limpa e centralizada que o estático comum
- Mais espaço negativo, sensação de respiro ampliado
- Foco visual mais concentrado num único elemento principal
- Menor ruído gráfico, menos camadas visuais simultâneas
- Maior estabilidade visual, sensação de equilíbrio assentado
- Sensação geral de resolução e fechamento emocional, não de provocação
- Manter integralmente a identidade do mood escolhido (cores, tipografia, alinhamento, raiz visual)
- Apenas modular intensidade: reduzir agressividade onde houver, aumentar contenção
`.trim();

function buildImagePrompt(params: {
  titulo: string;
  texto: string;
  imagePrompt: string;
  leituraCenica?: {
    intencao?: string;
    personagem?: string;
    ambiente?: string;
    expressao?: string;
    clima?: string;
    composicao?: string;
  };
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  moodInstructions: string;
  isFinal?: boolean;
  hasLogo?: boolean;
  logoPosition?: LogoPosition;
  format?: 'post' | 'reels_cover';
  hasRefs?: boolean;
}): string {
  const { titulo, texto, imagePrompt, leituraCenica, primaryColor, accentColor, fontFamily, moodInstructions, isFinal, hasLogo, logoPosition, format, hasRefs } = params;
  const isCover = format === 'reels_cover';
  const canvasSize = isCover ? '1080x1920' : '1080x1350';
  const canvasRatio = isCover ? '9:16 (reels vertical)' : '4:5 (feed)';
  const safeMargin = isCover ? '150 px' : '110 px';
  const tituloUpper = titulo.toUpperCase();
  const pos = logoPosition || 'bottom-right';
  const zonaLogo =
    pos === 'top-center'    ? `na FAIXA SUPERIOR CENTRAL (centralizada horizontalmente, dentro do topo da zona segura de ${safeMargin})`
  : pos === 'bottom-center' ? `na FAIXA INFERIOR CENTRAL (centralizada horizontalmente, dentro do rodapé da zona segura de ${safeMargin})`
  :                           'no canto inferior direito';
  const reservaBase = 'É uma ÁREA RESERVADA INVIOLÁVEL (~18% da largura × ~10% da altura). PROIBIDO ali: qualquer texto, lettering, número, título, palavra, rosto, mão, objeto-foco, gráfico, ícone, símbolo, recorte de produto ou elemento decorativo. A área deve ser uma CONTINUAÇÃO NATURAL E ORGÂNICA da imagem ao redor (fotografia de fundo, textura, superfície contínua). PROIBIDO TAMBÉM desenhar ali bloco, retângulo, painel, faixa, caixa, moldura, etiqueta, badge ou fundo de cor sólida (inclusive a cor da marca) para "marcar" o espaço da logo — sem moldura, sem caixa, sem painel, sem fundo de cor cheia destacado. Apenas garanta contraste local suficiente para a logo ficar legível depois.';
  const reservaInstrucao =
    pos === 'top-center'    ? `A FAIXA SUPERIOR CENTRAL é a zona da logomarca. ${reservaBase}`
  : pos === 'bottom-center' ? `A FAIXA INFERIOR CENTRAL é a zona da logomarca. ${reservaBase}`
  :                           `O CANTO INFERIOR DIREITO é a zona da logomarca. ${reservaBase}`;
  const marcaInstruction = hasLogo
    ? `Aplique a logomarca fornecida (imagem de referência) ${zonaLogo} da composição, em tamanho discreto (cerca de 12% da largura), totalmente dentro da zona segura de ${safeMargin}, preservando proporções originais, sem distorcer, sem cortar, sem inventar texto. Não adicione nenhuma outra assinatura textual. ${reservaInstrucao}`
    : `Não adicione nenhum texto de assinatura ou nome de marca — a assinatura será aplicada separadamente. ${reservaInstrucao}`;

  const typographyBlock = buildTypographyBlock(fontFamily);
  const typographyShort = buildTypographyShortRule(fontFamily);

  const cenaDetalhada = leituraCenica
    ? `CENA DETALHADA:
- Intenção emocional: ${leituraCenica.intencao || ''}
- Personagem: ${leituraCenica.personagem || ''}
- Ambiente: ${leituraCenica.ambiente || ''}
- Expressão: ${leituraCenica.expressao || ''}
- Clima/Luz: ${leituraCenica.clima || ''}
- Composição: ${leituraCenica.composicao || ''}
- Referência visual adicional: ${imagePrompt}`
    : `CENA FOTOGRÁFICA: ${imagePrompt}`;

  const finalModifier = isFinal ? `\n${ESTATICO_FINAL_MODIFIER}\n` : '';

  const coverRefBlock = (isCover && hasRefs)
    ? `\nREFERÊNCIA VISUAL OBRIGATÓRIA — A imagem de referência enviada é o PRIMEIRO FRAME do reels (o porta-voz na cena real, SEM logo aplicada). USE essa pessoa e esse cenário como BASE da capa: mesmo rosto (idade, etnia, barba, cabelo, óculos, expressão), mesma roupa, mesmo enquadramento aproximado, mesmo ambiente, mesma iluminação. NÃO invente outra pessoa, outro figurino, outro cenário. A capa é literalmente o frame do reels com o lettering do título aplicado por cima — não um novo conceito visual. Preserve a composição da referência e só adicione o título conforme as regras de tipografia e mood abaixo. NÃO desenhe logo, marca d'água, símbolo ou ícone gráfico — a logomarca será aplicada depois por composição (canvas), fora da IA.\n`
    : '';

  // Bloco anti-paráfrase: gpt-image-2 tende a "reescrever" o título em PT-BR
  // quando recebe só a versão estilizada (CAIXA ALTA). Repetimos o texto original
  // entre delimitadores e proibimos qualquer reinterpretação.
  const coverVerbatimBlock = isCover
    ? `\nTÍTULO LITERAL — REGRA INVIOLÁVEL: o único texto permitido na capa é EXATAMENTE o título abaixo, renderizado caractere por caractere, palavra por palavra, em português (pt-BR). É PROIBIDO traduzir, reescrever, resumir, parafrasear, substituir por sinônimos, inverter ordem, adicionar ou remover QUALQUER palavra. É proibido renderizar slogans, hashtags, marcas, nomes, números de telefone, URLs, legendas extras, etiquetas, badges ou qualquer outra palavra além do título. Se você não conseguir renderizar o texto EXATO, é preferível entregar a capa sem texto a inventar palavras diferentes. O título a renderizar, delimitado entre <<< e >>>, é:\n<<<${titulo}>>>\nApresente esse texto visualmente em CAIXA ALTA (estilo), mas preservando 100% das palavras acima.\n`
    : '';


  // Regra de dispositivos — proíbe conteúdo de tela na carcaça traseira.
  const DEVICE_RULE_FIRST = `⚠ REGRA ABSOLUTA — DISPOSITIVOS DIGITAIS:
PROIBIDO renderizar conteúdo de tela (dashboard, app, interface, gráfico, ícone, qualquer display) sobre a TAMPA TRASEIRA ou CARCAÇA de qualquer equipamento — notebook, laptop, tablet, iPad, celular, computador ou monitor. A carcaça traseira é superfície SÓLIDA, OPACA, lisa e na cor do equipamento: não tem tela, não emite luz, não exibe conteúdo.
CORRETO: tela FRONTAL com conteúdo real visível; carcaça traseira como superfície neutra, lisa e na cor do equipamento.

`;

  return `${DEVICE_RULE_FIRST}Crie ${isCover ? 'a CAPA do Reels (imagem estática 9:16 que aparece como thumbnail no perfil e como primeiro frame visual ao final do vídeo)' : 'um post profissional'} para Instagram em formato NATIVO ${canvasSize}px (proporção ${canvasRatio}), sem qualquer recorte posterior.${isCover ? '\n\nIMPORTANTE — COERÊNCIA DE SEQUÊNCIA: esta capa faz parte da MESMA SEQUÊNCIA visual do estático e do carrossel do dia. O lettering do título (peso, posição segundo o mood, tipografia, CAIXA ALTA) DEVE seguir as MESMAS regras do post estático abaixo, para que estático + carrossel + capa do reels formem uma composição harmônica no feed.' : ''}
${coverRefBlock}${coverVerbatimBlock}
RESPIRO INTERNO OBRIGATÓRIO — ZONA SEGURA INVIOLÁVEL DE ${safeMargin} em TODAS as bordas (laterais, topo e rodapé) do canvas ${canvasSize}. Nada importante (rosto, olhos, mãos, produto-foco, lettering, gráficos, logo) entra nesse perímetro. Bordas são continuação natural do fundo, sem texto cortado, sem rosto colado na borda, sem mão saindo do quadro.

${moodInstructions}
${finalModifier}
${cenaDetalhada}

CONTEÚDO TEXTUAL:
- Título principal em CAIXA ALTA (bold, destaque máximo, tamanho ajustado para caber sem cortar): "${tituloUpper}"
- Texto de apoio (regular, secundário, caixa normal): "${texto}"
- ${marcaInstruction}

COR PRIMÁRIA: ${primaryColor}
COR DE DESTAQUE: ${accentColor}

${typographyBlock}

REGRAS:
- Título renderizado em CAIXA ALTA exatamente como: "${tituloUpper}"
- Texto de apoio exatamente como: "${texto}", em caixa normal
- Todo texto em português, sem tradução, sem texto em inglês
- Sem elementos decorativos genéricos
- Alta resolução, estética editorial contemporânea brasileira
- ${typographyShort}

${FORBIDDEN_MOOD_WORDS}`;
}


const moodVisualInstructions: Record<MoodCode, string> = {
'OP-01': `ESTILO VISUAL (raiz: Renascentista):
- Grid organizado em 3 zonas horizontais bem definidas
- Assinatura da marca pequena e discreta no topo
- Título em 2 linhas máximo, hierarquia tipográfica clara, alinhado à ESQUERDA
- Texto de apoio curto abaixo do título, alinhado à esquerda
- Luz natural equilibrada, composição simétrica
- Fundo limpo, sem elementos decorativos desnecessários
- Paleta fria e controlada, cor de destaque apenas no elemento-chave`,

  'OP-02': `ESTILO VISUAL (raiz: Barroco):
- Fundo muito escuro, contraste extremo
- Imagem com iluminação dramática, luz focal sobre o elemento principal
- Texto em cor quente de destaque (amarelo ou laranja)
- Título CENTRALIZADO, bold, dominando o terço superior
- Assinatura da marca pequena e direta no rodapé
- Composição assimétrica com tensão visual intencional
- Sombras profundas, luz e sombra como protagonistas`,

  'OP-03': `ESTILO VISUAL (raiz: Impressionista):
- Foto de bastidor ou cena cotidiana capturada ao vivo
- Filtro quente e orgânico, luz ambiente natural sem estúdio
- Título sobreposto à imagem em posição LIVRE e informal, sem alinhamento rígido
- Sem simetria rígida, sem moldura formal
- Sensação de captura espontânea, autêntica
- Cores vibrantes e quentes, textura visível`,

  'OP-04': `ESTILO VISUAL (raiz: Cubista):
- Post-colagem com 3 a 5 blocos visuais distintos
- Cada bloco carrega uma informação ou ângulo diferente
- Título ancorado num bloco de cor, alinhado à ESQUERDA — NUNCA centralizado solto, NUNCA no canto inferior direito
- Texto de apoio posicionado no centro ou terço superior, longe do canto inferior direito
- Grid visível ou implícito organizando os fragmentos
- Paleta controlada unificando os blocos
- O canto inferior direito deve permanecer SEMPRE limpo e livre de texto, reservado para assinatura`,

  'OP-05': `ESTILO VISUAL (raiz: Surrealista):
- Imagem-conceito com elemento inesperado ou metáfora visual
- Composição ousada que provoca estranhamento controlado
- Título DESLOCADO e assimétrico — fora do centro, quebrando o equilíbrio esperado
- Elemento fora do lugar como ponto focal
- Paleta incomum ou contraste inesperado
- Sombras presentes mas LEVES — o rosto e a cabeça das pessoas NUNCA podem ficar encobertos por escurecimento
- Iluminação equilibrada: o elemento surreal não pode obscurecer o sujeito principal`,

  'OP-06': `ESTILO VISUAL (raiz: Minimalista):
- Fundo quase branco ou muito claro, espaço vazio como elemento principal
- Título CENTRALIZADO, fonte tipográfica como protagonista, com muito respiro ao redor
- Detalhe mínimo de cor como assinatura
- Composição com muito respiro, elementos reduzidos ao essencial
- Sensação de premium, contenção e autoridade`,
};

const FORBIDDEN_MOOD_WORDS = `PALAVRAS PROIBIDAS NA IMAGEM: NUNCA escreva, desenhe ou renderize como texto/lettering/título/etiqueta, em nenhum lugar da peça, as palavras CLAREZA, IMPACTO, INSTANTE, FRAGMENTO, DESVIO, SILÊNCIO, MOOD, OP-01, OP-02, OP-03, OP-04, OP-05, OP-06 — são códigos internos do sistema e nunca devem aparecer na arte final.`;

export async function generatePostImage(params: {
  imagePrompt: string;
  titulo: string;
  texto: string;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoDataUrl?: string;
  mood: MoodCode;
  vertical: 'post' | 'reels' | 'estatico_final' | 'reels_cover';
  leituraCenica?: {
    intencao?: string;
    personagem?: string;
    ambiente?: string;
    expressao?: string;
    clima?: string;
    composicao?: string;
  };
  logoPosition?: LogoPosition;
  // Imagens de referência (avatar/cenário/produtos do Kit Imagem).
  // Quando informadas, o servidor usa fal-ai/gpt-image-2/edit.
  referenceImages?: string[];
}): Promise<string> {
  const { imagePrompt, titulo, texto, primaryColor, accentColor, fontFamily, mood, vertical, leituraCenica, logoDataUrl, logoPosition, referenceImages } = params;

  const isReels = vertical === 'reels';
  const isCover = vertical === 'reels_cover';
  const isFinal = vertical === 'estatico_final';
  const moodInstructions = moodVisualInstructions[mood] || moodVisualInstructions['OP-01'];
  // Frame do reels: gpt-image-2 já incorpora a logo via referência (sem canvas).
  // Em todos os casos, se logoDataUrl foi enviado, ele entra como referência na geração
  // (frame do reels, post estático e estático final).
  // EXCEÇÃO — Capa do Reels: a logo é aplicada por canvas (composeReelsPng) no chamador,
  // respeitando kit.logoPosition. Mas a capa AGORA aceita referenceImages (frame do reels)
  // para ficar coerente com o porta-voz, rodando em fal-ai/gpt-image-2/edit.
  const hasLogo = !isCover && !!logoDataUrl;
  const coverHasRefs = isCover && !!(referenceImages && referenceImages.length);

  // Instrução de logo embutida no frame do reels (não há mais composição canvas).
  const reelsLogoLine = (() => {
    if (!isReels || !logoDataUrl) return '';
    const pos = logoPosition || 'bottom-right';
    const zona =
      pos === 'top-center'    ? 'na FAIXA SUPERIOR CENTRAL (centralizada horizontalmente, dentro do topo da zona segura de 150px)'
    : pos === 'bottom-center' ? 'na FAIXA INFERIOR CENTRAL (centralizada horizontalmente, dentro do rodapé da zona segura de 150px)'
    :                           'no CANTO INFERIOR DIREITO (dentro da zona segura de 150px)';
    return `\nLOGOMARCA: Aplique a logomarca fornecida (imagem de referência) ${zona}, em tamanho discreto (~12% da largura), preservando proporções, sem distorcer, sem cortar, sem inventar texto. Sem caixa/painel/moldura/fundo de cor sólida atrás dela — apenas contraste local suficiente para legibilidade. Nenhum outro lettering ou assinatura textual no quadro.`;
  })();

  const frameHasRefs = isReels && !!(referenceImages && referenceImages.length);
  // Reforço extra de refs — só quando há imagens de referência para não repetir a regra base.
  const frameRefsReinforcement = frameHasRefs
    ? `\n\nREFORÇO COM REFERÊNCIAS: USE a pessoa e o cenário da imagem de referência como BASE. Mesmo rosto, mesma roupa, mesmo ambiente, mesma iluminação.`
    : '';

  // Regra de dispositivos digitais com ângulos prescritos — obrigatória em TODOS os frames do reels.
  const DEVICE_RULE_REELS = `\n\nDISPOSITIVOS DIGITAIS — ÂNGULOS OBRIGATÓRIOS: NOTEBOOK: câmera frontal à tela 30°–50° horizontal, olho a olho — tela com conteúdo real visível, tampa traseira geometricamente oculta pela própria tela. CELULAR: tela voltada para a câmera 20°–40° da vertical — verso oculto. TABLET: tela inclinada 50°–70° da horizontal voltada para a câmera — verso oculto. PROIBIDO em qualquer dispositivo: tampa/verso/carcaça com tela, interface, gráfico ou reflexo de UI. TELA FRONTAL sempre com conteúdo real (app, dashboard, texto — nunca tela preta).`;

  const prompt = isReels
    ? `REGRAS INVIOLÁVEIS PARA A IMAGEM DO REELS (PRIMEIRO FRAME DO VÍDEO):
- Gerar UMA FOTO ÚNICA, não carrossel, não colagem, não montagem, não sequência de quadros.
- APENAS UMA PESSOA adulta visível em todo o quadro. Proibido grupo, reunião, plateia, cliente ao lado, reflexo de pessoa, silhueta humana ou corpo parcial no fundo.
- Se a cena pedir várias pessoas, reunião ou atendimento, converta para UMA pessoa porta-voz sozinha, olhando para a câmera.
- Enquadramento close-up ou meio-corpo, rosto bem visível, boca claramente enquadrada para fala.
- Imagem pura: SEM TÍTULO, sem legendas, sem letras, sem números, sem palavras desenhadas em parte alguma do quadro (a única exceção permitida é a logomarca aplicada conforme instrução abaixo).
- Composição vertical 9:16 cinematográfica (canvas 1080x1920), alta qualidade, foco nítido no rosto.

ZONA DE RESPIRO INVIOLÁVEL: 150 px de margem livre nas QUATRO bordas (topo, base, esquerda, direita) — nada importante (rosto, olhos, boca, mãos, produto-foco, gráfico) entra nesse perímetro. Bordas são continuação natural do fundo.
FAIXA CENTRAL HORIZONTAL livre: entre 35% e 65% da altura do canvas, mantenha a área SEM detalhes que competem com texto — é onde a capa do vídeo entra nos primeiros 0,4 s. Posicione rosto, mãos e elementos-foco PREFERENCIALMENTE no terço SUPERIOR ou no terço INFERIOR, deixando o miolo do quadro mais limpo.

CENA ADAPTADA PARA UM ÚNICO PORTA-VOZ: ${imagePrompt}.

${moodInstructions}${reelsLogoLine}${DEVICE_RULE_REELS}${frameRefsReinforcement}`
    : buildImagePrompt({
        titulo,
        texto,
        imagePrompt,
        leituraCenica,
        primaryColor,
        accentColor,
        fontFamily,
        moodInstructions,
        isFinal,
        hasLogo,
        logoPosition,
        format: isCover ? 'reels_cover' : 'post',
        hasRefs: coverHasRefs,
      });

  return generateImageAsync({
    prompt,
    format: (isReels || isCover) ? 'reels' : 'post',
    // Capa: continua sem logo via IA (canvas faz isso). Refs (frame do reels) entram
    // quando informadas, levando a chamada para fal-ai/gpt-image-2/edit.
    logoDataUrl: isCover ? undefined : (hasLogo ? logoDataUrl : undefined),
    referenceImages: (referenceImages && referenceImages.length) ? referenceImages : undefined,
  });
}

