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
