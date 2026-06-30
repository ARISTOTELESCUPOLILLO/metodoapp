// Ponto único de acesso ao localStorage/sessionStorage.
// TODO(fase-1): único arquivo do projeto com chamadas diretas a localStorage.
// Todos os demais módulos DEVEM usar as funções exportadas aqui.

import { IMAGE_KIT_KEY } from "./keys";

// ── Helpers internos ──────────────────────────────────────────────────────────

function scopedKey(base: string, userId?: string | null): string {
  return userId ? `${base}:${userId}` : base;
}

/** Libera espaço descartando o cache local do Kit Imagem (recuperável do servidor). */
function freeImageKitCache(): boolean {
  try {
    let freed = false;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(IMAGE_KIT_KEY)) {
        localStorage.removeItem(k);
        freed = true;
      }
    }
    return freed;
  } catch {
    return false;
  }
}

// ── localStorage escopado por userId ─────────────────────────────────────────

/** Lê `base` (ou `base:userId` quando userId fornecido). */
export function lsGet(base: string, userId?: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(scopedKey(base, userId));
  } catch {
    return null;
  }
}

/** Grava `base` (ou `base:userId`). Ignora silenciosamente QuotaExceededError. */
export function lsSet(base: string, value: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopedKey(base, userId), value);
  } catch {
    /* quota ou acesso negado — chamador decide se critica */
  }
}

/** Remove `base` (ou `base:userId`). */
export function lsRemove(base: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(scopedKey(base, userId));
  } catch {
    /* best-effort */
  }
}

/**
 * Grava com resiliência a QuotaExceededError: ao falhar, tenta liberar
 * espaço descartando o cache do Kit Imagem e grava novamente.
 * Use para dados que precisam sobreviver a reload (resultados, copy editado).
 */
export function lsSetQuotaSafe(base: string, value: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  const key = scopedKey(base, userId);
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if ((e as Error)?.name === "QuotaExceededError" && freeImageKitCache()) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (e2) {
        console.error(`lsSetQuotaSafe: falha ao salvar "${key}" mesmo após liberar espaço`, e2);
        return;
      }
    }
    console.error(`lsSetQuotaSafe: falha ao salvar "${key}"`, e);
  }
}

// ── localStorage chave literal (sem escopo) ───────────────────────────────────

export function lsGetRaw(key: string): string | null {
  return lsGet(key, null);
}

export function lsSetRaw(key: string, value: string): void {
  lsSet(key, value, null);
}

export function lsRemoveRaw(key: string): void {
  lsRemove(key, null);
}

/**
 * Grava pela chave literal SEM capturar erros — propaga QuotaExceededError.
 * Use apenas quando o chamador precisa tratar a quota explicitamente (ex.: imageKitStorage).
 */
export function lsSetRawOrThrow(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

// ── Limpeza em lote ───────────────────────────────────────────────────────────

/** Remove todas as chaves do localStorage que comecem com `prefix`. */
export function lsClearPrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch {
    /* best-effort */
  }
}

/** Remove todas as chaves escopadas de um usuário (contêm `:userId`). */
export function lsClearUser(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    const needle = `:${userId}`;
    for (const k of Object.keys(localStorage)) {
      if (k.includes(needle)) localStorage.removeItem(k);
    }
  } catch {
    /* best-effort */
  }
}

// ── sessionStorage ─────────────────────────────────────────────────────────────

export function ssGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function ssSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* preferência não crítica */
  }
}

export function ssClearPrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith(prefix)) sessionStorage.removeItem(k);
    }
  } catch {
    /* best-effort */
  }
}
