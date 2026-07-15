import { getAuthHeaders } from "./authHeaders";

// Envia áudio gravado (data URL) para transcrição + limpeza (remove vícios de
// fala, extrai a essência, equaliza nome de produto/serviço com o Kit de
// Marca quando `selectedProducts` é informado) — usado pelo microfone da
// Informação-chave (MOP+PU).
export async function transcribeKeyInfoAudio(
  audioDataUrl: string,
  selectedProducts: string[] = [],
): Promise<string> {
  const auth = await getAuthHeaders();
  const res = await fetch("/api/transcribe-keyinfo", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({ audioDataUrl, selectedProducts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao transcrever áudio (${res.status})`);
  }
  const json = await res.json();
  return String(json.text || "");
}
