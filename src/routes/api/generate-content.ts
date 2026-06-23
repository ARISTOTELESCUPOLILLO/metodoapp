import { createFileRoute } from "@tanstack/react-router";
import {
  checkBalance,
  checkRateLimit,
  debitUsage,
  resolveEffectiveUser,
  balanceFailMessage,
} from "@/lib/usage.server";
import { mopContentCost } from "@/lib/costs";

const LEITURA_CENICA_SCHEMA = {
  anyOf: [
    {
      type: "object",
      properties: {
        intencao: { type: "string" },
        personagem: { type: "string" },
        ambiente: { type: "string" },
        expressao: { type: "string" },
        clima: { type: "string" },
        composicao: { type: "string" },
      },
      required: ["intencao", "personagem", "ambiente", "expressao", "clima", "composicao"],
      additionalProperties: false,
    },
    { type: "null" },
  ],
} as const;

const FEED_SCHEMA = {
  anyOf: [
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          dia: { type: "number" },
          formato: { type: "string" },
          titulo: { type: "string" },
          texto: { type: "string" },
          legenda: { type: "string" },
          imagem: { type: "string" },
          leituraCenica: LEITURA_CENICA_SCHEMA,
        },
        required: ["dia", "formato", "titulo", "texto", "legenda", "imagem", "leituraCenica"],
        additionalProperties: false,
      },
    },
    { type: "null" },
  ],
} as const;

const CAROUSEL_SCHEMA = {
  anyOf: [
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          sequencia: { type: "number" },
          legenda: { type: "string" },
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                card: { type: "number" },
                titulo: { type: "string" },
                texto: { type: "string" },
                imagePrompt: { type: "string" },
                leituraCenica: LEITURA_CENICA_SCHEMA,
              },
              required: ["card", "titulo", "texto", "imagePrompt", "leituraCenica"],
              additionalProperties: false,
            },
          },
        },
        required: ["sequencia", "legenda", "cards"],
        additionalProperties: false,
      },
    },
    { type: "null" },
  ],
} as const;

const REELS_SCHEMA = {
  anyOf: [
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          hook: { type: "string" },
          script: { type: "string" },
          imagePrompt: { type: "string" },
          screenText: { type: "string" },
          legenda: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["hook", "script", "imagePrompt", "screenText", "legenda"],
        additionalProperties: false,
      },
    },
    { type: "null" },
  ],
} as const;

const STORIES_SCHEMA = {
  anyOf: [
    {
      type: "array",
      items: {
        type: "object",
        properties: {
          dia: { type: "number" },
          sequencia: { type: "string" },
          stories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                ordem: { type: "number" },
                tipo: { type: "string" },
                texto: { type: "string" },
              },
              required: ["ordem", "tipo", "texto"],
              additionalProperties: false,
            },
          },
        },
        required: ["dia", "sequencia", "stories"],
        additionalProperties: false,
      },
    },
    { type: "null" },
  ],
} as const;

const ANCORA_VISUAL_SCHEMA = {
  anyOf: [
    {
      type: "object",
      properties: {
        genero: { type: "string", enum: ["M", "F"] },
        papel: { type: "string", enum: ["publico_alvo", "contexto_de_uso"] },
        faixa_etaria: { type: "string" },
        marcadores_profissionais: { type: "string" },
        ambiente_base: { type: "string" },
      },
      required: ["genero", "papel", "faixa_etaria", "marcadores_profissionais", "ambiente_base"],
      additionalProperties: false,
    },
    { type: "null" },
  ],
} as const;

// Schema dependente da trilha: nas trilhas visual/experimentação o fechamento
// é "Estático Final" dentro de "feed" — a chave "reels" não existe nessas
// trilhas. Em response_format strict, toda chave em `properties` precisa
// constar em `required` (mesmo que anyOf-nullable); incluir "reels" sempre
// forçava o modelo a emitir "reels": null mesmo com o prompt instruindo o
// oposto — um conflito direto entre prompt e schema. Removendo a chave do
// schema quando ela não é usada, o conflito desaparece.
function buildMetodoOpSchema(includeReels: boolean, includeStories: boolean) {
  const properties: Record<string, unknown> = {
    ancora_visual: ANCORA_VISUAL_SCHEMA,
    feed: FEED_SCHEMA,
    carousel: CAROUSEL_SCHEMA,
  };
  const required = ["ancora_visual", "feed", "carousel"];
  if (includeReels) {
    properties.reels = REELS_SCHEMA;
    required.push("reels");
  }
  if (includeStories) {
    properties.stories = STORIES_SCHEMA;
    required.push("stories");
  }
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

export const Route = createFileRoute("/api/generate-content")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, preferredSlot, sequenceSize, track, wantsStories } = await request.json();
          if (!prompt) {
            return Response.json({ error: "prompt obrigatório" }, { status: 400 });
          }

          // Gate: limite de gerações por plano. Usa usuário efetivo (teste quando admin impersona).
          const effective = await resolveEffectiveUser(request);
          if (!effective) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          const { userId, impersonatedBy } = effective;
          if (!impersonatedBy) {
            const rate = await checkRateLimit(userId);
            if (!rate.ok) {
              return Response.json(
                {
                  error:
                    "Limite de 15 gerações por hora atingido. Aguarde antes de tentar novamente.",
                },
                { status: 429 },
              );
            }
          }
          const balance = await checkBalance(
            userId,
            0,
            0,
            1,
            preferredSlot as "plano1" | "plano2" | "bonus" | undefined,
          );
          if (!balance.ok) {
            return Response.json({ error: balanceFailMessage(balance.reason) }, { status: 402 });
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json(
              { error: "OPENAI_API_KEY_CONTENT não configurada" },
              { status: 500 },
            );
          }

          const t0 = Date.now();
          console.info("[generate-content] prompt_chars=%d", prompt.length);
          // Trilhas maiores (mais dias/cards/leituraCenica) geram mais tokens e
          // demoram mais com gpt-4.1 + json_schema strict — escala o timeout
          // pelo tamanho efetivo da sequência em vez de um valor fixo.
          const effectiveSize = track === "experimentacao" ? 3 : sequenceSize || 6;
          // Trilhas visual/experimentação fecham com "Estático Final" dentro de
          // "feed" — a chave "reels" não existe nessas trilhas (ver buildMetodoOpSchema).
          const includeReels = track !== "visual" && track !== "experimentacao";
          const includeStories = !!wantsStories;
          // S3 paga quase o mesmo prefill (prompt-base) que S6/S9 — só o array de
          // saída esperado é menor — então não faz sentido ter o orçamento de tempo
          // mais apertado dos três. Alinhado com S6.
          const TIMEOUT_BY_SIZE: Record<number, number> = { 3: 180_000, 6: 180_000, 9: 240_000 };
          const timeoutMs = TIMEOUT_BY_SIZE[effectiveSize] ?? 180_000;
          // S9 gera ~3x o conteúdo de S3 (6 itens de feed + 15 cards de carrossel +
          // 3 reels, cada um com leituraCenica verbosa) — 16384 tokens estoura e o
          // JSON sai truncado ("resposta incompleta"). 32768 é o teto do gpt-4.1.
          const MAX_TOKENS_BY_SIZE: Record<number, number> = { 3: 16384, 6: 16384, 9: 32768 };
          const maxTokens = MAX_TOKENS_BY_SIZE[effectiveSize] ?? 16384;
          const deadline = Date.now() + timeoutMs;
          let activeController: AbortController | null = null;

          const encoder = new TextEncoder();
          const requestBody = JSON.stringify({
            model: "gpt-4.1",
            messages: [
              {
                role: "system",
                content:
                  "Você é um especialista em comunicação de marca brasileira. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.85,
            max_tokens: maxTokens,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "metodo_op_result",
                strict: true,
                schema: buildMetodoOpSchema(includeReels, includeStories),
              },
            },
            stream: true,
            // Pede o chunk final com `usage` (incl. prompt_tokens_details.cached_tokens) —
            // mede se a reorganização do prefixo estático de buildMetodoOpPrompt (Etapa 1
            // do prompt caching) está sendo de fato reaproveitada pela OpenAI.
            stream_options: { include_usage: true },
          });

          // Faz uma chamada streaming à OpenAI e devolve o conteúdo acumulado.
          // gpt-4.1 + json_schema strict ocasionalmente trunca a resposta
          // (finish_reason='length' ou JSON inválido) de forma não-determinística,
          // por isso o handler tenta de novo quando isso acontece.
          // `budgetMs` é o orçamento de tempo desta tentativa (sub-orçamento do
          // timeout total) — cada tentativa tem seu próprio AbortController, então
          // uma 1ª tentativa lenta não consome todo o tempo da 2ª.
          async function runAttempt(budgetMs: number): Promise<
            | {
                kind: "ok";
                fullContent: string;
                finishReason: string | null;
                usage: { prompt_tokens?: number; cached_tokens?: number } | null;
              }
            | { kind: "http-error"; status: number; text: string }
            | { kind: "fetch-error"; aborted: boolean; message: string }
          > {
            const attemptController = new AbortController();
            activeController = attemptController;
            const attemptTimer = setTimeout(() => attemptController.abort(), budgetMs);
            try {
              let upstream: Response;
              try {
                upstream = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: requestBody,
                  signal: attemptController.signal,
                });
              } catch (e) {
                return {
                  kind: "fetch-error",
                  aborted: (e as Error).name === "AbortError",
                  message: (e as Error).message,
                };
              }
              if (!upstream.ok || !upstream.body) {
                const txt = await upstream.text().catch(() => "");
                return { kind: "http-error", status: upstream.status, text: txt };
              }
              const decoder = new TextDecoder();
              const reader = upstream.body.getReader();
              let buffer = "";
              let fullContent = "";
              let finishReason: string | null = null;
              let usage: { prompt_tokens?: number; cached_tokens?: number } | null = null;
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
                      const d = j?.choices?.[0]?.delta?.content;
                      if (typeof d === "string") fullContent += d;
                      const fr = j?.choices?.[0]?.finish_reason;
                      if (fr) finishReason = fr;
                      // Chunk final (stream_options.include_usage) — vem com choices:[]
                      // e o usage real da chamada, incluindo tokens cacheados.
                      if (j?.usage) {
                        usage = {
                          prompt_tokens: j.usage.prompt_tokens,
                          cached_tokens: j.usage.prompt_tokens_details?.cached_tokens,
                        };
                      }
                    } catch {
                      /* ignore parse errors */
                    }
                  }
                }
              }
              return { kind: "ok", fullContent, finishReason, usage };
            } catch (e) {
              return {
                kind: "fetch-error",
                aborted: (e as Error).name === "AbortError",
                message: (e as Error).message,
              };
            } finally {
              clearTimeout(attemptTimer);
              if (activeController === attemptController) activeController = null;
            }
          }

          const stream = new ReadableStream({
            async start(ctrl) {
              // Heartbeat: comentário SSE a cada 10s pra manter o pipe aquecido.
              const hb = setInterval(() => {
                try {
                  ctrl.enqueue(encoder.encode(": ping\n\n"));
                } catch {
                  /* controller já fechado (cliente desconectou) */
                }
              }, 10_000);

              try {
                let successContent: string | null = null;
                let lastContent: string | null = null;
                let connError: string | null = null;
                const maxAttempts = 2;
                // Tentativa 1 recebe no máximo 70% do orçamento total — se ela
                // travar perto do limite, ainda sobra tempo real para a tentativa 2
                // (antes, a 1ª tentativa podia consumir o timeout inteiro e a 2ª
                // rodava com ~0ms restantes).
                const ATTEMPT1_RATIO = 0.7;
                const MIN_ATTEMPT_BUDGET_MS = 15_000;

                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                  const remaining = deadline - Date.now();
                  if (remaining < MIN_ATTEMPT_BUDGET_MS) {
                    console.warn(
                      "[generate-content] sem orçamento de tempo restante para tentativa %d (%dms)",
                      attempt,
                      remaining,
                    );
                    break;
                  }
                  const budget =
                    attempt < maxAttempts
                      ? Math.min(remaining, Math.floor(timeoutMs * ATTEMPT1_RATIO))
                      : remaining;

                  const r = await runAttempt(budget);
                  if (r.kind === "fetch-error") {
                    console.error(
                      "[generate-content] attempt %d fetch failed (aborted=%s): %s",
                      attempt,
                      r.aborted,
                      r.message,
                    );
                    connError = r.aborted
                      ? "O servidor demorou demais pra responder. Tente novamente em alguns segundos."
                      : "Falha ao conectar ao gerador de conteúdo.";
                    continue;
                  }
                  if (r.kind === "http-error") {
                    console.error(
                      "[generate-content] attempt %d http %d: %s",
                      attempt,
                      r.status,
                      r.text.slice(0, 300),
                    );
                    connError = `OpenAI: ${r.text || r.status}`;
                    continue;
                  }
                  const validJson = (() => {
                    try {
                      JSON.parse(r.fullContent);
                      return true;
                    } catch {
                      return false;
                    }
                  })();
                  console.info(
                    "[generate-content] attempt %d openai_ms=%d chars=%d finish_reason=%s valid=%s prompt_tokens=%s cached_tokens=%s",
                    attempt,
                    Date.now() - t0,
                    r.fullContent.length,
                    r.finishReason,
                    validJson,
                    r.usage?.prompt_tokens ?? "?",
                    r.usage?.cached_tokens ?? "?",
                  );
                  lastContent = r.fullContent;
                  if (r.finishReason === "stop" && validJson) {
                    successContent = r.fullContent;
                    break;
                  }
                  console.warn(
                    "[generate-content] attempt %d incompleto (finish_reason=%s)%s",
                    attempt,
                    r.finishReason,
                    attempt < maxAttempts ? " — tentando de novo" : "",
                  );
                }

                if (successContent !== null) {
                  ctrl.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ choices: [{ delta: { content: successContent } }] })}\n\n`,
                    ),
                  );
                  ctrl.enqueue(encoder.encode("data: [DONE]\n\n"));
                } else if (lastContent !== null) {
                  // Devolve o que veio mesmo incompleto — o cliente detecta JSON
                  // inválido/vazio e mostra a mensagem apropriada.
                  ctrl.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ choices: [{ delta: { content: lastContent } }] })}\n\n`,
                    ),
                  );
                  ctrl.enqueue(encoder.encode("data: [DONE]\n\n"));
                } else {
                  ctrl.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ error: connError || "Falha ao gerar conteúdo." })}\n\n`,
                    ),
                  );
                }

                // Debita sempre (para rastreio de custo; usuário efetivo já resolvido acima).
                try {
                  await debitUsage(userId, 0, 0, {
                    evento: "gerar_conteudo_mop",
                    modulo: "mop",
                    geracoes: 1,
                    custoUsd: mopContentCost(effectiveSize),
                    impersonatedBy,
                    preferredSlot:
                      (preferredSlot as "plano1" | "plano2" | "bonus" | undefined) ?? undefined,
                  });
                } catch (e) {
                  console.warn("[generate-content] debit failed", e);
                }
              } catch (e) {
                console.error("[generate-content] stream error", (e as Error).message);
                try {
                  ctrl.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ error: "stream interrompido" })}\n\n`),
                  );
                } catch {
                  /* controller já fechado: cliente não vai receber o erro, mas já desconectou */
                }
              } finally {
                clearInterval(hb);
                try {
                  ctrl.close();
                } catch {
                  /* controller já estava fechado */
                }
              }
            },
            cancel() {
              try {
                activeController?.abort();
              } catch {
                /* abort best-effort no cancelamento do stream */
              }
            },
          });

          return new Response(stream, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
