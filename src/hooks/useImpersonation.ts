import { useEffect, useState } from "react";

const KEY = "impersonation-v1";

export interface Impersonation {
  userId: string;
  nome: string;
  email: string;
  isTest?: boolean;
}

function read(): Impersonation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function startImpersonation(imp: Impersonation) {
  localStorage.setItem(KEY, JSON.stringify(imp));
  window.dispatchEvent(new Event("impersonation-changed"));
}

export function stopImpersonation() {
  localStorage.removeItem(KEY);
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
