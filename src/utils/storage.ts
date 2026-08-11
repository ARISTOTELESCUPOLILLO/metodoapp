import { lsGet, lsRemove, lsSetQuotaSafe } from "../lib/storage/store";
import {
  KIT_KEY,
  LOGO_KEY,
  FORM_KEY,
  SUGESTAO_HISTORY_KEY,
  VARIACAO_SEED_KEY,
} from "../lib/storage/keys";

const SUGESTAO_HISTORY_MAX = 12;

/**
 * Últimas N sugestões geradas (MOP+PU), pra alimentar `previousSuggestions`
 * mesmo numa rodada nova (mount novo do formulário) — sem isso, o rodízio
 * sintático (checkRepeatedOpening) só enxerga sugestões da MESMA sessão de
 * página, ficando "cego" entre rodadas/visitas diferentes.
 */
export function loadSugestaoHistory(userId?: string | null): string[] {
  try {
    const raw = lsGet(SUGESTAO_HISTORY_KEY, userId);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/** Acrescenta `sugestao` ao histórico, mantendo só as últimas SUGESTAO_HISTORY_MAX. */
export function pushSugestaoHistory(sugestao: string, userId?: string | null): void {
  const trimmed = sugestao.trim();
  if (!trimmed) return;
  const next = [...loadSugestaoHistory(userId), trimmed].slice(-SUGESTAO_HISTORY_MAX);
  lsSetQuotaSafe(SUGESTAO_HISTORY_KEY, JSON.stringify(next), userId);
}

/**
 * Devolve a posição desta geração na fila de variação visual e já avança o
 * contador do usuário, reservando `pecas` posições — uma sequência do MOP que
 * gera 5 cards consome 5 posições, para a próxima sequência não recomeçar em
 * cima das mesmas câmeras.
 *
 * Fica aqui, e não dentro do motor, porque as engines são puras por convenção
 * (Regra 4 da Seção 5 do PLANO_V2): elas recebem a posição por parâmetro e não
 * conhecem localStorage. Sem userId (usuário não carregado ainda), devolve 0 —
 * a fila só perde a memória, o prompt continua válido.
 */
export function nextVariacaoSeed(userId?: string | null, pecas = 1): number {
  try {
    const atual = Number(lsGet(VARIACAO_SEED_KEY, userId) ?? 0);
    const base = Number.isFinite(atual) && atual >= 0 ? Math.trunc(atual) : 0;
    lsSetQuotaSafe(VARIACAO_SEED_KEY, String(base + Math.max(1, pecas)), userId);
    return base;
  } catch {
    return 0;
  }
}

export function saveKit(kit: { logoDataUrl?: string } & object, userId?: string | null) {
  try {
    const { logoDataUrl, ...kitWithoutLogo } = kit;
    lsSetQuotaSafe(KIT_KEY, JSON.stringify(kitWithoutLogo), userId);
    if (logoDataUrl) {
      lsSetQuotaSafe(LOGO_KEY, logoDataUrl as string, userId);
    } else {
      lsRemove(LOGO_KEY, userId);
    }
  } catch (e) {
    console.error("saveKit: falha ao persistir kit, não sobrevive a reload", e);
  }
}

export function loadKit<T extends { logoDataUrl?: string }>(
  fallback: T,
  userId?: string | null,
): T {
  try {
    const raw = lsGet(KIT_KEY, userId);
    const kit: T = raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
    const logo = lsGet(LOGO_KEY, userId);
    if (logo) kit.logoDataUrl = logo;
    return kit;
  } catch {
    return fallback;
  }
}

export function saveForm(form: object, userId?: string | null) {
  try {
    lsSetQuotaSafe(FORM_KEY, JSON.stringify(form), userId);
  } catch (e) {
    console.error("saveForm: falha ao persistir formulário, não sobrevive a reload", e);
  }
}

export function loadForm<T extends object>(fallback: T, userId?: string | null): T {
  try {
    const raw = lsGet(FORM_KEY, userId);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return fallback;
  }
}

/** Remove todos os dados locais escopados do userId (kit, logo, form). */
export function clearStorage(userId?: string | null) {
  lsRemove(KIT_KEY, userId);
  lsRemove(LOGO_KEY, userId);
  lsRemove(FORM_KEY, userId);
}
