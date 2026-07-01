// Diálogo de confirmação promise-based do app raiz — extraído de
// MetodoOpApp.tsx (PLANO_V2 Fase 9.1). Lógica movida 1:1, sem mudança de
// comportamento (distinto de useConfirm/ConfirmDialog do admin).
import { useState } from "react";

interface ConfirmState {
  title: string;
  message?: string;
  resolve: (v: boolean) => void;
}

export function useAppConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  function askConfirm(title: string, message?: string): Promise<boolean> {
    return new Promise((resolve) => setConfirmState({ title, message, resolve }));
  }

  function resolveConfirm(value: boolean) {
    const r = confirmState?.resolve;
    setConfirmState(null);
    r?.(value);
  }

  return { confirmState, askConfirm, resolveConfirm };
}
