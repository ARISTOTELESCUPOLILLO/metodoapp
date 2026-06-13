import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { fetchOpenAIChat } from '@/lib/openaiClient.server';

export const Route = createFileRoute('/api/correct-text')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
          }

          const body = await request.json();
          const text = String(body.text || '').slice(0, 2000);
          if (!text.trim()) {
            return Response.json({ corrected: text });
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json({ error: 'OPENAI_API_KEY_CONTENT não configurada' }, { status: 500 });
          }

          const result = await fetchOpenAIChat(apiKey, {
            model: 'gpt-4.1-mini',
            messages: [
              {
                role: 'system',
                content: 'Você revisa textos em português brasileiro. Corrija APENAS ortografia, acentuação, concordância e pontuação. NÃO altere o sentido, o tom, o tamanho, o vocabulário, as quebras de linha ou a estrutura das frases além do mínimo necessário para corrigir o erro. Se o texto já estiver correto, devolva-o exatamente igual. Responda SEMPRE com JSON válido no formato { "corrected": "texto corrigido" }.',
              },
              { role: 'user', content: text },
            ],
            temperature: 0,
            response_format: { type: 'json_object' },
          });

          if (!result.ok) {
            return Response.json({ error: result.error }, { status: result.status });
          }
          const content = result.data.choices?.[0]?.message?.content;
          if (!content) return Response.json({ error: 'Resposta vazia' }, { status: 502 });

          let parsed: { corrected?: string };
          try { parsed = JSON.parse(content); } catch { return Response.json({ error: 'JSON inválido' }, { status: 502 }); }

          return Response.json({ corrected: String(parsed.corrected ?? text) });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
