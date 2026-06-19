import { useState } from "react";
import { correctPortuguese } from "../services/textCorrection";

// Encapsula a chamada de correção ortográfica/gramatical (pt-BR) usada nos
// campos editáveis pelo usuário (Informação-chave, título, texto, legenda).
// `apply` recebe o texto corrigido apenas quando ele difere do original.
export function useTextCorrection() {
  const [correcting, setCorrecting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function correct(value: string, apply: (corrected: string) => void) {
    if (correcting || !value.trim()) return;
    setCorrecting(true);
    setMsg(null);
    setError(null);
    try {
      const corrected = (await correctPortuguese(value)).trim();
      if (corrected && corrected !== value.trim()) {
        apply(corrected);
      } else {
        setMsg("Nenhum erro encontrado.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCorrecting(false);
    }
  }

  return { correcting, msg, error, correct };
}
