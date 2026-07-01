// Histórico de até 2 legendas (inicial + 1 regerada) do Post Único —
// extraído de PostUnicoResult.tsx (PLANO_V2 Fase 9.1). Efeitos movidos 1:1,
// sem mudança de comportamento.
import { useEffect, useState } from "react";
import type { PostUnicoCaption } from "../services/postUnico";

export function useCaptionHistory(
  caption: PostUnicoCaption | undefined,
  imageDataUrl: string | undefined,
) {
  const [editedCaption, setEditedCaption] = useState<string | null>(null);
  const [captionHistory, setCaptionHistory] = useState<PostUnicoCaption[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Reseta o histórico de regeneração de legenda a cada nova imagem gerada
  // (o contador é zerado no app, setPuCaptionRegen, junto com a nova
  // geração). NÃO zera `editedCaption` aqui — regenerar a IMAGEM não deve
  // descartar uma edição manual da legenda (ex.: assinatura inserida pelo
  // botão "Inserir Assinatura"); isso só é zerado quando a legenda em si
  // muda (ver efeito abaixo, que reage a `caption`).
  useEffect(() => {
    setCaptionHistory([]);
    setSelectedIdx(0);
  }, [imageDataUrl]);

  // Mantém histórico de até 2 legendas (inicial + 1 regerada).
  useEffect(() => {
    if (!caption) return;
    setCaptionHistory((prev) => {
      if (prev.some((c) => c.full === caption.full)) {
        const idx = prev.findIndex((c) => c.full === caption.full);
        setSelectedIdx(idx);
        setEditedCaption(null);
        return prev;
      }
      const next = prev.length >= 2 ? [prev[0], caption] : [...prev, caption];
      setSelectedIdx(next.length - 1);
      setEditedCaption(null);
      return next;
    });
  }, [caption]);

  const activeCaption = captionHistory[selectedIdx] ?? caption;
  const captionText = editedCaption ?? activeCaption?.full ?? "";

  return {
    captionHistory,
    selectedIdx,
    setSelectedIdx,
    editedCaption,
    setEditedCaption,
    activeCaption,
    captionText,
  };
}
