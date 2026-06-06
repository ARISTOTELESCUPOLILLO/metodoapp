import { buildMetodoOpPrompt, normalizeMethodResult } from '../core/organizaMethodEngine';
import { pickImageVariationBlock } from '../core/visualDirection';
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

export async function generateMethodContent(data: ContentFormData, preferredSlot?: string): Promise<MethodOpResult> {
  const prompt = buildMetodoOpPrompt(data);
  const auth = await authHeader();
  const res = await fetch('/api/generate-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ prompt, ...(preferredSlot ? { preferredSlot } : {}) }),
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
  mood?: MoodCode;
}): string {
  const { titulo, texto, imagePrompt, leituraCenica, primaryColor, accentColor, fontFamily, moodInstructions, isFinal, hasLogo, logoPosition, format, hasRefs, mood } = params;
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
  const reservaBase = 'Área reservada inviolável (~18% × ~10%). PROIBIDO ali: texto, lettering, rosto, mão, objeto-foco, gráfico, ícone, símbolo, produto, moldura, caixa, painel, badge, fundo de cor sólida (inclusive cor da marca), círculo, elipse, anel, halo, linha decorativa, pontilhado, tracejado ou ornamento — inclusive em volta da zona da logo. A área deve ser continuação natural da imagem ao redor. Apenas garanta contraste local suficiente para a logo ser legível.';
  const reservaInstrucao =
    pos === 'top-center'    ? `A FAIXA SUPERIOR CENTRAL é a zona da logomarca. ${reservaBase}`
  : pos === 'bottom-center' ? `A FAIXA INFERIOR CENTRAL é a zona da logomarca. ${reservaBase}`
  :                           `O CANTO INFERIOR DIREITO é a zona da logomarca. ${reservaBase}`;
  const marcaInstruction = hasLogo
    ? `Aplique a logomarca fornecida (imagem de referência) ${zonaLogo} da composição, em tamanho discreto (~12% da largura), dentro da zona segura de ${safeMargin}, preservando proporções, sem distorcer, sem inventar texto.`
    : `Não adicione assinatura textual ou nome de marca — será aplicada separadamente.`;

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
    ? `\nREFERÊNCIA VISUAL OBRIGATÓRIA — A imagem de referência enviada é o PRIMEIRO FRAME do reels (o porta-voz na cena). USE essa pessoa e esse cenário como BASE da capa: mesmo rosto (idade, etnia, barba, cabelo, óculos, expressão), mesma roupa, mesmo enquadramento aproximado, mesmo ambiente, mesma iluminação e mesmo clima visual. NÃO invente outra pessoa, outro figurino, outro cenário. A capa é literalmente o frame do reels com o lettering do título aplicado por cima — não um novo conceito visual. Preserve integralmente o estilo de luz, contraste e temperatura de cor da referência (incluindo cenas escuras ou de alto contraste quando for o estilo do mood). Preserve a composição da referência e só adicione o título conforme as regras de tipografia e mood abaixo. NÃO desenhe logo, marca d'água, símbolo ou ícone gráfico — a logomarca será aplicada depois por composição (canvas), fora da IA.\n`
    : '';

  // Bloco anti-paráfrase: gpt-image-2 tende a "reescrever" o título em PT-BR
  // quando recebe só a versão estilizada (CAIXA ALTA). Repetimos o texto original
  // entre delimitadores e proibimos qualquer reinterpretação.
  const coverVerbatimBlock = isCover
    ? `\nTÍTULO LITERAL — REGRA INVIOLÁVEL: o único texto permitido na capa é EXATAMENTE o título abaixo, renderizado caractere por caractere, palavra por palavra, em português (pt-BR). É PROIBIDO traduzir, reescrever, resumir, parafrasear, substituir por sinônimos, inverter ordem, adicionar ou remover QUALQUER palavra. É proibido renderizar slogans, hashtags, marcas, nomes, números de telefone, URLs, legendas extras, etiquetas, badges ou qualquer outra palavra além do título. Se você não conseguir renderizar o texto EXATO, é preferível entregar a capa sem texto a inventar palavras diferentes. O título a renderizar, delimitado entre <<< e >>>, é:\n<<<${titulo}>>>\nApresente esse texto visualmente em CAIXA ALTA (estilo), mas preservando 100% das palavras acima.\n`
    : '';


  // Regra de dispositivos — proíbe qualquer tela com conteúdo visível.
  const DEVICE_RULE_FIRST = `⚠ DISPOSITIVOS DIGITAIS — REGRA GLOBAL INVIOLÁVEL:
PROIBIDO qualquer tela visível com conteúdo em notebook, laptop, tablet, iPad, celular, iPhone, monitor ou qualquer dispositivo digital — tela frontal ou traseira.
CONTEÚDO PROIBIDO EM TELA: gráfico, dashboard, imagem, interface, site, app, texto legível ou qualquer elemento visual.
DISPOSITIVO PERMITIDO APENAS COMO OBJETO CONTEXTUAL: fechado, de lado, de costas, desfocado ou com tela apagada/escura/neutra sem conteúdo identificável.
MÁXIMO 1 DISPOSITIVO por cena — duplicação proibida.
NEGATIVE: no visible screen content, no laptop screen facing viewer, no charts on screen, no dashboard on screen, no UI on screen, no app interface, no readable text on devices, no duplicated laptops, no extra devices, screen must be blank dark off turned away or out of focus.

`;

  // Suspiro — texto e elementos visuais nunca colam nas bordas.
  const SAFE_ZONE_RULE = `⚠ SUSPIRO DE ${safeMargin} (TODAS AS BORDAS): Canvas ${canvasSize}. Mantenha ${safeMargin} de margem livre em todas as bordas. PROIBIDO: qualquer letra, número ou lettering tocando esse perímetro. Todo texto dentro da área segura interna. Bordas são continuação natural do fundo — sem texto cortado.

⚠ IMAGEM FULL BLEED — REGRA ABSOLUTA: a imagem preenche o canvas completamente de borda a borda. PROIBIDO: moldura externa, frame decorativo, borda de cor sólida ao redor da arte, vinheta escura periférica como contentor, margem vazia ou espaço branco/preto separando a imagem das bordas do canvas. A composição começa e termina nas bordas — sem nenhum container ou enquadramento ao redor.

`;

  // Proteção antecipada da zona da logomarca — lida ANTES da composição da cena.
  const LOGO_ZONE_RULE = `⚠ REGRA INVIOLÁVEL — ZONA DA LOGOMARCA (${reservaInstrucao.split('.')[0]}):
PROIBIDO ABSOLUTO nessa área: texto, título, palavra, lettering, nome de empresa, slogan, call-to-action, hashtag, número, código, URL.
PROIBIDO TAMBÉM: rosto, olhos, mão, objeto-foco, produto, gráfico, ícone, símbolo ou qualquer elemento visual essencial para a comunicação da mensagem.
NENHUM ELEMENTO IMPORTANTE PODE SER COBERTO OU FICAR ATRÁS DA LOGOMARCA — a logo será aplicada sobre essa área depois.
A zona deve ser FUNDO NEUTRO: continuação natural da cena (céu, parede, textura, superfície contínua). Sem cor sólida de marca, sem moldura, sem painel, sem círculo, sem elipse, sem anel, sem halo, sem linha decorativa, sem pontilhado, sem tracejado, sem qualquer forma geométrica ou ornamento em volta, ao redor ou atrás da logo.

`;

  const variationBlock = pickImageVariationBlock(mood);

  return `${DEVICE_RULE_FIRST}${SAFE_ZONE_RULE}${hasLogo ? LOGO_ZONE_RULE : ''}Crie ${isCover ? 'a CAPA do Reels (imagem estática 9:16 que aparece como thumbnail no perfil e como primeiro frame visual ao final do vídeo)' : 'um post profissional'} para Instagram em formato NATIVO ${canvasSize}px (proporção ${canvasRatio}), sem qualquer recorte posterior.${isCover ? '\n\nIMPORTANTE — COERÊNCIA DE SEQUÊNCIA: esta capa faz parte da MESMA SEQUÊNCIA visual do estático e do carrossel do dia. O lettering do título (peso, posição segundo o mood, tipografia, CAIXA ALTA) DEVE seguir as MESMAS regras do post estático abaixo, para que estático + carrossel + capa do reels formem uma composição harmônica no feed.' : ''}
${coverRefBlock}${coverVerbatimBlock}
${moodInstructions}
${finalModifier}
${cenaDetalhada}
${variationBlock}

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
- ELEMENTO INESPERADO — ESCALA E PESO VISUAL: o objeto ou forma inusitado é COADJUVANTE EXPRESSIVO da mensagem — deve ocupar área visual significativa na composição (não um detalhe periférico ou diminuto), grande o suficiente para chamar atenção à primeira vista e orientar o olhar, harmônico com o conjunto e sem dominar o sujeito principal. PROIBIDO: reduzir o elemento surreal a detalhe sutil, pequeno ou escondido na periferia da peça.
- Paleta incomum mas legível — combinações: verde frio + magenta, azul profundo + ferrugem, lilás seco + mostarda, petróleo + coral queimado, vinho + azul elétrico suave — evitar excesso carnavalesco
- Sombras presentes mas LEVES — o rosto e a cabeça das pessoas NUNCA podem ficar encobertos por escurecimento
- Iluminação equilibrada: o elemento surreal não pode obscurecer o sujeito principal`,

  'OP-06': `ESTILO VISUAL (raiz: Minimalista):
- Fundo de paleta suave (areia, off-white, cinza quente, bege rosado, verde sálvia claro, azul névoa, taupe, marfim envelhecido) — evitar branco puro dominante; espaço vazio como elemento principal
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
  // Frame do reels: logo aplicada por canvas (composeReelsPng) no chamador — NÃO via IA.
  // Quando logoDataUrl é passado por paths legados (posts estáticos), entra como referência.
  // Capa do Reels: logo aplicada por canvas (composeReelsPng) no chamador.
  // Capa aceita referenceImages (frame sem logo) → ativa gpt-image-2/edit automaticamente.
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
  // IMPORTANTE: NÃO mencionar "mesma roupa" pois o anchor do avatar já instrui "IGNORE a roupa".
  const frameRefsReinforcement = frameHasRefs
    ? `\n\nREFORÇO COM REFERÊNCIAS: A pessoa da imagem de referência deve aparecer como SUJEITO FÍSICO E REAL da cena — em pé, sentada ou em movimento na locação descrita, jamais como imagem projetada/exibida na tela ou tampa de qualquer dispositivo. Preserve exatamente: rosto, traços faciais, etnia, cabelo, barba, óculos — mantendo a identidade visual da pessoa. Mesmo ambiente e iluminação da cena. NÃO copie a roupa da referência — vista a pessoa com roupa coerente com o contexto da cena.`
    : '';

  // Regra de dispositivos digitais — proíbe qualquer tela com conteúdo visível.
  const DEVICE_RULE_REELS = `\n\n⚠ DISPOSITIVOS DIGITAIS — REGRA GLOBAL INVIOLÁVEL (REELS):
PESSOA FÍSICA NA CENA: o porta-voz deve aparecer como PESSOA REAL E FÍSICA dentro do ambiente — nunca como imagem exibida na tela ou carcaça de qualquer dispositivo.
PROIBIDO qualquer tela com conteúdo visível em notebook, laptop, tablet, iPad, celular, iPhone ou monitor — tela frontal ou traseira.
CONTEÚDO PROIBIDO EM TELA: gráfico, dashboard, imagem, interface, app, texto legível ou qualquer elemento visual.
DISPOSITIVO PERMITIDO APENAS COMO OBJETO: fechado, de lado, de costas, desfocado ou com tela apagada/escura/neutra.
MÁXIMO 1 DISPOSITIVO por cena — duplicação proibida.
NEGATIVE: no visible screen content, no laptop screen facing viewer, no charts on screen, no dashboard, no UI, no app interface, no readable text on devices, no duplicated devices, screen must be blank dark off or out of focus.`;

  const prompt = isReels
    ? `REGRAS INVIOLÁVEIS PARA A IMAGEM DO REELS (PRIMEIRO FRAME DO VÍDEO):
- Gerar UMA FOTO ÚNICA, não carrossel, não colagem, não montagem, não sequência de quadros.
- APENAS UMA PESSOA adulta visível em todo o quadro. Proibido grupo, reunião, plateia, cliente ao lado, reflexo de pessoa, silhueta humana ou corpo parcial no fundo.
- Se a cena pedir várias pessoas, reunião ou atendimento, converta para UMA pessoa porta-voz sozinha, olhando para a câmera.
- Enquadramento close-up ou meio-corpo, rosto bem visível, boca claramente enquadrada para fala.
- Imagem pura: SEM TÍTULO, sem legendas, sem letras, sem números, sem palavras desenhadas em parte alguma do quadro${reelsLogoLine ? ' (a única exceção é a logomarca — veja instrução abaixo)' : ''}.
- Composição vertical 9:16 cinematográfica (canvas 1080x1920), alta qualidade, foco nítido no rosto.

ZONA DE RESPIRO INVIOLÁVEL: 150 px de margem livre nas QUATRO bordas (topo, base, esquerda, direita) — nada importante (rosto, olhos, boca, mãos, produto-foco, gráfico) entra nesse perímetro. Bordas são continuação natural do fundo.
IMAGEM FULL BLEED — REGRA ABSOLUTA: a imagem preenche o canvas 1080x1920 completamente de borda a borda. PROIBIDO: moldura externa, frame decorativo, borda de cor sólida ao redor da arte, vinheta escura periférica como contentor, margem vazia ou espaço branco/preto separando a imagem das bordas do canvas.
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
        mood,
      });

  return generateImageAsync({
    prompt,
    format: (isReels || isCover) ? 'reels' : 'post',
    // Capa: sem logo via IA (canvas aplica). Callers de capa não passam referenceImages
    // (edit model ignorava o título com frame de referência).
    logoDataUrl: isCover ? undefined : (hasLogo ? logoDataUrl : undefined),
    referenceImages: (referenceImages && referenceImages.length) ? referenceImages : undefined,
  });
}

