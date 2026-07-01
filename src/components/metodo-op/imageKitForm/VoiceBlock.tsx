// Bloco "Voz do Avatar" (gravar/subir amostra, treinar, aprovar/descartar,
// testar, apagar) do Kit Imagem — extraído de ImageKitForm.tsx (PLANO_V2
// Fase 9.1). JSX e lógica movidos 1:1, sem mudança de comportamento.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useImpersonation } from "../../../hooks/useImpersonation";
import { supabase } from "@/integrations/supabase/client";
import {
  cloneVoiceFromSample,
  confirmVoice,
  deleteVoiceForUser,
  getVoiceSampleUrl,
  loadVoiceForUser,
  ttsWithUserVoice,
  VoiceClone,
} from "../../../services/voiceClone";
import {
  fileToDataUrl as audioBlobToDataUrl,
  startRecorder,
  validateAudioBlob,
  VOICE_SAMPLE_SCRIPT,
  VOICE_MIN_SECONDS,
  VOICE_MAX_SECONDS,
  RecorderHandle,
} from "../../../utils/audioRecord";
import ConfirmDialog from "../ConfirmDialog";

type VoiceUiState =
  | "loading"
  | "idle"
  | "recording"
  | "preview"
  | "training"
  | "awaiting_approval"
  | "confirming"
  | "ready"
  | "testing";

export function VoiceBlock({ avatarSlot = 1 }: { avatarSlot?: 1 | 2 }) {
  const { user } = useAuth();
  const impersonation = useImpersonation();
  const effectiveUserId = impersonation?.userId ?? user?.id;
  // Admin pode usar ações de voz quando está atuando como usuário de TESTE.
  // Para usuários reais, as ações ficam bloqueadas (a voz deve ser do próprio usuário).
  const isImpersonating = !!impersonation && !impersonation.isTest;
  const [state, setState] = useState<VoiceUiState>("loading");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voice, setVoice] = useState<VoiceClone | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const recRef = useRef<RecorderHandle | null>(null);
  const tickRef = useRef<number | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  async function handleUploadFile(file: File) {
    setErrorMsg(null);
    try {
      const val = await validateAudioBlob(file);
      if (!val.ok) {
        setErrorMsg(val.reason || "Áudio inválido. Escolha outro arquivo.");
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewBlob(file);
      setPreviewUrl(url);
      setPreviewDuration(val.durationS);
      downloadBlobToDevice(file, file.name.split(".").pop() || "webm", file.name);
      setState("preview");
    } catch (e) {
      setErrorMsg((e as Error).message || "Falha ao ler o arquivo de áudio.");
    }
  }

  function downloadBlobToDevice(blob: Blob, ext: string, originalName?: string) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      a.download = originalName
        ? `minha-voz-${stamp}-${originalName}`
        : `minha-voz-${stamp}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      /* download é conveniência: falha silenciosa não bloqueia o fluxo */
    }
  }

  useEffect(() => {
    if (!effectiveUserId) {
      setState("idle");
      return;
    }
    let alive = true;
    setState("loading");
    setVoice(null);
    setVoicePreviewUrl(null);
    const flagCol = avatarSlot === 1 ? "voice_avatar1_enabled" : "voice_avatar2_enabled";
    Promise.all([
      loadVoiceForUser(effectiveUserId, avatarSlot),
      supabase.from("profiles").select(flagCol).eq("id", effectiveUserId).maybeSingle(),
    ])
      .then(async ([v, { data: prof }]) => {
        if (!alive) return;
        setVoiceEnabled(!!(prof as any)?.[flagCol]);
        if (v && v.status === "ready") {
          setVoice(v);
          setState("ready");
        } else if (v && v.status === "pendente_aprovacao" && v.sample_path) {
          try {
            const url = await getVoiceSampleUrl(v.sample_path);
            if (!alive) return;
            setVoice(v);
            setVoicePreviewUrl(url);
            setState("awaiting_approval");
          } catch {
            if (alive) setState("idle");
          }
        } else {
          setState("idle");
        }
      })
      .catch(() => alive && setState("idle"));
    return () => {
      alive = false;
    };
  }, [effectiveUserId, avatarSlot]);

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (recRef.current) {
        try {
          recRef.current.cancel();
        } catch {
          /* cleanup no unmount: gravador já pode estar parado */
        }
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleStartRecord() {
    setErrorMsg(null);
    try {
      const handle = await startRecorder();
      recRef.current = handle;
      setElapsed(0);
      setShowScript(true);
      setState("recording");
      tickRef.current = window.setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= VOICE_MAX_SECONDS) {
            // auto-stop ao atingir o máximo
            window.setTimeout(() => handleStopRecord(), 0);
          }
          return e + 1;
        });
      }, 1000);
    } catch (e) {
      setErrorMsg((e as Error).message || "Não foi possível acessar o microfone.");
      setState("idle");
    }
  }

  async function handleStopRecord() {
    if (!recRef.current) return;
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    try {
      const blob = await recRef.current.stop();
      recRef.current = null;
      const val = await validateAudioBlob(blob);
      if (!val.ok) {
        setErrorMsg(val.reason || "Áudio inválido. Grave de novo.");
        setState("idle");
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewUrl(url);
      setPreviewDuration(val.durationS);
      downloadBlobToDevice(blob, "webm");
      setState("preview");
    } catch (e) {
      setErrorMsg((e as Error).message || "Falha ao finalizar a gravação.");
      setState("idle");
    }
  }

  function handleCancelRecord() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (recRef.current) {
      try {
        recRef.current.cancel();
      } catch {
        /* cancelamento manual: gravador já pode estar parado */
      }
      recRef.current = null;
    }
    setState("idle");
  }

  function handleRetake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
    setPreviewDuration(0);
    setErrorMsg(null);
    setState("idle");
  }

  async function handleTrain() {
    if (!previewBlob) return;
    setErrorMsg(null);
    setState("training");
    try {
      const dataUrl = await audioBlobToDataUrl(previewBlob);
      const { voice: v, previewAudioUrl } = await cloneVoiceFromSample({
        sampleDataUrl: dataUrl,
        durationS: previewDuration,
        avatarSlot,
      });
      downloadBlobToDevice(previewBlob, "webm");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewBlob(null);
      setPreviewUrl(null);
      setVoice(v);
      setVoicePreviewUrl(previewAudioUrl);
      setState("awaiting_approval");
    } catch (e) {
      setErrorMsg((e as Error).message || "Não foi possível treinar a voz. Tente de novo.");
      setState("preview");
    }
  }

  async function handleApprove() {
    setErrorMsg(null);
    setState("confirming");
    try {
      const v = await confirmVoice("aprovar", avatarSlot);
      if (v) setVoice(v);
      setVoicePreviewUrl(null);
      setState("ready");
    } catch (e) {
      setErrorMsg((e as Error).message || "Falha ao aprovar a voz.");
      setState("awaiting_approval");
    }
  }

  async function handleDiscard() {
    setErrorMsg(null);
    setState("confirming");
    try {
      await confirmVoice("descartar", avatarSlot);
      setVoice(null);
      setVoicePreviewUrl(null);
      setState("idle");
    } catch (e) {
      setErrorMsg((e as Error).message || "Falha ao descartar a voz.");
      setState("awaiting_approval");
    }
  }

  async function handleTest() {
    setErrorMsg(null);
    setState("testing");
    try {
      const url = await ttsWithUserVoice(
        "Olá! Esta é a minha voz, pronta para narrar os vídeos da marca.",
        avatarSlot,
      );
      if (testAudioRef.current) {
        testAudioRef.current.pause();
      }
      const audio = new Audio(url);
      testAudioRef.current = audio;
      audio.onended = () => setState("ready");
      audio.onerror = () => {
        setErrorMsg("Não foi possível tocar o áudio.");
        setState("ready");
      };
      await audio.play();
    } catch (e) {
      setErrorMsg((e as Error).message || "Falha ao testar a voz.");
      setState("ready");
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    if (!effectiveUserId || isImpersonating) return;
    setErrorMsg(null);
    try {
      await deleteVoiceForUser(effectiveUserId, avatarSlot);
      setVoice(null);
      setState("idle");
    } catch (e) {
      setErrorMsg((e as Error).message || "Não foi possível apagar a voz.");
    }
  }

  const wrap: React.CSSProperties = {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#fff",
  };
  const title: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  };
  const hint: React.CSSProperties = { margin: "0 0 10px", fontSize: 12, color: "#64748b" };
  const btnPrimary: React.CSSProperties = {
    background: "#0f172a",
    color: "#fff",
    border: "1px solid #0f172a",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };
  const btnGhost: React.CSSProperties = {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
  const btnDanger: React.CSSProperties = {
    background: "#fff",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  function mmss(s: number) {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${ss}`;
  }

  // Estado bloqueado: funcionalidade não habilitada pelo admin (não se aplica a impersonação de usuário real, pois esse caso já é tratado abaixo)
  if (!voiceEnabled && !isImpersonating && state !== "loading") {
    return (
      <div style={wrap}>
        <span style={title}>🎙 Voz do Avatar {avatarSlot}</span>
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            color: "#92400e",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginTop: 8,
          }}
        >
          <span style={{ flexShrink: 0 }}>🔒</span>
          <span>Gravação de voz não habilitada. Peça ao admin para ativar.</span>
        </div>
        <button
          type="button"
          disabled
          style={{ ...btnPrimary, opacity: 0.4, cursor: "not-allowed", marginTop: 10 }}
        >
          🎤 Gravar amostra
        </button>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <span style={title}>🎙 Voz do Avatar {avatarSlot}</span>

      {!!impersonation && !impersonation.isTest && (
        <div
          style={{
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            fontSize: 12,
            color: "#78350f",
          }}
        >
          Visualizando voz de <strong>{impersonation.nome}</strong>.{" "}
          {state === "ready" && voice
            ? "✓ Voz treinada neste usuário."
            : "Este usuário ainda não tem voz treinada."}{" "}
          Ações (gravar / treinar / testar / apagar) só ficam disponíveis quando o próprio usuário
          entra na conta.
        </div>
      )}

      {!isImpersonating && state === "loading" && <p style={hint}>Verificando voz…</p>}

      {!isImpersonating && state === "idle" && (
        <>
          <p style={hint}>
            Treine a voz que será usada nos vídeos do seu avatar. Grave entre {VOICE_MIN_SECONDS}s e{" "}
            {Math.round(VOICE_MAX_SECONDS / 60)} min num lugar silencioso, falando de forma natural.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btnPrimary} onClick={handleStartRecord}>
              🎤 Gravar amostra
            </button>
            <button type="button" style={btnGhost} onClick={() => uploadInputRef.current?.click()}>
              📁 Subir áudio
            </button>
            <button type="button" style={btnGhost} onClick={() => setShowScript((v) => !v)}>
              {showScript ? "Esconder roteiro" : "Ver roteiro sugerido"}
            </button>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            accept="audio/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadFile(f);
              e.target.value = "";
            }}
          />
          {showScript && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 12,
                color: "#334155",
                whiteSpace: "pre-line",
                lineHeight: 1.5,
              }}
            >
              {VOICE_SAMPLE_SCRIPT}
            </div>
          )}
        </>
      )}

      {!isImpersonating && state === "recording" && (
        <>
          <p style={hint}>
            Gravando… leia o roteiro abaixo de forma natural. Pare quando terminar.
          </p>
          <div
            style={{
              padding: 12,
              marginBottom: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.55,
              color: "#0f172a",
              whiteSpace: "pre-line",
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {VOICE_SAMPLE_SCRIPT}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 700,
                color: "#b91c1c",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#dc2626",
                  animation: "pulse 1s infinite",
                }}
              />
              {mmss(elapsed)}
            </span>
            <button type="button" style={btnPrimary} onClick={handleStopRecord}>
              ■ Parar
            </button>
            <button type="button" style={btnGhost} onClick={handleCancelRecord}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {!isImpersonating && state === "preview" && previewUrl && (
        <>
          <p style={hint}>Ouça antes de treinar. Se ficou ruim, regrave.</p>
          <audio src={previewUrl} controls style={{ width: "100%", marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btnPrimary} onClick={handleTrain}>
              Treinar voz
            </button>
            <button type="button" style={btnGhost} onClick={handleRetake}>
              🎤 Regravar
            </button>
            {previewBlob && (
              <button
                type="button"
                style={btnGhost}
                onClick={() => downloadBlobToDevice(previewBlob, "webm")}
              >
                ⬇ Baixar gravação
              </button>
            )}
          </div>
        </>
      )}

      {!isImpersonating && state === "training" && (
        <p style={{ ...hint, color: "#0f172a", fontWeight: 600 }}>
          Treinando voz… isso leva alguns segundos.
        </p>
      )}

      {!isImpersonating &&
        (state === "awaiting_approval" || state === "confirming") &&
        voicePreviewUrl && (
          <>
            <p style={hint}>
              Ouça a prévia. Se for a sua voz, aprove. Se não ficou boa, descarte e grave de novo —
              só consome render ao aprovar.
            </p>
            <audio src={voicePreviewUrl} controls style={{ width: "100%", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={btnPrimary}
                onClick={handleApprove}
                disabled={state === "confirming"}
              >
                {state === "confirming" ? "Confirmando…" : "✅ Aprovar (usa 1 vídeo do plano)"}
              </button>
              <button
                type="button"
                style={btnDanger}
                onClick={handleDiscard}
                disabled={state === "confirming"}
              >
                🗑️ Descartar e gravar de novo
              </button>
              {voice?.sample_path && (
                <a
                  href={voicePreviewUrl}
                  download={`minha-voz-${new Date().toISOString().slice(0, 10)}.webm`}
                  style={{
                    ...btnGhost,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  ⬇ Baixar minha gravação
                </a>
              )}
            </div>
          </>
        )}

      {!isImpersonating && (state === "ready" || state === "testing") && voice && (
        <>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              background: "#dcfce7",
              color: "#15803d",
              fontWeight: 700,
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            ✓ Voz treinada
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={btnPrimary}
              onClick={handleTest}
              disabled={state === "testing"}
            >
              {state === "testing" ? "Tocando…" : "▶ Testar voz"}
            </button>
            <button
              type="button"
              style={btnGhost}
              onClick={handleRetake}
              disabled={state === "testing"}
            >
              🎤 Regravar
            </button>
            <button
              type="button"
              style={btnDanger}
              onClick={() => setConfirmDelete(true)}
              disabled={state === "testing"}
            >
              🗑 Apagar voz
            </button>
          </div>
        </>
      )}

      {errorMsg && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: 10,
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title="Apagar voz treinada?"
        message="A voz será removida e você precisará gravar de novo para usar nos vídeos."
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
