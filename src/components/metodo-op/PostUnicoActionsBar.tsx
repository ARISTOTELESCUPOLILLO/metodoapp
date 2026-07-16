// Barra de ações do resultado do Post Único (baixar, arquivar, regenerar,
// copiar/editar legenda, compartilhar, publicar) — extraído de
// PostUnicoResult.tsx (PLANO_V2 Fase 9.1). JSX movido 1:1, sem mudança de
// comportamento.
import { downloadDataUrl } from "../../utils/canvasComposer";
import { ArchiveButton } from "./ArchiveButton";
import { MetaPublish } from "./MetaPublish";
import type { RegenTipo } from "./PreImageAlert";
import type { PostUnicoCaption } from "../../services/postUnico";

type GuardFn = (opts: { hasPreview: boolean; run: () => void; tipo?: RegenTipo }) => void;

const lightBtn = {
  background: "#f8fafc",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 16px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

interface Props {
  imageDataUrl?: string;
  filename: string;
  slot?: "plano1" | "plano2" | "bonus";
  companyName?: string;
  captionText: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
  guard: GuardFn;
  caption?: PostUnicoCaption;
  captionLoading?: boolean;
  copied: boolean;
  onCopy: () => void;
  assinatura?: string;
  onInsertSignature: () => void;
  onDownloadTxt: () => void;
  isMobile: boolean;
  onClear?: () => void;
}

export function PostUnicoActionsBar({
  imageDataUrl,
  filename,
  slot,
  companyName,
  captionText,
  onRegenerate,
  regenerating,
  guard,
  caption,
  captionLoading,
  copied,
  onCopy,
  assinatura,
  onInsertSignature,
  onDownloadTxt,
  isMobile,
  onClear,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        justifyContent: "center",
        width: "100%",
        maxWidth: 480,
      }}
    >
      {imageDataUrl && (
        <>
          <button
            className="primaryBtn"
            type="button"
            style={{ width: "auto" }}
            onClick={() => downloadDataUrl(imageDataUrl, filename)}
          >
            Baixar PNG
          </button>
          <ArchiveButton
            tipo="PU"
            formato="estatico"
            slot={slot}
            legenda={captionText}
            titulo={companyName ? `Post Único — ${companyName}` : "Post Único"}
            imageDataUrls={[imageDataUrl]}
            disabledReason="Gere o Post Único antes de arquivar"
          />
        </>
      )}
      {onRegenerate && (
        <button
          type="button"
          onClick={() => guard({ hasPreview: true, tipo: "Estático", run: onRegenerate })}
          disabled={regenerating}
          style={{
            ...lightBtn,
            opacity: regenerating ? 0.6 : 1,
            cursor: regenerating ? "not-allowed" : "pointer",
          }}
        >
          {regenerating ? "Gerando…" : "Gerar outra imagem"}
        </button>
      )}
      {caption && !captionLoading && (
        <>
          <button className="primaryBtn" type="button" style={{ width: "auto" }} onClick={onCopy}>
            {copied ? "✓ Copiado!" : "Copiar legenda"}
          </button>
          <button
            type="button"
            disabled={!(assinatura && !captionText.includes(assinatura))}
            onClick={onInsertSignature}
            style={{
              ...lightBtn,
              background: assinatura && !captionText.includes(assinatura) ? "#0f172a" : "#e2e8f0",
              color: assinatura && !captionText.includes(assinatura) ? "#fff" : "#94a3b8",
              border: "none",
              cursor: assinatura && !captionText.includes(assinatura) ? "pointer" : "default",
            }}
          >
            Inserir Assinatura
          </button>
          <button type="button" style={lightBtn} onClick={onDownloadTxt}>
            Baixar legenda
          </button>
          {isMobile && (
            <button
              type="button"
              style={{
                ...lightBtn,
                background: "#25D366",
                color: "#fff",
                border: "1px solid #1ebe5d",
              }}
              onClick={() => {
                const d = new Date();
                const p = (n: number) => String(n).padStart(2, "0");
                const data = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
                const text = `Legenda Post Único – ${data}\n\n${captionText.trim()}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }}
            >
              Compartilhar no WhatsApp
            </button>
          )}
        </>
      )}
      {imageDataUrl && <MetaPublish imageDataUrl={imageDataUrl} caption={captionText} />}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={regenerating}
          style={{
            ...lightBtn,
            opacity: regenerating ? 0.6 : 1,
            cursor: regenerating ? "not-allowed" : "pointer",
          }}
        >
          Limpar conteúdo
        </button>
      )}
    </div>
  );
}
