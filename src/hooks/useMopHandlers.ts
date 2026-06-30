import { useState } from "react";
import { generateMethodContent } from "../services/api";
import { judgeAndRegenerateContent } from "../services/judgeContent";
import { saveImageKit, saveImageKitAsync } from "../utils/imageKitStorage";
import { clearSessionImages } from "../utils/sessionImageCache";
import { clearCopyEdits } from "../utils/copyEditsStorage";
import type { BrandKit, ContentFormData, ImageKit, MethodOpResult, MoodCode } from "../types";

interface Params {
  form: ContentFormData;
  kit: BrandKit;
  mood: MoodCode | null;
  imageKit: ImageKit;
  setImageKit: (kit: ImageKit) => void;
  effectiveUserId: string | null;
  selectedSlot: "plano1" | "plano2" | "bonus";
  setResult: (r: MethodOpResult | undefined) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
  refreshProfile: () => void;
  askConfirm: (title: string, message?: string) => Promise<boolean>;
}

export function useMopHandlers({
  form,
  kit,
  mood,
  imageKit,
  setImageKit,
  effectiveUserId,
  selectedSlot,
  setResult,
  setLoading,
  setError,
  refreshProfile,
  askConfirm,
}: Params) {
  const [imageKitSaved, setImageKitSaved] = useState(false);

  async function handleGenerate() {
    if (!mood && form.outputMode !== "stories") {
      setError("Escolha uma forma visual (mood) antes de gerar.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(undefined);
    clearSessionImages(effectiveUserId);
    clearCopyEdits(effectiveUserId);
    try {
      let generated = await generateMethodContent(
        {
          ...form,
          companyName: kit.companyName,
          segment: kit.segment,
          brandVoice: kit.brandVoice,
          mainActivity: kit.mainActivity || "",
          mood: mood ?? "OP-01",
        },
        selectedSlot,
      );
      try {
        const updated = await judgeAndRegenerateContent(generated, {
          companyName: kit.companyName,
          mainActivity: kit.mainActivity || "",
          keyInfo: form.keyInfo,
          segment: kit.segment,
        });
        if (updated) generated = updated;
      } catch {
        // best-effort — se o juiz falhar, segue com o resultado original.
      }
      setResult(generated);
      refreshProfile();
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleClearMethodResult() {
    if (
      !(await askConfirm(
        "Limpar conteúdo gerado",
        "Isso vai apagar o resultado atual (feed, carrossel, reels, stories). Deseja continuar?",
      ))
    )
      return;
    setResult(undefined);
    setError("");
    clearSessionImages(effectiveUserId);
    clearCopyEdits(effectiveUserId);
  }

  async function handleClearMethodGeneration() {
    if (
      !(await askConfirm(
        "Limpar geração de conteúdo",
        "Isso vai apagar a informação-chave e o resultado gerado pra você começar de novo. Deseja continuar?",
      ))
    )
      return;
    setResult(undefined);
    setError("");
    clearSessionImages(effectiveUserId);
    clearCopyEdits(effectiveUserId);
  }

  async function handleSaveImageKit() {
    try {
      const saved = await saveImageKitAsync(imageKit, effectiveUserId);
      setImageKit(saved);
      setImageKitSaved(true);
      setTimeout(() => setImageKitSaved(false), 2000);
    } catch (e) {
      try {
        saveImageKit(imageKit, effectiveUserId);
      } catch (localErr) {
        console.error("handleSaveImageKit: falha ao salvar cache local", localErr);
      }
      console.error("handleSaveImageKit: falha ao salvar Kit Imagem no servidor", e);
    }
  }

  return {
    imageKitSaved,
    handleGenerate,
    handleClearMethodResult,
    handleClearMethodGeneration,
    handleSaveImageKit,
  };
}
