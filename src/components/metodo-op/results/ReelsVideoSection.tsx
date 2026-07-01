// Seção de vídeo do Reels: seletor de modo de renderização, botão "Gerar
// vídeo" com barra de progresso, player do vídeo gerado (com badges de
// voz/sinalização e capa), e painéis de retry de capa/vídeo quando algo
// falhou — extraído de ReelsCard.tsx (PLANO_V2 Fase 9.1). JSX movido 1:1,
// sem mudança de comportamento.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { BrandKit } from "../../../types";
import { mopName } from "../../../utils/file";
import type { VideoMode } from "./useReelsGeneration";

interface Props {
  preview: string | null;
  videoUrl: string | null;
  busy: boolean;
  busyVideo: boolean;
  videoMode: VideoMode;
  setVideoMode: (mode: VideoMode) => void;
  hasClonedVoice: boolean;
  videoStepLabel: string | null;
  videoProgressPct: number;
  handleGenerateVideo: () => void;
  track?: string;
  dayNumber: number;
  kit: BrandKit;
  usedClonedVoice: boolean | null;
  requestedClonedVoice: boolean;
  coverPng: string | null;
  coverError: string | null;
  videoError: string | null;
  retryCover: () => void;
  retryingCover: boolean;
  retryVideoOnly: () => void;
  retryingVideo: boolean;
}

export function ReelsVideoSection({
  preview,
  videoUrl,
  busy,
  busyVideo,
  videoMode,
  setVideoMode,
  hasClonedVoice,
  videoStepLabel,
  videoProgressPct,
  handleGenerateVideo,
  track,
  dayNumber,
  kit,
  usedClonedVoice,
  requestedClonedVoice,
  coverPng,
  coverError,
  videoError,
  retryCover,
  retryingCover,
  retryVideoOnly,
  retryingVideo,
}: Props) {
  const videoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [videoUrl]);

  return (
    <>
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
              <video src={videoUrl} controls autoPlay style={{ width: "100%", borderRadius: 12 }} />
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
                    toast.error(`Não foi possível baixar o vídeo: ${(e as Error).message}`);
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
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#0c4a6e", fontWeight: 600 }}>
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
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#78350f", fontWeight: 600 }}>
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
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#78350f", fontWeight: 600 }}>
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
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#0c4a6e", fontWeight: 600 }}>
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
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#78350f", fontWeight: 600 }}>
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
    </>
  );
}
