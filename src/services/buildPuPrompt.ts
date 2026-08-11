// Montagem do prompt de imagem do Post Único — extraído de postUnico.ts (Fase 8).

import { BRAND_ACCENT } from "@/data/brandColors";
import { BrandKit, LogoPosition, MoodCode, PostUnicoDirecao, PostUnicoFormData } from "../types";
import {
  buildMoodGrammarBlock,
  pickImageVariationBlock,
  buildSceneRoleRule,
  variationHasFaceNotDominant,
  PersonagemGender,
} from "../core/visualDirection";
import {
  buildDeviceRule,
  isNonDigitalActivity,
  AMBIENTES_RULE,
  HUMANIZACAO_RULE,
  FORBIDDEN_MOOD_WORDS,
  CONCEITO_FIRST_RULE,
} from "../utils/promptRules";
import { mapFaixaToAnchorAge } from "../core/audienceAge";
import {
  buildTypographyBlock,
  buildTypographyShortRule,
  buildScriptAccentBlock,
} from "../utils/typography";
import type { PostUnicoReferences } from "../shared/visual/references";
import type { PostUnicoCopy } from "./postUnico";
import { referencesBlock } from "./puReferencesBlock";
import {
  OBJETIVO_LABEL,
  OBJETIVO_TONE,
  MOOD_NAMES,
  OBJETIVO_SENSACAO,
  OBJETIVO_ORIENTACAO,
  OBJETIVO_VISUAL_EXCLUSIONS,
  LIVRE_TOTAL_ARCHETYPES,
  OBJETIVO_ARCHETYPES,
  OBJETIVO_PALETAS,
  OBJETIVO_TONALIDADES_ROTACAO,
  LIVRE_TONALIDADES,
  AVATAR_ROLE_BY_SEGMENT_OBJETIVO,
} from "./objetivoConfig";
import { pickTonalidade, pickRotating } from "../core/colorRotation";
import { countTituloWords } from "../core/textWordUtils";
import {
  buildSemPersonagemBlock,
  buildSemPersonagemVariationBlock,
  SEM_PERSONAGEM_REFORCO_FINAL,
} from "../core/semPersonagem";
import {
  buildLookVariationBlock,
  buildCatalogoSemTextoBlock,
  CATALOGO_REFORCO_FINAL,
} from "../core/lookBook";

function direcaoBlock(
  direcao: PostUnicoDirecao,
  mood?: MoodCode,
  objetivo?: PostUnicoFormData["objetivo"],
  hasProdutos?: boolean,
  noDeviceThisScene?: boolean,
  tonalidadeSeed?: number,
  accentHex?: string,
  produtoHero?: boolean,
  lookBook?: boolean,
): string {
  if (direcao === "mood" && mood) {
    return `DIREÇÃO (mood ${mood} ${MOOD_NAMES[mood]}):\n${buildMoodGrammarBlock(mood, { noDeviceThisScene, tonalidadeSeed, accentHex, produtoHero, lookBook })}\n\nIMPORTANTE: esta peça é mood ${MOOD_NAMES[mood]} — NÃO use estética dos outros moods. Respeite rigorosamente a paleta, luz e composição descritas acima.\n\nPROIBIDO: aparência de Canva/template/panfleto, faixa/barra/painel de cor sólida na base ou no topo da composição (mesmo decorativa, mesmo antes de aplicar a logo), gradient banal, ícones flat, estética de stock genérico. O fundo é contínuo de borda a borda — NÃO divida a peça em blocos, faixas ou painéis de cor.`;
  }
  const obj = objetivo ?? "nenhum";

  // Quando há produtos referenciados (Kit Imagem / MIX), eles já são o "conceito"
  // da geração — sortear um arquétipo adicional (ex.: RELÓGIO/TEMPO) cria um
  // segundo elemento-herói que disputa protagonismo e espaço com o produto real,
  // degradando sua geometria. Por isso o sorteio é substituído por esta nota.
  const PRODUTOS_CONCEITO_NOTE =
    "\n\nPRODUTOS REFERENCIADOS SÃO O CONCEITO DESTA GERAÇÃO: não introduza objeto-conceito adicional (relógio, ampulheta, ferramenta simbólica isolada, elemento gráfico abstrato, etc.) que possa competir em protagonismo ou espaço com os produtos reais — a personalidade da peça vem de como os produtos são compostos na cena, com o PAPEL DA EMPRESA e a ATIVIDADE REAL como contexto.";

  // Livre + Nenhum é a combinação mais aberta do sistema (sem mood, sem objetivo).
  // Tratada à parte: os mapas OBJETIVO_* pressupõem conexão obrigatória com o negócio,
  // o que contradiz e neutraliza a "liberdade total" — daí a falta de ousadia observada.
  if (obj === "nenhum") {
    // Rodízio determinístico em vez de sorteio: com pool de 5 e Math.random(),
    // o mesmo conceito repetia em gerações seguidas com frequência alta — no
    // mesmo arquivo em que a PALETA já rodava por seed e nunca repetia. Passo 2
    // (co-primo com 5) para não andar sincronizado com a tonalidade, que usa o
    // mesmo seed com passo 1.
    const archetypeHint = hasProdutos
      ? PRODUTOS_CONCEITO_NOTE
      : `\n\n${pickRotating(LIVRE_TOTAL_ARCHETYPES, tonalidadeSeed ?? 0, 2)}`;
    return `DIREÇÃO LIVRE — SEM TEMA OU OBJETIVO PRÉ-DEFINIDO: a IA tem liberdade total e real de direção de arte — não há mood, não há objetivo, não há obrigação de literalidade com o negócio.${archetypeHint}\n\nVarie ATIVAMENTE entre abordagens possíveis: luz natural OU dramática, paleta fria OU quente, fundo claro OU escuro, composição calma OU energética, predominantemente fotográfica OU gráfica OU conceitual. Escolha uma direção com personalidade própria, ouse e vá fundo nela — o critério é qualidade editorial e impacto visual, não utilidade comercial. Resultado: arte publicitária brasileira contemporânea de alto nível editorial. PROIBIDO: aparência de Canva/template/panfleto, gradient banal, ícones flat, estética de stock genérico, fórmula default "fundo escuro + luz dourada dramática" (essa é apenas UMA das opções, não a padrão).`;
  }

  const sensacao = OBJETIVO_SENSACAO[obj];
  const orientacao = OBJETIVO_ORIENTACAO[obj];
  const exclusion = OBJETIVO_VISUAL_EXCLUSIONS[obj];
  // Sorteia arquétipo visual para forçar diversidade entre gerações sequenciais
  // — substituído pela nota de protagonismo dos produtos quando há MIX (acima).
  const archetypes = OBJETIVO_ARCHETYPES[obj];
  const archetypeHint = hasProdutos
    ? PRODUTOS_CONCEITO_NOTE
    : archetypes && archetypes.length
      ? `\n\n${pickRotating(archetypes, tonalidadeSeed ?? 0, 2)}`
      : "";
  const derivacaoBlock = hasProdutos
    ? ""
    : "\n\nDERIVAÇÃO OBRIGATÓRIA: o objeto, gesto ou elemento visual do arquétipo acima é sempre derivado da ATIVIDADE REAL da empresa e do PAPEL DA EMPRESA neste prompt — nunca de uma lista padrão. A estrutura visual (enquadramento, câmera, nível de abstração) é do arquétipo; o conteúdo é do ofício real.";
  return `DIREÇÃO LIVRE — SENSAÇÃO DESEJADA: ${sensacao}.\nOrientação: ${orientacao}\n\n${exclusion}${archetypeHint}${derivacaoBlock}\n\nA IA tem liberdade de direção de arte dentro do objetivo informado. Varie ATIVAMENTE entre abordagens visuais possíveis: pode ser luz natural suave OU dramática, paleta fria OU quente, fundo claro OU escuro, composição calma OU energética, predominantemente fotográfica OU gráfica OU mista. Escolha uma direção com personalidade própria e vá fundo nela. Resultado: arte publicitária brasileira contemporânea de alto nível editorial. PROIBIDO: aparência de Canva/template/panfleto, gradient banal, ícones flat, estética de stock genérico, fórmula default "fundo escuro + luz dourada dramática" (essa é apenas UMA das opções, não a padrão).`;
}

// Núcleo direcional de posição de TÍTULO por mood no PU — espelha as identidades
// do MOP (services/api/moodVisualInstructions.ts). Retorna undefined para os moods
// de posição LIVRE (INSTANTE/FRAGMENTO) e para SILÊNCIO (tratado à parte nos call
// sites, com a reserva da metade direita + LOGO_RESPIRO_CLAUSE). Só CLAREZA/IMPACTO/
// DESVIO recebem âncora fixa. É tipografia (overlay 2D), não composição da cena (3D).
function moodTitleAnchor(mood: MoodCode | undefined): string | undefined {
  switch (mood) {
    case "OP-01": // CLAREZA
      return "alinhado à ESQUERDA do quadro (alinhamento ortogonal), com respiro nas bordas";
    case "OP-02": // IMPACTO
      return "CENTRALIZADO horizontalmente no TERÇO SUPERIOR do quadro — centralize apenas o TEXTO; a cena e o sujeito permanecem assimétricos abaixo ou ao redor, ocupando os vazios escuros (não centralize a composição inteira)";
    case "OP-05": // DESVIO
      return "DESLOCADO e assimétrico, fora do centro, quebrando o equilíbrio esperado — sem cobrir o sujeito principal, que permanece nítido";
    default: // OP-03 INSTANTE, OP-04 FRAGMENTO, indefinido → posição livre
      return undefined;
  }
}

function logoZoneDescription(
  position: LogoPosition | undefined,
  opts?: { compactTopBand?: boolean },
): {
  reservaTopo: string;
  regraFinal: string;
} {
  const pos = position || "bottom-right";
  // GEOMETRIA REAL DA LOGO (canvasComposer.ts): canvas 1080x1350, PAD = 110,
  // LOGO_MAX_W = 288, LOGO_MAX_H = 108 → em bottom-right a logo ocupa
  // x 682..970 (63%..90% da largura) e y 1132..1240 (84%..92% da altura).
  // Achado real (03/08/2026): a reserva antiga ("~18% × ~10%") descrevia um
  // retângulo de 196x136 px COLADO na borda (x 884..1080, y 1214..1350) — quase
  // disjunto da caixa que a logo de fato ocupa. A IA obedecia a reserva ao pé da
  // letra e mesmo assim o carimbo da logo caía em cima da última linha de texto.
  // A reserva agora descreve a caixa real MAIS respiro, e diz explicitamente que
  // a zona NÃO está colada na borda — era essa a informação que faltava.
  // Pode haver fundo, textura, fotografia ou cor de marca atrás; só evitamos
  // texto, rosto, objeto-foco e lettering dentro da zona, mantendo contraste
  // local suficiente para a marca ser legível.
  // Achado real (04/08/2026): mesmo com a caixa real declarada e uma "TRAVA DE
  // LINHA" numérica ("nenhuma linha abaixo de 80% da altura"), o modelo desceu o
  // texto de apoio até 92% e a logo caiu em cima (PU Barbosa Lubrificantes,
  // logo bottom-right, gerada 04/08 já com o fix de 03/08 em produção). Proibir
  // o FIM do bloco não funciona — o que funciona é fixar o COMEÇO dele no alto
  // (ver blocoTopAnchorClause). A reserva, aqui, volta a dizer só o essencial:
  // área entregue vazia, sem texto, sem traço, sem forma, sem logo desenhada.
  const base =
    "Área reservada — canto inferior direito: começa a 60% da LARGURA e a 80% da ALTURA do canvas e vai até as bordas direita e inferior. A logomarca é aplicada DEPOIS, por composição, FORA da IA, e fica no MIOLO dessa área (recuada 110 px das bordas, não na beirada) — entregue a área INTEIRA vazia e limpa, como continuação natural da cena (fundo, textura, céu, parede). PROIBIDO ali: qualquer texto, lettering, número ou hashtag; rosto, mão, objeto-foco ou produto; e qualquer traço, linha, forma geométrica, moldura, caixa, painel, badge, bloco de cor sólida, círculo, elipse, anel, halo, pontilhado, ornamento, rabisco ou swoosh — dentro da zona e na área imediatamente adjacente a ela. PROIBIDO desenhar, imitar ou reproduzir qualquer logomarca, emblema, monograma ou o nome da empresa — mesmo que a marca apareça em imagem de referência. Esta regra VENCE o 'detalhe criativo' do mood. Apenas garanta contraste local suficiente para a logo ser legível. NEGATIVE: solid color block behind logo area, colored badge, colored panel, banner shape.";
  // Para logo centralizada (topo/base), o ponto da logo fica no MEIO de uma linha
  // que normalmente atravessa o canvas de ponta a ponta. Um "retângulo pequeno"
  // não basta: título/texto de apoio que ocupem essa linha colidem com a logo no
  // centro. Por isso a zona aqui é uma FAIXA HORIZONTAL COMPLETA — nenhuma linha
  // de texto pode cruzá-la, mesmo parcialmente.
  // GEOMETRIA REAL DA FAIXA (canvasComposer.ts): canvas 1080x1350, PAD = 110,
  // LOGO_MAX_H = 108 → top-center ocupa y 110..218 (8%..16,1% da altura) e
  // bottom-center ocupa y 1132..1240 (83,9%..91,9%). Em reels (1080x1920,
  // PAD 150, LOGO_MAX_H 132): 7,8%..14,7% no topo, 85,3%..92,2% na base.
  // Achado real (03/08/2026): as alturas antigas (~14% padrão, ~10% comprimida)
  // eram MENORES que a caixa da logo nos dois casos — a faixa do topo acabava
  // antes da logo terminar, e a da base começava 57 px DEPOIS de a logo começar.
  // Faixa de 20% cobre a logo com ~52 px de respiro nos dois formatos; a versão
  // comprimida do IMPACTO desce a 18% (limite geométrico, não menos que isso).
  const bandCompact = !!opts?.compactTopBand && pos === "top-center";
  const alturaFaixa = bandCompact ? "~18%" : "~20%";
  // A FAIXA precisa dizer, como a variante do canto (base), que a logo vem DEPOIS
  // e de fora da IA. Sem essa frase, "garanta contraste para a logo ser legível
  // dentro da faixa" lê como ordem de DESENHAR a logo ali — foi o que aconteceu
  // em 27/07/2026 (PU, mood SILÊNCIO, logo BASE CENTRAL): a IA reproduziu a
  // logomarca oficial dentro da imagem e o app aplicou a real por cima,
  // resultando em duas logos empilhadas.
  const faixa = `A logo ocupa uma FAIXA HORIZONTAL COMPLETA (de borda a borda do canvas), com ${alturaFaixa} da altura, medidos a partir da borda (superior ou inferior, conforme o ponto da logo). A logomarca é aplicada DEPOIS, por composição, FORA da IA, e fica no MIOLO da faixa (recuada da borda, não encostada nela) — entregue a faixa INTEIRA vazia e limpa, como continuação natural da cena (fundo, textura, céu, parede). PROIBIDO cruzar essa faixa, mesmo parcialmente, mesmo com uma única palavra ou linha: texto, título, lettering, hashtag, número, rosto, mão, objeto-foco ou produto — TÍTULO e TEXTO DE APOIO (todas as linhas) terminam ANTES dela ou começam DEPOIS dela, nunca divididos ao redor. PROIBIDO também qualquer traço, linha, forma geométrica, moldura, caixa, painel, badge, bloco ou barra de cor sólida, círculo, elipse, anel, halo, pontilhado, ornamento, rabisco ou swoosh — dentro da faixa e na área imediatamente adjacente a ela. PROIBIDO desenhar, imitar ou reproduzir qualquer logomarca, emblema, monograma ou o nome da empresa ali — mesmo que a marca apareça em imagem de referência. Esta regra VENCE o "detalhe criativo" do mood: se o mood pedir um traço autoral, ele fica em outra região do quadro. Apenas garanta contraste local suficiente para a logo ser legível dentro da faixa. NEGATIVE: solid color bar, bottom banner stripe, top banner stripe, flat color footer band, colored panel behind logo, navy or brand-color block at canvas edge.`;
  if (pos === "top-center") {
    return {
      reservaTopo: `Ponto da logo: TOPO CENTRAL. ${faixa}`,
      regraFinal:
        "Faixa superior é continuação natural da cena — SEM barra, painel ou bloco de cor sólida, livre de texto, logo central legível, sem dead space.",
    };
  }
  if (pos === "bottom-center") {
    return {
      reservaTopo: `Ponto da logo: BASE CENTRAL. ${faixa}`,
      regraFinal:
        "Faixa inferior é continuação natural da cena — SEM barra, painel ou bloco de cor sólida, livre de texto, logo central legível, sem dead space.",
    };
  }
  return {
    reservaTopo: `Ponto da logo: CANTO INFERIOR DIREITO. ${base}`,
    regraFinal:
      "Canto inferior direito é continuação natural da cena — SEM badge, painel ou bloco de cor sólida atrás da logo, legível, sem dead space.",
  };
}

// Âncora vertical do bloco de texto — a regra que de fato abre espaço para a
// logomarca (achado real de 04/08/2026, ver comentário em logoZoneDescription).
//
// Duas tentativas anteriores travaram o FIM do bloco ("última linha acima de 80%
// da altura") e as duas falharam: o modelo compõe de cima para baixo e trata o
// limite inferior como sugestão. Aqui a trava passa para o COMEÇO — o topo da
// primeira linha do título tem posição declarada, e como o texto de apoio (ou os
// tópicos) vem logo abaixo do título, o bloco inteiro termina naturalmente bem
// acima da zona da logo. É a mesma lógica de diagramação de anúncio: define-se
// onde a manchete começa, não onde o rodapé não pode chegar.
//
// GEOMETRIA (canvasComposer.ts): o recuo de segurança das bordas é de 110 px num
// canvas 1080x1350 (8,1% da altura) — a âncora começa logo abaixo dele. Com a
// logo em top-center a faixa reservada come os 20% superiores, então a âncora
// desce para depois dela.
function blocoTopAnchorClause(position: LogoPosition | undefined): string {
  const logoNoTopo = (position || "bottom-right") === "top-center";
  const faixaAncora = logoNoTopo ? "entre 24% e 30%" : "entre 10% e 16%";
  const motivo = logoNoTopo
    ? "a faixa da logomarca ocupa os 20% superiores do canvas — o bloco começa abaixo dela"
    : "logo abaixo do recuo de segurança de 8% da borda superior";
  const folga = logoNoTopo
    ? "A parte de baixo do quadro permanece livre para a cena."
    : "O espaço que sobra na parte de baixo é o espaço da LOGOMARCA, aplicada depois — é ele que não pode ser ocupado.";
  return ` ÂNCORA VERTICAL — O BLOCO COMEÇA PELO ALTO: o topo da primeira linha do título fica ${faixaAncora} da altura do canvas (${motivo}), e o bloco INTEIRO cresce PARA BAIXO a partir dali — título em cima, texto de apoio (ou tópicos) imediatamente abaixo dele, nessa ordem. ${folga} PROIBIDO centralizar o bloco verticalmente, ancorá-lo na base ou empurrá-lo para a metade inferior do quadro. Se o bloco não couber, reduza o corpo do texto — nunca desça a âncora.`;
}

function buildColorBlock(
  primary: string,
  accent: string,
  isMood: boolean,
  objetivo?: PostUnicoFormData["objetivo"],
  tonalidadeSeed?: number,
): string {
  if (isMood) {
    return `Referência cromática da marca (subordinada ao mood): primária ${primary}, apoio ${accent}.`;
  }

  const obj = objetivo ?? "nenhum";

  // Livre + Nenhum: antes a cor era 100% delegada ao modelo ("escolha livre"),
  // o que na prática convergia sempre nos mesmos atratores cromáticos do
  // gpt-image-2 para o mesmo briefing (verde na 1ª geração, azul na regen —
  // ver core/colorRotation.ts). Agora um rodízio determinístico de 5
  // tonalidades (seed fixado por sessão em usePostUnicoGeneration.ts) decide a
  // paleta, com observador que pula a tonalidade se ela conflitar em matiz com
  // a cor de acento da marca (aplicada em 1 palavra do título).
  if (obj === "nenhum") {
    const tonalidade = pickTonalidade(LIVRE_TONALIDADES, tonalidadeSeed ?? 0, accent);
    return `${tonalidade.bloco}
Dentro desta paleta, a IA tem liberdade para variar luz, saturação exata e textura — mas a combinação cromática de base é esta, não uma escolha nova a cada geração.
Referência cromática da marca (use apenas se houver harmonia natural com a paleta escolhida): primária ${primary}, apoio ${accent}.
COR DO LETTERING: escolha livremente a cor que garanta a melhor leitura visual sobre o fundo desta paleta — branco, preto, tom claro ou escuro conforme o contraste necessário. Legibilidade e destaque visual são prioritários.`;
  }

  // institucional/promocao/oportunidade/aviso/homenagem: mesma convergência de
  // cor relatada no caso "nenhum" (sorteio Math.random() puro, sem seed, sem
  // observador) — migrados para o rodízio determinístico com anti-conflito de
  // acento. fatos/venda ficam de fora: são objetivos de fidelidade à foto
  // real (Kit Imagem), sem escolha de cor de fato a rotacionar.
  if (
    obj === "institucional" ||
    obj === "promocao" ||
    obj === "oportunidade" ||
    obj === "aviso" ||
    obj === "homenagem"
  ) {
    const tonalidade = pickTonalidade(
      OBJETIVO_TONALIDADES_ROTACAO[obj],
      tonalidadeSeed ?? 0,
      accent,
    );
    return `${tonalidade.bloco}
As cores são definidas pela intenção emocional da peça, não pelas cores institucionais como base da composição. Referência cromática da marca (use apenas se houver harmonia natural): primária ${primary}, apoio ${accent}.
COR DO LETTERING: escolha livremente a cor que garanta a melhor leitura visual sobre o fundo desta paleta — branco, preto, tom claro ou escuro conforme o contraste necessário. Legibilidade e destaque visual são prioritários.`;
  }

  const pool = OBJETIVO_PALETAS[obj];
  const palette = pool[Math.floor(Math.random() * pool.length)];

  return `${palette}
As cores são definidas pela intenção emocional da peça, não pelas cores institucionais como base da composição. Referência cromática da marca (use apenas se houver harmonia natural): primária ${primary}, apoio ${accent}.
COR DO LETTERING: escolha livremente a cor que garanta a melhor leitura visual sobre o fundo desta paleta — branco, preto, tom claro ou escuro conforme o contraste necessário. Legibilidade e destaque visual são prioritários.`;
}

function avatarRoleBlock(
  segment?: string,
  objetivo?: PostUnicoFormData["objetivo"],
  hasAvatar?: boolean,
  isPersonalBrand?: boolean,
): string {
  if (!hasAvatar || !segment || !objetivo) return "";
  const key =
    segment === "MARCA" && isPersonalBrand
      ? `${segment}:${objetivo}:pessoal`
      : `${segment}:${objetivo}`;
  return (
    AVATAR_ROLE_BY_SEGMENT_OBJETIVO[key] ??
    AVATAR_ROLE_BY_SEGMENT_OBJETIVO[`${segment}:${objetivo}`] ??
    ""
  );
}

export function buildPostUnicoPrompt(params: {
  data: PostUnicoFormData;
  kit: BrandKit;
  copy?: PostUnicoCopy;
  references?: PostUnicoReferences;
  forcedGender?: PersonagemGender;
  /** true quando é "Gerar outra imagem" — força execução visual diferente da anterior. */
  variationHint?: boolean;
  /** Índice-base do rodízio de tonalidade (Direção Livre + Objetivo "nenhum") — ver core/colorRotation.ts. */
  tonalidadeSeed?: number;
}): string {
  const { data, kit, copy, references, forcedGender, variationHint, tonalidadeSeed } = params;
  // Peça sem personagem (ver core/semPersonagem.ts): desliga as instruções que
  // AFIRMAM pessoa (gênero obrigatório, pose sorteada, personagem-padrão da
  // cena) e injeta a regra de precedência máxima + o reforço final.
  const semPersonagem = !!references?.semPersonagemAtivo;
  // Peça de CATÁLOGO (ver core/lookBook.ts): look book sem nenhum texto na
  // imagem. Desliga o bloco de copy, a tipografia e as regras que pressupõem
  // título/texto de apoio no quadro. buildReferences só marca isto junto com
  // produtoVestido, então aqui já vem coerente com o look book.
  const lookCatalogo = !!references?.lookCatalogo;
  const isNenhum = data.objetivo === "nenhum";
  const objetivo = isNenhum ? null : OBJETIVO_LABEL[data.objetivo];
  const tom = isNenhum ? null : OBJETIVO_TONE[data.objetivo];
  // Mesma condição usada por buildDeviceRule (abaixo) para banir TODO
  // dispositivo digital desta peça — repetida aqui pra que a gramática do
  // mood (CLAREZA/FRAGMENTO) saiba que não pode pedir/permitir dispositivo
  // quando essa proibição global já está ativa (ver resolveMoodRuleText).
  const noDeviceThisScene =
    isNonDigitalActivity(data.mainActivity || kit.mainActivity) ||
    (!!references?.produtos?.length &&
      !references?.produtoTelaInformativa &&
      !references?.produtoEhDispositivo);
  // Movido pra antes de direcaoBlock (era calculado só mais abaixo) porque o
  // mood SILÊNCIO agora precisa do accent pra rodízio de tonalidade — ver
  // core/colorRotation.ts. Sem mudança de valor, só de ordem.
  const primary = kit.primaryColor || "#123a63";
  const accent = kit.accentColor || kit.secondaryColor || BRAND_ACCENT;
  // Só VAREJO tem regra de produto-herói (buildProductHierarchyBlock); em
  // SERVIÇOS/MARCA o produto é apoio ou equilíbrio, e a trava de plano médio do
  // CLAREZA não conflita com nada.
  // No look book o enquadramento é ditado pelo tipo da peça (corpo inteiro para
  // vestido/terno/calçado) — a mesma trava de plano médio precisa ceder em
  // qualquer segmento, não só em VAREJO.
  const produtoHero =
    (kit.segment === "VAREJO" && !!references?.produtos?.length) || !!references?.produtoVestido;
  const direcao = direcaoBlock(
    data.direcao,
    data.mood,
    data.objetivo,
    !!references?.produtos?.length,
    noDeviceThisScene,
    tonalidadeSeed,
    accent,
    produtoHero,
    !!references?.produtoVestido,
  );
  // Quando não há personagem de referência (sem avatar e sem checkbox "personagem
  // sem avatar"), a faixaEtaria do form chega ao prompt de imagem como âncora de
  // idade no bloco de variação (Mood) ou como instrução explícita (Direção Livre).
  const semPersonagemRef = !references?.avatar && !references?.personagemSemAvatarAtivo;
  // Sem personagem não há pessoa para ancorar em faixa etária — a âncora de
  // idade é, ela mesma, uma afirmação de que existe alguém na cena.
  const faixaLabelImagem =
    semPersonagemRef && !semPersonagem ? mapFaixaToAnchorAge(data.faixaEtaria) : undefined;
  // pickImageVariationBlock sorteia pose de personagem e declara gênero em
  // todos os moods — substituído pelo bloco de variação sem pessoa.
  //
  // O look book entra como um terceiro ramo, antes do sorteio do mood: a pose e
  // o enquadramento passam a ser os de uma modelo vestindo a peça, decididos
  // pelo TIPO do produto (ver core/lookBook.ts). Vale em qualquer direção,
  // inclusive na Livre — quem marcou o modo já disse o que quer ver, e deixar a
  // Livre sem enquadramento definido devolveria a imprevisibilidade que o modo
  // existe para eliminar.
  const variationBlock = semPersonagem
    ? buildSemPersonagemVariationBlock(data.direcao === "mood" ? data.mood : undefined)
    : references?.produtoVestido
      ? buildLookVariationBlock(references.produtoVestido, lookCatalogo)
      : data.direcao === "mood"
        ? pickImageVariationBlock(
            data.mood,
            !!references?.avatar,
            copy?.titulo,
            copy?.texto,
            forcedGender,
            faixaLabelImagem,
          )
        : "";
  // Rede de segurança de gênero/idade — vale em QUALQUER direção, não só na Livre.
  // A diretiva de gênero vinha por dois ramos mutuamente exclusivos: o bloco de
  // variação do mood (pickImageVariationBlock) e este bloco. Os dois podiam ser
  // pulados ao mesmo tempo, deixando a peça SEM nenhuma linha de gênero e o
  // gpt-image-2 caindo no viés padrão (personagem feminino) mesmo com "Masculino"
  // marcado (bug real). Dois buracos fechados aqui:
  //   1) Direção "mood" com mood NÃO selecionado — pickImageVariationBlock retorna
  //      "" (ver imageVariationPicker.ts: `if (!mood) return ""`), e a condição
  //      antiga `data.direcao !== "mood"` também pulava este bloco.
  //   2) Direção Livre com forcedGender ausente (a antiga condição dependia dele).
  // Agora dispara sempre que o bloco do mood NÃO tiver declarado o gênero e não
  // houver referência de personagem que já o fixe. O teste em variationBlock
  // evita declaração duplicada quando o mood já o incluiu.
  const moodJaDeclarouGenero = variationBlock.includes("GÊNERO OBRIGATÓRIO");
  const genderSafetyBlock =
    !semPersonagem &&
    !moodJaDeclarouGenero &&
    semPersonagemRef &&
    (forcedGender || faixaLabelImagem)
      ? (() => {
          const idadeClause = faixaLabelImagem ? `, aparentando ${faixaLabelImagem}` : "";
          if (!forcedGender) {
            return `\n⚠ PERSONAGEM — FAIXA ETÁRIA OBRIGATÓRIA: a pessoa retratada DEVE aparentar ${faixaLabelImagem}. `;
          }
          const oposto = forcedGender === "mulher" ? "homem" : "mulher";
          return `\n⚠ PERSONAGEM — GÊNERO OBRIGATÓRIO (PRECEDÊNCIA MÁXIMA, sobrepõe qualquer outra descrição de cena, pose ou contexto): a pessoa retratada DEVE ser ${forcedGender}${idadeClause}. PROIBIDO gerar ${oposto} ou personagem de gênero ambíguo/indefinido. `;
        })()
      : "";
  // "Gerar outra imagem": mantém o MESMO título/texto, mas exige uma execução
  // visual claramente diferente da anterior (enquadramento, ângulo, composição,
  // cor de fundo, cena) — evita a peça sair idêntica na regeneração.
  // No catálogo não há título nem texto para manter — repetir a frase padrão
  // reintroduziria, na regeneração, a ideia de que existe texto na peça.
  const regenVariationBlock = variationHint
    ? lookCatalogo
      ? `\n\n♻ NOVA VERSÃO: gere uma execução visual CLARAMENTE DIFERENTE da anterior — mude pose, ângulo de câmera, composição, cenário e paleta de fundo, mantendo a MESMA peça de roupa vestida pela mesma modelo e a peça igualmente sem texto. Não repita a imagem anterior.`
      : `\n\n♻ NOVA VERSÃO: gere uma execução visual CLARAMENTE DIFERENTE da anterior — mude enquadramento, ângulo de câmera, composição, paleta de fundo e cena, mantendo o MESMO título e o MESMO texto de apoio. Não repita a imagem anterior.`
    : "";
  // Detecta se a variação sorteada (CLAREZA "DETALHE CONTEXTUAL", IMPACTO
  // "SUJEITO SEM PERSONAGEM DOMINANTE") já retira o rosto do centro da cena —
  // sem isso, a regra de protagonismo do produto (abaixo) competia com essa
  // variação e o modelo de imagem resolvia o conflito gerando um retrato de
  // rosto em primeiro plano (ver variationHasFaceNotDominant).
  const faceNotDominant = variationHasFaceNotDominant(variationBlock);
  // Declarado aqui (antes era logo abaixo) porque logoZoneDescription agora
  // precisa dele para comprimir a faixa da logo no caso IMPACTO+tópicos+topo.
  const hasTopicos = !!(copy?.topicos && copy.topicos.length);
  const zona = logoZoneDescription(kit.logoPosition, {
    compactTopBand: data.mood === "OP-02" && hasTopicos,
  });

  // No catálogo não há uma única letra na peça: instruir fonte, hierarquia
  // tipográfica ou acento em palavra do título seria afirmar que existe texto,
  // logo depois de proibi-lo. Blocos vazios.
  const typographyBlock = lookCatalogo ? "" : buildTypographyBlock(kit.fontPair);
  const typographyShort = buildTypographyShortRule(kit.fontPair);
  const scriptAccentBlock =
    kit.secondaryFont && !lookCatalogo
      ? `\n${buildScriptAccentBlock(kit.secondaryFont, copy?.titulo || data.keyInfo || "")}\n`
      : "";

  const hasCopy = copy && (copy.titulo || copy.texto || hasTopicos);
  // Tamanho do título escalona pela contagem de palavras — um piso fixo de
  // "35-45%" pra qualquer título (3 palavras ou 6) fazia títulos mais longos
  // (2-3 linhas) ficarem gigantes e dominarem a peça, brigando com produto/
  // personagem. Mesmo critério já usado no branch sem copy fixo (abaixo).
  // countTituloWords (não split cru) trata "R$ 120,00" como 1 palavra —
  // mesma contagem usada pela validação de texto (textValidation.ts) — para
  // não subestimar o degrau de escala do modo AJUSTADO (PU Promoção com
  // oferta concreta, até 9 "palavras" nesse sentido, ver ofertaDetection.ts).
  const tituloWordCount = hasCopy ? countTituloWords(copy.titulo) : 0;
  const tituloSizeClause =
    tituloWordCount >= 7
      ? "ocupando entre 20% e 28% da altura útil do canvas — quebre em 3 linhas curtas para manter legibilidade sem dominar o quadro; se o título incluir um valor monetário, mantenha-o numa linha própria para garantir leitura clara do número"
      : tituloWordCount >= 5
        ? "ocupando entre 28% e 38% da altura útil do canvas — quebre em 2-3 linhas para manter o corpo grande e legível sem dominar o quadro"
        : "ocupando entre 35% e 45% da altura útil do canvas, em 1-2 linhas";
  // Formato alternativo "tópicos com ícone" (só institucional/oportunidade/
  // promocao/venda — ver PostUnicoFormatoTexto): substitui o TEXTO DE APOIO por 3
  // blocos ícone+texto curtos, abaixo do título. O ícone já foi escolhido no
  // passo de copy (generate-pu-copy.ts, vocabulário fechado em
  // topicoValidation.ts) — aqui só reforça que a IA de imagem deve
  // RENDERIZAR os 3 exatamente como vieram, sem inventar/trocar.
  // Mood SILÊNCIO (OP-06) reserva a metade DIREITA do quadro pro título
  // (visualDirection.lexicon.ts, MOOD_RULES["OP-06"]) — a instrução de
  // "posição livre" abaixo contradizia essa reserva quando o formato tinha
  // tópicos, deixando o modelo livre pra ancorar o título no topo/base/
  // esquerda enquanto a regra do mood já empurrava o objeto pra longe da
  // direita (zona que ficava vazia à toa).
  const isSilencioMood = data.direcao === "mood" && data.mood === "OP-06";
  // Achado real (12/07/2026): oferecer "base" como opção vertical sem
  // resguardo de respiro fez o modelo colar o bloco imediatamente acima da
  // zona da logo (que só proíbe SOBREPOSIÇÃO, nunca exigiu distância) e
  // deixar o topo da metade direita vazio — composição desequilibrada.
  // 04/08/2026: a variação vertical acabou. Todo bloco de texto ancora pelo
  // alto (blocoTopAnchorClause) — a liberdade que sobra é horizontal e de
  // estilo. Foi a única forma de a base do quadro chegar limpa à logomarca.
  const TOP_ANCHOR_CLAUSE = blocoTopAnchorClause(kit.logoPosition);
  const topicosPosicaoClause =
    (isSilencioMood
      ? "POSIÇÃO do bloco título+tópicos: ancore na METADE DIREITA do quadro — é a zona reservada para o título no mood SILÊNCIO, nunca à esquerda nem centralizado horizontalmente."
      : moodTitleAnchor(data.mood)
        ? `POSIÇÃO do bloco título+tópicos: ${moodTitleAnchor(data.mood)}.`
        : "POSIÇÃO HORIZONTAL do bloco título+tópicos é livre — explore ancoragens laterais (esquerda, direita, largura cheia).") +
    TOP_ANCHOR_CLAUSE;
  const topicosBlock =
    hasTopicos && copy?.topicos
      ? `TÍTULO E TÓPICOS OBRIGATÓRIOS (use EXATAMENTE estas palavras como tipografia da peça — NÃO invente outros, NÃO traduza, NÃO reescreva):
TÍTULO: "${copy.titulo.toUpperCase()}"
TÓPICOS (exatamente 3 — substituem o texto de apoio corrido nesta peça):
1. ÍCONE: ${copy.topicos[0].icone} · TEXTO: "${copy.topicos[0].texto}"
2. ÍCONE: ${copy.topicos[1].icone} · TEXTO: "${copy.topicos[1].texto}"
3. ÍCONE: ${copy.topicos[2].icone} · TEXTO: "${copy.topicos[2].texto}"

Hierarquia tipográfica: título DOMINANTE em CAIXA ALTA — renderizado em tamanho grande e impactante (pense em outdoor, não em editorial compacto), ${tituloSizeClause}. Abaixo do título, os 3 TÓPICOS aparecem em coluna (ou lado a lado, se a composição pedir): cada tópico é um ÍCONE simples, no estilo line-art/glifo minimalista (mesmo estilo visual e mesma cor nos 3 ícones), posicionado ao lado ou acima do seu texto correspondente. O texto de cada tópico tem corpo entre 40% e 55% do título — claramente legível, mais curto e discreto que um texto de apoio corrido. RENDERIZE EXATAMENTE estes 3 ícones e textos, NESTA ORDEM — PROIBIDO inventar um ícone diferente do indicado, trocar a ordem, fundir os tópicos em um só bloco de texto corrido ou adicionar um 4º tópico. ${topicosPosicaoClause}
ACENTO DE COR NO TÍTULO: aplique a cor de acento da paleta (ou tom vibrante da paleta desta peça) em 1 palavra-chave ou na linha mais impactante do título — o restante fica em branco ou neutro. Este contraste de cor cria hierarquia visual e personalidade. Não obrigatório se a composição já tiver energia cromática suficiente, mas fortemente recomendado.
⚠ TÍTULO FIXO — ANTI-TRADUÇÃO LITERAL: o título acima é texto tipográfico a renderizar. "Conceito do título" = INTENÇÃO EMOCIONAL da mensagem (urgência, decisão, transformação, conquista), NÃO tradução de cada palavra em objeto visual. A CENA nasce do PAPEL DA EMPRESA e da ATIVIDADE REAL — nunca de palavras abstratas do título. A imagem APOIA a mensagem do título sem ILUSTRÁ-LA objeto por objeto.`
      : "";
  // Mesma reserva de direita do mood SILÊNCIO (ver isSilencioMood acima),
  // aplicada aqui ao formato título+texto corrido.
  const textoPosicaoClause =
    (isSilencioMood
      ? "POSIÇÃO do bloco: ancore na METADE DIREITA do quadro — é a zona reservada para o título no mood SILÊNCIO, nunca à esquerda nem centralizado horizontalmente."
      : moodTitleAnchor(data.mood)
        ? `POSIÇÃO do bloco: ${moodTitleAnchor(data.mood)}.`
        : "POSIÇÃO HORIZONTAL do bloco é livre — explore ancoragens laterais (esquerda, direita, largura cheia).") +
    TOP_ANCHOR_CLAUSE;
  // Modo CATÁLOGO (look book sem texto) — o ÚNICO caso do Post Único em que a
  // peça sai sem lettering. Entra como primeiro ramo porque tem de vencer os
  // dois seguintes, inclusive o "texto é SEMPRE obrigatório" do ramo sem copy.
  const copyBlock = lookCatalogo
    ? buildCatalogoSemTextoBlock(kit.logoPosition)
    : hasTopicos
      ? topicosBlock
      : hasCopy
        ? `TÍTULO E TEXTO OBRIGATÓRIOS (use EXATAMENTE estas palavras como tipografia da peça — NÃO invente outros, NÃO traduza, NÃO reescreva):
TÍTULO: "${copy.titulo.toUpperCase()}"
TEXTO DE APOIO: "${copy.texto}"

Hierarquia tipográfica: título DOMINANTE em CAIXA ALTA — renderizado em tamanho grande e impactante (pense em outdoor, não em editorial compacto), ${tituloSizeClause}. Texto de apoio como SUBTÍTULO DE REVISTA com corpo entre 55% e 70% do título — claramente legível a distância normal de celular, nunca tamanho de legenda ou rodapé. ${textoPosicaoClause}
ACENTO DE COR NO TÍTULO: aplique a cor de acento da paleta (ou tom vibrante da paleta desta peça) em 1 palavra-chave ou na linha mais impactante do título — o restante fica em branco ou neutro. Este contraste de cor cria hierarquia visual e personalidade. Não obrigatório se a composição já tiver energia cromática suficiente, mas fortemente recomendado.
⚠ TÍTULO FIXO — ANTI-TRADUÇÃO LITERAL: o título acima é texto tipográfico a renderizar. "Conceito do título" = INTENÇÃO EMOCIONAL da mensagem (urgência, decisão, transformação, conquista), NÃO tradução de cada palavra em objeto visual. A CENA nasce do PAPEL DA EMPRESA e da ATIVIDADE REAL — nunca de palavras abstratas do título. Proibições diretas: "novo"/"novidade" ≠ caderno limpo, página em branco, objeto novo genérico; "ação"/"agir" ≠ seta, figura em movimento, objeto cinético; "rumo"/"caminho"/"direção" ≠ corredor, estrada, passagem, bússola, mapa, GPS, placa de sinalização; "hoje"/"agora" ≠ relógio, ampulheta, pôr do sol; "escolha"/"decisão" ≠ encruzilhada, bifurcação; "novo" ≠ porta se abrindo. A imagem APOIA a mensagem do título sem ILUSTRÁ-LA objeto por objeto.`
        : `TEXTO — CRIADO PELA IA A PARTIR DA INFORMAÇÃO-CHAVE (obrigatório em todas as peças):
A peça DEVE ter lettering — texto é SEMPRE obrigatório na composição visual.
Crie livremente: um TÍTULO curto em CAIXA ALTA (impacto direto, 3 a 6 palavras) + TEXTO DE APOIO breve (1-2 frases), inspirados na informação-chave${data.keyInfo.trim() ? ` "${data.keyInfo.trim()}"` : " fornecida"} e na atividade da empresa${objetivo ? ` com objetivo: ${objetivo}` : ""}.
⚠ REGRA ABSOLUTA DE TEXTO NA IMAGEM: a imagem contém EXATAMENTE 2 elementos de texto — (1) o TÍTULO em caixa alta e (2) o TEXTO DE APOIO. NENHUM outro texto, frase, citação ou trecho deve aparecer na imagem. A informação-chave é contexto criativo para INSPIRAR o título e o texto — JAMAIS deve aparecer escrita, citada ou resumida como terceiro elemento tipográfico na peça.
NÃO copie a informação-chave literalmente — interprete-a criativamente com tom publicitário.
PROIBIDO usar o nome da empresa ou da marca como título ou texto — inspire-se na mensagem, na atividade e na informação-chave, nunca no nome da empresa. O nome da marca é representado pela logomarca, não pelo texto da arte.
${
  (isSilencioMood
    ? "O bloco de texto deve ancorar na METADE DIREITA do quadro — é a zona reservada para o título no mood SILÊNCIO. A liberdade é de ESTILO, nunca de posição horizontal: nunca à esquerda nem centralizado. A liberdade de estilo não é de ESCALA: o título não deve invadir nem dominar visualmente a peça inteira — deve sobrar respiro e espaço para a cena/imagem ao redor do bloco de texto."
    : moodTitleAnchor(data.mood)
      ? `O bloco de texto deve ancorar ${moodTitleAnchor(data.mood)}. A liberdade é de ESTILO tipográfico dentro dessa ancoragem, não de posição horizontal. A liberdade de estilo não é de ESCALA: o título não deve invadir nem dominar visualmente a peça inteira — deve sobrar respiro e espaço para a cena/imagem ao redor do bloco de texto.`
      : 'A IA tem LIBERDADE de ancoragem HORIZONTAL e de estilo tipográfico do bloco de texto — explore ancoragens além do "bloco encostado na borda esquerda". A liberdade é de posição horizontal e ESTILO, não de ESCALA: o título não deve invadir nem dominar visualmente a peça inteira — deve sobrar respiro e espaço para a cena/imagem ao redor do bloco de texto.') +
  TOP_ANCHOR_CLAUSE
}
Hierarquia tipográfica obrigatória:
• TÍTULO: DOMINANTE — renderizado em tamanho grande e impactante (pense em outdoor), ocupando entre 30% e 45% da altura útil do canvas (nunca mais que isso). A âncora é o CORPO da fonte permanecer grande e legível, não preencher área a qualquer custo: se o título tiver 4 ou mais palavras, quebre em 2-3 linhas para manter o corpo grande; se tiver 1-3 palavras, mantenha em 1-2 linhas — não infle artificialmente o corpo nem espalhe poucas palavras em muitas linhas só para preencher altura. Título curto ocupa naturalmente menos área, e isso é correto.
• TEXTO DE APOIO: SUBTÍTULO DE REVISTA — corpo entre 55% e 70% do título, facilmente legível a distância normal de celular (nunca tamanho de legenda ou rodapé; se o texto tiver 2-3 linhas, cada linha deve ser claramente lida sem aproximar o olho da tela).
• ACENTO DE COR: aplique a cor de acento da paleta em 1 palavra-chave ou linha do título para criar hierarquia e personalidade visual.
⚠ ANTI-TRADUÇÃO LITERAL DO TÍTULO CRIADO: ao criar o título e o texto acima, NÃO os transforme em objeto visual literal da cena. "Conceito do título" = INTENÇÃO EMOCIONAL da mensagem (urgência, decisão, transformação, conquista), NÃO tradução de cada palavra em objeto visual. A CENA nasce do PAPEL DA EMPRESA e da ATIVIDADE REAL — nunca de palavras do título que você mesmo escrever. Proibições diretas: "novo"/"novidade" ≠ caderno limpo, página em branco, objeto novo genérico; "ação"/"agir" ≠ seta, figura em movimento, objeto cinético; "rumo"/"caminho"/"direção" ≠ corredor, estrada, passagem, bússola, mapa, GPS, placa de sinalização; "hoje"/"agora" ≠ relógio, ampulheta, pôr do sol; "escolha"/"decisão" ≠ encruzilhada, bifurcação. A imagem APOIA a mensagem do título sem ILUSTRÁ-LA objeto por objeto.`;

  // Instrução de referência (avatar/cenário/produtos) com PRIORIDADE MÁXIMA —
  // posicionada junto das demais regras invioláveis, ANTES da descrição da peça
  // e da leitura de cena, para não competir e perder força para elas (mesma
  // estratégia aplicada no MOP — ver referenceAnchorBlock em api.ts).
  const refsBlock = referencesBlock(
    references,
    kit.segment,
    { primary, accent },
    data.objetivo,
    forcedGender,
    kit.isPersonalBrand,
    data.mainActivity || kit.mainActivity,
    faceNotDominant,
    data.mood,
  );
  const referenceAnchorBlock = refsBlock
    ? `⚠ REFERÊNCIA VISUAL ENVIADA — PRIORIDADE MÁXIMA: as instruções abaixo sobre a(s) imagem(ns) de referência têm PRECEDÊNCIA sobre qualquer elemento, ambiente, figurino ou personagem descrito no restante deste prompt, em caso de conflito.\n${refsBlock}\n\n`
    : "";

  // papelBlock usa buildSceneRoleRule() — fonte canônica em visualDirection.ts.
  //
  // "ação concreta" (includeConcreteAction: true) ativa apenas quando:
  //   - sem Kit Imagem ativo (refsBlock) — referência ancora e domina a cena;
  //   - objetivo não simbólico (homenagem/aviso — sem ação operacional clara);
  //   - mood não intencionalmente abstrato (OP-04/05/06 — fragmento/desvio/minimalismo).
  //
  // Trava anti-metáfora sempre ativa — buildSceneRoleRule({ includeConcreteAction: false })
  // retorna só a trava, sem "mostre ação concreta". Quando Kit Imagem ativo, a referência
  // domina avatar/produto/cenário; a trava anti-metáfora não conflita e permanece.
  const OBJETIVOS_SIMBOLICOS = new Set(["homenagem", "aviso"]);
  const MOODS_SIMBOLICOS = new Set(["OP-04", "OP-05", "OP-06"]);
  const moodEhSimbolico = data.direcao === "mood" && MOODS_SIMBOLICOS.has(data.mood ?? "");
  // semPersonagem também suprime a ação concreta: o bloco começa por
  // "PERSONAGEM-PADRÃO DA CENA — O PÚBLICO-ALVO", que é a única instrução a
  // afirmar pessoa quando NENHUMA referência do Kit está marcada (refsBlock
  // vazio). A trava anti-metáfora continua entrando.
  const showConcreteAction =
    !refsBlock &&
    !semPersonagem &&
    !OBJETIVOS_SIMBOLICOS.has(data.objetivo ?? "") &&
    !moodEhSimbolico;
  // Quando a ação concreta é omitida (Kit Imagem ativo), preenche o vácuo com
  // um papel específico de segmento+objetivo, se houver um mapeado — ver
  // avatarRoleBlock acima.
  const roleBlock = !showConcreteAction
    ? avatarRoleBlock(kit.segment, data.objetivo, !!references?.avatar, kit.isPersonalBrand)
    : "";
  const papelBlock = `\n${buildSceneRoleRule({ includeConcreteAction: showConcreteAction })}${roleBlock ? `\n${roleBlock}` : ""}\n`;

  return `${buildDeviceRule(
    data.mainActivity || kit.mainActivity,
    references?.produtoTelaInformativa,
    !!references?.produtos?.length,
    references?.produtoEhDispositivo,
  )}

${AMBIENTES_RULE}

${HUMANIZACAO_RULE}

${referenceAnchorBlock}${
    semPersonagem
      ? `${buildSemPersonagemBlock({
          hasProdutos: !!references?.produtos?.length,
          hasCenario: !!references?.cenario,
          hasFachada: !!references?.fachada,
        })}\n\n`
      : ""
  }Peça publicitária ÚNICA para Instagram, formato NATIVO 1080x1350px (4:5). NÃO carrossel, NÃO série — standalone.

ZONA SEGURA INVIOLÁVEL DE 110 PX em todas as bordas do canvas 1080x1350. Nada importante (rosto, olhos, mãos, produto-foco, lettering, gráficos, logo) entra nesse perímetro — bordas são continuação natural do fundo (ver regra específica de margem para título e texto de apoio nas REGRAS, abaixo).

⚠ ZONA SEGURA PARA IMPULSIONAMENTO — MARGEM LATERAL DE 160 PX: esta peça pode ser impulsionada (Meta Ads/boost), que reformata automaticamente a mesma imagem para posicionamentos mais estreitos (Stories, Reels), cortando as laterais do quadro 4:5. Por isso, ROSTO, OLHOS, MÃOS e PRODUTO-FOCO nunca podem ficar a menos de 160 PX das bordas ESQUERDA e DIREITA do canvas — mantenha esses elementos numa faixa central mais estreita que o restante da composição. Essa margem lateral é ADICIONAL e maior que a zona de 110 px acima (que vale nas 4 bordas); aqui a exigência é especificamente sobre pessoas e produto-foco, e só nas bordas esquerda e direita.

IMAGEM FULL BLEED — REGRA ABSOLUTA: a imagem preenche o canvas 1080x1350 completamente de borda a borda. PROIBIDO: moldura externa, frame decorativo, borda de cor sólida ao redor da arte, vinheta escura periférica como contentor, margem vazia ou espaço branco/preto separando a imagem das bordas do canvas. A composição começa e termina nas bordas — sem nenhum container ou enquadramento ao redor.

⚠ REGRA INVIOLÁVEL — ZONA DA LOGOMARCA: ${zona.reservaTopo}
NENHUM ELEMENTO IMPORTANTE PODE SER COBERTO OU FICAR ATRÁS DA LOGOMARCA — planeje a composição já respeitando essa área antes de posicionar qualquer elemento.

EMPRESA: ${data.companyName || kit.companyName || "Marca"}
ATIVIDADE: ${data.mainActivity || kit.mainActivity || ""}
${objetivo ? `OBJETIVO: ${objetivo}\nTOM: ${tom}` : ""}

${
  data.keyInfo.trim()
    ? `INFORMAÇÃO-CHAVE (contexto criativo — USE APENAS para ${lookCatalogo ? "escolher clima, cenário e paleta desta foto de catálogo" : "gerar o conceito e o texto da peça"}, PROIBIDO renderizar esta informação como texto, lettering, citação ou qualquer tipografia na imagem):\n"${data.keyInfo.trim()}"`
    : `INFORMAÇÃO-CHAVE: não fornecida. Crie a peça com base apenas na empresa, atividade, objetivo e kit visual — a IA tem TOTAL LIBERDADE para inventar o tema e a mensagem mais pertinente para esta marca e este objetivo.`
}

${copyBlock}
${CONCEITO_FIRST_RULE}
${papelBlock}
${direcao}${variationBlock}${genderSafetyBlock}${regenVariationBlock}

${buildColorBlock(primary, accent, data.direcao === "mood", data.objetivo, tonalidadeSeed)}

${typographyBlock}
${scriptAccentBlock}
REGRAS:
- Esta peça é STANDALONE — não precisa parecer parte de uma série. Evite a fórmula visual mais óbvia para o briefing; escolha uma execução com personalidade própria dentro da direção definida.
${
  lookCatalogo
    ? "- Esta peça NÃO tem texto nenhum (ver bloco PEÇA DE CATÁLOGO acima) — as regras de idioma, margem e hierarquia de título/texto de apoio não se aplicam aqui"
    : `- Todo texto em PORTUGUÊS, sem inglês
- ⚠ MARGEM DE 110 PX para título e texto de apoio (zona segura definida no topo do prompt) — texto que não caiba dentro da margem deve ser reduzido ou reposicionado, nunca cortado`
}
- Alta resolução, estética editorial/publicitária brasileira
- Direção de arte humana, nunca arte automática
- Sem watermarks, sem logo fictícia, sem assinatura textual — a logomarca oficial da marca é aplicada SEPARADAMENTE (por composição, fora da IA); PROIBIDO desenhar, inventar, imitar, reproduzir ou renderizar qualquer logomarca, emblema, símbolo de marca, monograma ou nome da empresa como texto na arte, em qualquer ponto do quadro. ÚNICA exceção: a logomarca já impressa no tecido do uniforme de referência, que continua sendo reproduzida na roupa do personagem — em nenhum outro lugar.
- PROIBIDO ABSOLUTO: renderizar o nome da empresa, nome da marca ou razão social como texto, lettering, título ou qualquer elemento tipográfico na imagem — o nome da marca é representado exclusivamente pela logomarca aplicada separadamente. Nunca escreva o nome da empresa na arte.
- PROIBIDO ABSOLUTO: escrever, citar ou transcrever a INFORMAÇÃO-CHAVE do briefing como texto na imagem — ela é contexto de criação, não conteúdo tipográfico. ${lookCatalogo ? "Esta peça é um CATÁLOGO e não contém texto algum — nenhuma palavra, em nenhum ponto do quadro." : "A imagem contém apenas o TÍTULO e o TEXTO DE APOIO definidos acima; qualquer texto adicional (terceiro bloco, rodapé, tagline extra, citação) é PROIBIDO."}
- Regras absolutas (dispositivos digitais, ambientes, humanização): ver início deste prompt
- ${zona.regraFinal}

${FORBIDDEN_MOOD_WORDS}${semPersonagem ? `\n\n${SEM_PERSONAGEM_REFORCO_FINAL}` : ""}${lookCatalogo ? `\n\n${CATALOGO_REFORCO_FINAL}` : ""}`;
}
