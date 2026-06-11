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
  motivoReprovacao?: string;
}

export interface RegenResult {
  value: string;
  flags?: string[];
}

async function callRegenerateBlock(ctx: RegenContext): Promise<RegenResult> {
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
  return {
    value: String(json.value || '').trim(),
    flags: Array.isArray(json.flags) ? json.flags : undefined,
  };
}

export async function regenerateBlock(ctx: RegenContext): Promise<string> {
  const { value } = await callRegenerateBlock(ctx);
  return value;
}

// Variante usada pela orquestração de regeneração automática (E3) — também
// devolve as reprovações D1 já recalculadas pelo servidor sobre o novo valor.
export async function regenerateBlockWithFlags(ctx: RegenContext): Promise<RegenResult> {
  return callRegenerateBlock(ctx);
}
