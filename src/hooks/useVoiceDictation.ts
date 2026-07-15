import { useRef, useState } from "react";
import { fileToDataUrl, startRecorder, RecorderHandle } from "../utils/audioRecord";
import { transcribeKeyInfoAudio } from "../services/transcribeKeyInfo";

export type DictationState = "idle" | "recording" | "transcribing";

const DICTATION_MAX_SECONDS = 90;

// Grava um trecho curto de fala, transcreve e limpa (vícios de fala/hesitação)
// via /api/transcribe-keyinfo, entregando o texto pronto por `onResult` —
// usado pelo botão 🎙 do campo Informação-chave (MOP + PU).
export function useVoiceDictation(onResult: (text: string) => void) {
  const [state, setState] = useState<DictationState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecorderHandle | null>(null);
  const tickRef = useRef<number | null>(null);

  function clearTick() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  async function stop() {
    if (!recRef.current) return;
    clearTick();
    setState("transcribing");
    try {
      const blob = await recRef.current.stop();
      recRef.current = null;
      const dataUrl = await fileToDataUrl(blob);
      const text = await transcribeKeyInfoAudio(dataUrl);
      if (text.trim()) {
        onResult(text.trim());
      } else {
        setError("Não entendemos nenhuma fala no áudio. Tente de novo.");
      }
    } catch (e) {
      setError((e as Error).message || "Falha ao transcrever o áudio.");
    } finally {
      setState("idle");
    }
  }

  async function start() {
    if (state !== "idle") return;
    setError(null);
    try {
      const handle = await startRecorder();
      recRef.current = handle;
      setElapsed(0);
      setState("recording");
      tickRef.current = window.setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= DICTATION_MAX_SECONDS) {
            window.setTimeout(() => stop(), 0);
          }
          return e + 1;
        });
      }, 1000);
    } catch (e) {
      setError((e as Error).message || "Não foi possível acessar o microfone.");
      setState("idle");
    }
  }

  function cancel() {
    clearTick();
    if (recRef.current) {
      try {
        recRef.current.cancel();
      } catch {
        /* gravador já pode estar parado */
      }
      recRef.current = null;
    }
    setState("idle");
  }

  return { state, elapsed, error, start, stop, cancel };
}
