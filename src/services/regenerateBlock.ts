import { applyDeterministicFallback } from "../core/textValidation";
import { getAuthHeaders } from "./authHeaders";

export type RegenKind = "titulo" | "texto" | "legenda";

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
  // Slot do plano a debitar o contador regen_texto no servidor. Quando ausente,
  // o servidor cai no slot preferido padrão (plano1) — ver debit_usage.
  preferredSlot?: "plano1" | "plano2" | "bonus";
}

export interface RegenResult {
  value: string;
  flags?: string[];
}

async function callRegenerateBlock(ctx: RegenContext): Promise<RegenResult> {
  const auth = await getAuthHeaders();
  const res = await fetch("/api/regenerate-block", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(ctx),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao regenerar (${res.status})`);
  }
  const json = await res.json();
  return {
    value: String(json.value || "").trim(),
    flags: Array.isArray(json.flags) ? json.flags : undefined,
  };
}

// Variante usada pela orquestração de regeneração automática (E3) — também
// devolve as reprovações D1 já recalculadas pelo servidor sobre o novo valor.
export async function regenerateBlockWithFlags(ctx: RegenContext): Promise<RegenResult> {
  return callRegenerateBlock(ctx);
}

const MAX_ATTEMPTS = 2;

// Variante usada pelos botões manuais de "Gerar outro" (UI) — antes
// descartava as reprovações D1 do servidor (regenerateBlock simples) e podia
// devolver ao usuário um texto que o próprio motor já sabia estar flagado.
// Aplica a mesma garantia do E3 (autoRegenerate.ts): tenta de novo com o
// motivo da reprovação e, se ainda flagar na 2ª tentativa, aplica a limpeza
// determinística (E4) em vez de expor o texto reprovado como sugestão.
export async function regenerateBlockClean(ctx: RegenContext): Promise<string> {
  let value = "";
  let motivoReprovacao = ctx.motivoReprovacao;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const regen = await callRegenerateBlock({ ...ctx, motivoReprovacao });
    value = regen.value;
    if (!regen.flags || regen.flags.length === 0) return value;
    motivoReprovacao = regen.flags.join("; ");
    if (attempt === MAX_ATTEMPTS) {
      console.warn(
        `[regenerateBlockClean] ${ctx.kind} reprovado após ${MAX_ATTEMPTS} tentativas — limpeza determinística aplicada. Motivos: ${motivoReprovacao}`,
      );
      return applyDeterministicFallback(value, ctx.kind);
    }
  }
  return value;
}
