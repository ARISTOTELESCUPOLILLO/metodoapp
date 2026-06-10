import { createFileRoute } from '@tanstack/react-router';
import { checkBalance, debitUsage, resolveEffectiveUser } from '@/lib/usage.server';
import { COST_USD } from '@/lib/costs';

const LEITURA_CENICA_SCHEMA = {
  anyOf: [
    {
      type: 'object',
      properties: {
        intencao: { type: 'string' },
        personagem: { type: 'string' },
        ambiente: { type: 'string' },
        expressao: { type: 'string' },
        clima: { type: 'string' },
        composicao: { type: 'string' },
      },
      required: ['intencao', 'personagem', 'ambiente', 'expressao', 'clima', 'composicao'],
      additionalProperties: false,
    },
    { type: 'null' },
  ],
} as const;

const METODO_OP_SCHEMA = {
  type: 'object',
  properties: {
    feed: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dia: { type: 'number' },
              formato: { type: 'string' },
              titulo: { type: 'string' },
              texto: { type: 'string' },
              legenda: { type: 'string' },
              imagem: { type: 'string' },
              leituraCenica: LEITURA_CENICA_SCHEMA,
            },
            required: ['dia', 'formato', 'titulo', 'texto', 'legenda', 'imagem', 'leituraCenica'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
    carousel: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sequencia: { type: 'number' },
              legenda: { type: 'string' },
              cards: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    card: { type: 'number' },
                    titulo: { type: 'string' },
                    texto: { type: 'string' },
                    imagePrompt: { type: 'string' },
                    leituraCenica: LEITURA_CENICA_SCHEMA,
                  },
                  required: ['card', 'titulo', 'texto', 'imagePrompt', 'leituraCenica'],
                  additionalProperties: false,
                },
              },
            },
            required: ['sequencia', 'legenda', 'cards'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
    reels: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              hook: { type: 'string' },
              script: { type: 'string' },
              imagePrompt: { type: 'string' },
              screenText: { type: 'string' },
              legenda: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
            required: ['hook', 'script', 'imagePrompt', 'screenText', 'legenda'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
    stories: {
      anyOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dia: { type: 'number' },
              sequencia: { type: 'string' },
              stories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    ordem: { type: 'number' },
                    tipo: { type: 'string' },
                    texto: { type: 'string' },
                  },
                  required: ['ordem', 'tipo', 'texto'],
                  additionalProperties: false,
                },
              },
            },
            required: ['dia', 'sequencia', 'stories'],
            additionalProperties: false,
          },
        },
        { type: 'null' },
      ],
    },
  },
  required: ['feed', 'carousel', 'reels', 'stories'],
  additionalProperties: false,
} as const;

export const Route = createFileRoute('/api/generate-content')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { prompt, preferredSlot } = await request.json();
          if (!prompt) {
            return Response.json({ error: 'prompt obrigatório' }, { status: 400 });
          }

          // Gate: limite de gerações por plano. Usa usuário efetivo (teste quando admin impersona).
          const effective = await resolveEffectiveUser(request);
          if (!effective) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
          }
          const { userId, impersonatedBy } = effective;
          const balance = await checkBalance(userId, 0, 0, 1, preferredSlot as 'plano1' | 'plano2' | 'bonus' | undefined);
          if (!balance.ok) {
            const slot = preferredSlot as string | undefined;
            const msg = slot === 'bonus' ? 'Bônus encerrado.' : 'Plano esgotado — renove para continuar.';
            return Response.json({ error: msg }, { status: 402 });
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json({ error: 'OPENAI_API_KEY_CONTENT não configurada' }, { status: 500 });
          }

          const t0 = Date.now();
          console.info('[generate-content] prompt_chars=%d', prompt.length);
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 120_000);

          let upstream: Response;
          try {
            upstream = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4.1',
                messages: [
                  { role: 'system', content: 'Você é um especialista em comunicação de marca brasileira. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro.' },
                  { role: 'user', content: prompt },
                ],
                temperature: 0.85,
                max_tokens: 16384,
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: 'metodo_op_result',
                    strict: true,
                    schema: METODO_OP_SCHEMA,
                  },
                },
                stream: true,
              }),
              signal: controller.signal,
            });
          } catch (e) {
            clearTimeout(timer);
            const aborted = (e as Error).name === 'AbortError';
            console.error('[generate-content] openai fetch failed', aborted ? 'timeout' : (e as Error).message);
            return Response.json(
              { error: aborted ? 'O servidor demorou demais pra responder. Tente novamente em alguns segundos.' : 'Falha ao conectar ao gerador de conteúdo.' },
              { status: aborted ? 504 : 502 },
            );
          }

          if (!upstream.ok || !upstream.body) {
            clearTimeout(timer);
            const txt = await upstream.text().catch(() => '');
            return Response.json({ error: `OpenAI: ${txt || upstream.status}` }, { status: 502 });
          }

          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          const reader = upstream.body.getReader();

          const stream = new ReadableStream({
            async start(ctrl) {
              // Heartbeat: comentário SSE a cada 10s pra manter o pipe aquecido.
              const hb = setInterval(() => {
                try { ctrl.enqueue(encoder.encode(': ping\n\n')); } catch {}
              }, 10_000);

              let buffer = '';
              let fullContent = '';
              try {
                while (true) {
                  const { value, done } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  buffer += chunk;
                  // Repassa cru pro cliente (SSE puro da OpenAI).
                  ctrl.enqueue(encoder.encode(chunk));

                  // Acumula `delta.content` pra logging/debit no fim.
                  let idx;
                  while ((idx = buffer.indexOf('\n\n')) !== -1) {
                    const evt = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    for (const line of evt.split('\n')) {
                      if (!line.startsWith('data: ')) continue;
                      const payload = line.slice(6).trim();
                      if (!payload || payload === '[DONE]') continue;
                      try {
                        const j = JSON.parse(payload);
                        const d = j?.choices?.[0]?.delta?.content;
                        if (typeof d === 'string') fullContent += d;
                        const cached = j?.usage?.prompt_tokens_details?.cached_tokens;
                        if (cached) console.info('[generate-content] cached_tokens=%d', cached);
                      } catch { /* ignore parse errors */ }
                    }
                  }
                }
                console.info('[generate-content] openai_ms=' + (Date.now() - t0) + ' chars=' + fullContent.length);

                // Debita sempre (para rastreio de custo; usuário efetivo já resolvido acima).
                try {
                  await debitUsage(userId, 0, 0, { evento: 'gerar_conteudo_mop', modulo: 'mop', geracoes: 1, custoUsd: COST_USD.content, impersonatedBy, preferredSlot: (preferredSlot as 'plano1' | 'plano2' | 'bonus' | undefined) ?? undefined });
                } catch (e) {
                  console.warn('[generate-content] debit failed', e);
                }
              } catch (e) {
                console.error('[generate-content] stream error', (e as Error).message);
                try {
                  ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'stream interrompido' })}\n\n`));
                } catch {}
              } finally {
                clearInterval(hb);
                clearTimeout(timer);
                try { ctrl.close(); } catch {}
              }
            },
            cancel() {
              try { controller.abort(); } catch {}
            },
          });

          return new Response(stream, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no',
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
