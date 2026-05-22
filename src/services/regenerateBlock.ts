export type RegenKind = 'titulo' | 'texto' | 'legenda';

export interface RegenContext {
  kind: RegenKind;
  companyName?: string;
  mainActivity?: string;
  keyInfo?: string;
  formato?: string;
  tituloAtual?: string;
  textoAtual?: string;
  legendaAtual?: string;
}

export async function regenerateBlock(ctx: RegenContext): Promise<string> {
  const res = await fetch('/api/regenerate-block', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao regenerar (${res.status})`);
  }
  const json = await res.json();
  return String(json.value || '').trim();
}
