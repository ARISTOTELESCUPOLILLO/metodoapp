import { getAuthHeaders } from './authHeaders';

// Corrige ortografia, acentuação, concordância e pontuação de um texto em
// português brasileiro, sem alterar sentido, tom ou tamanho.
export async function correctPortuguese(text: string): Promise<string> {
  const auth = await getAuthHeaders();
  const res = await fetch('/api/correct-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao corrigir texto (${res.status})`);
  }
  const json = await res.json();
  return String(json.corrected ?? text);
}
