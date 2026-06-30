import { BRAND_ACCENT } from "../../../data/brandColors";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getImpersonation } from "@/hooks/useImpersonation";
import { lsGetRaw } from "../../../lib/storage/store";
import { BrandKit, MoodCode, ReelsGuide } from "../../../types";
import { PersonagemGender } from "../../../core/visualDirection";
import { type RegenKind } from "../../../services/regenerateBlock";
import { generatePostImage } from "../../../services/api";
import { composeReelsPng, composeReelsTitlePng, downloadDataUrl } from "../../../utils/canvasComposer";
import { mopName } from "../../../utils/file";
import { emptyImageKit } from "../../../utils/imageKitStorage";
import { getSessionImage, setSessionImage } from "../../../utils/sessionImageCache";
import { loadCopyEdit, saveCopyEdit } from "../../../utils/copyEditsStorage";
import { regenerateWithKit } from "../../../services/regenerateWithKit";
import { burnTitleIntoVideo } from "../../../utils/burnTitleIntoVideo";
import { useIsMobile } from "../../../hooks/use-mobile";
import { ArchiveButton } from "../ArchiveButton";
import UsoReferenciasDia from "../UsoReferenciasDia";
import { useImageGenAlert } from "../PreImageAlert";
import { EditableField } from "./EditableField";
import { RefSelectorProps, RefsRegenButton } from "./RefsRegenButton";
import { insertSignature, useSyncUpstream, shareLegendaWhatsApp } from "./utils";

// Modos de renderização de vídeo (Veo3.1 Lite):
// 'portugues'   → áudio nativo do modelo em pt-BR
// 'kit-voz'     → TTS com voz clonada sincronizada via audio_url
// 'sinalizacao' → vídeo silencioso + título queimado no canvas via FFmpeg
type VideoMode = "portugues" | "kit-voz" | "sinalizacao";

export function ReelsCard({
  reels,
  kit,
  mood,
  dayNumber,
  track,
  keyInfo,
  guard,
  segmento,
  modelo,
  imageKit,
  extrasCarrossel,
  onImageGenerated,
  userId,
  forcedGender,
  anchoraPersonagem,
  ancoragePapel,
}: {
  reels: ReelsGuide;
  kit: BrandKit;
  mood: MoodCode;
  dayNumber: number;
  track?: string;
  keyInfo: string;
  guard: ReturnType<typeof useImageGenAlert>["guard"];
  onImageGenerated?: () => void;
  userId?: string | null;
  forcedGender?: PersonagemGender;
  anchoraPersonagem?: string;
  ancoragePapel?: string;
} & RefSelectorProps) {
  const [open, setOpen] = useState(false);
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
  const [copied, setCopied] = useState(false);
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
  const videoRef = useRef<HTMLDivElement | null>(null);

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
  const isMobile = useIsMobile();

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

  // Conteúdo editável do reels
  const reelsCopyKey = `reels:${dayNumber}`;
  const savedReelsCopyEdit = useMemo(
    () => loadCopyEdit(userId, reelsCopyKey),
    [userId, reelsCopyKey],
  );
  const [hook, setHook] = useState(savedReelsCopyEdit?.titulo ?? reels.hook);
  const [script, setScript] = useState(savedReelsCopyEdit?.texto ?? reels.script);
  const [legenda, setLegenda] = useState(
    savedReelsCopyEdit?.legenda ?? (reels.legenda || reels.script || "").trim(),
  );
  const [hCount, setHCount] = useState(savedReelsCopyEdit?.tCount ?? 0);
  const [sCount, setSCount] = useState(savedReelsCopyEdit?.xCount ?? 0);
  const [lCount, setLCount] = useState(savedReelsCopyEdit?.lCount ?? 0);
  useEffect(() => {
    saveCopyEdit(userId, reelsCopyKey, {
      titulo: hook,
      texto: script,
      legenda,
      tCount: hCount,
      xCount: sCount,
      lCount,
    });
  }, [userId, reelsCopyKey, hook, script, legenda, hCount, sCount, lCount]);
  useSyncUpstream(reels.hook, hook, setHook);
  useSyncUpstream(reels.script, script, setScript);
  useSyncUpstream((reels.legenda || reels.script || "").trim(), legenda, setLegenda);

  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [videoUrl]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(legenda);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

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
      alert(`Erro: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  function handleGenerate() {
    guard({ hasPreview: !!preview, tipo: "Reels", run: runGenerate });
  }

  async function runGenerateWithRefs() {
    const storageKey = `uso-ref:reels:${dayNumber}`;
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
      });
      const final = await composeReelsPng(kit, url);
      updatePreview(final);
      // url = imagem do reels antes do canvas aplicar a logo → base ideal para o /edit da capa.
      updatePreviewBase(url);
      setVideoUrl(null);
      updateCoverPng(null);
      onImageGenerated?.();
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`);
    } finally {
      setBusyRefs(false);
    }
  }

  function handleGenerateWithRefs() {
    guard({ hasPreview: !!preview, tipo: "Reels", run: runGenerateWithRefs });
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

  const ctx = (kind: RegenKind) => ({
    kind,
    companyName: kit.companyName,
    mainActivity: kit.mainActivity,
    keyInfo,
    formato: "Reels",
    tituloAtual: hook,
    textoAtual: `Roteiro: ${script}`,
    legendaAtual: legenda,
  });

  function handleGenerateVideo() {
    guard({ hasPreview: !!videoUrl, tipo: "Vídeo", run: runGenerateVideo });
  }

  return (
    <article className="contentCard">
      <button className="cardHeader" type="button" onClick={() => setOpen((o) => !o)}>
        <div className="cardHeaderLeft">
          <span className="cardTag">Dia {dayNumber} · Reels</span>
          <strong className="cardTitle">{hook}</strong>
        </div>
        <span className="cardChevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="cardBody">
          <UsoReferenciasDia
            segmento={segmento}
            modelo={modelo}
            formato="reels"
            posicao={dayNumber}
            extrasCarrossel={extrasCarrossel}
            kit={kit}
            imageKit={imageKit ?? emptyImageKit}
            mood={mood}
            imagePrompt={reels.imagePrompt}
            formatoOverride="reels"
            storageKey={`uso-ref:reels:${dayNumber}`}
            userId={userId}
            forcedGender={forcedGender}
            anchoraPersonagem={anchoraPersonagem}
            ancoragePapel={ancoragePapel}
            onGerou={async (url) => {
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
            }}
          />
          <EditableField
            label="Hook / Título do reels"
            kind="titulo"
            value={hook}
            original={reels.hook}
            count={hCount}
            onChange={setHook}
            onRegenSuccess={() => setHCount((c) => c + 1)}
            ctxBuilder={() => ctx("titulo")}
            maxWords={6}
          />
          <EditableField
            label="Roteiro falado (TTS ou voz clonada)"
            kind="texto"
            value={script}
            original={reels.script}
            count={sCount}
            onChange={setScript}
            onRegenSuccess={() => setSCount((c) => c + 1)}
            ctxBuilder={() => ctx("texto")}
            multiline
            maxWords={22}
          />
          <EditableField
            label="Legenda"
            kind="legenda"
            value={legenda}
            original={(reels.legenda || reels.script || "").trim()}
            count={lCount}
            onChange={setLegenda}
            onRegenSuccess={() => setLCount((c) => c + 1)}
            ctxBuilder={() => ctx("legenda")}
            multiline
            maxWords={40}
            excludeTexts={kit.assinatura ? [kit.assinatura] : undefined}
          />

          {legenda && (
            <div className="cardActions" style={{ marginBottom: 4 }}>
              <button
                type="button"
                disabled={!(kit.assinatura && !legenda.includes(kit.assinatura))}
                onClick={() => {
                  if (kit.assinatura && !legenda.includes(kit.assinatura))
                    setLegenda(insertSignature(legenda, kit.assinatura));
                }}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor:
                    kit.assinatura && !legenda.includes(kit.assinatura) ? "pointer" : "default",
                  background:
                    kit.assinatura && !legenda.includes(kit.assinatura) ? "#0f172a" : "#e2e8f0",
                  color: kit.assinatura && !legenda.includes(kit.assinatura) ? "#fff" : "#94a3b8",
                }}
              >
                Inserir Assinatura
              </button>
              <button
                className="downloadBtn"
                type="button"
                onClick={handleCopy}
                style={{ minHeight: 44, fontSize: 15 }}
              >
                {copied ? "✓ Copiado!" : "📋 Copiar legenda"}
              </button>
              {isMobile && (
                <button
                  className="downloadBtn"
                  type="button"
                  onClick={() => shareLegendaWhatsApp("Reels", legenda)}
                  style={{ minHeight: 44, fontSize: 15 }}
                >
                  📲 Compartilhar no WhatsApp
                </button>
              )}
            </div>
          )}

          {preview && (
            <div className="previewWrapper">
              <img src={preview} alt="Reels" className="previewImgReels" />
            </div>
          )}
          <div className="cardActions">
            <button
              className="generateBtn"
              type="button"
              onClick={handleGenerate}
              disabled={busy || busyRefs || busyVideo}
            >
              {busy
                ? "Gerando..."
                : preview
                  ? "↻ Gerar novamente (sem refs)"
                  : "⬇ Gerar imagem pura"}
            </button>
            <RefsRegenButton
              storageKey={`uso-ref:reels:${dayNumber}`}
              busy={busyRefs || busyVideo}
              onRun={handleGenerateWithRefs}
              imageKit={imageKit}
              formato="reels"
              segmento={segmento}
              modelo={modelo}
              hasPreview={!!preview}
            />
            {preview &&
              (() => {
                const isCine = track === "cinematica";
                const baseTipo = isCine
                  ? `s3c_${String(dayNumber).padStart(2, "0")}`
                  : `rel${String(dayNumber).padStart(2, "0")}`;
                return (
                  <button
                    className="downloadBtn"
                    type="button"
                    onClick={() =>
                      downloadDataUrl(
                        preview,
                        mopName({ company: kit.companyName, tipo: `${baseTipo}_cp`, ext: "jpg" }),
                      )
                    }
                  >
                    Baixar
                  </button>
                );
              })()}
          </div>
          {preview && (
            <div
              className="cardActions"
              style={{ marginTop: 8, flexDirection: "column", alignItems: "stretch", gap: 8 }}
            >
              {/* Seletor dos modos de renderização de vídeo */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {(
                  [
                    {
                      mode: "portugues" as VideoMode,
                      icon: "🎙️",
                      label: "Voz nativa",
                      desc: "",
                      disabled: false,
                      title: "Gera vídeo com voz automática em português.",
                    },
                    {
                      mode: "kit-voz" as VideoMode,
                      icon: "🎤",
                      label: "Kit de Voz",
                      desc: hasClonedVoice ? "" : "Configure no Kit",
                      disabled: !hasClonedVoice,
                      title: hasClonedVoice
                        ? "Gera vídeo com sua voz clonada."
                        : "Treine e aprove sua voz no Kit Imagem primeiro.",
                    },
                  ] as Array<{
                    mode: VideoMode;
                    icon: string;
                    label: string;
                    desc: string;
                    disabled: boolean;
                    title: string;
                  }>
                ).map(({ mode, icon, label, desc, disabled, title }) => {
                  const active = videoMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      title={title}
                      disabled={disabled || busyVideo}
                      onClick={() => setVideoMode(mode)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        padding: "8px 6px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: active ? 700 : 500,
                        cursor: disabled ? "not-allowed" : "pointer",
                        background: active ? "#123a63" : "#f8fafc",
                        color: active ? "#fff" : disabled ? "#94a3b8" : "#0f172a",
                        border: `1.5px solid ${active ? "#123a63" : "#e2e8f0"}`,
                        transition: "all .15s",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{icon}</span>
                      <span>{label}</span>
                      {desc && <span style={{ fontSize: 10, opacity: 0.75 }}>{desc}</span>}
                    </button>
                  );
                })}
              </div>

              <button
                className="generateBtn"
                type="button"
                onClick={handleGenerateVideo}
                disabled={busyVideo || busy}
              >
                {busyVideo
                  ? videoStepLabel || "Gerando vídeo..."
                  : videoUrl
                    ? "↻ Gerar vídeo novamente"
                    : videoMode === "kit-voz"
                      ? "🎤 Gerar vídeo com minha voz"
                      : "🎙️ Gerar vídeo"}
              </button>

              {busyVideo && videoMode === "kit-voz" && (
                <div
                  style={{
                    width: "100%",
                    height: 6,
                    background: "#e2e8f0",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${videoProgressPct}%`,
                      height: "100%",
                      background: "#123a63",
                      transition: "width 1s linear",
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {videoUrl &&
            (() => {
              const isCine = track === "cinematica";
              const baseTipo = isCine
                ? `s3c_${String(dayNumber).padStart(2, "0")}`
                : `rel${String(dayNumber).padStart(2, "0")}`;
              const videoFile = mopName({
                company: kit.companyName,
                tipo: `${baseTipo}_vt`,
                ext: "mp4",
              });
              const coverFile = mopName({
                company: kit.companyName,
                tipo: `${baseTipo}_cp`,
                ext: "png",
              });
              return (
                <div ref={videoRef} className="previewWrapper" style={{ marginTop: 12 }}>
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    style={{ width: "100%", borderRadius: 12 }}
                  />
                  {/* Badges de modo e resultado real do backend. */}
                  {usedClonedVoice === true && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "#ecfdf5",
                        border: "1px solid #6ee7b7",
                        color: "#065f46",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      🎤 Voz clonada aplicada
                    </div>
                  )}
                  {usedClonedVoice === false && requestedClonedVoice && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "#fffbeb",
                        border: "1px solid #fcd34d",
                        color: "#78350f",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      ⚠ Vídeo gerado sem sua voz clonada (a sincronização falhou — ficou com a voz
                      automática)
                    </div>
                  )}
                  {videoMode === "sinalizacao" && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "#f0f9ff",
                        border: "1px solid #7dd3fc",
                        color: "#0c4a6e",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      📝 Sinalização visual aplicada
                    </div>
                  )}
                  <button
                    type="button"
                    className="downloadBtn"
                    style={{ display: "block", marginTop: 8, textAlign: "center", width: "100%" }}
                    onClick={async () => {
                      try {
                        const resp = await fetch(videoUrl);
                        const blob = await resp.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = videoFile;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
                      } catch (e) {
                        alert(`Não foi possível baixar o vídeo: ${(e as Error).message}`);
                      }
                    }}
                  >
                    ⬇ Baixar vídeo
                  </button>
                  {coverPng && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: "#f0f9ff",
                        border: "1px solid #7dd3fc",
                        borderRadius: 8,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: 13,
                          color: "#0c4a6e",
                          fontWeight: 600,
                        }}
                      >
                        📸 Capa do Reels (use no Instagram)
                      </p>
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#0c4a6e" }}>
                        No Instagram, ao postar o reels, toque em "Capa" → "Adicionar da galeria" e
                        selecione esta imagem.
                      </p>
                      <img
                        src={coverPng}
                        alt="Capa"
                        style={{
                          width: "min(80%, 320px)",
                          borderRadius: 8,
                          display: "block",
                          margin: "0 auto 8px",
                        }}
                      />
                      <a
                        href={coverPng}
                        download={coverFile}
                        className="downloadBtn"
                        style={{ display: "block", textAlign: "center" }}
                      >
                        ⬇ Baixar capa
                      </a>
                    </div>
                  )}
                  {!coverPng && coverError && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: "#fffbeb",
                        border: "1px solid #fcd34d",
                        borderRadius: 8,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: 13,
                          color: "#78350f",
                          fontWeight: 600,
                        }}
                      >
                        ⚠ Capa do Reels não foi gerada
                      </p>
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#78350f" }}>
                        Não conseguimos finalizar a capa automática agora. O vídeo está pronto
                        normalmente — você pode gerar a capa novamente abaixo.
                      </p>
                      <button
                        type="button"
                        className="downloadBtn"
                        onClick={retryCover}
                        disabled={retryingCover}
                        style={{ display: "block", margin: "0 auto" }}
                      >
                        {retryingCover ? "Gerando capa…" : "🔄 Gerar capa novamente"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          {/* Painel de capa/erro do vídeo quando NÃO há vídeo (vídeo falhou) — capa é preservada e usuário pode tentar só o vídeo. */}
          {!videoUrl &&
            (coverPng || coverError || videoError) &&
            (() => {
              const isCine = track === "cinematica";
              const baseTipo = isCine
                ? `s3c_${String(dayNumber).padStart(2, "0")}`
                : `rel${String(dayNumber).padStart(2, "0")}`;
              const coverFile = mopName({
                company: kit.companyName,
                tipo: `${baseTipo}_cp`,
                ext: "png",
              });
              return (
                <div style={{ marginTop: 12 }}>
                  {videoError && (
                    <div
                      style={{
                        padding: 12,
                        background: "#fffbeb",
                        border: "1px solid #fcd34d",
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: 13,
                          color: "#78350f",
                          fontWeight: 600,
                        }}
                      >
                        ⚠ Vídeo não foi gerado
                      </p>
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#78350f" }}>
                        {coverPng
                          ? "Não conseguimos gerar o vídeo desta vez. A capa foi gerada normalmente — você pode tentar o vídeo de novo sem refazer a capa."
                          : "Não conseguimos gerar o vídeo desta vez. Tente novamente."}
                      </p>
                      <button
                        type="button"
                        className="downloadBtn"
                        onClick={retryVideoOnly}
                        disabled={retryingVideo}
                        style={{ display: "block", margin: "0 auto" }}
                      >
                        {retryingVideo ? "Gerando vídeo…" : "🔄 Tentar gerar vídeo novamente"}
                      </button>
                    </div>
                  )}
                  {coverPng && (
                    <div
                      style={{
                        padding: 12,
                        background: "#f0f9ff",
                        border: "1px solid #7dd3fc",
                        borderRadius: 8,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: 13,
                          color: "#0c4a6e",
                          fontWeight: 600,
                        }}
                      >
                        📸 Capa do Reels (use no Instagram)
                      </p>
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#0c4a6e" }}>
                        No Instagram, ao postar o reels, toque em "Capa" → "Adicionar da galeria" e
                        selecione esta imagem.
                      </p>
                      <img
                        src={coverPng}
                        alt="Capa"
                        style={{
                          width: "min(80%, 320px)",
                          borderRadius: 8,
                          display: "block",
                          margin: "0 auto 8px",
                        }}
                      />
                      <a
                        href={coverPng}
                        download={coverFile}
                        className="downloadBtn"
                        style={{ display: "block", textAlign: "center" }}
                      >
                        ⬇ Baixar capa
                      </a>
                    </div>
                  )}
                  {!coverPng && coverError && (
                    <div
                      style={{
                        padding: 12,
                        background: "#fffbeb",
                        border: "1px solid #fcd34d",
                        borderRadius: 8,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 8px",
                          fontSize: 13,
                          color: "#78350f",
                          fontWeight: 600,
                        }}
                      >
                        ⚠ Capa do Reels não foi gerada
                      </p>
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#78350f" }}>
                        Não conseguimos finalizar a capa automática agora.
                      </p>
                      <button
                        type="button"
                        className="downloadBtn"
                        onClick={retryCover}
                        disabled={retryingCover}
                        style={{ display: "block", margin: "0 auto" }}
                      >
                        {retryingCover ? "Gerando capa…" : "🔄 Gerar capa novamente"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <ArchiveButton
              tipo="S3V"
              formato="reels"
              dia={dayNumber}
              legenda={legenda}
              imageDataUrls={[coverPng || preview]}
              videoUrl={
                // Sinalizacao: blob URL expira; usa a URL FAL original para arquivamento.
                falVideoUrlRef.current || videoUrl
              }
              titulo={hook}
              disabledReason="Gere o vídeo (e a capa) antes de arquivar"
            />
          </div>
        </div>
      )}
    </article>
  );
}
