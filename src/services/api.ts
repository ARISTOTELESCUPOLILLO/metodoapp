import { PersonagemGender } from "../core/visualDirection";
import { LogoPosition, MoodCode, SecondaryFont } from "../types";
import { generateImageAsync } from "./imageGeneration";
import { buildImagePrompt } from "./api/buildImagePrompt";
import { moodVisualInstructions } from "./api/moodVisualInstructions";
import { pickDeviceTypeLine, isNonDigitalActivity } from "../utils/promptRules";
import { buildReferenceAnchorWrapper } from "../shared/visual/referenceBlocks";

export { generateMethodContent } from "./api/generateMethodContent";

export async function generatePostImage(params: {
  imagePrompt: string;
  titulo: string;
  texto: string;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  secondaryFont?: SecondaryFont;
  logoDataUrl?: string;
  mood: MoodCode;
  vertical: "post" | "reels" | "estatico_final" | "reels_cover";
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
  // Instrução textual de PRIORIDADE MÁXIMA sobre como usar as `referenceImages`
  // (ex.: "IMAGEM #1 = PRODUTO OBRIGATÓRIO. Use EXATAMENTE este produto...").
  // Recebe posição de destaque no prompt final — ANTES da leitura de cena —
  // para não competir e perder para a descrição narrativa do card.
  referenceAnchor?: string;
  // Indica que a primeira referência enviada é um AVATAR (foto de identidade
  // da pessoa). Quando true, o sorteio de variação NÃO deve embutir um gênero
  // aleatório no prompt — o gênero já vem definido pela própria foto, e uma
  // instrução de "gênero sorteado com precedência" entraria em conflito com a
  // regra de preservar a identidade do avatar, fazendo a IA descartar a referência.
  hasAvatarRef?: boolean;
  // Indica que a referência de CENÁRIO (fachada/ambiente real do Kit Imagem)
  // foi enviada — suprime a linha "Ambiente" da leitura de cena (texto), que
  // entraria em conflito com a foto real do local.
  hasCenarioRef?: boolean;
  // Gênero do personagem atribuído pelo chamador para esta peça específica —
  // usado para balancear a presença de homem/mulher entre as peças de uma
  // mesma sequência e mantê-lo estável entre regenerações ("gerar de novo"
  // não deve trocar o gênero por acaso). Sem efeito quando hasAvatarRef.
  forcedGender?: PersonagemGender;
  // Descrição do personagem-tipo da âncora da sequência MOP. Injetada no prompt
  // de imagem quando não há avatar, garantindo consistência visual entre cards.
  anchoraPersonagem?: string;
  // Papel da empresa na cena (ainda_visual.papel). 'contexto_de_uso' injeta
  // regra compositiva produto-protagonista em feed/carrossel/final.
  ancoragePapel?: string;
  // Indica que uma das `referenceImages` é o UNIFORME OBRIGATÓRIO do Kit de
  // Marca (não a roupa do avatar). Quando true, o reforço de referências do
  // Reels não pode instruir "não copie a roupa" — isso anularia o uniforme.
  hasUniformeRef?: boolean;
  // Atividade real da empresa — ver nota em buildImagePrompt.
  mainActivity?: string;
  // Ver nota em buildImagePrompt — produto referenciado é ele mesmo um
  // dispositivo cujo conteúdo de tela é a identidade do produto.
  hasProdutoTelaRef?: boolean;
  segment?: import("../types").Segment;
}): Promise<string> {
  const {
    imagePrompt,
    titulo,
    texto,
    primaryColor,
    accentColor,
    fontFamily,
    secondaryFont,
    mood,
    vertical,
    leituraCenica,
    logoDataUrl,
    logoPosition,
    referenceImages,
    referenceAnchor,
    hasAvatarRef,
    hasCenarioRef,
    forcedGender,
    anchoraPersonagem,
    ancoragePapel,
    hasUniformeRef,
    mainActivity,
    hasProdutoTelaRef,
    segment,
  } = params;

  const isReels = vertical === "reels";
  const isCover = vertical === "reels_cover";
  const isFinal = vertical === "estatico_final";
  const moodInstructions = moodVisualInstructions[mood] || moodVisualInstructions["OP-01"];
  // Frame do reels: logo aplicada por canvas (composeReelsPng) no chamador — NÃO via IA.
  // Quando logoDataUrl é passado por paths legados (posts estáticos), entra como referência.
  // Capa do Reels: logo aplicada por canvas (composeReelsPng) no chamador.
  // Capa aceita referenceImages (frame sem logo) → ativa gpt-image-2/edit automaticamente.
  const hasLogo = !isCover && !!logoDataUrl;
  const coverHasRefs = isCover && !!(referenceImages && referenceImages.length);

  // Instrução de logo embutida no frame do reels (não há mais composição canvas).
  const reelsLogoLine = (() => {
    if (!isReels || !logoDataUrl) return "";
    const pos = logoPosition || "bottom-right";
    const zona =
      pos === "top-center"
        ? "na FAIXA SUPERIOR CENTRAL (centralizada horizontalmente, dentro do topo da zona segura de 150px)"
        : pos === "bottom-center"
          ? "na FAIXA INFERIOR CENTRAL (centralizada horizontalmente, dentro do rodapé da zona segura de 150px)"
          : "no CANTO INFERIOR DIREITO (dentro da zona segura de 150px)";
    return `\nLOGOMARCA: Aplique a logomarca fornecida (imagem de referência) ${zona}, em tamanho discreto (~12% da largura), preservando proporções, sem distorcer, sem cortar, sem inventar texto. Sem caixa/painel/moldura/fundo de cor sólida atrás dela — apenas contraste local suficiente para legibilidade. Nenhum outro lettering ou assinatura textual no quadro.`;
  })();

  const frameHasRefs = isReels && !!(referenceImages && referenceImages.length);
  // Reforço extra de refs — só quando há imagens de referência para não repetir a regra base.
  // Quando NÃO há uniforme: a roupa da referência é a do avatar, que deve ser
  // ignorada (o anchor do avatar já instrui "IGNORE a roupa"). Quando HÁ
  // uniforme, é o oposto — essa roupa é obrigatória e não pode ser descartada.
  const frameRefsReinforcement = frameHasRefs
    ? `\n\nREFORÇO COM REFERÊNCIAS: A pessoa da imagem de referência deve aparecer como SUJEITO FÍSICO E REAL da cena — em pé, sentada ou em movimento na locação descrita, jamais como imagem projetada/exibida na tela ou tampa de qualquer dispositivo. Preserve exatamente: rosto, traços faciais, etnia, cabelo, barba, óculos — mantendo a identidade visual da pessoa. Mesmo ambiente e iluminação da cena. ${
        hasUniformeRef
          ? "Preserve a identidade do avatar e aplique o uniforme obrigatório quando houver referência de uniforme. Ignore apenas a roupa original do avatar, não a roupa da referência de uniforme."
          : "NÃO copie a roupa da referência — vista a pessoa com roupa coerente com o contexto da cena."
      }`
    : "";

  // Regra de dispositivos digitais para Reels — alinhada com buildDeviceRule() de promptRules.ts.
  const DEVICE_RULE_REELS = isNonDigitalActivity(mainActivity)
    ? `\n\n⚠ DISPOSITIVOS DIGITAIS — PROIBIDOS NESTE REELS: o ofício real do porta-voz é manual, físico ou artístico e NÃO passa por tela. PROIBIDO incluir notebook, laptop, tablet, celular, monitor, computador ou qualquer dispositivo digital na composição, mesmo como elemento de apoio.
NEGATIVE: laptop, notebook, tablet, smartphone, computer monitor, desktop computer, screen, digital device, phone in hand.`
    : `\n\n⚠ DISPOSITIVOS DIGITAIS — REGRA GLOBAL INVIOLÁVEL (REELS):
PESSOA FÍSICA NA CENA: o porta-voz deve aparecer como PESSOA REAL E FÍSICA dentro do ambiente — nunca como imagem exibida na tela ou carcaça de qualquer dispositivo.
DISPOSITIVO: pode estar aberto, em mãos, em uso ou em qualquer posição natural — NÃO forçar fechado. A tela DEVE mostrar conteúdo com desfoque LEVE E SUTIL (~5% de intensidade — o mínimo necessário para impedir a leitura, não um borrão pesado) que sugere interface ou atividade; presença visual de conteúdo é desejável, opacidade total não. PROIBIDO: tela completamente apagada/escura em dispositivo em uso, conteúdo legível, logo reconhecível, interface clara, dashboard, gráfico, planilha, desfoque forte, borrão pesado ou qualquer efeito que pareça defeito de renderização — a tela deve parecer apenas levemente fora de foco, quase nítida.
COMPOSIÇÃO POR TIPO DE DISPOSITIVO — SE a cena envolver dispositivo digital, use o tipo e a composição sorteados para esta geração (define o ângulo para que a tampa/carcaça errada não possa aparecer por geometria): ${pickDeviceTypeLine()}
DIVERSIFICAÇÃO: não repita sempre notebook entre as peças da mesma sequência — alterne com celular, tablet, monitor de desktop ou tela/TV de fundo conforme a atividade.
CARCAÇA E TAMPA — REGRA ABSOLUTA (reforço, mesmo com a composição correta): tampa traseira e carcaça de qualquer dispositivo DEVEM ser completamente lisas — PROIBIDO especificamente: logo de maçã iluminado ou gravado, qualquer símbolo de fabricante, glowing backlit logo, gravação na tampa. Use equipamento genérico sem marca.
MÁXIMO 1 DISPOSITIVO por cena — duplicação proibida.
NEGATIVE: no legible screen content, no recognizable logo on screen, no readable text on screen, no charts, no dashboard, no spreadsheet, no clear UI, no duplicated devices, no image or logo on device casing or back cover, no Apple logo, no glowing logo on lid, no backlit symbol on laptop, no brand mark on back cover, no laptop logo, generic unbranded laptop only, no laptop screen facing camera.`;

  // Instrução de referência (avatar/cenário/produto) com prioridade máxima —
  // precisa vir ANTES da descrição da cena para não perder força para ela.
  const referenceAnchorBlock = buildReferenceAnchorWrapper(referenceAnchor ?? "");

  const prompt = isReels
    ? `REGRAS INVIOLÁVEIS PARA A IMAGEM DO REELS (PRIMEIRO FRAME DO VÍDEO):
- Gerar UMA FOTO ÚNICA, não carrossel, não colagem, não montagem, não sequência de quadros.
- APENAS UMA PESSOA adulta visível em todo o quadro. Proibido grupo, reunião, plateia, cliente ao lado, reflexo de pessoa, silhueta humana ou corpo parcial no fundo.
- Se a cena pedir várias pessoas, reunião ou atendimento, converta para UMA pessoa porta-voz sozinha, olhando para a câmera.
- Enquadramento close-up ou meio-corpo, rosto bem visível, boca claramente enquadrada para fala.
- Imagem pura: SEM TÍTULO, sem legendas, sem letras, sem números, sem palavras desenhadas em parte alguma do quadro${reelsLogoLine ? " (a única exceção é a logomarca — veja instrução abaixo)" : ""}.
- Composição vertical 9:16 cinematográfica (canvas 1080x1920), alta qualidade, foco nítido no rosto.

ZONA DE RESPIRO INVIOLÁVEL: 150 px de margem livre nas QUATRO bordas (topo, base, esquerda, direita) — nada importante (rosto, olhos, boca, mãos, produto-foco, gráfico) entra nesse perímetro. Bordas são continuação natural do fundo.
IMAGEM FULL BLEED — REGRA ABSOLUTA: a imagem preenche o canvas 1080x1920 completamente de borda a borda. PROIBIDO: moldura externa, frame decorativo, borda de cor sólida ao redor da arte, vinheta escura periférica como contentor, margem vazia ou espaço branco/preto separando a imagem das bordas do canvas.
FAIXA CENTRAL HORIZONTAL livre: entre 35% e 65% da altura do canvas, mantenha a área SEM detalhes que competem com texto — é onde a capa do vídeo entra nos primeiros 0,4 s. Posicione rosto, mãos e elementos-foco PREFERENCIALMENTE no terço SUPERIOR ou no terço INFERIOR, deixando o miolo do quadro mais limpo.

${referenceAnchorBlock}${anchoraPersonagem && !hasAvatarRef ? `PERSONAGEM-TIPO DA SEQUÊNCIA (manter consistente): ${anchoraPersonagem}.\n` : ""}CENA ADAPTADA PARA UM ÚNICO PORTA-VOZ: ${imagePrompt}.

${moodInstructions}${reelsLogoLine}${DEVICE_RULE_REELS}${frameRefsReinforcement}`
    : buildImagePrompt({
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
        format: isCover ? "reels_cover" : "post",
        hasRefs: coverHasRefs,
        mood,
        referenceAnchor,
        hasAvatarRef,
        hasCenarioRef,
        forcedGender,
        anchoraPersonagem,
        ancoragePapel,
        mainActivity,
        hasProdutoTelaRef,
        segment,
      });

  return generateImageAsync({
    prompt,
    format: isReels || isCover ? "reels" : "post",
    // Capa: sem logo via IA (canvas aplica). Callers de capa não passam referenceImages
    // (edit model ignorava o título com frame de referência).
    logoDataUrl: isCover ? undefined : hasLogo ? logoDataUrl : undefined,
    referenceImages: referenceImages && referenceImages.length ? referenceImages : undefined,
  });
}
