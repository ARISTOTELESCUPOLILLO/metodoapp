import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest, checkBalance, checkRateLimit } from "@/lib/usage.server";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";

const SEGMENT_LABEL: Record<string, string> = {
  VAREJO: "Varejo — comercialização de produtos ao consumidor final",
  MARCA: "Marca — construção de identidade e posicionamento",
  SERVIÇOS: "Serviços — prestação de serviços especializados",
};

interface JudgeItem {
  id: string;
  formato?: string;
  titulo?: string;
  texto?: string;
  legenda?: string;
}

export const Route = createFileRoute("/api/judge-content")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          // Exigia login mas não checava plano. Este juiz roda automático
          // depois de uma geração já paga em outro endpoint — sem plano,
          // não há geração legítima para julgar, então falha aberto (sem
          // reprovações) em vez de erro, mantendo o padrão não-bloqueante
          // já usado abaixo para items.length === 0.
          const balance = await checkBalance(userId, 0, 0, 0);
          if (!balance.ok) {
            return Response.json({ avaliacoes: [] });
          }
          const rate = await checkRateLimit(userId);
          if (!rate.ok) {
            return Response.json({ avaliacoes: [] });
          }

          const body = await request.json();
          const companyName = String(body.companyName || "").slice(0, 200);
          const mainActivity = String(body.mainActivity || "").slice(0, 300);
          const segment = String(body.segment || "");
          const keyInfo = String(body.keyInfo || "").slice(0, 1000);
          const items: JudgeItem[] = Array.isArray(body.items) ? body.items.slice(0, 30) : [];

          if (items.length === 0) {
            return Response.json({ avaliacoes: [] });
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json(
              { error: "OPENAI_API_KEY_CONTENT não configurada" },
              { status: 500 },
            );
          }

          const segmentBlock = segment ? `SEGMENTO: ${SEGMENT_LABEL[segment] || segment}\n` : "";

          const itemsBlock = items
            .map((it) => {
              const campos: string[] = [];
              if (it.titulo) campos.push(`  título: "${it.titulo}"`);
              if (it.texto) campos.push(`  texto: "${it.texto}"`);
              if (it.legenda) campos.push(`  legenda: "${it.legenda}"`);
              return `- id: "${it.id}" (${it.formato || "peça"})\n${campos.join("\n")}`;
            })
            .join("\n");

          const userPrompt = `Você está revisando a sequência de conteúdo gerada pelo Método OP para Instagram. NÃO reescreva nada — apenas avalie.

EMPRESA: ${companyName}
ATIVIDADE: ${mainActivity}
${segmentBlock}INFORMAÇÃO-CHAVE (oferta/contexto real do momento): "${keyInfo || "(não informada)"}"

CONTEXTO IMPORTANTE SOBRE A PROGRESSÃO DA SEQUÊNCIA: o Método OP constrói uma progressão psicológica — peças do INÍCIO da sequência (primeiros estáticos/carrossel) trabalham tensão, identificação ou contexto, e PODEM, DE PROPÓSITO, não citar a oferta/informação-chave diretamente. Isso é esperado e CORRETO — NÃO reprove por isso. Só avalie "perde relação com a informação-chave" para a peça de FECHAMENTO da sequência (formato "Estático Final", "Reels" final ou último item) — e mesmo assim só reprove se ela não tiver NENHUMA relação com o negócio/oferta, não por falta de cópia literal de palavras.

PEÇAS:
${itemsBlock}

Avalie CADA campo (titulo/texto/legenda) preenchido de cada peça segundo estes 5 critérios — e SOMENTE estes:
1. SEM SENTIDO: a frase não faz sentido lógico ou gramatical em português, mesmo que cada palavra individualmente esteja correta (ex.: combinação de palavras que não forma uma ideia coerente).
2. PERDE RELAÇÃO COM A INFORMAÇÃO-CHAVE: aplica-se SOMENTE à peça de fechamento (ver acima) — o conteúdo não tem nenhuma relação com o negócio/oferta informada.
3. GENÉRICO DEMAIS: o texto poderia pertencer a QUALQUER empresa de QUALQUER ramo — não diz nada específico sobre este negócio, atividade ou segmento.
4. NÃO CONVERSA COM O SEGMENTO: o tom, vocabulário ou abordagem é incompatível com o segmento informado (ex.: linguagem de varejo popular numa marca institucional sóbria, ou vice-versa).
5. FORÇADO/NÃO NATURAL: a frase é gramaticalmente válida mas nenhum brasileiro falaria assim — soa comprimida ou truncada para caber num limite de palavras, com concordância estranha ou conectivo faltando (ex.: "Mais olho nos seus anúncios", "Rotina de ajustes prévios conta", "Seu lucro pede olhar vivo"). Teste: leia em voz alta — se travar ou parecer tradução malfeita, reprove.

Retorne JSON EXATAMENTE assim, listando APENAS os campos REPROVADOS em algum critério (lista vazia se todos estiverem bons):
{ "avaliacoes": [ { "id": "feed[0]", "campo": "titulo", "motivo": "explicação curta e específica do problema" } ] }`;

          const result = await fetchOpenAIChat(
            apiKey,
            {
              model: "gpt-4.1-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "Você é revisor de qualidade de conteúdo publicitário brasileiro. Sua função é APENAS avaliar e apontar problemas reais — nunca reescrever, nunca inventar problema para parecer rigoroso. Responda SEMPRE com JSON válido.",
                },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.2,
              response_format: { type: "json_object" },
            },
            10_000,
          );

          if (!result.ok) {
            return Response.json({ error: result.error }, { status: result.status });
          }
          const content = result.data.choices?.[0]?.message?.content;
          if (!content) return Response.json({ avaliacoes: [] });

          let parsed: { avaliacoes?: { id?: string; campo?: string; motivo?: string }[] };
          try {
            parsed = JSON.parse(content);
          } catch {
            return Response.json({ avaliacoes: [] });
          }

          const validIds = new Set(items.map((it) => it.id));
          const avaliacoes = (Array.isArray(parsed.avaliacoes) ? parsed.avaliacoes : [])
            .filter(
              (a) =>
                a &&
                validIds.has(String(a.id)) &&
                ["titulo", "texto", "legenda"].includes(String(a.campo)) &&
                a.motivo,
            )
            .map((a) => ({
              id: String(a.id),
              campo: String(a.campo),
              motivo: String(a.motivo).slice(0, 300),
            }))
            .slice(0, 30);

          return Response.json({ avaliacoes });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
