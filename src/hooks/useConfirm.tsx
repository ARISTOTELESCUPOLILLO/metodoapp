import { useCallback, useState } from "react";
import ConfirmDialog from "../components/metodo-op/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

// Substitui window.confirm/confirm() nativo por um diálogo do próprio app —
// Regra 9 do PLANO_V2 ("window.confirm e alert() são proibidos"). Aceita uma
// string simples (vira o título) ou as opções completas do ConfirmDialog.
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === "string" ? { title: options } : options;
    return new Promise((resolve) => setState({ ...opts, resolve }));
  }, []);

  const dialog = state ? (
    <ConfirmDialog
      open
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      tone={state.tone}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
      onCancel={() => {
        state.resolve(false);
        setState(null);
      }}
    />
  ) : null;

  return { confirm, dialog };
}
