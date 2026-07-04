// Geração de imagem/vídeo do Reels (preview sem/com refs, submissão de
// vídeo com poll, burn de título via FFmpeg no modo Sinalização, retry de
// capa/vídeo) — extraído de ReelsCard.tsx (PLANO_V2 Fase 9.1). Lógica
// movida 1:1, sem mudança de comportamento.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getImpersonation } from "@/hooks/useImpersonation";
import { lsGetRaw } from "../../../lib/storage/store";
import { BrandKit, ImageKit, MoodCode, ReelsGuide } from "../../../types";
import { PersonagemGender } from "../../../core/visualDirection";
import type { ModeloOP } from "../../../core/personalizacaoMop";
import { USO_REF_PREFIX } from "../../../lib/storage/keys";
import { generatePostImage } from "../../../services/api";
import { composeReelsPng, composeReelsTitlePng } from "../../../utils/canvasComposer";
import { emptyImageKit } from "../../../utils/imageKitStorage";
import { getSessionImage, setSessionImage } from "../../../utils/sessionImageCache";
import { regenerateWithKit } from "../../../services/regenerateWithKit";
import { burnTitleIntoVideo } from "../../../utils/burnTitleIntoVideo";
import { BRAND_ACCENT } from "../../../data/brandColors";
import { useImageGenAlert } from "../PreImageAlert";

// Modos de renderização de vídeo (Veo3.1 Lite):
// 'portugues'   → áudio nativo do modelo em pt-BR
// 'kit-voz'     → TTS com voz clonada sincronizada via audio_url
// 'sinalizacao' → vídeo silencioso + título queimado no canvas via FFmpeg
export type VideoMode = "portugues" | "kit-voz" | "sinalizacao";

export function useReelsGeneration(params: {
  reels: ReelsGuide;
  kit: BrandKit;
  mood: MoodCode;
  dayNumber: number;
  modelo?: ModeloOP | null;
  imageKit?: ImageKit;
  userId?: string | null;
  forcedGender?: PersonagemGender;
  anchoraPersonagem?: string;
  ancoragePapel?: string;
  onImageGenerated?: () => void;
  guard: ReturnType<typeof useImageGenAlert>["guard"];
  hook: string;
  script: string;
}) {
  const {
    reels,
    kit,
    mood,
    dayNumber,
    modelo,
    imageKit,
    userId,
    forcedGender,
    anchoraPersonagem,
    ancoragePapel,
    onImageGenerated,
    guard,
    hook,
    script,
  } = params;

  const [busy, setBusy] = useState(false);
  const [busyRefs, setBusyRefs] = useState(false);
  const [preview, setPreview] = useState<string | null>(() =>
    getSessionImage(userId, `reels-preview:${dayNumber}`),
  );
  // previewBase = mesma imagem do preview SEM a logo aplicada pelo canvas.
  // É o que mandamos para o gpt-image-2/edit como referência da capa, para
  // que o modelo aplique apenas o lettering do título e não tente redesenhar
  // a logomarca (a logo final é reaplicada por canvas em cima da capa).
  const [previewBase, setPreviewBase] = useState<string | null>(() =>
    getSessionImage(userId, `reels-previewBase:${dayNumber}`),
  );
  const [busyVideo, setBusyVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Resultado real do backend de vídeo (lipsync efetivamente concluído ou não).
  const [usedClonedVoice, setUsedClonedVoice] = useState<boolean | null>(null);
  const [requestedClonedVoice, setRequestedClonedVoice] = useState<boolean>(false);
  const [coverPng, setCoverPng] = useState<string | null>(() =>
    getSessionImage(userId, `reels-cover:${dayNumber}`),
  );
  const [coverError, setCoverError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [retryingCover, setRetryingCover] = useState(false);
  const [retryingVideo, setRetryingVideo] = useState(false);
  const [hasClonedVoice, setHasClonedVoice] = useState(false);
  const [videoMode, setVideoMode] = useState<VideoMode>("portugues");
  const [videoStartedAt, setVideoStartedAt] = useState<number | null>(null);
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [burnProgress, setBurnProgress] = useState<string | null>(null);
  // Ref para limpar blob URLs de vídeos processados pelo FFmpeg (sinalização).
  const burnedBlobUrlRef = useRef<string | null>(null);
  // URL original do FAL (antes do burn) — usada para arquivamento, pois blob URLs
  // expiram ao fechar a página e não podem ser acessadas pelo servidor.
  const falVideoUrlRef = useRef<string | null>(null);

  function updatePreview(value: string | null) {
    setPreview(value);
    setSessionImage(userId, `reels-preview:${dayNumber}`, value);
  }
  function updatePreviewBase(value: string | null) {
    setPreviewBase(value);
    setSessionImage(userId, `reels-previewBase:${dayNumber}`, value);
  }
  function updateCoverPng(value: string | null) {
    setCoverPng(value);
    setSessionImage(userId, `reels-cover:${dayNumber}`, value);
  }

  // Limpa blob URL ao desmontar (evita vazamento de memória).
  useEffect(() => {
    return () => {
      if (burnedBlobUrlRef.current) {
        URL.revokeObjectURL(burnedBlobUrlRef.current);
      }
    };
  }, []);

  // Garante que modos com voz clonada só ficam ativos quando há voz treinada.
  useEffect(() => {
    if (!hasClonedVoice && videoMode === "kit-voz") {
      setVideoMode("portugues");
    }
  }, [hasClonedVoice, videoMode]);

  // Tick simulado de progresso enquanto o vídeo gera.
  useEffect(() => {
    if (!busyVideo || !videoStartedAt) return;
    const id = setInterval(() => {
      setVideoElapsed(Math.floor((Date.now() - videoStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [busyVideo, videoStartedAt]);

  const videoStepLabel = (() => {
    if (!busyVideo) return null;
    if (burnProgress) return burnProgress;
    if (videoMode === "sinalizacao") {
      return videoElapsed > 60 ? "Aplicando sinalização visual…" : "Gerando vídeo…";
    }
    return "Gerando vídeo…";
  })();
  const videoProgressPct = (() => {
    if (!busyVideo) return 0;
    if (videoMode === "kit-voz") {
      return Math.min(95, Math.round((videoElapsed / 120) * 95));
    }
    if (videoMode === "sinalizacao") {
      return Math.min(95, Math.round((videoElapsed / 120) * 95));
    }
    return 0;
  })();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("voice_clones")
        .select("status")
        .eq("user_id", uid)
        .maybeSingle();
      if (alive && data?.status === "ready") setHasClonedVoice(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function runGenerate() {
    setBusy(true);
    try {
      // Logo NÃO vai para a IA — gpt-image-2/edit com logo como referência ignorava o prompt
      // da cena. Logo é aplicada por canvas (igual ao path com refs do Kit Imagem).
      const url = await generatePostImage({
        imagePrompt: reels.imagePrompt,
        titulo: "",
        texto: "",
        companyName: kit.companyName,
        mainActivity: kit.mainActivity,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || BRAND_ACCENT,
        fontFamily: kit.fontPair || "Montserrat",
        secondaryFont: kit.secondaryFont,
        mood,
        vertical: "reels",
        logoPosition: kit.logoPosition,
        forcedGender,
        anchoraPersonagem,
        ancoragePapel,
      });
      const final = kit.logoDataUrl ? await composeReelsPng(kit, url) : url;
      updatePreview(final);
      updatePreviewBase(url); // frame limpo (sem logo) = base ideal para a capa
      setVideoUrl(null);
      updateCoverPng(null);
      onImageGenerated?.();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  function handleGenerate() {
    guard({ hasPreview: !!preview, tipo: "Reels", run: runGenerate });
  }

  async function runGenerateWithRefs() {
    const storageKey = `${USO_REF_PREFIX}:${userId || "anon"}:reels:${dayNumber}`;
    let s: {
      usarAvatar: boolean;
      avatarNum: 1 | 2 | null;
      usarFachada?: boolean;
      cenarioNum: number | null;
      produtosNums: number[];
      useUniforme?: boolean;
    };
    try {
      const raw = lsGetRaw(storageKey);
      const j = raw ? JSON.parse(raw) : {};
      // Migração do formato antigo (usarAvatar boolean) → avatarNum (1|2|null).
      const avatarNum: 1 | 2 | null =
        typeof j.avatarNum === "number" ? j.avatarNum : j.usarAvatar ? 1 : null;
      s = {
        usarAvatar: avatarNum != null,
        avatarNum,
        usarFachada: !!j.usarFachada,
        cenarioNum: typeof j.cenarioNum === "number" ? j.cenarioNum : null,
        produtosNums: Array.isArray(j.produtosNums) ? j.produtosNums : [],
        useUniforme: avatarNum != null && !!j.useUniforme,
      };
    } catch {
      return;
    }
    setBusyRefs(true);
    try {
      const url = await regenerateWithKit({
        slot: { formato: "reels", posicao: dayNumber, elemento: "avatar", motivo: "" },
        kit,
        imageKit: imageKit ?? emptyImageKit,
        mood,
        keyInfo: `${reels.imagePrompt || ""}`.slice(0, 500),
        imagePrompt: reels.imagePrompt,
        leituraCenica: reels.leituraCenica,
        formato: "reels",
        selecaoDireta: s,
        anchoraPersonagem,
        ancoragePapel,
        forcedGender,
        userId,
        modelo,
      });
      const final = await composeReelsPng(kit, url);
      updatePreview(final);
      // url = imagem do reels antes do canvas aplicar a logo → base ideal para o /edit da capa.
      updatePreviewBase(url);
      setVideoUrl(null);
      updateCoverPng(null);
      onImageGenerated?.();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    } finally {
      setBusyRefs(false);
    }
  }

  function handleGenerateWithRefs() {
    guard({ hasPreview: !!preview, tipo: "Reels", run: runGenerateWithRefs });
  }

  async function handleReferenceImageGenerated(url: string) {
    // Reels: a imagem vem limpa do motor (cenário/avatar já
    // aplicados). Aqui só sobrepõe a logo via canvas.
    try {
      const withLogo = kit.logoDataUrl ? await composeReelsPng(kit, url) : url;
      updatePreview(withLogo);
      // url = frame SEM logo → base ideal para o /edit da capa.
      updatePreviewBase(url);
    } catch {
      updatePreview(url);
      updatePreviewBase(url);
    }
    setVideoUrl(null);
    updateCoverPng(null);
  }

  async function submitVideoRequest(): Promise<{
    videoUrl: string;
    usedClonedVoice: boolean;
    requestedClonedVoice: boolean;
  }> {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const imp = getImpersonation();
    const res = await fetch("/api/generate-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(imp ? { "X-Impersonate-User-Id": imp.userId } : {}),
      },
      body: JSON.stringify({
        imageBase64: preview,
        script,
        videoMode,
        useClonedVoice: videoMode === "kit-voz",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao gerar vídeo");

    // Backend submete o job (Kling AI Avatar) e retorna imediatamente com statusUrl/responseUrl.
    // O frontend faz o poll via /api/fal-status a cada 5s até receber o vídeo.
    if (data.phase === "pending" && data.statusUrl && data.responseUrl) {
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch(
          `/api/fal-status?statusUrl=${encodeURIComponent(data.statusUrl)}&responseUrl=${encodeURIComponent(data.responseUrl)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        const s = (await statusRes.json()) as { status: string; videoUrl?: string; error?: string };
        if (s.status === "done" && s.videoUrl) {
          return {
            videoUrl: s.videoUrl,
            usedClonedVoice: data.usedClonedVoice === true,
            requestedClonedVoice: data.requestedClonedVoice === true,
          };
        }
        if (s.status === "failed") throw new Error(s.error || "Geração falhou.");
        // status === 'processing': continua polling
      }
      throw new Error("Geração de vídeo não completou em 10 minutos. Tente novamente.");
    }

    return {
      videoUrl: data.videoUrl as string,
      usedClonedVoice: data.usedClonedVoice === true,
      requestedClonedVoice: data.requestedClonedVoice === true || videoMode === "kit-voz",
    };
  }

  async function runGenerateVideo() {
    if (!preview) return;
    setBusyVideo(true);
    setVideoStartedAt(Date.now());
    setVideoElapsed(0);
    setBurnProgress(null);
    // Só limpa a capa se ainda não há uma gerada — preserva a capa existente nos retries.
    if (!coverPng) setCoverPng(null);
    setCoverError(null);
    setVideoError(null);
    try {
      // Título da capa = hook/título do reels.
      const titleText = hook.trim();

      // Ref da capa = frame sem logo quando disponível; fallback = preview com logo.
      const coverRefImage = previewBase || preview;

      // Só gera nova capa se ainda não há uma — em retries reutiliza a capa existente.
      // Frame (previewBase sem logo) como referência → gpt-image-2/edit preserva cena + aplica título.
      // Logo aplicada por canvas após geração (não vai para a IA).
      const coverPromise: Promise<string> = coverPng
        ? Promise.resolve(coverPng)
        : generatePostImage({
            imagePrompt: reels.imagePrompt,
            titulo: titleText,
            texto: "",
            companyName: kit.companyName,
            mainActivity: kit.mainActivity,
            primaryColor: kit.primaryColor,
            accentColor: kit.accentColor || BRAND_ACCENT,
            fontFamily: kit.fontPair || "Montserrat",
            secondaryFont: kit.secondaryFont,
            mood,
            vertical: "reels_cover",
            logoDataUrl: kit.logoDataUrl,
            logoPosition: kit.logoPosition,
            referenceImages: coverRefImage ? [coverRefImage] : undefined,
          }).then(async (url) => (kit.logoDataUrl ? composeReelsPng(kit, url) : url));

      const videoPromise = submitVideoRequest();

      const [videoRes, coverRes] = await Promise.allSettled([videoPromise, coverPromise]);

      // PRIMEIRO trata capa.
      if (coverRes.status === "fulfilled") {
        updateCoverPng(coverRes.value);
      } else {
        const msg = (coverRes.reason as Error)?.message || "erro desconhecido";
        console.error("[runGenerateVideo] capa falhou:", coverRes.reason);
        setCoverError(msg);
      }

      // DEPOIS trata vídeo.
      if (videoRes.status === "rejected") {
        const msg = (videoRes.reason as Error)?.message || "erro desconhecido";
        console.error("[runGenerateVideo] vídeo falhou:", videoRes.reason);
        setVideoError(msg);
        return;
      }

      const falUrl = videoRes.value.videoUrl;
      falVideoUrlRef.current = falUrl; // preserva URL FAL para arquivamento
      let finalVideoUrl = falUrl;
      setUsedClonedVoice(videoRes.value.usedClonedVoice);
      setRequestedClonedVoice(videoRes.value.requestedClonedVoice);

      // Modo Sinalização: queima o screenText como overlay visual usando FFmpeg.
      // O título aparece nos primeiros 4s do vídeo (metade do reels de 8s).
      if (videoMode === "sinalizacao" && titleText) {
        try {
          setBurnProgress("Etapa 2/2: Carregando processador de sinalização…");
          const baseImg = previewBase || preview || undefined;
          const titlePng = await composeReelsTitlePng(kit, titleText, baseImg ?? undefined, mood);
          setBurnProgress("Etapa 2/2: Aplicando texto visual no vídeo…");
          const burnedBlob = await burnTitleIntoVideo(falUrl, titlePng, 4.0, (msg) =>
            setBurnProgress(`Sinalização: ${msg}`),
          );
          // Libera o blob anterior antes de criar o novo.
          if (burnedBlobUrlRef.current) {
            URL.revokeObjectURL(burnedBlobUrlRef.current);
          }
          const blobUrl = URL.createObjectURL(burnedBlob);
          burnedBlobUrlRef.current = blobUrl;
          finalVideoUrl = blobUrl;
        } catch (e) {
          // Falha no burn não impede o usuário de ver o vídeo base.
          console.warn("[runGenerateVideo] sinalizacao burn falhou:", (e as Error).message);
          setVideoError(
            `Sinalização visual falhou: ${(e as Error).message}. O vídeo base está disponível.`,
          );
        }
        setBurnProgress(null);
      }

      setVideoUrl(finalVideoUrl);
      onImageGenerated?.();
    } finally {
      setBusyVideo(false);
      setVideoStartedAt(null);
      setBurnProgress(null);
    }
  }

  async function retryVideoOnly() {
    if (!preview || retryingVideo) return;
    setRetryingVideo(true);
    setVideoError(null);
    setVideoStartedAt(Date.now());
    setVideoElapsed(0);
    setBurnProgress(null);
    try {
      const r = await submitVideoRequest();
      const falUrl = r.videoUrl;
      falVideoUrlRef.current = falUrl;
      let finalVideoUrl = falUrl;

      if (videoMode === "sinalizacao") {
        const titleText = hook.trim();
        if (titleText) {
          try {
            setBurnProgress("Aplicando sinalização visual…");
            const baseImg = previewBase || preview || undefined;
            const titlePng = await composeReelsTitlePng(kit, titleText, baseImg ?? undefined, mood);
            const burnedBlob = await burnTitleIntoVideo(falUrl, titlePng, 4.0, (msg) =>
              setBurnProgress(msg),
            );
            if (burnedBlobUrlRef.current) URL.revokeObjectURL(burnedBlobUrlRef.current);
            const blobUrl = URL.createObjectURL(burnedBlob);
            burnedBlobUrlRef.current = blobUrl;
            finalVideoUrl = blobUrl;
          } catch (e) {
            console.warn("[retryVideoOnly] sinalizacao burn falhou:", (e as Error).message);
          }
        }
      }

      setVideoUrl(finalVideoUrl);
      setUsedClonedVoice(r.usedClonedVoice);
      setRequestedClonedVoice(r.requestedClonedVoice);
      onImageGenerated?.();
    } catch (e) {
      const msg = (e as Error)?.message || "erro desconhecido";
      console.error("[retryVideoOnly]", e);
      setVideoError(msg);
    } finally {
      setRetryingVideo(false);
      setVideoStartedAt(null);
      setBurnProgress(null);
    }
  }

  async function retryCover() {
    if (!preview || retryingCover) return;
    setRetryingCover(true);
    setCoverError(null);
    try {
      // Título da capa = hook/título do reels.
      const titleText = hook.trim();
      // Frame (previewBase sem logo) como referência → gpt-image-2/edit preserva cena + aplica título.
      // Logo aplicada por canvas após geração.
      const url = await generatePostImage({
        imagePrompt: reels.imagePrompt,
        titulo: titleText,
        texto: "",
        companyName: kit.companyName,
        mainActivity: kit.mainActivity,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || BRAND_ACCENT,
        fontFamily: kit.fontPair || "Montserrat",
        secondaryFont: kit.secondaryFont,
        mood,
        vertical: "reels_cover",
        logoDataUrl: kit.logoDataUrl,
        logoPosition: kit.logoPosition,
        referenceImages: previewBase || preview ? [(previewBase || preview) as string] : undefined,
      });
      const withLogo = kit.logoDataUrl ? await composeReelsPng(kit, url) : url;
      updateCoverPng(withLogo);
    } catch (e) {
      setCoverError((e as Error)?.message || "erro desconhecido");
    } finally {
      setRetryingCover(false);
    }
  }

  function handleGenerateVideo() {
    guard({ hasPreview: !!videoUrl, tipo: "Vídeo", run: runGenerateVideo });
  }

  return {
    preview,
    previewBase,
    busy,
    busyRefs,
    busyVideo,
    videoUrl,
    usedClonedVoice,
    requestedClonedVoice,
    coverPng,
    coverError,
    videoError,
    retryingCover,
    retryingVideo,
    hasClonedVoice,
    videoMode,
    setVideoMode,
    videoStepLabel,
    videoProgressPct,
    falVideoUrlRef,
    handleGenerate,
    handleGenerateWithRefs,
    handleReferenceImageGenerated,
    handleGenerateVideo,
    retryVideoOnly,
    retryCover,
  };
}
