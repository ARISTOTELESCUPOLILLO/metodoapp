import { useState, useRef, type Dispatch, type SetStateAction } from "react";
import type { BrandKit, PostUnicoFormData } from "../types";
import { generatePostUnicoCopy, type PostUnicoCopy } from "../services/postUnico";
import { regenerateBlockClean } from "../services/regenerateBlock";
import { autoRegenerateFlaggedPostUnico } from "../services/autoRegenerate";
import { judgeAndRegeneratePostUnico } from "../services/judgeContent";
import { checkCoerencia } from "../core/intencao";

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
      // O aviso de coerência nunca bloqueia — mas gerar apesar dele é o dado
      // mais revelador do piloto (item 2 dos critérios da Etapa 2). Registrado
      // em usage_logs.payload, não usado no prompt.
      const avisoIgnorado = !!checkCoerencia(
        data.intencao ?? null,
        data.transformacaoPrincipal ?? null,
        kit.segment,
      );
      const generated = await generatePostUnicoCopy(
        { ...data, companyName, mainActivity },
        kit.brandVoice,
        kit.segment,
        puSlot,
        undefined,
        undefined,
        avisoIgnorado,
      );
      // Modo "tópicos" usa schema próprio ({titulo, topicos}), incompatível
      // com autoRegenerateFlaggedPostUnico/judgeAndRegeneratePostUnico (feitos
      // para {titulo, texto}) — os tópicos em si usam só a validação
      // determinística já aplicada no backend (ver topicoValidation.ts). O
      // título, porém, reaproveita o mesmo regen/fallback de E3/E4 do modo
      // corrido (achado real 16/07: em Promoção com oferta concreta, sem essa
      // rede de segurança um título flagado pelo D1 (ex.: perdeu o preço
      // citado) ia pra tela sem chance de correção).
      if (generated.topicos?.length) {
        let titulo = generated.titulo;
        const tituloFlagado = generated.flags?.some((f) => f.campo === "copy.titulo");
        if (tituloFlagado) {
          try {
            const regenerado = await regenerateBlockClean({
              kind: "titulo",
              companyName,
              mainActivity,
              keyInfo: data.keyInfo,
              objetivo: data.objetivo,
              formato: "PostUnico",
              tituloAtual: generated.titulo,
              motivoReprovacao: generated.flags
                ?.filter((f) => f.campo === "copy.titulo")
                .map((f) => f.motivo)
                .join("; "),
              intencao: data.intencao ?? null,
              transformacaoPrincipal: data.transformacaoPrincipal ?? null,
              segment: kit.segment,
            });
            if (regenerado.trim()) titulo = regenerado;
          } catch {
            // best-effort — se a regeneração falhar, segue com o título original
          }
        }
        const withRegenTitulo = { ...generated, titulo };
        setCopy(withRegenTitulo);
        setCopyOriginal(withRegenTitulo);
        copyKeyInfoRef.current = data.keyInfo;
        return;
      }
      let result = await autoRegenerateFlaggedPostUnico(
        { titulo: generated.titulo, texto: generated.texto },
        generated.flags,
        {
          companyName,
          mainActivity,
          keyInfo: data.keyInfo,
          objetivo: data.objetivo,
          intencao: data.intencao ?? null,
          transformacaoPrincipal: data.transformacaoPrincipal ?? null,
          segment: kit.segment,
        },
      );
      try {
        const updated = await judgeAndRegeneratePostUnico(result, {
          companyName,
          mainActivity,
          keyInfo: data.keyInfo,
          segment: kit.segment,
          objetivo: data.objetivo,
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

  // "Gerar outros tópicos" — mantém o TÍTULO fixo (mesmo princípio do
  // "TÍTULO FIXO" em regenerate-block.ts) e busca só um novo conjunto de 3
  // tópicos. Reaproveita o contador/limite já existente de "texto"
  // (copyXRegenCount/onTextoRegen) — tópicos e texto corrido são mutuamente
  // exclusivos nesta peça, então reaproveitar o mesmo contador é correto.
  async function regenTopicos() {
    if (!copy) return;
    if ((!isAdmin && copyXRegenCount >= COPY_REGEN_MAX) || copyXBusy) return;
    setCopyXBusy(true);
    setCopyXError(null);
    try {
      const companyName = data.companyName || kit.companyName;
      const mainActivity = data.mainActivity || kit.mainActivity || "";
      const generated = await generatePostUnicoCopy(
        { ...data, companyName, mainActivity },
        kit.brandVoice,
        kit.segment,
        puSlot,
        copy.titulo,
        // Tópicos na tela viram lista de "não repita" no motor — sem isso, o
        // modelo partia do mesmo título + mesma informação-chave e devolvia
        // frases quase idênticas às já entregues (achado real 22/07/2026).
        copy.topicos?.map((t) => t.texto) ?? [],
      );
      if (generated.topicos?.length) {
        setCopy((c) => (c ? { ...c, topicos: generated.topicos, texto: generated.texto } : c));
        onTextoRegen?.();
      } else {
        setCopyXError("Tópicos vazios — tente de novo.");
      }
    } catch (e) {
      setCopyXError((e as Error).message);
    } finally {
      setCopyXBusy(false);
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
        objetivo: data.objetivo,
        formato: "PostUnico",
        tituloAtual: copy.titulo,
        textoAtual: copy.texto,
        intencao: data.intencao ?? null,
        transformacaoPrincipal: data.transformacaoPrincipal ?? null,
        segment: kit.segment,
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
    regenTopicos,
    clearCopy,
  };
}
