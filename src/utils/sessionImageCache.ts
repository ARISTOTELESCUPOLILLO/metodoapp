// Cache de imagens geradas (Método OP) em memória + localStorage.
//
// Memória: sobrevive à navegação entre rotas (ex.: /historico → /app) pois
// vive no módulo (fora do ciclo de vida do componente).
// localStorage: sobrevive a reload e nova aba na mesma sessão de login.
// Limpo explicitamente em logout (signOut) e em "Limpar conteúdo" (clearSessionImages).

import { lsGetRaw, lsSetRaw, lsRemoveRaw, lsClearPrefix } from "../lib/storage/store";
import { SESSION_IMG_PREFIX } from "../lib/storage/keys";

const cache = new Map<string, string>();

function memKey(userId: string | null | undefined, key: string): string {
  return `${userId || "anon"}:${key}`;
}

// A chave no localStorage inclui userId como parte do caminho (não como escopo separado),
// porque um card pode ter várias sub-chaves (ex: uuid:card-1-feed, uuid:card-1-reels).
function lsFullKey(userId: string | null | undefined, key: string): string {
  return `${SESSION_IMG_PREFIX}:${userId || "anon"}:${key}`;
}

export function getSessionImage(userId: string | null | undefined, key: string): string | null {
  const k = memKey(userId, key);
  const memVal = cache.get(k);
  if (memVal) return memVal;
  const stored = lsGetRaw(lsFullKey(userId, key));
  if (stored) {
    cache.set(k, stored);
    return stored;
  }
  return null;
}

export function setSessionImage(
  userId: string | null | undefined,
  key: string,
  value: string | null,
): void {
  const k = memKey(userId, key);
  if (value) {
    cache.set(k, value);
    // Best-effort: data URLs são grandes; quota excedida não quebra a sessão
    lsSetRaw(lsFullKey(userId, key), value);
  } else {
    cache.delete(k);
    lsRemoveRaw(lsFullKey(userId, key));
  }
}

export function clearSessionImages(userId: string | null | undefined): void {
  const memPrefix = `${userId || "anon"}:`;
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(memPrefix)) cache.delete(k);
  }
  lsClearPrefix(`${SESSION_IMG_PREFIX}:${userId || "anon"}:`);
}
