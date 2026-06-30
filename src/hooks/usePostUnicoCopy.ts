import { useState, useRef, type Dispatch, type SetStateAction } from "react";
import type { BrandKit, PostUnicoFormData } from "../types";
import { generatePostUnicoCopy, type PostUnicoCopy } from "../services/postUnico";
import { regenerateBlockClean } from "../services/regenerateBlock";
import { autoRegenerateFlaggedPostUnico } from "../services/autoRegenerate";
import { judgeAndRegeneratePostUnico } from "../services/judgeContent";

interface Params {
  data: PostUnicoFormData;
  kit: BrandKit;
  puSlot?: string;
  isAdmin?: boolean;
  tituloRegenCount?: number;
  textoRegenCount?: number;
  onTituloRegen?: () => void;
  onTextoRegen?: () => void;
  onResetCopyRegen?: () => void;
  copy: PostUnicoCopy | null;
  setCopy: Dispatch<SetStateAction<PostUnicoCopy | null>>;
  setCopyOriginal: Dispatch<SetStateAction<PostUnicoCopy | null>>;
}

const COPY_REGEN_MAX = 2;

export function usePostUnicoCopy({
  data,
  kit,
  puSlot,
  isAdmin,
  tituloRegenCount,
  textoRegenCount,
  onTituloRegen,
  onTextoRegen,
  onResetCopyRegen,
  copy,
  setCopy,
  setCopyOriginal,
}: Params) {
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyTBusy, setCopyTBusy] = useState(false);
  const [copyXBusy, setCopyXBusy] = useState(false);
  const [copyTError, setCopyTError] = useState<string | null>(null);
  const [copyXError, setCopyXError] = useState<string | null>(null);
  const [copyTSuggs, setCopyTSuggs] = useState<string[]>([]);
  const [copyXSuggs, setCopyXSuggs] = useState<string[]>([]);
  const copyKeyInfoRef = useRef<string>(data.keyInfo);

  const copyTRegenCount = tituloRegenCount ?? 0;
  const copyXRegenCount = textoRegenCount ?? 0;

  async function fetchCopy() {
    if (copyLoading) return;
    setCopyLoading(true);
    setCopyError(null);
    try {
      const companyName = data.companyName || kit.companyName;
      const mainActivity = data.mainActivity || kit.mainActivity || "";
      const generated = await generatePostUnicoCopy(
        { ...data, companyName, mainActivity },
        kit.brandVoice,
        kit.segment,
        puSlot,
      );
      let result = await autoRegenerateFlaggedPostUnico(
        { titulo: generated.titulo, texto: generated.texto },
        generated.flags,
        { companyName, mainActivity, keyInfo: data.keyInfo },
      );
      try {
        const updated = await judgeAndRegeneratePostUnico(result, {
          companyName,
          mainActivity,
          keyInfo: data.keyInfo,
          segment: kit.segment,
        });
        if (updated) result = updated;
      } catch {
        // best-effort — se o juiz falhar, segue com o resultado do E3
      }
      setCopy(result);
      setCopyOriginal(result);
      copyKeyInfoRef.current = data.keyInfo;
    } catch (e) {
      setCopyError((e as Error).message);
    } finally {
      setCopyLoading(false);
    }
  }

  async function regenField(kind: "titulo" | "texto") {
    if (!copy) return;
    const isTitulo = kind === "titulo";
    if (isTitulo) {
      if ((!isAdmin && copyTRegenCount >= COPY_REGEN_MAX) || copyTBusy) return;
    } else {
      if ((!isAdmin && copyXRegenCount >= COPY_REGEN_MAX) || copyXBusy) return;
    }
    if (isTitulo) {
      setCopyTBusy(true);
      setCopyTError(null);
    } else {
      setCopyXBusy(true);
      setCopyXError(null);
    }
    try {
      const next = await regenerateBlockClean({
        kind,
        companyName: data.companyName || kit.companyName,
        mainActivity: data.mainActivity || kit.mainActivity || "",
        keyInfo: data.keyInfo,
        formato: "PostUnico",
        tituloAtual: copy.titulo,
        textoAtual: copy.texto,
      });
      const trimmed = next.trim();
      if (trimmed) {
        if (isTitulo) setCopyTSuggs((s) => [...s, trimmed]);
        else setCopyXSuggs((s) => [...s, trimmed]);
        if (isTitulo) onTituloRegen?.();
        else onTextoRegen?.();
      } else {
        if (isTitulo) setCopyTError("Sugestão vazia — tente de novo.");
        else setCopyXError("Sugestão vazia — tente de novo.");
      }
    } catch (e) {
      if (isTitulo) setCopyTError((e as Error).message);
      else setCopyXError((e as Error).message);
    } finally {
      if (isTitulo) setCopyTBusy(false);
      else setCopyXBusy(false);
    }
  }

  function clearCopy({ resetCounter = true }: { resetCounter?: boolean } = {}) {
    setCopy(null);
    setCopyOriginal(null);
    setCopyError(null);
    if (resetCounter) onResetCopyRegen?.();
    setCopyTError(null);
    setCopyXError(null);
    setCopyTSuggs([]);
    setCopyXSuggs([]);
  }

  return {
    copyLoading,
    copyError,
    copyTBusy,
    copyXBusy,
    copyTError,
    copyXError,
    copyTSuggs,
    setCopyTSuggs,
    copyXSuggs,
    setCopyXSuggs,
    copyKeyInfoRef,
    fetchCopy,
    regenField,
    clearCopy,
  };
}
