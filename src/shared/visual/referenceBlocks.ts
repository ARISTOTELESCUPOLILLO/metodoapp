// Blocos de texto de referência visual compartilhados entre MOP (buildAnchorPrefix)
// e PU (referencesBlock). Extraídos para eliminar duplicação literal nos dois motores.

// Última verificação de contagem de produtos — IDÊNTICA nos dois motores.
// Posicionada como última linha do bloco de referências porque modelos de imagem
// tendem a dar mais peso à instrução mais recente em prompts longos.
export function buildUltimaVerificacaoBlock(n: number): string {
  return (
    `⚠ ÚLTIMA VERIFICAÇÃO ANTES DE GERAR: conte os produtos na composição — devem ser EXATAMENTE ${n}, nunca ${n - 1} nem menos. ` +
    `NEGATIVE: missing product, only ${n - 1} product visible, single product shown when ${n} were required, product omitted, incomplete product count.`
  );
}

// Contrato de presença dos elementos do MIX — quando o usuário combina duas ou
// mais referências do Kit Imagem (avatar + cenário + produto, por exemplo), TODAS
// devem aparecer na peça. Não é preferência: é o que ele selecionou.
//
// Antes deste bloco, a presença de cada elemento dependia de blocos separados
// ("AVATAR: use como personagem", "CENÁRIO OBRIGATÓRIO", "PRODUTOS SELECIONADOS")
// que podiam ser vencidos, dentro do MESMO prompt, pela variação de pose sorteada
// ou pela gramática do mood — ex.: CLAREZA "DETALHE CONTEXTUAL" manda o personagem
// existir só por "mão, braço, silhueta", e o avatar simplesmente sumia da imagem
// (achado real 06/08/2026, PU Atrevidinha Modas). O sorteio já foi corrigido na
// origem (imageVariationPicker), mas isto fecha a porta para qualquer outra
// instrução do prompt que empurre na mesma direção — inclusive as que vierem
// depois, no texto da leitura de cena.
//
// Vai como ÚLTIMA linha do bloco de referências (mesma lógica do
// buildUltimaVerificacaoBlock: em prompt longo, instrução mais recente pesa mais).
export function buildMixContratoBlock(opts: {
  avatar?: boolean;
  fachada?: boolean;
  cenario?: boolean;
  produtosCount?: number;
}): string {
  const produtosCount = opts.produtosCount ?? 0;
  const itens: string[] = [];
  if (opts.avatar) {
    itens.push(
      "A PESSOA DO AVATAR — presente na cena, com o ROSTO VISÍVEL e reconhecível. NÃO basta mão, braço, ombro, silhueta, sombra, reflexo ou 'presença implícita': o rosto tem de aparecer",
    );
  }
  if (opts.fachada) {
    itens.push("A FACHADA — reconhecível na imagem como o mesmo estabelecimento da referência");
  }
  if (opts.cenario) {
    itens.push("O AMBIENTE DO CENÁRIO — reconhecível na imagem como o mesmo local da referência");
  }
  if (produtosCount === 1) {
    itens.push(
      "O PRODUTO referenciado — inteiro, nítido e identificável, sem estar cortado, encoberto nem perdido ao fundo",
    );
  } else if (produtosCount > 1) {
    itens.push(
      `OS ${produtosCount} PRODUTOS referenciados — todos inteiros, nítidos e identificáveis, nenhum cortado, encoberto nem perdido ao fundo`,
    );
  }
  // Com um único elemento não há mix: os blocos específicos já bastam.
  if (itens.length < 2) return "";

  const negatives = [
    opts.avatar
      ? "missing person, faceless figure, person cropped out of frame, only hands visible, character replaced by implied presence"
      : "",
    opts.fachada ? "storefront missing, different building" : "",
    opts.cenario ? "different location, generic background replacing the referenced place" : "",
    produtosCount > 0 ? "product omitted, product missing from scene, product out of frame" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    `⚠ CONTRATO DO MIX — TODOS OS ELEMENTOS SELECIONADOS APARECEM NESTA IMAGEM: foram enviadas ${itens.length} referências e a peça final DEVE conter TODAS elas ao mesmo tempo, visíveis e identificáveis:\n` +
    itens.map((t, i) => `${i + 1}. ${t}.`).join("\n") +
    `\nEste contrato TEM PRECEDÊNCIA sobre qualquer variação de pose, estrutura de cena, enquadramento ou gramática de mood descrita em qualquer outro ponto deste prompt. ` +
    `Se alguma dessas instruções levar a suprimir, cortar fora do quadro, esconder atrás de outro elemento ou reduzir a "presença implícita" qualquer um dos itens acima, ADAPTE A COMPOSIÇÃO — recue ou reposicione a câmera, mude o ângulo, redistribua os elementos no quadro — NUNCA elimine um elemento para cumprir a variação. ` +
    `⚠ ÚLTIMA VERIFICAÇÃO ANTES DE GERAR: percorra a lista acima item por item e confirme que cada um está de fato na imagem.` +
    (negatives ? `\nNEGATIVE: ${negatives}.` : "")
  );
}

// Wrapper de prioridade máxima para o bloco de referência visual.
// Duplicado em api.ts em duas funções (generatePostImage e generateReels).
// Retorna "" quando body é falsy — o caller pode usar diretamente no template.
export function buildReferenceAnchorWrapper(body: string): string {
  if (!body) return "";
  return (
    `⚠ REFERÊNCIA VISUAL ENVIADA — PRIORIDADE MÁXIMA: as instruções abaixo sobre a(s) imagem(ns) de referência ` +
    `têm PRECEDÊNCIA sobre qualquer elemento, ambiente, figurino ou personagem descrito na leitura de cena a seguir, em caso de conflito.\n` +
    `${body}\n\n`
  );
}
