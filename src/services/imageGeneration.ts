// Helper compartilhado: start -> poll -> result
// Mantém a conexão HTTP curta — cada chamada dura poucos segundos,
// evitando o "upstream request timeout" da plataforma.

import { supabase } from '@/integrations/supabase/client';
import { getImpersonation } from '@/hooks/useImpersonation';
import { prepareReferenceImage, prepareReferenceImages } from '@/utils/prepareReference';

// Slot de débito ativo — atualizado via setCurrentDebitSlot() pelo MetodoOpApp
// quando o usuário seleciona um card de plano. Usado como fallback quando
// generateImageAsync não recebe preferredSlot explícito.
let _currentDebitSlot: string | undefined;
export function setCurrentDebitSlot(slot: string | undefined) { _currentDebitSlot = slot; }

type StartResp = { requestId?: string; modelPath?: string; statusUrl?: string; responseUrl?: string; error?: string };
type StatusResp = { status?: string; error?: string };
type ResultResp = { dataUrl?: string; error?: string };

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const imp = getImpersonation();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(imp ? { 'X-Impersonate-User-Id': imp.userId } : {}),
    };
  } catch {
    return {};
  }
}

async function postJson<T>(body: unknown): Promise<{ ok: boolean; status: number; data: T; raw: string }> {
  const auth = await authHeader();
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data: T = {} as T;
  try {
    data = raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    // mantém raw para mensagem de erro
  }
  return { ok: res.ok, status: res.status, data, raw };
}

function friendlyError(status: number, raw: string, fallback: string): string {
  const snippet = raw.slice(0, 160).trim();
  if (status === 504 || /upstream|timeout|gateway/i.test(snippet)) {
    return 'Tempo esgotado no servidor de imagem. Tente novamente em alguns segundos.';
  }
  return fallback || snippet || `Erro ${status}`;
}

export async function generateImageAsync(params: {
  prompt: string;
  format?: 'post' | 'reels';
  logoDataUrl?: string;
  referenceImages?: string[];
  modulo?: string;
  preferredSlot?: string;
  maxMs?: number;
  pollMs?: number;
  onProgress?: (status: string) => void;
}): Promise<string> {
  // Com Kit Imagem (referenceImages) o modelo gpt-image-2/edit costuma levar bem mais tempo.
  // Default sem refs: 4min. Com refs: 6min.
  const hasRefs = Array.isArray(params.referenceImages) && params.referenceImages.length > 0;
  const { prompt, format, logoDataUrl, referenceImages, modulo, preferredSlot, maxMs = hasRefs ? 360_000 : 240_000, pollMs = 2500, onProgress } = params;

  // Compacta refs + logo (lado <=1024, JPEG q=0.85) antes do POST.
  // Reduz drasticamente o payload base64 enviado ao /api/generate-image
  // e, downstream, ao gpt-image-2/edit do FAL.
  const [refsSmall, logoSmall] = await Promise.all([
    prepareReferenceImages(referenceImages),
    logoDataUrl ? prepareReferenceImage(logoDataUrl) : Promise.resolve(null),
  ]);

  // Log discreto quando algo foi descartado pelo preparador.
  const refsIn = referenceImages?.length || 0;
  if (refsIn && refsSmall.length !== refsIn) {
    console.warn('[imageGeneration] refs descartadas no preparo', { in: refsIn, out: refsSmall.length });
  }
  if (logoDataUrl && !logoSmall) {
    console.warn('[imageGeneration] logo descartada no preparo (formato não suportado)');
  }

  // 1) START
  const start = await postJson<StartResp>({
    action: 'start',
    prompt,
    format,
    logoDataUrl: logoSmall || undefined,
    referenceImages: refsSmall.length ? refsSmall : undefined,
    modulo: modulo || 'metodo-op',
  });
  if (!start.ok || !start.data.requestId) {
    throw new Error(
      friendlyError(start.status, start.raw, start.data.error || 'Falha ao iniciar a geração.'),
    );
  }
  const { requestId, modelPath, statusUrl, responseUrl } = start.data;

  // 2) POLL — passa URLs opacas devolvidas pelo FAL quando disponíveis
  const t0 = Date.now();
  let lastStatus = 'IN_QUEUE';
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;
  while (Date.now() - t0 < maxMs) {
    await new Promise((r) => setTimeout(r, pollMs));
    const st = await postJson<StatusResp>({
      action: 'status',
      statusUrl,
      requestId,
      modelPath,
    });
    if (!st.ok) {
      // 4xx fora 429 = abortar imediatamente
      if (st.status >= 400 && st.status < 500 && st.status !== 429) {
        throw new Error(st.data.error || `Falha ao consultar status (${st.status}).`);
      }
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(
          'Não foi possível consultar o progresso da geração. Tente novamente em alguns segundos.',
        );
      }
      continue;
    }
    consecutiveFailures = 0;
    lastStatus = st.data.status || lastStatus;
    onProgress?.(lastStatus);
    if (lastStatus === 'COMPLETED') break;
    if (lastStatus === 'FAILED' || lastStatus === 'ERROR') {
      throw new Error('Geração da peça falhou no servidor de imagem. Tente novamente.');
    }
  }
  if (lastStatus !== 'COMPLETED') {
    throw new Error('A imagem ainda não ficou pronta. Tente novamente.');
  }

  // 3) RESULT
  const slotToDebit = preferredSlot ?? _currentDebitSlot;
  const rr = await postJson<ResultResp>({
    action: 'result',
    responseUrl,
    requestId,
    modelPath,
    modulo: modulo || 'metodo-op',
    ...(slotToDebit ? { preferredSlot: slotToDebit } : {}),
  });
  if (!rr.ok || !rr.data.dataUrl) {
    throw new Error(
      friendlyError(rr.status, rr.raw, rr.data.error || 'Imagem ausente na resposta.'),
    );
  }
  return rr.data.dataUrl;
}
