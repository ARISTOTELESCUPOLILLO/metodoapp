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

function buildAnchorPrefix(refs: PostUnicoReferences, mood: MoodCode): string {
  // Ordem dos prefixos espelha a ordem em que as imagens são enviadas
  // (avatar → cenário → produtos), pra que a numeração "imagem #1/#2/#3"
  // case com a posição em image_urls no servidor.
  const lines: string[] = [];
  let idx = 1;
  if (refs.avatar) {
    lines.push(
      `IMAGEM #${idx} = AVATAR (referência de IDENTIDADE, não de figurino). PRESERVE EXATAMENTE: rosto, traços faciais, idade, cabelo, barba, tom de pele, etnia, sexo, biótipo/estatura/porte físico, óculos e acessórios fixos do rosto. NÃO rejuvenesça, NÃO envelheça, NÃO troque etnia, NÃO mude o gênero, NÃO altere o porte físico. IGNORE a roupa, a cor da roupa, a pose exata e os acessórios de vestuário (relógio, anéis, colares) da foto — eles servem só pra mostrar a pessoa, não o figurino. Vista o avatar com roupa NOVA, coerente com a cena e o contexto da empresa descritos abaixo (pode ser polo, camisa social, jaleco, uniforme, regata de treino, moletom, terno — escolha o que faz sentido para a situação e o ambiente).`,
    );
    idx++;
  }
  if (refs.cenario) {
    const reilumina = MOODS_CLAROS.has(mood);
    lines.push(
      reilumina
        ? `IMAGEM #${idx} = CENÁRIO OBRIGATÓRIO. Use EXATAMENTE este ambiente: mesma sala, mesmos móveis/equipamentos visíveis, mesma parede, mesmo ponto de vista da câmera. NÃO invente um novo ambiente, NÃO troque os objetos, NÃO mude o ângulo. A ILUMINAÇÃO DEVE SER REINTERPRETADA conforme o ESTILO VISUAL do mood descrito abaixo: clarear o ambiente, equilibrar luz natural, suavizar sombras profundas — preserve a arquitetura e os objetos do ambiente, mas adapte a luz para casar com o mood claro.`
        : `IMAGEM #${idx} = CENÁRIO OBRIGATÓRIO. Use EXATAMENTE este ambiente: mesma sala, mesmos móveis/equipamentos visíveis, mesma parede, mesma iluminação, mesmo ponto de vista da câmera. NÃO invente um novo ambiente, NÃO troque os objetos, NÃO mude o ângulo. Apenas adicione/adapte o personagem e a ação descritos abaixo dentro deste ambiente real.`,
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
  const anchorPrefix = buildAnchorPrefix(references, mood);

  const inferred: 'post' | 'reels' = slot.formato === 'reels' ? 'reels' : 'post';
  const targetFormato = formato ?? inferred;
  const isReels = targetFormato === 'reels';
  const isFinal = slot.formato === 'estatico_final';

  const baseScene = (imagePrompt || keyInfo || '').slice(0, 600);
  const deviceRule =
    '⚠ REGRA ABSOLUTA — DISPOSITIVOS DIGITAIS:\n' +
    'PROIBIDO renderizar conteúdo de tela (dashboard, app, interface, gráfico, ícone, qualquer display) sobre a TAMPA TRASEIRA ou CARCAÇA de qualquer equipamento — notebook, laptop, tablet, iPad, celular, computador ou monitor. A carcaça traseira é superfície SÓLIDA, OPACA, lisa e na cor do equipamento: não tem tela, não emite luz, não exibe conteúdo.\n' +
    'CORRETO: tela FRONTAL com conteúdo real visível; carcaça traseira como superfície neutra, lisa e na cor do equipamento.\n\n';
  const anchoredPrompt = (anchorPrefix + deviceRule + baseScene).slice(0, 1800);

  if (isReels) {
    return generatePostImage({
      imagePrompt: anchoredPrompt,
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
      imagePrompt: anchoredPrompt,
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
    imagePrompt: anchoredPrompt,
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

