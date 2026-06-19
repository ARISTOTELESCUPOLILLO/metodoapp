// Cache de imagens geradas (Método OP) em memória, por sessão de navegador.
// Sobrevive à navegação entre rotas (ex.: ir para /historico ou /conta e
// voltar para /app, que desmonta e remonta o MetodoOpApp), pois vive no
// módulo (memória do processo), não no state de um componente. É descartado
// sozinho ao recarregar/fechar a aba, e pode ser limpo manualmente (nova
// geração, "Limpar conteúdo"/"Limpar geração").
const cache = new Map<string, string>();

function fullKey(userId: string | null | undefined, key: string): string {
  return `${userId || "anon"}:${key}`;
}

export function getSessionImage(userId: string | null | undefined, key: string): string | null {
  return cache.get(fullKey(userId, key)) ?? null;
}

export function setSessionImage(
  userId: string | null | undefined,
  key: string,
  value: string | null,
): void {
  const k = fullKey(userId, key);
  if (value) cache.set(k, value);
  else cache.delete(k);
}

export function clearSessionImages(userId: string | null | undefined): void {
  const prefix = `${userId || "anon"}:`;
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}
