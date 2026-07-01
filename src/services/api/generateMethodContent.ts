// Geração de texto do Método OP (streaming SSE + fallback não-stream) —
// extraído de services/api.ts (PLANO_V2 Fase 9.1). Movido 1:1, sem mudança
// de comportamento. Reexportado por services/api.ts para manter o import
// existente em hooks/useMopHandlers.ts funcionando sem alteração.
import { buildMetodoOpPrompt, normalizeMethodResult } from "../../core/organizaMethodEngine";
import { ContentFormData, MethodOpResult } from "../../types";
import { autoRegenerateFlaggedFields } from "../autoRegenerate";
import { supabase } from "@/integrations/supabase/client";
import { getImpersonation } from "@/hooks/useImpersonation";

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

export async function generateMethodContent(
  data: ContentFormData,
  preferredSlot?: string,
): Promise<MethodOpResult> {
  const prompt = buildMetodoOpPrompt(data);
  const auth = await authHeader();
  const res = await fetch("/api/generate-content", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      prompt,
      sequenceSize: data.sequenceSize,
      track: data.track,
      wantsStories: data.outputMode === "stories" || data.outputMode === "feed+stories",
      ...(preferredSlot ? { preferredSlot } : {}),
    }),
  });

  const ct = res.headers.get("content-type") || "";
  const isStream = ct.includes("text/event-stream") && res.body;

  // Caminho 1: stream SSE (caminho normal a partir de agora).
  if (res.ok && isStream) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let streamErr: string | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const evt = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of evt.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            if (j?.error) {
              streamErr = String(j.error);
              continue;
            }
            const d = j?.choices?.[0]?.delta?.content;
            if (typeof d === "string") full += d;
          } catch {
            /* chunk parcial — ignora */
          }
        }
      }
    }

    if (streamErr) {
      throw new Error(
        "O servidor demorou demais pra responder. Tente novamente em alguns segundos.",
      );
    }
    if (!full) {
      throw new Error("Resposta vazia do gerador. Tente novamente.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(full);
    } catch {
      throw new Error("Resposta do gerador veio incompleta. Tente novamente.");
    }
    const result = normalizeMethodResult(parsed, data.track, data.sequenceSize, data.keyInfo);
    return autoRegenerateFlaggedFields(result, {
      companyName: data.companyName,
      mainActivity: data.mainActivity,
      keyInfo: data.keyInfo,
    });
  }

  // Caminho 2 (fallback): resposta não-stream (erro JSON ou texto de gateway).
  const raw = await res.text();
  let payload: { error?: string; result?: unknown } | null = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    /* não-JSON */
  }
  if (!res.ok || !payload) {
    const lower = (raw || "").toLowerCase();
    const msg =
      payload?.error ||
      (lower.includes("upstream") ||
      lower.includes("timeout") ||
      lower.includes("time-out") ||
      lower.includes("524")
        ? "O servidor demorou demais pra responder. Tente novamente em alguns segundos."
        : raw?.slice(0, 200) || `Erro ${res.status} ao gerar conteúdo`);
    throw new Error(msg);
  }
  // Compat: rota antiga devolvia { result }.
  const result = normalizeMethodResult(payload.result, data.track, data.sequenceSize, data.keyInfo);
  return autoRegenerateFlaggedFields(result, {
    companyName: data.companyName,
    mainActivity: data.mainActivity,
    keyInfo: data.keyInfo,
  });
}
