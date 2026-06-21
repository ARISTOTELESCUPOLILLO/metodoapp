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

import type { BrandKit, ImageKit, MoodCode, Segment } from "../types";
import type { PostUnicoReferences } from "./postUnico";
import { orderedReferenceImages } from "./postUnico";
import { generatePostImage } from "./api";
import { loadImageKitAsync } from "../utils/imageKitStorage";
import { isClothingFriendly, buildClothingPool } from "../core/clothingPool";
import type { ElementoPersonalizacao, SlotPersonalizacao } from "../core/personalizacaoMop";
import { buildProductHierarchyBlock, type PersonagemGender } from "../core/visualDirection";

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
  // estas três flags para montar as referências (avatar / cenário / produtos).
  // Permite combinações que o `elemento` legado não modela (ex.: VAREJO
  // estático com avatar + cenário + produtos juntos).
  selecaoDireta?: {
    usarAvatar: boolean;
    // Qual avatar do Kit usar quando usarAvatar=true. Default: 1 (avatar
    // principal). Apenas 1 avatar é enviado por geração.
    avatarNum?: 1 | 2 | null;
    // Usa a foto de fachada do Kit Imagem (slot próprio, fora do pool de
    // cenários) como referência obrigatória.
    usarFachada?: boolean;
    cenarioNum?: number | null;
    produtosNums?: number[];
    // Distribuição de fotos de produto no carrossel (VAREJO): quando true,
    // o produto referenciado deve aparecer em DETALHE/RECORTE (não o produto
    // inteiro) neste card — ver distributeProduto em ResultsView.tsx.
    produtoDetalhe?: boolean;
    // Veste o avatar com a foto de uniforme do Kit de Marca (kit.uniformeDataUrl)
    // em vez do figurino livre sorteado. Só tem efeito com usarAvatar=true.
    useUniforme?: boolean;
    // Personagem sem avatar + uniforme: cria um personagem do zero (sem foto
    // de avatar) vestido com o uniforme do Kit, na idade indicada. Só tem
    // efeito quando usarAvatar=false. Antes só existia no motor da PU
    // (MetodoOpApp.tsx) — agora compartilhado via buildReferences.
    personagemSemAvatar?: { ativo: boolean; idade?: string };
  };
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
}

// Fonte única de montagem de referências (avatar/cenário/produtos/uniforme)
// — usada pelo MOP (regenerateWithKit, abaixo) e pela PU (MetodoOpApp.tsx),
// que antes montava o objeto `references` manualmente e por isso só ela
// suportava "personagem sem avatar + uniforme".
export function buildReferences(
  elemento: ElementoPersonalizacao,
  imageKit: ImageKit,
  produtosSelecionados?: number[],
  cenarioSelecionado?: number | null,
  selecaoDireta?: {
    usarAvatar: boolean;
    avatarNum?: 1 | 2 | null;
    usarFachada?: boolean;
    cenarioNum?: number | null;
    produtosNums?: number[];
    useUniforme?: boolean;
    personagemSemAvatar?: { ativo: boolean; idade?: string };
  },
  uniformeDataUrl?: string,
): PostUnicoReferences {
  const refs: PostUnicoReferences = {};
  const wantsAvatar = selecaoDireta
    ? selecaoDireta.usarAvatar
    : elemento === "avatar" || elemento === "cenario+avatar" || elemento === "avatar+produto";
  const wantsFachada = !!selecaoDireta?.usarFachada;
  const wantsCenario = selecaoDireta
    ? selecaoDireta.cenarioNum != null
    : elemento === "cenario" || elemento === "cenario+avatar";
  const wantsProduto = selecaoDireta
    ? !!(selecaoDireta.produtosNums && selecaoDireta.produtosNums.length)
    : elemento === "produto" || elemento === "avatar+produto";
  const cenarioPick = selecaoDireta
    ? (selecaoDireta.cenarioNum ?? null)
    : (cenarioSelecionado ?? null);
  const produtosPick = selecaoDireta
    ? (selecaoDireta.produtosNums ?? [])
    : (produtosSelecionados ?? []);

  if (wantsAvatar) {
    const avatarNum = selecaoDireta?.avatarNum ?? 1;
    const avatarUrl = avatarNum === 2 ? imageKit.avatar2 || imageKit.avatar : imageKit.avatar;
    if (avatarUrl) refs.avatar = avatarUrl;
  }
  if (wantsFachada && imageKit.fachada) {
    refs.fachada = imageKit.fachada;
  }
  if (wantsCenario) {
    const idx = (cenarioPick ?? 1) - 1;
    const fallbackIdx = imageKit.cenarios.findIndex((c) => !!c);
    const finalIdx = imageKit.cenarios[idx] ? idx : fallbackIdx;
    const chosen = finalIdx >= 0 ? imageKit.cenarios[finalIdx] : null;
    if (chosen) {
      refs.cenario = chosen;
    }
  }
  if (wantsProduto) {
    const nums = produtosPick.length
      ? produtosPick
      : imageKit.produtos.map((p, i) => (p ? i + 1 : null)).filter((n): n is number => n !== null);
    const lista = nums
      .map((n) => {
        const url = imageKit.produtos[n - 1];
        return url ? { num: n, dataUrl: url } : null;
      })
      .filter((p): p is { num: number; dataUrl: string } => p !== null);
    if (lista.length) refs.produtos = lista;
  }
  // Uniforme: veste o avatar (quando presente) OU cria um personagem do zero
  // sem avatar vestido com o uniforme — mesma capacidade que antes só
  // existia na PU.
  if (selecaoDireta?.useUniforme && refs.avatar && uniformeDataUrl) {
    refs.uniforme = uniformeDataUrl;
  } else if (!refs.avatar && selecaoDireta?.personagemSemAvatar?.ativo && uniformeDataUrl) {
    refs.uniforme = uniformeDataUrl;
    refs.personagemIdade = selecaoDireta.personagemSemAvatar.idade;
  }
  return refs;
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
const MOODS_CLAROS: ReadonlySet<MoodCode> = new Set<MoodCode>(["OP-01", "OP-06"]);

// isClothingFriendly/buildClothingPool agora moram em core/clothingPool.ts —
// compartilhadas com postUnico.ts (PU) pra evitar duplicação literal.

// Variações de ângulo + distância de câmera para o cenário do carrossel —
// o MESMO cenário é compartilhado pelos 5 cards, então sem variação os fundos
// saem quase idênticos. Cada item troca o ENQUADRAMENTO, nunca o lugar: o
// espaço, a arquitetura e os objetos continuam os mesmos e reconhecíveis.
// Escolha determinística por índice do card (não aleatória) — regenerar o
// mesmo card individualmente preserva a mesma variação.
const CENARIO_FRAMING_POOL: readonly string[] = [
  "plano aberto / visão geral do ambiente — câmera mais afastada, mostrando o espaço por inteiro",
  "plano médio com a câmera deslocada para o lado — outro ponto de vista do mesmo espaço, ângulo lateral",
  "close-up / plano de detalhe — aproxime de um elemento específico do ambiente (uma parede, prateleira, bancada, equipamento ou decoração), mantendo pistas do entorno reconhecíveis",
  "ângulo de câmera mais baixo ou mais alto — ponto de vista vertical diferente do mesmo espaço",
  "enquadramento diagonal / outro canto do ambiente — plano médio-fechado, recorte diferente do mesmo local",
];

// Variações de enquadramento para o card de "PRODUTO EM DETALHE" do carrossel
// (VAREJO) — quando a distribuição de fotos (distributeProduto, ResultsView)
// decide que este card mostra um RECORTE/APROXIMAÇÃO do produto em vez do
// produto inteiro. Escolha determinística por índice do card, mesma lógica
// do CENARIO_FRAMING_POOL — dá variedade visual sem repetir o mesmo recorte.
const PRODUTO_DETALHE_POOL: readonly string[] = [
  "aproxime em DETALHE de uma parte específica do produto — uma textura, acabamento, etiqueta, encaixe ou material — sem mostrar o produto inteiro",
  "plano de DETALHE em outro ângulo do mesmo produto — uma borda, canto, costura, botão ou elemento funcional, em close-up, sem mostrar o produto inteiro",
  "RECORTE/aproximação de uma seção do produto em uso ou em destaque (ex.: mãos manipulando ou apresentando essa parte), sem revelar o produto completo",
];

function buildAnchorPrefix(
  refs: PostUnicoReferences,
  mood: MoodCode,
  kitColors?: { primary: string; accent: string },
  cardCarrossel?: number,
  segment?: Segment,
  produtoDetalhe?: boolean,
): string {
  // Ordem dos prefixos espelha a ordem em que as imagens são enviadas
  // (avatar → uniforme → fachada → cenário → produtos), pra que a numeração
  // "imagem #1/#2/#3" case com a posição em image_urls no servidor.
  const lines: string[] = [];
  let idx = 1;
  // Quando há produto referenciado, o cenário deixa de "travar" móveis/ângulo
  // originais — vira pano de fundo de apoio, e a câmera pode se reposicionar
  // para dar protagonismo ao produto (ver buildProductHierarchyBlock abaixo).
  const temProduto = !!refs.produtos?.length;
  if (refs.avatar) {
    const clothingHint = refs.uniforme
      ? " COR/MODELO DO VESTUÁRIO: ver IMAGEM seguinte (UNIFORME OBRIGATÓRIO) — não escolha roupa livre."
      : kitColors
        ? (() => {
            const pool = buildClothingPool(kitColors.primary, kitColors.accent);
            return ` COR DO VESTUÁRIO: ${pool[Math.floor(Math.random() * pool.length)]}`;
          })()
        : "";
    const figurinoSentence = refs.uniforme
      ? "Vista o avatar com o uniforme obrigatório da próxima imagem. Não escolha figurino livre."
      : "Vista o avatar com roupa NOVA, coerente com a cena e o contexto da empresa descritos abaixo (pode ser polo, camisa social, jaleco, uniforme, regata de treino, moletom, terno — escolha o que faz sentido para a situação e o ambiente).";
    lines.push(
      `IMAGEM #${idx} = AVATAR (referência de IDENTIDADE, não de figurino). PRESERVE EXATAMENTE: rosto, traços faciais, idade, cabelo, barba, tom de pele, etnia, sexo, biótipo/estatura/porte físico, óculos e acessórios fixos do rosto. NÃO rejuvenesça, NÃO envelheça, NÃO troque etnia, NÃO mude o gênero, NÃO altere o porte físico. IGNORE a roupa, a cor da roupa, a pose exata e os acessórios de vestuário (relógio, anéis, colares) da foto — eles servem só pra mostrar a pessoa, não o figurino. ${figurinoSentence}${clothingHint}`,
    );
    idx++;
  }
  if (refs.uniforme) {
    lines.push(
      `IMAGEM #${idx} = UNIFORME OBRIGATÓRIO. Vista o personagem da cena EXATAMENTE com esta peça de roupa: mesma cor, mesmo modelo/corte e mesma posição da logomarca aplicada ao tecido. IGNORE COMPLETAMENTE quem aparece nesta foto de referência — rosto, corpo, idade, pose e identidade dessa pessoa NÃO importam, apenas a peça de roupa em si. NÃO copie a pessoa do uniforme; aplique somente a roupa ao personagem da cena.`,
    );
    idx++;
  }
  if (refs.fachada) {
    const reiluminaFachada = MOODS_CLAROS.has(mood);
    const fachadaClause = `preserve a arquitetura, letreiros e identidade visual do local — a fachada deve ser reconhecível na imagem final, com personagem ou produto posicionado à frente ou com a fachada claramente visível ao fundo. Se houver fios elétricos, postes, cabos aéreos, lixo ou poluição visual cruzando a fachada, é PERMITIDO retocar/remover esses elementos da composição final — desde que a arquitetura, os letreiros e a identidade visual do local continuem plenamente reconhecíveis. Se o céu aparecer na cena, é PERMITIDO substituí-lo por um céu mais bonito e coerente com o mood e o horário do dia (ex.: azul limpo, entardecer dourado, nublado suave) — sem look artificial ou composição com aparência de colagem`;
    lines.push(
      reiluminaFachada
        ? `IMAGEM #${idx} = FACHADA OBRIGATÓRIA. Use EXATAMENTE este local: ${fachadaClause}. NÃO invente outro local, NÃO troque os elementos, NÃO mude o ângulo. A ILUMINAÇÃO DEVE SER REINTERPRETADA conforme o ESTILO VISUAL do mood descrito abaixo: clarear o ambiente, equilibrar luz natural, suavizar sombras profundas — preserve a arquitetura e os elementos do local, mas adapte a luz para casar com o mood claro.`
        : `IMAGEM #${idx} = FACHADA OBRIGATÓRIA. Use EXATAMENTE este local: ${fachadaClause}. NÃO invente outro local, NÃO troque os elementos, NÃO mude o ângulo. Apenas adicione/adapte o personagem e a ação descritos abaixo neste local real.`,
    );
    idx++;
  }
  if (refs.cenario) {
    const reilumina = MOODS_CLAROS.has(mood);
    // Carrossel reaproveita o MESMO cenário em todos os cards — sem variar o
    // enquadramento, os 5 fundos saem quase idênticos. Aqui trocamos a regra
    // fixa "NÃO mude o ângulo" por uma instrução de enquadramento específica
    // para este card (determinística pelo índice), preservando o mesmo espaço.
    const variaEnquadramento = cardCarrossel != null;
    const framingPick = variaEnquadramento
      ? CENARIO_FRAMING_POOL[(cardCarrossel! - 1) % CENARIO_FRAMING_POOL.length]
      : null;

    // "ponto de vista da câmera" só entra na lista de preservação quando NÃO
    // estamos variando o enquadramento — caso contrário a frase contradiria
    // a liberação de ângulo/distância dada pelo framingClause abaixo.
    // Com produto referenciado, os móveis/objetos do cenário viram fundo de
    // apoio (não competem pelo protagonismo) e a câmera fica livre para se
    // reposicionar a favor do produto — ver framingClause abaixo.
    const ambienteInternoClause = temProduto
      ? "preserve a arquitetura, paredes, piso, iluminação geral e identidade visual do ambiente — móveis e objetos do cenário aparecem apenas como FUNDO de apoio, atrás e ao redor do produto referenciado, nunca à frente dele nem maiores ou mais nítidos que ele"
      : variaEnquadramento
        ? "preserve sala, móveis, equipamentos e paredes"
        : "preserve sala, móveis, equipamentos, paredes e ponto de vista da câmera";
    const framingClause = framingPick
      ? `Pode variar o ÂNGULO e a DISTÂNCIA DA CÂMERA — mas continue sendo claramente reconhecível como o MESMO AMBIENTE, com a mesma arquitetura, móveis/objetos e identidade visual. ENQUADRAMENTO DESTE CARD: ${framingPick}.`
      : temProduto
        ? "NÃO invente outro local, NÃO troque os objetos. Pode reposicionar ÂNGULO e DISTÂNCIA da câmera para dar protagonismo ao produto referenciado — mas o ambiente deve continuar reconhecível como o mesmo local."
        : "NÃO invente outro local, NÃO troque os objetos, NÃO mude o ângulo.";
    // SERVIÇOS/MARCA: produtos de terceiros visíveis no cenário real (ex.: embalagens
    // de marca em obra) não devem "vazar" pra peça — a política de referências
    // dessas combinações não inclui produtos (ver referenciasPolicy.ts).
    const produtoGuard =
      segment !== "VAREJO"
        ? " Itens de mercadoria, produtos de terceiros ou embalagens com marcas visíveis em primeiro plano NÃO devem ser reproduzidos como elementos centrais da composição — desfoque, exclua ou mantenha discretos ao fundo, priorizando o avatar e a ação."
        : "";
    lines.push(
      reilumina
        ? `IMAGEM #${idx} = CENÁRIO OBRIGATÓRIO. Use EXATAMENTE este espaço: ${ambienteInternoClause}.${produtoGuard} NÃO invente outro local, NÃO troque os objetos. ${framingClause} A ILUMINAÇÃO DEVE SER REINTERPRETADA conforme o ESTILO VISUAL do mood descrito abaixo: clarear o ambiente, equilibrar luz natural, suavizar sombras profundas — preserve a arquitetura e os objetos do ambiente, mas adapte a luz para casar com o mood claro.`
        : `IMAGEM #${idx} = CENÁRIO OBRIGATÓRIO. Use EXATAMENTE este espaço: ${ambienteInternoClause}${variaEnquadramento || temProduto ? "" : ", mesma iluminação"}.${produtoGuard} NÃO invente outro local, NÃO troque os objetos. ${framingClause} Apenas adicione/adapte o personagem e a ação descritos abaixo dentro deste espaço real.`,
    );
    idx++;
  }
  if (refs.produtos?.length) {
    const n = refs.produtos.length;
    if (n === 1 && produtoDetalhe) {
      const detalhePick =
        cardCarrossel != null
          ? PRODUTO_DETALHE_POOL[(cardCarrossel - 1) % PRODUTO_DETALHE_POOL.length]
          : PRODUTO_DETALHE_POOL[0];
      lines.push(
        `IMAGEM #${idx} = PRODUTO DE REFERÊNCIA — DETALHE/RECORTE OBRIGATÓRIO (não o produto inteiro): ${detalhePick}. Mantenha fidelidade ao produto real: mesma cor, material, rótulo e acabamento da referência — apenas o ENQUADRAMENTO é parcial/aproximado. Não invente outro produto, não troque a marca, não altere o design.`,
      );
    } else {
      lines.push(
        `IMAGEM${n > 1 ? "NS" : ""} #${idx}${n > 1 ? `..#${idx + n - 1}` : ""} = PRODUTO${n > 1 ? "S" : ""} OBRIGATÓRIO${n > 1 ? "S" : ""}. Use EXATAMENTE este produto, com mesmo formato, mesma cor, mesmo rótulo e mesma embalagem. Não invente outra versão, não troque a marca, não altere o design.`,
      );
    }
    // Em modo detalhe/recorte, a hierarquia padrão de produto não se aplica:
    // AVATAR_VS_PRODUTO_SINGULAR pede um ângulo que "revele a forma por
    // inteiro" do produto, o que contradiria o recorte pedido acima.
    if (!(n === 1 && produtoDetalhe)) {
      lines.push(
        buildProductHierarchyBlock({
          produtosCount: n,
          hasCenario: !!refs.cenario,
          hasAvatar: !!refs.avatar,
          segment,
        }),
      );
    }
    if (n >= 2) {
      lines.push(
        `REGRA DE CONTAGEM — INEGOCIÁVEL: a imagem final DEVE conter EXATAMENTE ${n} produto${n > 1 ? "s" : ""} visíveis e identificáveis, todos enviados como referência. PROIBIDO omitir, esconder atrás de objetos, cortar fora do quadro ou substituir qualquer um deles. Se o plano aberto não acomodar os ${n}, APROXIME o enquadramento (close-up de produto, detalhe do pé com o tênis, bancada/prateleira com os ${n} itens lado a lado, flat-lay) em vez de mostrar um cenário amplo com apenas parte dos produtos. Conte os produtos na composição final: o número deve ser ${n}.`,
      );
    }
  }
  // Quando apenas avatar enviado (sem cenário, fachada ou produto): suprimir
  // construção de ambiente pelo modelo. O campo leituraCenica.ambiente continua
  // indo ao prompt mas deve orientar vestuário/postura, não gerar fundo detalhado.
  if (refs.avatar && !refs.cenario && !refs.fachada && !refs.produtos?.length) {
    lines.push(
      "FUNDO NEUTRO OBRIGATÓRIO: apenas avatar de referência enviado — sem imagem de cenário. " +
        "Usar FUNDO LIMPO, SUAVE e DESFOCADO: bokeh suave, gradiente neutro, textura vaga ou superfície indefinida. " +
        "NÃO construir ambiente físico específico, sala, escritório ou local identificável como fundo — mesmo que a leitura de cena abaixo descreva um local. " +
        'O campo "Ambiente" da leitura de cena orienta apenas VESTUÁRIO e POSTURA do personagem, não o fundo a renderizar. ' +
        "NEGATIVE: detailed background, specific room interior, identifiable location behind person, sharp background, busy background, office furniture behind subject.",
    );
  }
  if (!lines.length) return "";
  return `${lines.join("\n")}\n\n`;
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

  const references = buildReferences(
    slot.elemento,
    effectiveImageKit,
    produtosSelecionados,
    cenarioSelecionado,
    selecaoDireta,
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
      accent: kit.accentColor || "#f4b000",
    },
    slot.formato === "carrossel" ? slot.cardCarrossel : undefined,
    kit.segment,
    selecaoDireta?.produtoDetalhe,
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
    return generatePostImage({
      imagePrompt: baseScene,
      referenceAnchor,
      titulo: "",
      texto: "",
      companyName: kit.companyName,
      primaryColor: kit.primaryColor,
      accentColor: kit.accentColor || "#f4b000",
      fontFamily: kit.fontPair || "Montserrat",
      secondaryFont: kit.secondaryFont,
      mood,
      vertical: "reels",
      // Sem logoDataUrl: a logo é aplicada por canvas (composeReelsPng).
      referenceImages: referenceImages.length ? referenceImages : undefined,
      hasAvatarRef,
      hasCenarioRef,
      hasUniformeRef,
      forcedGender,
      anchoraPersonagem,
      ancoragePapel,
    });
  }

  // Estático Final: imagem-base limpa, logo aplicada por canvas (composeFinalPng).
  if (isFinal) {
    return generatePostImage({
      imagePrompt: baseScene,
      referenceAnchor,
      titulo: titulo || "",
      texto: texto || "",
      companyName: kit.companyName,
      primaryColor: kit.primaryColor,
      accentColor: kit.accentColor || "#f4b000",
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
      forcedGender,
      anchoraPersonagem,
      ancoragePapel,
    });
  }

  // Estático / Carrossel: paridade com o fluxo normal — o motor queima
  // título e texto no mesmo estilo do mood, usando as referências do Kit
  // Imagem (cenário/avatar/produto) como ancoragem visual. O caller aplica
  // apenas a logo via composeFeedPng.
  return generatePostImage({
    imagePrompt: baseScene,
    referenceAnchor,
    titulo: titulo || "",
    texto: texto || "",
    companyName: kit.companyName,
    primaryColor: kit.primaryColor,
    accentColor: kit.accentColor || "#f4b000",
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
    forcedGender,
    anchoraPersonagem,
    ancoragePapel,
  });
}
