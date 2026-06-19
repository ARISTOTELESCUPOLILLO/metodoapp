import { ImageKit } from '../types';

// Persistência local do Kit Imagem.
// Estratégia: localStorage (rápido, simples, sem dependência de backend).
// Se a quota do navegador estourar, sinalizamos com QuotaExceededError —
// o consumidor pode mostrar uma mensagem ou (futuramente) fazer fallback
// para upload em cloud storage.

export const IMAGE_KIT_KEY = 'metodo-op-image-kit-v1';
export const PRODUTO_SLOTS = 8;
export const CENARIO_SLOTS = 2;

export const emptyImageKit: ImageKit = {
  avatar: undefined,
  avatar2: undefined,
  fachada: undefined,
  cenarios: Array.from({ length: CENARIO_SLOTS }, () => null),
  produtos: Array.from({ length: PRODUTO_SLOTS }, () => null),
  fato: undefined,
  venda: undefined,
};

function normalize(kit: any): ImageKit {
  // Produtos
  const produtos = Array.isArray(kit?.produtos) ? kit.produtos.slice(0, PRODUTO_SLOTS) : [];
  while (produtos.length < PRODUTO_SLOTS) produtos.push(null);

  // Cenários — migração do shape antigo `cenario: string` → `cenarios: [string, null]`.
  let cenarios: (string | null)[];
  if (Array.isArray(kit?.cenarios)) {
    cenarios = kit.cenarios.slice(0, CENARIO_SLOTS);
  } else if (typeof kit?.cenario === 'string' && kit.cenario) {
    cenarios = [kit.cenario, null];
  } else {
    cenarios = [];
  }
  while (cenarios.length < CENARIO_SLOTS) cenarios.push(null);

  return {
    avatar: kit?.avatar || undefined,
    avatar2: kit?.avatar2 || undefined,
    fachada: kit?.fachada || undefined,
    cenarios: cenarios.map((c) => (typeof c === 'string' && c ? c : null)),
    produtos: produtos.map((p: any) => (typeof p === 'string' && p ? p : null)),
    fato: kit?.fato || undefined,
    venda: kit?.venda || undefined,
  };
}

function freshEmpty(): ImageKit {
  return {
    avatar: undefined,
    avatar2: undefined,
    fachada: undefined,
    cenarios: Array.from({ length: CENARIO_SLOTS }, () => null),
    produtos: Array.from({ length: PRODUTO_SLOTS }, () => null),
    fato: undefined,
    venda: undefined,
  };
}

export function loadImageKit(userId?: string | null): ImageKit {
  if (typeof window === 'undefined') return freshEmpty();
  try {
    const key = userId ? `${IMAGE_KIT_KEY}:${userId}` : IMAGE_KIT_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return freshEmpty();
    return normalize(JSON.parse(raw));
  } catch {
    return freshEmpty();
  }
}

export function saveImageKit(kit: ImageKit, userId?: string | null): void {
  if (typeof window === 'undefined') return;
  const key = userId ? `${IMAGE_KIT_KEY}:${userId}` : IMAGE_KIT_KEY;
  const payload = JSON.stringify(normalize(kit));
  try {
    localStorage.setItem(key, payload);
  } catch (e) {
    // Quota: re-lança para o componente tratar (toast com instrução de remover algo).
    throw e;
  }
}

export function clearImageKit(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `${IMAGE_KIT_KEY}:${userId}` : IMAGE_KIT_KEY;
    localStorage.removeItem(key);
  } catch {}
}

export function hasAnyImage(kit: ImageKit): boolean {
  return (
    !!kit.avatar ||
    !!kit.avatar2 ||
    !!kit.fachada ||
    kit.cenarios.some((c) => !!c) ||
    kit.produtos.some((p) => !!p) ||
    !!kit.fato ||
    !!kit.venda
  );
}

export function produtosDisponiveis(kit: ImageKit): number[] {
  return kit.produtos
    .map((p, i) => (p ? i + 1 : null))
    .filter((n): n is number => n !== null);
}

export function cenariosDisponiveis(kit: ImageKit): number[] {
  return kit.cenarios
    .map((c, i) => (c ? i + 1 : null))
    .filter((n): n is number => n !== null);
}

// Rótulo de exibição do cenário (1..2) — a fachada agora tem slot próprio,
// fora do pool de cenários, então todo cenário é "ambiente".
export function cenarioLabel(_kit: ImageKit, num: number): string {
  return `Cenário ${num}`;
}

// ============================================================
// Sync com backend (Supabase). O Kit Imagem agora vive no
// servidor para que o usuário não perca o Kit ao trocar de
// dispositivo, e para que admin possa atuar como ele.
// O localStorage acima vira só cache local de leitura rápida.
// ============================================================

import { ImageKit as _ImageKit } from '../types';
import { loadImageKitFor, saveImageKitFor } from '../lib/imageKit.functions';

function normalizeRemote(remote: {
  avatar?: string | null;
  avatar2?: string | null;
  fachada?: string | null;
  cenarios?: (string | null)[] | null;
  produtos?: (string | null)[] | null;
  fato?: string | null;
  venda?: string | null;
}): _ImageKit {
  const cenarios = (remote.cenarios || []).slice(0, CENARIO_SLOTS);
  while (cenarios.length < CENARIO_SLOTS) cenarios.push(null);
  const produtos = (remote.produtos || []).slice(0, PRODUTO_SLOTS);
  while (produtos.length < PRODUTO_SLOTS) produtos.push(null);
  return {
    avatar: remote.avatar || undefined,
    avatar2: remote.avatar2 || undefined,
    fachada: remote.fachada || undefined,
    cenarios: cenarios.map((c) => (typeof c === 'string' && c ? c : null)),
    produtos: produtos.map((p) => (typeof p === 'string' && p ? p : null)),
    fato: remote.fato || undefined,
    venda: remote.venda || undefined,
  };
}

// Carrega do backend. Se falhar, devolve o cache local pra não travar a UI.
export async function loadImageKitAsync(userId?: string | null): Promise<ImageKit> {
  try {
    const remote = await loadImageKitFor({ data: userId ? { userId } : {} });
    const kit = normalizeRemote(remote);
    // Atualiza o cache local pra próximas leituras instantâneas.
    try { saveImageKit(kit, userId); } catch {}
    return kit;
  } catch (e) {
    console.warn('[imageKit] loadAsync falhou, usando cache local:', e);
    return loadImageKit(userId);
  }
}

// Calcula o que enviar pro backend olhando o slot atual:
// - dataURL (data:...): upload novo
// - URL assinado http(s): já está no servidor → não reenvia (undefined)
// - vazio quando antes tinha algo: apagar (null)
// - vazio quando já estava vazio: nada (undefined)
function slotPayload(prev: string | null | undefined, next: string | null | undefined): string | null | undefined {
  const a = prev || null;
  const b = next || null;
  if (!b) return a ? null : undefined;
  if (b.startsWith('data:')) return b; // upload novo
  return undefined; // signed URL já existente, sem mudança
}

function diffSlots(prev: (string | null)[], next: (string | null)[]): (string | null | undefined)[] {
  const len = Math.max(prev.length, next.length);
  const out: (string | null | undefined)[] = [];
  for (let i = 0; i < len; i++) out.push(slotPayload(prev[i], next[i]));
  return out;
}

export async function saveImageKitAsync(kit: ImageKit, userId?: string | null): Promise<ImageKit> {
  const prev = loadImageKit(userId);
  const avatarPayload = slotPayload(prev.avatar, kit.avatar);
  const avatar2Payload = slotPayload(prev.avatar2, kit.avatar2);
  const fachadaPayload = slotPayload(prev.fachada, kit.fachada);
  const cenariosPayload = diffSlots(prev.cenarios, kit.cenarios);
  const produtosPayload = diffSlots(prev.produtos, kit.produtos);
  const fatoPayload = slotPayload(prev.fato, kit.fato);
  const vendaPayload = slotPayload(prev.venda, kit.venda);

  const remote = await saveImageKitFor({
    data: {
      ...(userId ? { userId } : {}),
      avatar: avatarPayload,
      avatar2: avatar2Payload,
      fachada: fachadaPayload,
      cenarios: cenariosPayload as any,
      produtos: produtosPayload as any,
      fato: fatoPayload,
      venda: vendaPayload,
    },
  });
  const saved = normalizeRemote(remote);
  // Espelha no cache local
  try { saveImageKit(saved, userId); } catch {}
  return saved;
}
