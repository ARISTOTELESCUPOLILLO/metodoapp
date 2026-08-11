import { BRAND_ACCENT } from "@/data/brandColors";
// Regen de peça do Método OP aplicando o Kit Imagem como referência visual.
// Chamado pelo ResultsView (via UsoReferenciasDia) — devolve a imagem-base
// (sem composição final de logo). O caller compõe logo + lettering exatamente
// como faz no fluxo normal (composeFeedPng / composeFinalPng / composeReelsPng).
//
// Bug histórico: antes a versão non-reels chamava generatePostUnico (motor do
// Post Único standalone), que enche o prompt de instruções de lettering e
// faz o modelo ignorar a referência visual do cenário/produto. Agora usamos
// o MESMO motor da geração normal (generatePostImage com vertical adequado),
// apenas adicionando as imagens do Kit como referenceImages.

import type { BrandKit, ImageKit, MoodCode } from "../types";
import type { SelecaoDireta } from "../domain/visualSelection";
import { orderedReferenceImages } from "../shared/visual/references";
import { generatePostImage } from "./api";
import { judgeLogoUniforme } from "./judgeContent";
import { loadImageKitAsync } from "../utils/imageKitStorage";
import type { ModeloOP, SlotPersonalizacao } from "../core/personalizacaoMop";
import type { PersonagemGender } from "../core/visualDirection";
import { policyPorFormato } from "../core/referenciasPolicy";
import { buildReferences } from "./regenerateWithKit/buildReferences";
import { buildAnchorPrefix } from "./regenerateWithKit/buildAnchorPrefix";

export { buildReferences } from "./regenerateWithKit/buildReferences";

export interface RegenerateInput {
  // Slot recomendado pela tabela de personalização do MOP
  slot: SlotPersonalizacao;
  // Kit Imagem do usuário (avatar/cenarios/produtos)
  imageKit: ImageKit;
  // Kit de Marca (logo, cores, tipografia)
  kit: BrandKit;
  // Mood escolhido na geração do MOP
  mood: MoodCode;
  // Texto-âncora da peça (título + descrição da cena). Fallback quando
  // titulo/imagePrompt não vêm separados.
  keyInfo: string;
  // Conteúdo editável atual da peça — usado para queimar título/texto na
  // mesma posição/estilo do motor normal.
  titulo?: string;
  texto?: string;
  // Descrição da CENA fotográfica (item.imagem / card.imagePrompt). Se
  // ausente, usamos keyInfo.
  imagePrompt?: string;
  // Leitura cênica detalhada da peça (quando disponível).
  leituraCenica?: {
    intencao?: string;
    personagem?: string;
    ambiente?: string;
    expressao?: string;
    clima?: string;
    composicao?: string;
  };
  // Para slots de "produto": número(s) escolhidos pelo usuário (1..8).
  // Se vazio, regenerateWithKit usa todos os produtos disponíveis.
  produtosSelecionados?: number[];
  // Para slots de "cenário": número (1..2) escolhido pelo usuário.
  // Se ausente, usa o primeiro cenário disponível.
  cenarioSelecionado?: number | null;
  // Override direto da seleção: quando presente, ignora slot.elemento e usa
  // as flags de SelecaoDireta para montar as referências (avatar/cenário/produtos).
  // Permite combinações que o `elemento` legado não modela (ex.: VAREJO
  // estático com avatar + cenário + produtos juntos).
  selecaoDireta?: SelecaoDireta;
  // Atividade da empresa (ancoragem semântica) — reservado para futuro uso.
  mainActivity?: string;
  // Override explícito do formato-alvo. Quando ausente, infere do slot.
  formato?: "post" | "reels";
  // Âncora de personagem da sequência — faixa etária e papel compositivo.
  // Garante consistência de identidade entre peças com refs e sem refs.
  anchoraPersonagem?: string;
  ancoragePapel?: string;
  // Gênero atribuído pelo chamador (balanceamento entre peças + persistência
  // entre regenerações — ver computeBlockGenders em ResultsView.tsx). Sem
  // efeito quando há avatar de referência (a foto já define o gênero).
  forcedGender?: PersonagemGender;
  // Quando presente, recarrega o Kit Imagem do servidor antes de montar as
  // referências — evita usar um snapshot em memória/cache que ainda tenha
  // uma foto já deletada (referência fantasma, ex.: produto removido do Kit
  // mas ainda enviado como referência obrigatória pro modelo de imagem).
  userId?: string | null;
  // Modelo/trilha da peça (MOP, EXP, PU2/PU4/PU8) — usado para revalidar a
  // policy de referências corretamente (EXP/PU têm limites próprios de produto).
  modelo?: ModeloOP | null;
  // Seed estável por sequência (ver useAnchorControl) — mantém a MESMA cor de
  // roupa prevista em todas as peças quando o avatar é usado sem uniforme real.
  clothingSeed?: number;
  // Posição da sequência na fila de variação (result.variacaoSeed) — rege a
  // paleta dos moods com rodízio de cor e a câmera. Também é por sequência,
  // pelo mesmo motivo do clothingSeed acima: regenerar UM card com o Kit não
  // pode trocar a paleta só dele e desamarrar o carrossel.
  variacaoSeed?: number;
}

// Ordenação de referências (avatar -> uniforme -> cenário -> produtos) agora
// vem de orderedReferenceImages em postUnico.ts — fonte única compartilhada
// com a trilha PU (antes duplicada aqui como refsToArray).

/**
 * Regenera a imagem-base da peça com Kit Imagem aplicado.
 * O caller compõe a logo e o overlay final no canvas (não fazemos aqui),
 * mantendo paridade visual com o fluxo de geração normal.
 *
 * - Reels (formato='reels' ou slot.formato==='reels'): vertical 'reels',
 *   foto limpa 1080x1920 sem texto e sem logo. Caller aplica logo via
 *   composeReelsPng e usa como primeiro frame do vídeo.
 *
 * - Estático / Carrossel: vertical 'post' (1080x1350) com título e texto
 *   queimados no mesmo estilo do motor normal. Caller aplica logo via
 *   composeFeedPng.
 *
 * - Estático Final: vertical 'estatico_final' (1080x1350, sem lettering
 *   próprio). Caller compõe título/texto/logo via composeFinalPng.
 */

// Monta instrução de correção de logomarca para o retry — referência adicional
// passada APÓS as refs originais, numerada de acordo com a posição no array.
function buildLogoCorrection(imgIdx: number, divergencia?: string | null): string {
  const problema = divergencia
    ? `Problema detectado: ${divergencia}.`
    : "Divergência de cor ou elementos detectada na logomarca.";
  return (
    `IMAGEM #${imgIdx} = LOGOMARCA OFICIAL DA EMPRESA (referência de correção de marca).\n` +
    `${problema}\n` +
    `CORRIJA a logomarca no vestuário do personagem para corresponder EXATAMENTE a esta imagem de referência: mesmas cores, mesmo símbolo, mesmos elementos visuais.\n` +
    `MANTENHA TODO O RESTO DA CENA INALTERADO: composição, personagem, rosto, ambiente, pose, iluminação — apenas a logomarca no vestuário deve ser corrigida.`
  );
}

// Gera a imagem e, quando há uniforme + logo no kit, aciona o juiz visual.
// Se a logomarca no uniforme divergir da referência, regenera uma única vez
// adicionando a logo como referência extra com instrução corretiva.
// Best-effort: qualquer falha no juiz ou no retry usa a imagem original.
async function generateWithLogoJudge(
  params: Parameters<typeof generatePostImage>[0],
  kitLogoDataUrl: string | undefined,
): Promise<string> {
  const imageUrl = await generatePostImage(params);
  if (!kitLogoDataUrl || !params.hasUniformeRef) return imageUrl;

  const verdict = await judgeLogoUniforme(imageUrl, kitLogoDataUrl);
  if (!verdict || verdict.fiel) return imageUrl;

  const logoIdx = (params.referenceImages?.length ?? 0) + 1;
  const correctionBlock = buildLogoCorrection(logoIdx, verdict.divergencia);
  const retryParams: Parameters<typeof generatePostImage>[0] = {
    ...params,
    referenceImages: [...(params.referenceImages ?? []), kitLogoDataUrl],
    referenceAnchor: params.referenceAnchor
      ? `${params.referenceAnchor}\n${correctionBlock}`
      : correctionBlock,
  };

  try {
    return await generatePostImage(retryParams);
  } catch {
    return imageUrl; // fallback para a imagem original se o retry falhar
  }
}

export async function regenerateWithKit(input: RegenerateInput): Promise<string> {
  const {
    slot,
    imageKit,
    kit,
    mood,
    keyInfo,
    titulo,
    texto,
    imagePrompt,
    leituraCenica,
    produtosSelecionados,
    cenarioSelecionado,
    selecaoDireta,
    formato,
    anchoraPersonagem,
    ancoragePapel,
    forcedGender,
    userId,
    modelo,
    clothingSeed,
    variacaoSeed,
  } = input;

  // Recarrega o Kit do servidor (autoritativo) antes de montar as
  // referências, em vez de confiar no snapshot recebido — que pode estar
  // desatualizado em relação a um delete feito em outra aba/sessão.
  let effectiveImageKit = imageKit;
  if (userId !== undefined) {
    try {
      effectiveImageKit = await loadImageKitAsync(userId);
    } catch {
      effectiveImageKit = imageKit;
    }
  }

  // Re-valida a seleção de produtos contra a policy do segmento/formato.
  // A seleção é persistida no localStorage sem escopo de segmento — se o
  // segmento mudou (ex.: VAREJO → MARCA) a seleção antiga pode conter produtos
  // que a policy atual proíbe. A UI já bloqueia a seleção, mas não revalida
  // na geração, então este é o ponto central de defesa.
  const policy = policyPorFormato(kit.segment, slot.formato, modelo ?? null);
  const sanitizedSelecao =
    selecaoDireta && policy.produtos === 0
      ? { ...selecaoDireta, produtosNums: [], produtoTelaInformativa: false }
      : selecaoDireta;

  const references = buildReferences(
    slot.elemento,
    effectiveImageKit,
    produtosSelecionados,
    cenarioSelecionado,
    sanitizedSelecao,
    kit.uniformeDataUrl,
  );
  const referenceImages = orderedReferenceImages(references);
  const hasAvatarRef = !!references.avatar;
  const hasCenarioRef = !!(references.cenario || references.fachada);
  const hasUniformeRef = !!references.uniforme;
  const anchorPrefix = buildAnchorPrefix(
    references,
    mood,
    {
      primary: kit.primaryColor || "#123a63",
      accent: kit.accentColor || BRAND_ACCENT,
    },
    slot.formato === "carrossel" ? slot.cardCarrossel : undefined,
    kit.segment,
    selecaoDireta?.produtoDetalhe,
    kit.isPersonalBrand,
    clothingSeed,
  );

  const inferred: "post" | "reels" = slot.formato === "reels" ? "reels" : "post";
  const targetFormato = formato ?? inferred;
  const isReels = targetFormato === "reels";
  const isFinal = slot.formato === "estatico_final";

  const baseScene = (imagePrompt || keyInfo || "").slice(0, 600);
  // Anchor de referência (ex.: "IMAGEM #1 = PRODUTO OBRIGATÓRIO...") é enviado
  // separado da cena — ver buildImagePrompt/generatePostImage, que o posicionam
  // com prioridade máxima, ANTES da leitura cênica. Não embutir aqui dentro do
  // imagePrompt: lá ele acabaria enterrado num bullet de "referência adicional",
  // perdendo força para o restante da descrição de cena.
  // A regra de dispositivos digitais também não precisa ser repetida aqui —
  // generatePostImage já injeta DEVICE_RULE_FIRST/DEVICE_RULE_REELS no topo do prompt.
  const referenceAnchor = anchorPrefix.trim() ? anchorPrefix.trim() : undefined;

  if (isReels) {
    return generateWithLogoJudge(
      {
        imagePrompt: baseScene,
        referenceAnchor,
        titulo: "",
        texto: "",
        companyName: kit.companyName,
        mainActivity: kit.mainActivity,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || BRAND_ACCENT,
        fontFamily: kit.fontPair || "Montserrat",
        secondaryFont: kit.secondaryFont,
        mood,
        vertical: "reels",
        // Sem logoDataUrl: a logo é aplicada por canvas (composeReelsPng).
        referenceImages: referenceImages.length ? referenceImages : undefined,
        hasAvatarRef,
        hasCenarioRef,
        hasUniformeRef,
        hasProdutoTelaRef: references.produtoTelaInformativa,
        hasProdutoFisicoRef: !!references.produtos?.length,
        produtoEhDispositivo: references.produtoEhDispositivo,
        forcedGender,
        anchoraPersonagem,
        ancoragePapel,
        segment: kit.segment,
        variacaoSeed,
      },
      hasUniformeRef ? kit.logoDataUrl : undefined,
    );
  }

  // Estático Final: imagem-base limpa, logo aplicada por canvas (composeFinalPng).
  if (isFinal) {
    return generateWithLogoJudge(
      {
        imagePrompt: baseScene,
        referenceAnchor,
        titulo: titulo || "",
        texto: texto || "",
        companyName: kit.companyName,
        mainActivity: kit.mainActivity,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || BRAND_ACCENT,
        fontFamily: kit.fontPair || "Montserrat",
        secondaryFont: kit.secondaryFont,
        mood,
        vertical: "estatico_final",
        logoPosition: kit.logoPosition,
        leituraCenica,
        referenceImages: referenceImages.length ? referenceImages : undefined,
        hasAvatarRef,
        hasCenarioRef,
        hasUniformeRef,
        hasProdutoTelaRef: references.produtoTelaInformativa,
        hasProdutoFisicoRef: !!references.produtos?.length,
        produtoEhDispositivo: references.produtoEhDispositivo,
        forcedGender,
        anchoraPersonagem,
        ancoragePapel,
        segment: kit.segment,
        variacaoSeed,
      },
      hasUniformeRef ? kit.logoDataUrl : undefined,
    );
  }

  // Estático / Carrossel: paridade com o fluxo normal — o motor queima
  // título e texto no mesmo estilo do mood, usando as referências do Kit
  // Imagem (cenário/avatar/produto) como ancoragem visual. O caller aplica
  // apenas a logo via composeFeedPng.
  return generateWithLogoJudge(
    {
      imagePrompt: baseScene,
      referenceAnchor,
      titulo: titulo || "",
      texto: texto || "",
      companyName: kit.companyName,
      mainActivity: kit.mainActivity,
      primaryColor: kit.primaryColor,
      accentColor: kit.accentColor || BRAND_ACCENT,
      fontFamily: kit.fontPair || "Montserrat",
      secondaryFont: kit.secondaryFont,
      mood,
      vertical: "post",
      logoPosition: kit.logoPosition,
      leituraCenica,
      referenceImages: referenceImages.length ? referenceImages : undefined,
      hasAvatarRef,
      hasCenarioRef,
      hasUniformeRef,
      hasProdutoTelaRef: references.produtoTelaInformativa,
      hasProdutoFisicoRef: !!references.produtos?.length,
      produtoEhDispositivo: references.produtoEhDispositivo,
      forcedGender,
      anchoraPersonagem,
      ancoragePapel,
      segment: kit.segment,
      variacaoSeed,
    },
    hasUniformeRef ? kit.logoDataUrl : undefined,
  );
}
