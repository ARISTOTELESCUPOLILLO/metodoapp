// Edição/regeneração de título/texto/legenda por peça do Método OP +
// contadores de regeneração, persistidos em localStorage por usuário.
// Sem isso, sair da página (ex.: /historico, /conta — rotas que desmontam o
// MetodoOpApp) e voltar perdia tanto o texto editado quanto o contador,
// fazendo o limite "2/2" reaparecer zerado mesmo já tendo sido usado.
export interface CopyEditEntry {
  titulo?: string;
  texto?: string;
  legenda?: string;
  tCount?: number;
  xCount?: number;
  lCount?: number;
}

type CopyEditsMap = Record<string, CopyEditEntry>;

function storageKey(userId: string | null | undefined): string {
  return `metodo-op-copyedits-v1:${userId || "anon"}`;
}

function loadAll(userId: string | null | undefined): CopyEditsMap {
  try {
    const raw = localStorage.getItem(storageKey(userId));
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
    localStorage.setItem(storageKey(userId), JSON.stringify(all));
  } catch (e) {
    console.error("saveCopyEdit: falha ao persistir edição, pode se perder ao navegar", e);
  }
}

export function clearCopyEdits(userId: string | null | undefined): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {}
}
