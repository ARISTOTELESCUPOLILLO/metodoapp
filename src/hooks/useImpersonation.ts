import { useEffect, useState } from "react";
import { lsGetRaw, lsSetRaw, lsRemoveRaw } from "../lib/storage/store";
import { IMPERSONATION_KEY } from "../lib/storage/keys";

export interface Impersonation {
  userId: string;
  nome: string;
  email: string;
  isTest?: boolean;
}

function read(): Impersonation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = lsGetRaw(IMPERSONATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function startImpersonation(imp: Impersonation) {
  lsSetRaw(IMPERSONATION_KEY, JSON.stringify(imp));
  window.dispatchEvent(new Event("impersonation-changed"));
}

export function stopImpersonation() {
  lsRemoveRaw(IMPERSONATION_KEY);
  window.dispatchEvent(new Event("impersonation-changed"));
}

export function getImpersonation(): Impersonation | null {
  return read();
}

export function useImpersonation(): Impersonation | null {
  const [imp, setImp] = useState<Impersonation | null>(read);
  useEffect(() => {
    const sync = () => setImp(read());
    window.addEventListener("impersonation-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("impersonation-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return imp;
}
