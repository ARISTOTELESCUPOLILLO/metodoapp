// Monta o prompt de imagem para post/carrossel/estático final (não-Reels) —
// extraído de services/api.ts (PLANO_V2 Fase 9.1). Movido 1:1, sem mudança
// de comportamento, junto com a constante que só ele usa (ESTATICO_FINAL_MODIFIER).
import { pickImageVariationBlock, PersonagemGender } from "../../core/visualDirection";
import { LogoPosition, MoodCode, SecondaryFont } from "../../types";
import {
  buildTypographyBlock,
  buildTypographyShortRule,
  buildScriptAccentBlock,
} from "../../utils/typography";
import {
  buildDeviceRule,
  FORBIDDEN_MOOD_WORDS,
  CONCEITO_FIRST_RULE,
} from "../../utils/promptRules";
import { buildReferenceAnchorWrapper } from "../../shared/visual/referenceBlocks";

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
- PROIBIDO NO FECHAMENTO — PRESENÇA EM VEZ DE PARTIDA: personagem NUNCA em deslocamento saindo da cena, NUNCA olhando para o horizonte, NUNCA com olhar perdido na distância, NUNCA de costas caminhando para longe. O fechamento exige presença ANCORADA no espaço — pausa, estabilidade, gesto contido, olhar direcionado a algo concreto dentro da cena ou olhar para baixo/lado em concentração. INSTANTE NO FECHAMENTO: usar somente variações de pausa, micro-momento ou direção em pé — PROIBIDO qualquer variação de transição, deslocamento ou caminhada.
`.trim();

export function buildImagePrompt(params: {
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
  secondaryFont?: SecondaryFont;
  moodInstructions: string;
  isFinal?: boolean;
  hasLogo?: boolean;
  logoPosition?: LogoPosition;
  format?: "post" | "reels_cover";
  hasRefs?: boolean;
  mood?: MoodCode;
  // Instrução de PRIORIDADE MÁXIMA sobre como usar as imagens de referência
  // (avatar/cenário/produto). Recebe destaque no topo do prompt — junto das
  // demais regras inegociáveis — para não perder força para a leitura de cena.
  referenceAnchor?: string;
  // Ver nota em generatePostImage: quando true, suprime o sorteio de gênero
  // do personagem (o avatar de referência já define a identidade/gênero).
  hasAvatarRef?: boolean;
  // Quando true, há uma imagem de CENÁRIO de referência enviada — suprime a
  // linha "Ambiente" da leitura de cena (texto) para não competir com a foto
  // real do local, que tem precedência (ver referenceAnchorBlock).
  hasCenarioRef?: boolean;
  // Gênero atribuído pelo chamador para esta peça (balanceamento entre as N
  // peças da sequência + persistência entre regenerações). Ver generatePostImage.
  forcedGender?: PersonagemGender;
  // Descrição do personagem-tipo da âncora da sequência (ex: "homem, 35-45 anos,
  // camisa polo azul, postura técnica"). Injetada no genderBlock quando não há avatar.
  anchoraPersonagem?: string;
  // Papel da empresa na cena — 'contexto_de_uso' injeta regra compositiva que
  // coloca o produto como protagonista visual (pessoa é coadjuvante).
  ancoragePapel?: string;
  // Atividade real da empresa — usada por buildDeviceRule para suprimir
  // dispositivos eletrônicos quando o ofício é manual/físico/artístico
  // (ex.: artista, artesão) e a cena não deveria incluir tela alguma.
  mainActivity?: string;
  // O produto referenciado é ele mesmo um dispositivo cujo conteúdo de tela
  // é a identidade do produto (ex.: tablet mostrando o app/print do negócio)
  // — suspende a regra global de desfoque de tela de buildDeviceRule só para
  // esta geração. Ver PostUnicoVisualSelection.produtoTelaInformativa.
  hasProdutoTelaRef?: boolean;
  // Há produto físico de referência selecionado (Kit Imagem) e ele NÃO é ele
  // mesmo uma tela — esse produto já é o elemento concreto/foco da peça, e um
  // dispositivo digital sorteado no fundo não tem relação narrativa com ele
  // (achado real: peça de ração recebeu notebook sem motivo). Suprime o bloco
  // de dispositivo inteiro, mesma lógica já aplicada na PU (buildPuPrompt.ts).
  hasProdutoFisicoRef?: boolean;
  // O produto de referência É ele mesmo um dispositivo digital (tablet/notebook/
  // celular/monitor). Impede que hasProdutoFisicoRef banha o dispositivo quando
  // a nitidez de tela foi degradada por avatar presente — sem isso o próprio
  // tablet vira objeto genérico (bug real 2026-07-08). Ver buildDeviceRule.
  produtoEhDispositivo?: boolean;
  segment?: import("../../types").Segment;
}): string {
  const {
    titulo,
    texto,
    imagePrompt,
    leituraCenica,
    primaryColor,
    accentColor,
    fontFamily,
    secondaryFont,
    moodInstructions,
    isFinal,
    hasLogo,
    logoPosition,
    format,
    hasRefs,
    mood,
    referenceAnchor,
    hasAvatarRef,
    hasCenarioRef,
    forcedGender,
    anchoraPersonagem,
    ancoragePapel,
    mainActivity,
    hasProdutoTelaRef,
    hasProdutoFisicoRef,
    produtoEhDispositivo,
    segment,
  } = params;
  const isCover = format === "reels_cover";
  const canvasSize = isCover ? "1080x1920" : "1080x1350";
  const canvasRatio = isCover ? "9:16 (reels vertical)" : "4:5 (feed)";
  const safeMargin = isCover ? "150 px" : "110 px";
  const tituloUpper = titulo.toUpperCase();
  const pos = logoPosition || "bottom-right";
  const zonaLogo =
    pos === "top-center"
      ? `na FAIXA SUPERIOR CENTRAL (centralizada horizontalmente, dentro do topo da zona segura de ${safeMargin})`
      : pos === "bottom-center"
        ? `na FAIXA INFERIOR CENTRAL (centralizada horizontalmente, dentro do rodapé da zona segura de ${safeMargin})`
        : "no canto inferior direito";
  // GEOMETRIA REAL DA LOGO (canvasComposer.ts): feed 1080x1350 com PAD 110 e logo
  // até 288x108 → x 682..970 (63%..90%) e y 1132..1240 (84%..92%); capa reels
  // 1080x1920 com PAD 150 e logo até 336x132 → x 594..930 (55%..86%) e
  // y 1638..1770 (85%..92%). Achado real (03/08/2026): a reserva antiga
  // ("~18% × ~10%") descrevia um retângulo colado na borda, quase disjunto da
  // caixa que a logo de fato ocupa — a IA obedecia e o carimbo da logo caía em
  // cima da última linha de texto. Ver comentário gêmeo em buildPuPrompt.ts.
  const reservaBase = `Área reservada inviolável — RETÂNGULO GRANDE, NÃO COLADO NA BORDA: começa a ${isCover ? "50%" : "60%"} da LARGURA e a 80% da ALTURA do canvas e se estende até as bordas direita e inferior. ATENÇÃO À GEOMETRIA — a logomarca é aplicada DEPOIS, recuada ${safeMargin} das bordas: ela ocupa o MIOLO desse retângulo (aprox. de ${isCover ? "55% a 86%" : "63% a 90%"} da largura e de 84% a 92% da altura), NÃO a beirada do canvas. Por isso a proibição vale no retângulo INTEIRO, principalmente na parte mais interna e mais alta dele — deixar texto "logo acima do canto" ou "logo à esquerda do canto" é exatamente onde a logo cai. TRAVA DE LINHA: nenhuma linha de título ou texto pode descer abaixo de 80% da altura do canvas na metade direita — a última linha termina ANTES disso; se não couber, reduza o corpo do texto ou suba o bloco inteiro. PROIBIDO ali: texto, lettering, rosto, mão, objeto-foco, gráfico, ícone, símbolo, produto, moldura, caixa, painel, badge, fundo de cor sólida (inclusive cor da marca), círculo, elipse, anel, halo, linha decorativa, pontilhado, tracejado, ornamento, vírgula, aspas, rabisco, swoosh, símbolo gráfico solto ou forma orgânica decorativa — inclusive em volta da zona da logo e na área imediatamente adjacente a ela. A área deve ser continuação natural da imagem ao redor. Apenas garanta contraste local suficiente para a logo ser legível. NEGATIVE: solid color block behind logo area, colored badge, colored panel, banner shape.`;
  // Para logo centralizada (topo/base), o ponto da logo fica no MEIO de uma linha
  // que normalmente atravessa o canvas de ponta a ponta. Um "retângulo pequeno"
  // não basta: título/texto que ocupem essa linha colidem com a logo no centro.
  // Por isso a zona aqui é uma FAIXA HORIZONTAL COMPLETA — nenhuma linha de texto
  // pode cruzá-la, mesmo parcialmente.
  // Faixa de ~20% (era ~14%): a logo centralizada ocupa até 16,1% da altura no
  // feed (PAD 110 + LOGO_MAX_H 108 em 1350) — a faixa antiga terminava ANTES da
  // logo no topo e começava DEPOIS dela na base. Ver buildPuPrompt.ts.
  const reservaFaixa =
    'A logo ocupa uma FAIXA HORIZONTAL COMPLETA (de borda a borda do canvas), com ~20% da altura, medidos a partir da borda (superior ou inferior, conforme o ponto da logo). ATENÇÃO À GEOMETRIA: a logomarca é aplicada DEPOIS, recuada da borda — ela fica no MIOLO da faixa, não encostada na borda do canvas. Portanto a proibição vale na faixa INTEIRA, inclusive na parte dela mais distante da borda: texto que pare "logo antes da borda" ainda cai em cima da logo. PROIBIDO ABSOLUTO: qualquer texto, título, lettering, slogan, hashtag, número, rosto humano, mão, objeto-foco, gráfico, ícone, símbolo ou produto que cruze essa faixa — mesmo parcialmente, mesmo apenas uma palavra ou linha. Título e texto/legenda (incluindo TODAS as linhas) devem terminar ANTES dessa faixa começar, ou começar DEPOIS dela terminar — NUNCA divididos ao redor dela, NUNCA com uma linha cruzando-a. A faixa deve ser continuação natural da imagem (fundo, textura, céu, parede). PROIBIDO TAMBÉM: moldura, caixa, painel, badge, fundo de cor sólida, círculo, elipse, anel, halo, linha decorativa, pontilhado, tracejado, ornamento, vírgula, aspas, rabisco, swoosh, símbolo gráfico solto ou forma orgânica decorativa — dentro da faixa e também na área imediatamente adjacente a ela. Apenas garanta contraste local suficiente para a logo ser legível dentro da faixa. NEGATIVE: solid color bar, bottom banner stripe, top banner stripe, flat color footer band, colored panel behind logo, navy or brand-color block at canvas edge.';
  const reservaInstrucao =
    pos === "top-center"
      ? `A FAIXA SUPERIOR CENTRAL é a zona da logomarca. ${reservaFaixa}`
      : pos === "bottom-center"
        ? `A FAIXA INFERIOR CENTRAL é a zona da logomarca. ${reservaFaixa}`
        : `O CANTO INFERIOR DIREITO é a zona da logomarca. ${reservaBase}`;
  const marcaInstruction = hasLogo
    ? `Aplique a logomarca fornecida (imagem de referência) ${zonaLogo} da composição, em tamanho discreto (~12% da largura), dentro da zona segura de ${safeMargin}, preservando proporções, sem distorcer, sem inventar texto.`
    : `Não adicione assinatura textual ou nome de marca — será aplicada separadamente.`;

  const typographyBlock = buildTypographyBlock(fontFamily);
  const typographyShort = buildTypographyShortRule(fontFamily);
  const scriptAccentBlock = secondaryFont
    ? `\n${buildScriptAccentBlock(secondaryFont, titulo)}\n`
    : "";

  // Quando há `referenceAnchor`, ele já cobre a "referência visual" com prioridade
  // máxima lá no topo do prompt (ver referenceAnchorBlock) — não repetir aqui
  // dentro de um bullet, onde perderia força para o restante da leitura cênica.
  // Personagem/Ambiente da leitura de cena competem com as referências de
  // imagem (avatar/cenário) sobre "quem está na cena" e "onde a cena
  // acontece" — quando a foto real já define isso, omitir a versão textual
  // evita que o modelo concilie duas descrições divergentes (ver hasAvatarRef
  // já suprimindo o sorteio de gênero em pickImageVariationBlock).
  const cenaLinhas = [
    `- Intenção emocional: ${leituraCenica?.intencao || ""}`,
    ...(hasAvatarRef ? [] : [`- Personagem: ${leituraCenica?.personagem || ""}`]),
    ...(hasCenarioRef ? [] : [`- Ambiente: ${leituraCenica?.ambiente || ""}`]),
    `- Expressão: ${leituraCenica?.expressao || ""}`,
    `- Clima/Luz: ${leituraCenica?.clima || ""}`,
    `- Composição: ${leituraCenica?.composicao || ""}`,
  ];
  const cenaDetalhada = leituraCenica
    ? `CENA DETALHADA:\n${cenaLinhas.join("\n")}${referenceAnchor ? "" : `\n- Referência visual adicional: ${imagePrompt}`}`
    : `CENA FOTOGRÁFICA: ${imagePrompt}`;

  // Instrução de referência (avatar/cenário/produto) com prioridade máxima —
  // posicionada junto das demais regras inegociáveis, ANTES da leitura de cena,
  // para não competir e perder para a descrição narrativa do card.
  const referenceAnchorBlock = buildReferenceAnchorWrapper(referenceAnchor ?? "");

  const finalModifier = isFinal ? `\n${ESTATICO_FINAL_MODIFIER}\n` : "";

  const coverRefBlock =
    isCover && hasRefs
      ? `\nREFERÊNCIA VISUAL OBRIGATÓRIA — A imagem de referência enviada é o PRIMEIRO FRAME do reels (o porta-voz na cena). USE essa pessoa e esse cenário como BASE da capa: mesmo rosto (idade, etnia, barba, cabelo, óculos, expressão), mesma roupa, mesmo enquadramento aproximado, mesmo ambiente, mesma iluminação e mesmo clima visual. NÃO invente outra pessoa, outro figurino, outro cenário. A capa é literalmente o frame do reels com o lettering do título aplicado por cima — não um novo conceito visual. Preserve integralmente o estilo de luz, contraste e temperatura de cor da referência (incluindo cenas escuras ou de alto contraste quando for o estilo do mood). Preserve a composição da referência e só adicione o título conforme as regras de tipografia e mood abaixo. NÃO desenhe logo, marca d'água, símbolo ou ícone gráfico — a logomarca será aplicada depois por composição (canvas), fora da IA.\n`
      : "";

  // Bloco anti-paráfrase: gpt-image-2 tende a "reescrever" o título em PT-BR
  // quando recebe só a versão estilizada (CAIXA ALTA). Repetimos o texto original
  // entre delimitadores e proibimos qualquer reinterpretação.
  const coverVerbatimBlock = isCover
    ? `\nTÍTULO LITERAL — REGRA INVIOLÁVEL: o único texto permitido na capa é EXATAMENTE o título abaixo, renderizado caractere por caractere, palavra por palavra, em português (pt-BR). É PROIBIDO traduzir, reescrever, resumir, parafrasear, substituir por sinônimos, inverter ordem, adicionar ou remover QUALQUER palavra. É proibido renderizar slogans, hashtags, marcas, nomes, números de telefone, URLs, legendas extras, etiquetas, badges ou qualquer outra palavra além do título. Se você não conseguir renderizar o texto EXATO, é preferível entregar a capa sem texto a inventar palavras diferentes. O título a renderizar, delimitado entre <<< e >>>, é:\n<<<${titulo}>>>\nApresente esse texto visualmente em CAIXA ALTA (estilo), mas preservando 100% das palavras acima.\n`
    : "";

  // Suspiro — texto e elementos visuais nunca colam nas bordas.
  const SAFE_ZONE_RULE = `⚠ SUSPIRO DE ${safeMargin} (TODAS AS BORDAS): Canvas ${canvasSize}. Mantenha ${safeMargin} de margem livre em todas as bordas. PROIBIDO: qualquer letra, número ou lettering tocando esse perímetro. Todo texto dentro da área segura interna. Bordas são continuação natural do fundo — sem texto cortado.

⚠ IMAGEM FULL BLEED — REGRA ABSOLUTA: a imagem preenche o canvas completamente de borda a borda. PROIBIDO: moldura externa, frame decorativo, borda de cor sólida ao redor da arte, vinheta escura periférica como contentor, margem vazia ou espaço branco/preto separando a imagem das bordas do canvas. A composição começa e termina nas bordas — sem nenhum container ou enquadramento ao redor.

`;

  // Zona lateral de segurança pensada para IMPULSIONAMENTO (Meta Ads/boost),
  // não pro feed orgânico: quando o post é promovido, a Meta gera variações
  // automáticas para placements mais estreitos (Stories/Reels 9:16), cortando
  // as laterais de um criativo 4:5 — um corte centralizado remove ~160px de
  // cada lado. Sem essa regra, rosto/mão/produto-foco coladas na borda
  // esquerda/direita (ok pro feed) saem cortadas ou espremidas no boost.
  // Só se aplica ao formato feed (o reels_cover já nasce 9:16, imune a esse
  // recorte específico).
  const AD_SAFE_MARGIN = "160 px";
  const AD_SAFE_ZONE_RULE = !isCover
    ? `⚠ ZONA SEGURA PARA IMPULSIONAMENTO — MARGEM LATERAL DE ${AD_SAFE_MARGIN}: este post pode ser impulsionado (Meta Ads/boost), que reformata automaticamente a mesma imagem para posicionamentos mais estreitos (Stories, Reels), cortando as laterais do quadro 4:5. Por isso, ROSTO, OLHOS, MÃOS e PRODUTO-FOCO nunca podem ficar a menos de ${AD_SAFE_MARGIN} das bordas ESQUERDA e DIREITA do canvas — mantenha esses elementos numa faixa central mais estreita que o restante da composição. Essa margem lateral é ADICIONAL e maior que o suspiro de ${safeMargin} (que vale nas 4 bordas e é sobre texto/lettering) — aqui a exigência é especificamente sobre pessoas e produto-foco, e só nas bordas esquerda e direita.

`
    : "";

  // Proteção antecipada da zona da logomarca — lida ANTES da composição da cena.
  // Emitida SEMPRE (paridade com a PU, que emite incondicionalmente): a logomarca
  // oficial é carimbada por canvas (composeFeedPng/composeFinalPng/composeReelsPng)
  // depois da IA em todos os caminhos estáticos e de capa, então a zona precisa
  // estar reservada mesmo quando `hasLogo` é false (hasLogo = "IA desenha a logo",
  // que só vale no ramo legado de uniforme). Sem essa reserva, a IA poderia pôr
  // rosto/produto/texto exatamente onde o canvas vai carimbar a logo por cima.
  const LOGO_ZONE_RULE = `⚠ REGRA INVIOLÁVEL — ZONA DA LOGOMARCA (${reservaInstrucao.split(".")[0]}):
PROIBIDO ABSOLUTO nessa área: texto, título, palavra, lettering, nome de empresa, slogan, call-to-action, hashtag, número, código, URL.
PROIBIDO TAMBÉM: rosto, olhos, mão, objeto-foco, produto, gráfico, ícone, símbolo ou qualquer elemento visual essencial para a comunicação da mensagem.
NENHUM ELEMENTO IMPORTANTE PODE SER COBERTO OU FICAR ATRÁS DA LOGOMARCA — a logo será aplicada sobre essa área depois.
A zona deve ser FUNDO NEUTRO: continuação natural da cena (céu, parede, textura, superfície contínua). Sem cor sólida de marca, sem moldura, sem painel, sem círculo, sem elipse, sem anel, sem halo, sem linha decorativa, sem pontilhado, sem tracejado, sem qualquer forma geométrica, ornamento, vírgula, aspas, rabisco, swoosh, símbolo gráfico solto ou forma orgânica decorativa em volta, ao redor, atrás ou na área adjacente à logo.

`;

  const variationBlock = pickImageVariationBlock(
    mood,
    hasAvatarRef,
    titulo,
    texto,
    forcedGender,
    anchoraPersonagem,
    leituraCenica?.composicao,
    hasCenarioRef,
    segment,
  );

  // Regra compositiva de produto-protagonista — só para segmento VAREJO quando
  // a âncora visual define papel=contexto_de_uso (ancoragePapel só assume esse
  // valor nesse segmento — ver organizaMethodEngine.ts). Antes era suprimida
  // quando havia avatar de referência, na suposição de que buildProductHierarchyBlock
  // (visualDirection.ts, via referenceAnchorBlock) já cobria a hierarquia —
  // mas aquele bloco só entra quando HÁ produto de referência selecionado
  // (refs.produtos.length > 0); com avatar referenciado e nenhuma foto de
  // produto marcada, a cena ficava sem QUALQUER regra de protagonismo. Mantém
  // sempre, com texto adaptado para o caso de avatar presente.
  const papelBlock =
    ancoragePapel === "contexto_de_uso" && !isCover
      ? hasAvatarRef
        ? "\n⚠ PAPEL DO PRODUTO — COMPOSIÇÃO: o PRODUTO é o protagonista visual desta cena. O avatar de referência APRESENTA ou USA o produto — segurando, indicando, demonstrando — sem cobrir, competir ou roubar o foco dele. PROIBIDO: avatar com mais área visual que o produto ou pose que esconda o produto.\n"
        : "\n⚠ PAPEL DO PRODUTO — COMPOSIÇÃO: o PRODUTO é o protagonista visual desta cena. A pessoa (se presente) aparece usando, segurando ou interagindo com ele em segundo plano. PROIBIDO: pessoa com mais área visual que o produto ou que roube o foco dele.\n"
      : "";

  // Título com 5+ palavras (2-3 linhas) precisa de um teto de altura menor —
  // um piso fixo de "35-45%" pra qualquer contagem de palavra fazia títulos
  // longos dominarem a peça, brigando com produto/personagem.
  const tituloWordCount = titulo.trim().split(/\s+/).filter(Boolean).length;
  const tituloSizeClause =
    tituloWordCount >= 5
      ? "corpo GRANDE — entre 28% e 38% da altura do canvas, em 2-3 linhas — manchete editorial, sem dominar o quadro inteiro"
      : "corpo GRANDE — entre 35% e 45% da altura do canvas, em até 3 linhas — manchete editorial grande, sem dominar o quadro inteiro";

  return `${buildDeviceRule(mainActivity, hasProdutoTelaRef, hasProdutoFisicoRef, produtoEhDispositivo)}\n\n${SAFE_ZONE_RULE}${AD_SAFE_ZONE_RULE}${LOGO_ZONE_RULE}${referenceAnchorBlock}Crie ${isCover ? "a CAPA do Reels (imagem estática 9:16 que aparece como thumbnail no perfil e como primeiro frame visual ao final do vídeo)" : "um post profissional"} para Instagram em formato NATIVO ${canvasSize}px (proporção ${canvasRatio}), sem qualquer recorte posterior.${isCover ? "\n\nIMPORTANTE — COERÊNCIA DE SEQUÊNCIA: esta capa faz parte da MESMA SEQUÊNCIA visual do estático e do carrossel do dia. O lettering do título (peso, posição segundo o mood, tipografia, CAIXA ALTA) DEVE seguir as MESMAS regras do post estático abaixo, para que estático + carrossel + capa do reels formem uma composição harmônica no feed." : ""}
${coverRefBlock}${coverVerbatimBlock}
${moodInstructions}
${finalModifier}
${CONCEITO_FIRST_RULE}
${cenaDetalhada}
${papelBlock}${variationBlock}

CONTEÚDO TEXTUAL:
- Título principal em CAIXA ALTA (bold, ${tituloSizeClause}): "${tituloUpper}"
- Texto de apoio — SUBTÍTULO DE REVISTA (corpo entre 55% e 70% do título, legível sem zoom no celular, caixa normal, peso regular — nunca tamanho de legenda): "${texto}"
- ${marcaInstruction}

COR PRIMÁRIA: ${primaryColor}
COR DE DESTAQUE: ${accentColor}

${typographyBlock}
${scriptAccentBlock}
REGRAS:
- Título renderizado em CAIXA ALTA exatamente como: "${tituloUpper}"
- Texto de apoio exatamente como: "${texto}", em caixa normal, corpo entre 55% e 70% do título (subtítulo de revista legível sem zoom — nunca tamanho de legenda)
- ⚠ MARGEM DE ${safeMargin} para título e texto de apoio (zona segura definida no topo do prompt) — se o texto não couber, quebre em mais linhas ou reposicione; nunca reduza o corpo da fonte nem corte palavras
- Todo texto em português, sem tradução, sem texto em inglês
- Sem elementos decorativos genéricos
- Sem watermarks, sem logo fictícia, sem assinatura textual — a logomarca oficial da marca é aplicada SEPARADAMENTE (por composição, fora da IA); PROIBIDO desenhar, inventar, imitar ou renderizar qualquer logomarca, emblema, símbolo de marca, monograma ou nome da empresa como texto na arte.
- Alta resolução, estética editorial contemporânea brasileira
- A zona da logomarca (${pos === "top-center" ? "faixa superior" : pos === "bottom-center" ? "faixa inferior" : "canto inferior direito"}) é continuação natural da cena — SEM barra, painel, badge ou bloco de cor sólida atrás da logo; legível, sem dead space.

${FORBIDDEN_MOOD_WORDS}`;
}
