import { useState, useRef, useEffect } from "react";
import type { BrandKit, ImageKit, PostUnicoFormData, PostUnicoVisualSelection } from "../types";
import {
  generatePostUnico,
  generatePostUnicoCaption,
  type PostUnicoCaption,
  type PostUnicoCopy,
} from "../services/postUnico";
import { buildReferences } from "../services/regenerateWithKit";
import { detectForcedGenderFromCopy, PersonagemGender } from "../core/visualDirection";
import { mapFaixaToAnchorAge } from "../core/audienceAge";
import { loadImageKitAsync } from "../utils/imageKitStorage";
import { lsSetQuotaSafe } from "../lib/storage/store";
import { PU_IMG_KEY, PU_STARTED_KEY } from "../lib/storage/keys";

interface Params {
  postUnico: PostUnicoFormData;
  kit: BrandKit;
  imageKit: ImageKit;
  setImageKit: (kit: ImageKit) => void;
  visualSelection: PostUnicoVisualSelection;
  selectedSlot: "plano1" | "plano2" | "bonus";
  effectiveUserId: string | null;
  refreshProfile: () => void;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
}

export function usePostUnicoGeneration({
  postUnico,
  kit,
  imageKit,
  setImageKit,
  visualSelection,
  selectedSlot,
  effectiveUserId,
  refreshProfile,
  setLoading,
  setError,
}: Params) {
  const [postUnicoImg, setPostUnicoImg] = useState<string | undefined>();
  const [postUnicoStarted, setPostUnicoStarted] = useState(false);
  const [caption, setCaption] = useState<PostUnicoCaption | undefined>();
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionError, setCaptionError] = useState("");
  const [puTituloRegen, setPuTituloRegen] = useState(0);
  const [puTextoRegen, setPuTextoRegen] = useState(0);
  const [puCaptionRegen, setPuCaptionRegen] = useState(0);
  const [puCopy, setPuCopy] = useState<PostUnicoCopy | null>(null);
  const [puCopyOriginal, setPuCopyOriginal] = useState<PostUnicoCopy | null>(null);
  const postUnicoGenderRef = useRef<PersonagemGender | undefined>(undefined);
  const lastPuCopyRef = useRef<{ titulo: string; texto: string } | undefined>(undefined);

  useEffect(() => {
    if (puCopy) lastPuCopyRef.current = { titulo: puCopy.titulo, texto: puCopy.texto };
  }, [puCopy]);

  async function handleGenerateCaption() {
    setCaptionLoading(true);
    setCaptionError("");
    try {
      const c = await generatePostUnicoCaption(
        {
          ...postUnico,
          companyName: postUnico.companyName || kit.companyName,
          mainActivity: postUnico.mainActivity || kit.mainActivity || "",
        },
        { brandVoice: kit.brandVoice, previousCaption: caption?.full },
      );
      setCaption(c);
      setPuCaptionRegen((n) => n + 1);
    } catch (e) {
      setCaptionError(String((e as Error).message || e));
    } finally {
      setCaptionLoading(false);
    }
  }

  async function handleGeneratePostUnico(
    copy?: { titulo: string; texto: string },
    opts?: { regenerate?: boolean },
  ) {
    const isRegenerate = !!opts?.regenerate;
    const effectiveCopy = copy ?? (isRegenerate ? lastPuCopyRef.current : undefined);
    if (copy) lastPuCopyRef.current = copy;
    copy = effectiveCopy;
    setLoading(true);
    setError("");
    setPostUnicoImg(undefined);
    setPostUnicoStarted(true);
    setCaption(undefined);
    setCaptionError("");
    setPuCaptionRegen(0);
    const data = {
      ...postUnico,
      companyName: postUnico.companyName || kit.companyName,
      mainActivity: postUnico.mainActivity || kit.mainActivity || "",
    };
    setCaptionLoading(true);
    generatePostUnicoCaption(data, {
      debit: true,
      brandVoice: kit.brandVoice,
      preferredSlot: selectedSlot,
    })
      .then((c) => {
        setCaption(c);
        refreshProfile();
      })
      .catch((e) => setCaptionError(String((e as Error).message || e)))
      .finally(() => setCaptionLoading(false));
    try {
      const freshImageKit = await loadImageKitAsync(effectiveUserId).catch(() => imageKit);
      setImageKit(freshImageKit);
      const rawPersonagemSemAvatar = visualSelection.personagemSemAvatar?.ativo
        ? visualSelection.personagemSemAvatar
        : undefined;
      const personagemSemAvatar = rawPersonagemSemAvatar
        ? {
            ...rawPersonagemSemAvatar,
            ...(data.generoPref && {
              genero: (data.generoPref === "F" ? "mulher" : "homem") as "mulher" | "homem",
            }),
            ...(data.faixaEtaria && {
              idade:
                mapFaixaToAnchorAge(data.faixaEtaria) ??
                rawPersonagemSemAvatar.idade,
            }),
          }
        : undefined;
      const references = buildReferences(
        "avatar",
        freshImageKit,
        undefined,
        undefined,
        {
          usarAvatar: visualSelection.useAvatar,
          avatarNum: visualSelection.avatarSelecionado ?? 1,
          usarFachada: visualSelection.useFachada,
          cenarioNum: visualSelection.useCenario ? (visualSelection.cenarioSelecionado ?? 1) : null,
          produtosNums: visualSelection.useProdutos
            ? visualSelection.produtosSelecionados
            : undefined,
          useUniforme: visualSelection.useUniforme,
          personagemSemAvatar,
          produtoTelaInformativa: visualSelection.produtoTelaInformativa,
        },
        kit.uniformeDataUrl,
      );
      if (visualSelection.useFato && freshImageKit.fato) references.fato = freshImageKit.fato;
      if (visualSelection.useVenda && freshImageKit.venda) references.venda = freshImageKit.venda;
      const hasRefs = !!(
        references.avatar ||
        references.fachada ||
        references.cenario ||
        references.produtos?.length ||
        references.uniforme ||
        references.personagemSemAvatarAtivo ||
        references.fato ||
        references.venda
      );
      const formGender: PersonagemGender | null =
        data.generoPref === "F" ? "mulher" : data.generoPref === "M" ? "homem" : null;
      if (postUnicoGenderRef.current === undefined) {
        postUnicoGenderRef.current =
          detectForcedGenderFromCopy(copy?.titulo, copy?.texto) ??
          (Math.random() < 0.5 ? "mulher" : "homem");
      }
      const effectiveForcedGender: PersonagemGender | undefined =
        (personagemSemAvatar?.genero as PersonagemGender | undefined) ??
        formGender ??
        postUnicoGenderRef.current;
      const dataUrl = await generatePostUnico({
        data,
        kit,
        copy,
        references: hasRefs ? references : undefined,
        preferredSlot: selectedSlot,
        forcedGender: effectiveForcedGender,
        variationHint: isRegenerate,
      });
      lsSetQuotaSafe(PU_IMG_KEY, JSON.stringify(dataUrl), effectiveUserId);
      lsSetQuotaSafe(PU_STARTED_KEY, "false", effectiveUserId);
      setPostUnicoImg(dataUrl);
      refreshProfile();
    } catch (e) {
      lsSetQuotaSafe(PU_STARTED_KEY, "false", effectiveUserId);
      setError(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }

  function clearPostUnicoState() {
    setPostUnicoImg(undefined);
    setPostUnicoStarted(false);
    setCaption(undefined);
    setCaptionError("");
    postUnicoGenderRef.current = undefined;
    lastPuCopyRef.current = undefined;
    setPuTituloRegen(0);
    setPuTextoRegen(0);
    setPuCaptionRegen(0);
    setPuCopy(null);
    setPuCopyOriginal(null);
  }

  return {
    postUnicoImg,
    setPostUnicoImg,
    postUnicoStarted,
    setPostUnicoStarted,
    caption,
    setCaption,
    captionLoading,
    captionError,
    setCaptionError,
    puTituloRegen,
    setPuTituloRegen,
    puTextoRegen,
    setPuTextoRegen,
    puCaptionRegen,
    puCopy,
    setPuCopy,
    puCopyOriginal,
    setPuCopyOriginal,
    handleGeneratePostUnico,
    handleGenerateCaption,
    clearPostUnicoState,
  };
}
