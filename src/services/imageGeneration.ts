// Helper compartilhado: start -> poll -> result
// Mantém a conexão HTTP curta — cada chamada dura poucos segundos,
// evitando o "upstream request timeout" da plataforma.

import { supabase } from "@/integrations/supabase/client";
import { getImpersonation } from "@/hooks/useImpersonation";
import { prepareReferenceImage, prepareReferenceImages } from "@/utils/prepareReference";
import { montarVariacaoTelemetria, type VariacaoTelemetria } from "@/core/variacaoTelemetria";

// Slot de débito ativo — atualizado via setCurrentDebitSlot() pelo MetodoOpApp
// quando o usuário seleciona um card de plano. Usado como fallback quando
// generateImageAsync não recebe preferredSlot explícito.
let _currentDebitSlot: string | undefined;
export function setCurrentDebitSlot(slot: string | undefined) {
  _currentDebitSlot = slot;
}

type StartResp = {
  requestId?: string;
  modelPath?: string;
  statusUrl?: string;
  responseUrl?: string;
  error?: string;
};
type StatusResp = { status?: string; error?: string };
type ResultResp = { dataUrl?: string; imageUrl?: string; contentType?: string; error?: string };

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const imp = getImpersonation();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(imp ? { "X-Impersonate-User-Id": imp.userId } : {}),
    };
  } catch {
    return {};
  }
}

async function postJson<T>(
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T; raw: string }> {
  const auth = await authHeader();
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
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
    return "Tempo esgotado no servidor de imagem. Tente novamente em alguns segundos.";
  }
  return fallback || snippet || `Erro ${status}`;
}

// Achado real 2026-07-16: um gpt-image-2/edit rodou ~71s na fila do fal.ai e só
// falhou no fetch do resultado final (500 "downstream_service_error" — instabilidade
// transitória da OpenAI, não rejeição de moderação: falha rápida de moderação não
// gastaria 71s de execução). A fila também pode marcar o job direto como
// FAILED/ERROR pelo mesmo tipo de instabilidade. Nos dois casos, rebuscar a mesma
// responseUrl ou re-consultar o mesmo requestId só devolve o erro já gravado —
// só resubmeter a geração do zero (novo START) tem chance de dar certo. Ver
// memória project-generate-image-downstream-error-fix-2026-07-16.
class DownstreamGenerationError extends Error {}

async function pollAndFetchResult(opts: {
  requestId: string;
  modelPath?: string;
  statusUrl?: string;
  responseUrl?: string;
  modulo?: string;
  preferredSlot?: string;
  variacao?: VariacaoTelemetria;
  maxMs: number;
  pollMs: number;
  onProgress?: (status: string) => void;
}): Promise<string> {
  const {
    requestId,
    modelPath,
    statusUrl,
    responseUrl,
    modulo,
    preferredSlot,
    variacao,
    maxMs,
    pollMs,
    onProgress,
  } = opts;

  const t0 = Date.now();
  let lastStatus = "IN_QUEUE";
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;
  while (Date.now() - t0 < maxMs) {
    await new Promise((r) => setTimeout(r, pollMs));
    const st = await postJson<StatusResp>({
      action: "status",
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
          "Não foi possível consultar o progresso da geração. Tente novamente em alguns segundos.",
        );
      }
      continue;
    }
    consecutiveFailures = 0;
    lastStatus = st.data.status || lastStatus;
    onProgress?.(lastStatus);
    if (lastStatus === "COMPLETED") break;
    if (lastStatus === "FAILED" || lastStatus === "ERROR") {
      throw new DownstreamGenerationError(
        "Geração da peça falhou no servidor de imagem. Tente novamente.",
      );
    }
  }
  if (lastStatus !== "COMPLETED") {
    throw new Error("A imagem ainda não ficou pronta. Tente novamente.");
  }

  const rr = await postJson<ResultResp>({
    action: "result",
    responseUrl,
    requestId,
    modelPath,
    modulo: modulo || "metodo-op",
    ...(preferredSlot ? { preferredSlot } : {}),
    // Vai junto do RESULT, não do START, porque é no RESULT que o servidor
    // debita a imagem e grava a linha em usage_logs — o START não escreve log.
    // Efeito colateral desejado: a telemetria só existe para imagem que ficou
    // pronta de verdade, na mesma linha que registrou o custo dela.
    ...(variacao ? { variacao } : {}),
  });
  const rawUrl = rr.data.dataUrl || rr.data.imageUrl;
  if (!rr.ok || !rawUrl) {
    throw new DownstreamGenerationError(
      friendlyError(rr.status, rr.raw, rr.data.error || "Imagem ausente na resposta."),
    );
  }
  // Se já é data URL (legado), retorna direto.
  if (rawUrl.startsWith("data:")) return rawUrl;
  // É uma URL CDN — faz o download no browser (sem limite de Worker).
  try {
    const imgResp = await fetch(rawUrl, { mode: "cors" });
    if (!imgResp.ok) throw new Error(`status ${imgResp.status}`);
    const blob = await imgResp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Erro ao converter imagem."));
      reader.readAsDataURL(blob);
    });
  } catch {
    // Se CORS bloquear, retorna a URL HTTPS direta — composeFeedPng tenta usá-la
    // no canvas; se falhar também, devolve a URL para exibição como <img src>.
    return rawUrl;
  }
}

export async function generateImageAsync(params: {
  prompt: string;
  format?: "post" | "reels";
  logoDataUrl?: string;
  referenceImages?: string[];
  modulo?: string;
  preferredSlot?: string;
  /** O que se sabe da variação desta peça no ponto de chamada — mood, posição
   *  na fila e presença de avatar. Os eixos sorteados NÃO entram aqui: são
   *  lidos do próprio prompt logo abaixo (ver core/variacaoTelemetria.ts).
   *  Opcional: caminho que não informa nada simplesmente não gera telemetria. */
  variacao?: { mood?: string; seed?: number; avatar?: boolean };
  maxMs?: number;
  pollMs?: number;
  onProgress?: (status: string) => void;
}): Promise<string> {
  // Com Kit Imagem (referenceImages) o modelo gpt-image-2/edit costuma levar bem mais tempo.
  // Default sem refs: 4min. Com refs: 6min.
  const hasRefs = Array.isArray(params.referenceImages) && params.referenceImages.length > 0;
  const {
    prompt,
    format,
    logoDataUrl,
    referenceImages,
    modulo,
    preferredSlot,
    variacao,
    maxMs = hasRefs ? 360_000 : 240_000,
    pollMs = 1500,
    onProgress,
  } = params;

  // Lê do prompt já montado os eixos que o sorteio escolheu e junta ao que o
  // chamador informou. É calculado uma vez, fora do laço de retry: uma
  // resubmissão por falha de downstream reenvia o MESMO prompt, então a
  // variação é a mesma.
  const variacaoMeta = montarVariacaoTelemetria({ prompt, ...(variacao || {}) });

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
    console.warn("[imageGeneration] refs descartadas no preparo", {
      in: refsIn,
      out: refsSmall.length,
    });
  }
  if (logoDataUrl && !logoSmall) {
    console.warn("[imageGeneration] logo descartada no preparo (formato não suportado)");
  }

  const startBody = {
    action: "start",
    prompt,
    format,
    logoDataUrl: logoSmall || undefined,
    referenceImages: refsSmall.length ? refsSmall : undefined,
    modulo: modulo || "metodo-op",
    ...(preferredSlot ? { preferredSlot } : {}),
  };
  const slotToDebit = preferredSlot ?? _currentDebitSlot;

  // 1 retry automático quando a geração falha no downstream (fal.ai/OpenAI) depois
  // de já ter passado pelo START — resubmete o job inteiro do zero (ver
  // DownstreamGenerationError acima). O START em si já tem seu próprio retry de
  // 5xx logo abaixo, então uma falha nele não entra nesse loop.
  const MAX_GENERATION_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    // 1) START — 1 retry automático em caso de 5xx transiente (ex.: fal.ai/OpenAI 500)
    let start = await postJson<StartResp>(startBody);
    if (!start.ok && start.status >= 500) {
      await new Promise((r) => setTimeout(r, 3000));
      start = await postJson<StartResp>(startBody);
    }
    if (!start.ok || !start.data.requestId) {
      throw new Error(
        friendlyError(start.status, start.raw, start.data.error || "Falha ao iniciar a geração."),
      );
    }

    try {
      // 2) POLL + 3) RESULT
      return await pollAndFetchResult({
        requestId: start.data.requestId,
        modelPath: start.data.modelPath,
        statusUrl: start.data.statusUrl,
        responseUrl: start.data.responseUrl,
        modulo,
        preferredSlot: slotToDebit,
        variacao: variacaoMeta,
        maxMs,
        pollMs,
        onProgress,
      });
    } catch (e) {
      if (e instanceof DownstreamGenerationError && attempt < MAX_GENERATION_ATTEMPTS) {
        onProgress?.("IN_QUEUE");
        continue;
      }
      throw e;
    }
  }
  // Inalcançável — o loop sempre retorna ou lança antes de terminar as tentativas.
  throw new Error("Falha desconhecida na geração da imagem.");
}
