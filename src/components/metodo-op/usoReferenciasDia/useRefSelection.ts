// Hook reaproveitável: lê o estado de seleção persistido por uma peça
// (mesma `storageKey` usada pelo <UsoReferenciasDia>) e re-renderiza
// quando muda (mesma aba via evento custom, outras abas via 'storage').
// Extraído de UsoReferenciasDia.tsx (PLANO_V2 Fase 9.1). Movido 1:1, sem
// mudança de comportamento. Reexportado por UsoReferenciasDia.tsx para
// manter os imports existentes (CarouselCardBlock, ReelsCard, FeedCard,
// FinalCard, RefsRegenButton, useCarouselGeneration) funcionando sem
// alteração.
import { useSyncExternalStore } from "react";
import { lsGetRaw } from "../../../lib/storage/store";

export interface RefSelectionState {
  enabled: boolean;
  // Qual avatar está marcado (1, 2 ou nenhum).
  avatarNum: number | null;
  usarFachada: boolean;
  cenarioNum: number | null;
  produtosNums: number[];
  useUniforme: boolean;
  // O(s) produto(s) selecionados são, eles mesmos, uma tela/dispositivo cujo
  // conteúdo exibido é a identidade do produto — ver promptRules.buildDeviceRule.
  produtoTelaInformativa: boolean;
  hasAny: boolean;
}

const EMPTY_SEL: RefSelectionState = {
  enabled: false,
  avatarNum: null,
  usarFachada: false,
  cenarioNum: null,
  produtosNums: [],
  useUniforme: false,
  produtoTelaInformativa: false,
  hasAny: false,
};

function readSel(storageKey: string): RefSelectionState {
  try {
    if (typeof window === "undefined") return EMPTY_SEL;
    const raw = lsGetRaw(storageKey);
    if (!raw) return EMPTY_SEL;
    const s = JSON.parse(raw);
    const enabled = !!s.enabled;
    // Migração do formato antigo (usarAvatar boolean) → avatarNum (1|2|null).
    const avatarNum =
      typeof s.avatarNum === "number" || s.avatarNum === null
        ? s.avatarNum
        : s.usarAvatar
          ? 1
          : null;
    const usarFachada = !!s.usarFachada;
    const cenarioNum = typeof s.cenarioNum === "number" ? s.cenarioNum : null;
    const produtosNums = Array.isArray(s.produtosNums)
      ? s.produtosNums.filter((n: unknown) => typeof n === "number")
      : [];
    const useUniforme = avatarNum != null && !!s.useUniforme;
    const produtoTelaInformativa = produtosNums.length > 0 && !!s.produtoTelaInformativa;
    const hasAny =
      enabled &&
      (avatarNum != null || usarFachada || cenarioNum != null || produtosNums.length > 0);
    return {
      enabled,
      avatarNum,
      usarFachada,
      cenarioNum,
      produtosNums,
      useUniforme,
      produtoTelaInformativa,
      hasAny,
    };
  } catch {
    return EMPTY_SEL;
  }
}

// Cache simples por storageKey para o snapshot ser estável.
const selCache = new Map<string, RefSelectionState>();
function getSnapshot(storageKey: string): RefSelectionState {
  const fresh = readSel(storageKey);
  const cached = selCache.get(storageKey);
  if (
    cached &&
    cached.enabled === fresh.enabled &&
    cached.avatarNum === fresh.avatarNum &&
    cached.usarFachada === fresh.usarFachada &&
    cached.cenarioNum === fresh.cenarioNum &&
    cached.produtosNums.length === fresh.produtosNums.length &&
    cached.produtosNums.every((n, i) => n === fresh.produtosNums[i]) &&
    cached.useUniforme === fresh.useUniforme &&
    cached.produtoTelaInformativa === fresh.produtoTelaInformativa
  ) {
    return cached;
  }
  selCache.set(storageKey, fresh);
  return fresh;
}

export function useRefSelection(storageKey: string): RefSelectionState {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      const onStorage = (e: StorageEvent) => {
        if (e.key === storageKey) cb();
      };
      const onLocal = (e: Event) => {
        const ce = e as CustomEvent<{ key: string }>;
        if (ce.detail?.key === storageKey) cb();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener("uso-ref:changed", onLocal as EventListener);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("uso-ref:changed", onLocal as EventListener);
      };
    },
    () => getSnapshot(storageKey),
    () => EMPTY_SEL,
  );
}
