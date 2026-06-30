// Edição/regeneração de título/texto/legenda por peça do Método OP +
// contadores de regeneração, persistidos em localStorage por usuário.
// Sem isso, sair da página (ex.: /historico, /conta — rotas que desmontam o
// MetodoOpApp) e voltar perdia tanto o texto editado quanto o contador,
// fazendo o limite "2/2" reaparecer zerado mesmo já tendo sido usado.

import { lsGet, lsSet, lsRemove } from "../lib/storage/store";
import { COPY_EDITS_KEY } from "../lib/storage/keys";

export interface CopyEditEntry {
  titulo?: string;
  texto?: string;
  legenda?: string;
  tCount?: number;
  xCount?: number;
  lCount?: number;
}

type CopyEditsMap = Record<string, CopyEditEntry>;

function loadAll(userId: string | null | undefined): CopyEditsMap {
  try {
    const raw = lsGet(COPY_EDITS_KEY, userId || null);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadCopyEdit(
  userId: string | null | undefined,
  itemKey: string,
): CopyEditEntry | undefined {
  return loadAll(userId)[itemKey];
}

export function saveCopyEdit(
  userId: string | null | undefined,
  itemKey: string,
  patch: Partial<CopyEditEntry>,
): void {
  try {
    const all = loadAll(userId);
    all[itemKey] = { ...all[itemKey], ...patch };
    lsSet(COPY_EDITS_KEY, JSON.stringify(all), userId || null);
  } catch (e) {
    console.error("saveCopyEdit: falha ao persistir edição, pode se perder ao navegar", e);
  }
}

export function clearCopyEdits(userId: string | null | undefined): void {
  lsRemove(COPY_EDITS_KEY, userId || null);
}
