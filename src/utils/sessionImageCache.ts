// Cache de imagens geradas (Método OP) em memória + localStorage.
//
// Memória: sobrevive à navegação entre rotas (ex.: /historico → /app) pois
// vive no módulo (fora do ciclo de vida do componente).
// localStorage: sobrevive a reload e nova aba na mesma sessão de login.
// Limpo explicitamente em logout (signOut) e em "Limpar conteúdo" (clearSessionImages).
const cache = new Map<string, string>();

// Prefixo das chaves no localStorage — separado do prefixo da PU para
// facilitar remoção seletiva sem varrer todas as chaves do storage.
const LS_PREFIX = "metodo-op-img-v1";

function fullKey(userId: string | null | undefined, key: string): string {
  return `${userId || "anon"}:${key}`;
}

function lsKey(userId: string | null | undefined, key: string): string {
  return `${LS_PREFIX}:${userId || "anon"}:${key}`;
}

export function getSessionImage(userId: string | null | undefined, key: string): string | null {
  const k = fullKey(userId, key);
  const memVal = cache.get(k);
  if (memVal) return memVal;
  // Fallback: localStorage sobrevive a reload/nova aba
  try {
    const stored = localStorage.getItem(lsKey(userId, key));
    if (stored) {
      cache.set(k, stored); // repopula memória para chamadas subsequentes
      return stored;
    }
  } catch {
    /* sem acesso ao storage */
  }
  return null;
}

export function setSessionImage(
  userId: string | null | undefined,
  key: string,
  value: string | null,
): void {
  const k = fullKey(userId, key);
  if (value) {
    cache.set(k, value);
    // Best-effort: data URLs são grandes; quota excedida não quebra a sessão
    try {
      localStorage.setItem(lsKey(userId, key), value);
    } catch {
      /* quota excedida — memória ainda funciona para a sessão atual */
    }
  } else {
    cache.delete(k);
    try {
      localStorage.removeItem(lsKey(userId, key));
    } catch {
      /* best-effort */
    }
  }
}

export function clearSessionImages(userId: string | null | undefined): void {
  const memPrefix = `${userId || "anon"}:`;
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(memPrefix)) cache.delete(k);
  }
  // Limpa também do localStorage
  try {
    const lsPrefix = `${LS_PREFIX}:${userId || "anon"}:`;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(lsPrefix)) localStorage.removeItem(k);
    }
  } catch {
    /* best-effort */
  }
}
