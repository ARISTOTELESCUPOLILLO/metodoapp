import { useState } from "react";
import { toast } from "sonner";
import { BrandKit, MoodCode, ReelsGuide } from "../../../types";
import { PersonagemGender } from "../../../core/visualDirection";
import { type RegenKind } from "../../../services/regenerateBlock";
import { downloadDataUrl } from "../../../utils/canvasComposer";
import { mopName } from "../../../utils/file";
import { emptyImageKit } from "../../../utils/imageKitStorage";
import { useIsMobile } from "../../../hooks/use-mobile";
import { ArchiveButton } from "../ArchiveButton";
import UsoReferenciasDia from "../UsoReferenciasDia";
import { useImageGenAlert } from "../PreImageAlert";
import { EditableField } from "./EditableField";
import { RefSelectorProps, RefsRegenButton } from "./RefsRegenButton";
import { insertSignature, shareLegendaWhatsApp } from "./utils";
import { useReelsCopyEdit } from "./useReelsCopyEdit";
import { useReelsGeneration } from "./useReelsGeneration";
import { ReelsVideoSection } from "./ReelsVideoSection";

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
  const [copied, setCopied] = useState(false);
  const isMobile = useIsMobile();

  const {
    hook,
    setHook,
    script,
    setScript,
    legenda,
    setLegenda,
    hCount,
    setHCount,
    sCount,
    setSCount,
    lCount,
    setLCount,
  } = useReelsCopyEdit(reels, userId, dayNumber);

  const {
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
  } = useReelsGeneration({
    reels,
    kit,
    mood,
    dayNumber,
    imageKit,
    userId,
    forcedGender,
    anchoraPersonagem,
    ancoragePapel,
    onImageGenerated,
    guard,
    hook,
    script,
  });

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(legenda);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
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
            onGerou={handleReferenceImageGenerated}
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
          <ReelsVideoSection
            preview={preview}
            videoUrl={videoUrl}
            busy={busy}
            busyVideo={busyVideo}
            videoMode={videoMode}
            setVideoMode={setVideoMode}
            hasClonedVoice={hasClonedVoice}
            videoStepLabel={videoStepLabel}
            videoProgressPct={videoProgressPct}
            handleGenerateVideo={handleGenerateVideo}
            track={track}
            dayNumber={dayNumber}
            kit={kit}
            usedClonedVoice={usedClonedVoice}
            requestedClonedVoice={requestedClonedVoice}
            coverPng={coverPng}
            coverError={coverError}
            videoError={videoError}
            retryCover={retryCover}
            retryingCover={retryingCover}
            retryVideoOnly={retryVideoOnly}
            retryingVideo={retryingVideo}
          />
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
