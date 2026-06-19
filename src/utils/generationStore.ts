import { useSyncExternalStore } from "react";
import type { MethodOpResult } from "../types";
import type { PostUnicoCaption } from "../services/postUnico";

export type GenStore = {
  loading: boolean;
  result: MethodOpResult | undefined;
  error: string;
  postUnicoImg: string | undefined;
  postUnicoStarted: boolean;
  caption: PostUnicoCaption | undefined;
  captionLoading: boolean;
  captionError: string;
};

export const GENINITIAL: GenStore = {
  loading: false,
  result: undefined,
  error: "",
  postUnicoImg: undefined,
  postUnicoStarted: false,
  caption: undefined,
  captionLoading: false,
  captionError: "",
};

let _store: GenStore = { ...GENINITIAL };
let _storeUserId: string | null = null;
const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach((fn) => fn());
}

export function getGenStore(): GenStore {
  return _store;
}
export function getGenStoreUserId(): string | null {
  return _storeUserId;
}

export function setGenStore(patch: Partial<GenStore>, userId?: string | null) {
  _store = { ..._store, ...patch };
  if (userId !== undefined) _storeUserId = userId;
  if (userId) {
    try {
      if ("result" in patch) {
        const k = `metodo-op-result-v1:${userId}`;
        patch.result === undefined
          ? localStorage.removeItem(k)
          : localStorage.setItem(k, JSON.stringify(patch.result));
      }
      if ("postUnicoImg" in patch) {
        const k = `metodo-op-postunico-img-v1:${userId}`;
        patch.postUnicoImg === undefined
          ? localStorage.removeItem(k)
          : localStorage.setItem(k, JSON.stringify(patch.postUnicoImg));
      }
      if ("caption" in patch) {
        const k = `metodo-op-postunico-caption-v1:${userId}`;
        patch.caption === undefined
          ? localStorage.removeItem(k)
          : localStorage.setItem(k, JSON.stringify(patch.caption));
      }
      if ("postUnicoStarted" in patch) {
        localStorage.setItem(
          `metodo-op-postunico-started-v1:${userId}`,
          patch.postUnicoStarted ? "true" : "false",
        );
      }
    } catch {}
  }
  _notify();
}

export function subscribeGenStore(fn: () => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

export function useGenStore(): GenStore {
  return useSyncExternalStore(subscribeGenStore, getGenStore, () => ({ ...GENINITIAL }));
}
