import { useEffect, useRef, useState } from "react";

export type RegenTipo = "Estático" | "Carrossel" | "Estático Final" | "Reels" | "Vídeo";

interface Props {
  open: boolean;
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: () => void;
}

/**
 * Diálogo exibido antes da PRIMEIRA geração de imagem de cada bloco
 * (estático, carrossel, estático final, reels). O texto/título do bloco
 * vai virar a base visual da peça — então o cliente é avisado para revisar
 * antes de gerar. Tem opção "não mostrar de novo nesta sessão".
 */
export default function PreImageAlert({ open, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (!open) {
      setDontShow(false);
      return;
    }
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 26,
          maxWidth: 460,
          width: "100%",
          boxShadow: "0 30px 80px rgba(15,23,42,.35)",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a" }}>
          Antes de gerar a imagem
        </h3>
        <p style={{ margin: "10px 0 16px", color: "#475569", fontSize: 14.5, lineHeight: 1.55 }}>
          A IA vai usar o <strong>título</strong> e o <strong>texto</strong> deste bloco como base
          visual. Se quiser ajustar, refine agora — depois de gerar a imagem, mudar o texto não muda
          a peça.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 18,
            fontSize: 13,
            color: "#475569",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
          />
          Não mostrar de novo nesta sessão
        </label>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              background: "#f8fafc",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Revisar texto
          </button>
          <button
            type="button"
            onClick={() => onConfirm(dontShow)}
            style={{
              background: "#123a63",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "10px 18px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(18,58,99,.3)",
            }}
          >
            Gerar imagem
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Diálogo exibido ANTES de uma re-geração (já existe preview/vídeo).
 * Avisa que a nova geração consome cota do plano para o tipo do card.
 * Sem checkbox de "não mostrar mais" — o aviso é explícito a cada vez.
 */
function RegenAlert({
  open,
  tipo,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  tipo: RegenTipo;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 26,
          maxWidth: 460,
          width: "100%",
          boxShadow: "0 30px 80px rgba(15,23,42,.35)",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a" }}>
          Gerar nov{tipo === "Vídeo" ? "o" : "a"} {tipo}?
        </h3>
        <p style={{ margin: "10px 0 18px", color: "#475569", fontSize: 14.5, lineHeight: 1.55 }}>
          Este pedido vai consumir uma geração de <strong>{tipo}</strong> do limite disponível no
          seu plano.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              background: "#f8fafc",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: "#123a63",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "10px 18px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(18,58,99,.3)",
            }}
          >
            Gerar {tipo}
          </button>
        </div>
      </div>
    </div>
  );
}

const SESSION_KEY = "mop-skip-pre-image-alert";

export function useImageGenAlert() {
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [pendingRegen, setPendingRegen] = useState<null | { run: () => void; tipo: RegenTipo }>(
    null,
  );

  function shouldSkip(): boolean {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  }

  /**
   * Envolve uma ação de geração de imagem/vídeo.
   * - 1ª vez do bloco (sem preview): abre o aviso de pré-geração ("Antes de gerar...").
   *   Se "não mostrar de novo" estiver marcado nesta sessão, executa direto.
   * - Re-geração (já tem preview): abre o aviso de cota do plano (sempre, sem skip).
   */
  function guard(opts: { hasPreview: boolean; run: () => void; tipo?: RegenTipo }) {
    if (opts.hasPreview) {
      setPendingRegen({ run: opts.run, tipo: opts.tipo || "Estático" });
      return;
    }
    if (shouldSkip()) {
      opts.run();
      return;
    }
    setPending(() => opts.run);
  }

  function confirm(dontShowAgain: boolean) {
    if (dontShowAgain) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
    }
    const run = pending;
    setPending(null);
    run?.();
  }

  function cancel() {
    setPending(null);
  }

  function confirmRegen() {
    const run = pendingRegen?.run;
    setPendingRegen(null);
    run?.();
  }

  function cancelRegen() {
    setPendingRegen(null);
  }

  const dialog = (
    <>
      <PreImageAlert open={!!pending} onConfirm={confirm} onCancel={cancel} />
      <RegenAlert
        open={!!pendingRegen}
        tipo={pendingRegen?.tipo || "Estático"}
        onConfirm={confirmRegen}
        onCancel={cancelRegen}
      />
    </>
  );

  return { guard, dialog };
}
