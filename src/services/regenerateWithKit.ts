// Regen de peça do Método OP aplicando o Kit Imagem como referência visual.
// Chamado pelo PersonalizacaoBadge — devolve a imagem-base (sem composição
// final de logo). O caller (ResultsView) compõe logo + lettering exatamente
// como faz no fluxo normal (composeFeedPng / composeFinalPng / composeReelsPng).
//
// Bug histórico: antes a versão non-reels chamava generatePostUnico (motor do
// Post Único standalone), que enche o prompt de instruções de lettering e
// faz o modelo ignorar a referência visual do cenário/produto. Agora usamos
// o MESMO motor da geração normal (generatePostImage com vertical adequado),
// apenas adicionando as imagens do Kit como referenceImages.

import type { BrandKit, ImageKit, MoodCode } from '../types';
import type { PostUnicoReferences } from './postUnico';
import { generatePostImage } from './api';
import type {
  ElementoPersonalizacao,
  SlotPersonalizacao,
} from '../core/personalizacaoMop';

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
    cenarioNum?: number | null;
    produtosNums?: number[];
  };
  // Atividade da empresa (ancoragem semântica) — reservado para futuro uso.
  mainActivity?: string;
  // Override explícito do formato-alvo. Quando ausente, infere do slot.
  formato?: 'post' | 'reels';
}

function buildReferences(
  elemento: ElementoPersonalizacao,
  imageKit: ImageKit,
  produtosSelecionados?: number[],
  cenarioSelecionado?: number | null,
  selecaoDireta?: { usarAvatar: boolean; cenarioNum?: number | null; produtosNums?: number[] },
): PostUnicoReferences {
  const refs: PostUnicoReferences = {};
  const wantsAvatar = selecaoDireta
    ? selecaoDireta.usarAvatar
    : (elemento === 'avatar' || elemento === 'cenario+avatar' || elemento === 'avatar+produto');
  const wantsCenario = selecaoDireta
    ? (selecaoDireta.cenarioNum != null)
    : (elemento === 'cenario' || elemento === 'cenario+avatar');
  const wantsProduto = selecaoDireta
    ? !!(selecaoDireta.produtosNums && selecaoDireta.produtosNums.length)
    : (elemento === 'produto' || elemento === 'avatar+produto');
  const cenarioPick = selecaoDireta ? (selecaoDireta.cenarioNum ?? null) : (cenarioSelecionado ?? null);
  const produtosPick = selecaoDireta ? (selecaoDireta.produtosNums ?? []) : (produtosSelecionados ?? []);

  if (wantsAvatar && imageKit.avatar) refs.avatar = imageKit.avatar;
  if (wantsCenario) {
    const idx = (cenarioPick ?? 1) - 1;
    const chosen =
      imageKit.cenarios[idx] ||
      imageKit.cenarios.find((c) => !!c) ||
      null;
    if (chosen) refs.cenario = chosen;
  }
  if (wantsProduto) {
    const nums = produtosPick.length
      ? produtosPick
      : imageKit.produtos
          .map((p, i) => (p ? i + 1 : null))
          .filter((n): n is number => n !== null);
    const lista = nums
      .map((n) => {
        const url = imageKit.produtos[n - 1];
        return url ? { num: n, dataUrl: url } : null;
      })
      .filter((p): p is { num: number; dataUrl: string } => p !== null);
    if (lista.length) refs.produtos = lista;
  }
  return refs;
}

function refsToArray(refs: PostUnicoReferences): string[] {
  const out: string[] = [];
  if (refs.avatar) out.push(refs.avatar);
  if (refs.cenario) out.push(refs.cenario);
  if (refs.produtos?.length) {
    for (const p of [...refs.produtos].sort((a, b) => a.num - b.num)) {
      out.push(p.dataUrl);
    }
  }
  return out;
}

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
const MOODS_CLAROS: ReadonlySet<MoodCode> = new Set<MoodCode>(['OP-01', 'OP-06']);

function isClothingFriendly(hex: string): boolean {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  if (l < 0.35) return true;
  if (s < 0.25) return true;
  return false;
}

function buildClothingPool(primary: string, accent: string): string[] {
  const pool = [
    'Roupa branca — neutra e limpa; cores da marca reservadas para fundo, grafismos ou tipografia.',
    'Roupa preta — neutra e forte; cores da marca em outros elementos.',
    'Cinza claro ou chumbo — versátil, harmoniza com qualquer paleta de marca.',
    'Bege ou creme — neutro quente que complementa qualquer paleta.',
  ];
  if (isClothingFriendly(primary)) {
    pool.push(`Peça principal (camisa, blazer ou jaqueta) na cor primária da marca (${primary}).`);
  }
  if (isClothingFriendly(accent) && accent.toLowerCase() !== primary.toLowerCase()) {
    pool.push(`Destaque da cor de acento da marca (${accent}) em detalhe ou peça secundária sobre base neutra.`);
  }
  return pool;
}

// Variações de ângulo + distância de câmera para o cenário do carrossel —
// o MESMO cenário é compartilhado pelos 5 cards, então sem variação os fundos
// saem quase idênticos. Cada item troca o ENQUADRAMENTO, nunca o lugar: o
// espaço, a arquitetura e os objetos continuam os mesmos e reconhecíveis.
// Escolha determinística por índice do card (não aleatória) — regenerar o
// mesmo card individualmente preserva a mesma variação.
const CENARIO_FRAMING_POOL: readonly string[] = [
  'plano aberto / visão geral do ambiente — câmera mais afastada, mostrando o espaço por inteiro',
  'plano médio com a câmera deslocada para o lado — outro ponto de vista do mesmo espaço, ângulo lateral',
  'close-up / plano de detalhe — aproxime de um elemento específico do ambiente (uma parede, prateleira, bancada, equipamento ou decoração), mantendo pistas do entorno reconhecíveis',
  'ângulo de câmera mais baixo ou mais alto — ponto de vista vertical diferente do mesmo espaço',
  'enquadramento diagonal / outro canto do ambiente — plano médio-fechado, recorte diferente do mesmo local',
];

function buildAnchorPrefix(refs: PostUnicoReferences, mood: MoodCode, kitColors?: { primary: string; accent: string }, cardCarrossel?: number): string {
  // Ordem dos prefixos espelha a ordem em que as imagens são enviadas
  // (avatar → cenário → produtos), pra que a numeração "imagem #1/#2/#3"
  // case com a posição em image_urls no servidor.
  const lines: string[] = [];
  let idx = 1;
  if (refs.avatar) {
    const clothingHint = kitColors
      ? (() => {
          const pool = buildClothingPool(kitColors.primary, kitColors.accent);
          return ` COR DO VESTUÁRIO: ${pool[Math.floor(Math.random() * pool.length)]}`;
        })()
      : '';
    lines.push(
      `IMAGEM #${idx} = AVATAR (referência de IDENTIDADE, não de figurino). PRESERVE EXATAMENTE: rosto, traços faciais, idade, cabelo, barba, tom de pele, etnia, sexo, biótipo/estatura/porte físico, óculos e acessórios fixos do rosto. NÃO rejuvenesça, NÃO envelheça, NÃO troque etnia, NÃO mude o gênero, NÃO altere o porte físico. IGNORE a roupa, a cor da roupa, a pose exata e os acessórios de vestuário (relógio, anéis, colares) da foto — eles servem só pra mostrar a pessoa, não o figurino. Vista o avatar com roupa NOVA, coerente com a cena e o contexto da empresa descritos abaixo (pode ser polo, camisa social, jaleco, uniforme, regata de treino, moletom, terno — escolha o que faz sentido para a situação e o ambiente).${clothingHint}`,
    );
    idx++;
  }
  if (refs.cenario) {
    const reilumina = MOODS_CLAROS.has(mood);
    const fachadaClause = `se for FACHADA ou FRENTE DE ESTABELECIMENTO, preserve a arquitetura, letreiros e identidade visual do local — a fachada deve ser reconhecível na imagem final, com personagem ou produto posicionado à frente ou com a fachada claramente visível ao fundo. Se houver fios elétricos, postes, cabos aéreos, lixo ou poluição visual cruzando a fachada, é PERMITIDO retocar/remover esses elementos da composição final — desde que a arquitetura, os letreiros e a identidade visual do local continuem plenamente reconhecíveis. Se o céu aparecer na cena, é PERMITIDO substituí-lo por um céu mais bonito e coerente com o mood e o horário do dia (ex.: azul limpo, entardecer dourado, nublado suave) — sem look artificial ou composição com aparência de colagem`;
    // Carrossel reaproveita o MESMO cenário em todos os cards — sem variar o
    // enquadramento, os 5 fundos saem quase idênticos. Aqui trocamos a regra
    // fixa "NÃO mude o ângulo" por uma instrução de enquadramento específica
    // para este card (determinística pelo índice), preservando o mesmo espaço.
    const variaEnquadramento = cardCarrossel != null;
    // "ponto de vista da câmera" só entra na lista de preservação quando NÃO
    // estamos variando o enquadramento — caso contrário a frase contradiria
    // a liberação de ângulo/distância dada pelo framingClause abaixo.
    const ambienteInternoClause = variaEnquadramento
      ? 'preserve sala, móveis, equipamentos e paredes'
      : 'preserve sala, móveis, equipamentos, paredes e ponto de vista da câmera';
    const framingClause = variaEnquadramento
      ? `Pode variar o ÂNGULO e a DISTÂNCIA DA CÂMERA — mas continue sendo claramente reconhecível como o MESMO AMBIENTE, com a mesma arquitetura, móveis/objetos e identidade visual. ENQUADRAMENTO DESTE CARD: ${CENARIO_FRAMING_POOL[(cardCarrossel! - 1) % CENARIO_FRAMING_POOL.length]}.`
      : `NÃO invente outro local, NÃO troque os objetos, NÃO mude o ângulo.`;
    lines.push(
      reilumina
        ? `IMAGEM #${idx} = CENÁRIO OBRIGATÓRIO. Use EXATAMENTE este espaço: ${fachadaClause}; se for AMBIENTE INTERNO, ${ambienteInternoClause}. NÃO invente outro local, NÃO troque os objetos. ${framingClause} A ILUMINAÇÃO DEVE SER REINTERPRETADA conforme o ESTILO VISUAL do mood descrito abaixo: clarear o ambiente, equilibrar luz natural, suavizar sombras profundas — preserve a arquitetura e os objetos do ambiente, mas adapte a luz para casar com o mood claro.`
        : `IMAGEM #${idx} = CENÁRIO OBRIGATÓRIO. Use EXATAMENTE este espaço: ${fachadaClause}; se for AMBIENTE INTERNO, ${ambienteInternoClause}${variaEnquadramento ? '' : ', mesma iluminação'}. NÃO invente outro local, NÃO troque os objetos. ${framingClause} Apenas adicione/adapte o personagem e a ação descritos abaixo dentro deste espaço real.`,
    );
    idx++;
  }
  if (refs.produtos?.length) {
    const n = refs.produtos.length;
    lines.push(
      `IMAGEM${n > 1 ? 'NS' : ''} #${idx}${n > 1 ? `..#${idx + n - 1}` : ''} = PRODUTO${n > 1 ? 'S' : ''} OBRIGATÓRIO${n > 1 ? 'S' : ''}. Use EXATAMENTE este produto, com mesmo formato, mesma cor, mesmo rótulo e mesma embalagem. Não invente outra versão, não troque a marca, não altere o design.`,
    );
    if (n >= 2) {
      lines.push(
        `REGRA DE CONTAGEM — INEGOCIÁVEL: a imagem final DEVE conter EXATAMENTE ${n} produto${n > 1 ? 's' : ''} visíveis e identificáveis, todos enviados como referência. PROIBIDO omitir, esconder atrás de objetos, cortar fora do quadro ou substituir qualquer um deles. Se o plano aberto não acomodar os ${n}, APROXIME o enquadramento (close-up de produto, detalhe do pé com o tênis, bancada/prateleira com os ${n} itens lado a lado, flat-lay) em vez de mostrar um cenário amplo com apenas parte dos produtos. Conte os produtos na composição final: o número deve ser ${n}.`,
      );
    }
  }
  if (!lines.length) return '';
  return `${lines.join('\n')}\n\n`;
}

export async function regenerateWithKit(
  input: RegenerateInput,
): Promise<string> {
  const {
    slot, imageKit, kit, mood, keyInfo,
    titulo, texto,
    imagePrompt, leituraCenica,
    produtosSelecionados, cenarioSelecionado, selecaoDireta, formato,
  } = input;

  const references = buildReferences(slot.elemento, imageKit, produtosSelecionados, cenarioSelecionado, selecaoDireta);
  const referenceImages = refsToArray(references);
  const anchorPrefix = buildAnchorPrefix(references, mood, {
    primary: kit.primaryColor || '#123a63',
    accent: kit.accentColor || kit.secondaryColor || '#f4b000',
  }, slot.formato === 'carrossel' ? slot.cardCarrossel : undefined);

  const inferred: 'post' | 'reels' = slot.formato === 'reels' ? 'reels' : 'post';
  const targetFormato = formato ?? inferred;
  const isReels = targetFormato === 'reels';
  const isFinal = slot.formato === 'estatico_final';

  const baseScene = (imagePrompt || keyInfo || '').slice(0, 600);
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
      titulo: '',
      texto: '',
      companyName: kit.companyName,
      primaryColor: kit.primaryColor,
      accentColor: kit.accentColor || kit.secondaryColor || '#f4b000',
      fontFamily: kit.fontPair || 'Montserrat',
      mood,
      vertical: 'reels',
      // Sem logoDataUrl: a logo é aplicada por canvas (composeReelsPng).
      referenceImages: referenceImages.length ? referenceImages : undefined,
    });
  }

  // Estático Final: imagem-base limpa, logo aplicada por canvas (composeFinalPng).
  if (isFinal) {
    return generatePostImage({
      imagePrompt: baseScene,
      referenceAnchor,
      titulo: titulo || '',
      texto: texto || '',
      companyName: kit.companyName,
      primaryColor: kit.primaryColor,
      accentColor: kit.accentColor || kit.secondaryColor || '#f4b000',
      fontFamily: kit.fontPair || 'Montserrat',
      mood,
      vertical: 'estatico_final',
      logoPosition: kit.logoPosition,
      leituraCenica,
      referenceImages: referenceImages.length ? referenceImages : undefined,
    });
  }

  // Estático / Carrossel: paridade com o fluxo normal — o motor queima
  // título e texto no mesmo estilo do mood, usando as referências do Kit
  // Imagem (cenário/avatar/produto) como ancoragem visual. O caller aplica
  // apenas a logo via composeFeedPng.
  return generatePostImage({
    imagePrompt: baseScene,
    referenceAnchor,
    titulo: titulo || '',
    texto: texto || '',
    companyName: kit.companyName,
    primaryColor: kit.primaryColor,
    accentColor: kit.accentColor || kit.secondaryColor || '#f4b000',
    fontFamily: kit.fontPair || 'Montserrat',
    mood,
    vertical: 'post',
    logoPosition: kit.logoPosition,
    leituraCenica,
    referenceImages: referenceImages.length ? referenceImages : undefined,
  });
}

