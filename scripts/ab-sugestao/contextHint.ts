import { fetchOpenAIChat } from "@/lib/openaiClient.server";

// ─────────────────────────────────────────────────────────────────────────
// Teste da ideia do Fable (08/07/2026, conversa sobre "especificação
// silenciosa de produto genérico"): em vez de reescrever o NOME do item
// cadastrado (arriscado — vira afirmação de catálogo, travada pelo
// checkItemNameDrift em produção), gera 1-3 hipóteses de CONTEXTO DE USO
// para um item genérico e injeta como reforço na ATIVIDADE — o
// elementoConcretoBlock de sugestaoEngine.ts já lê "dentro de
// '${mainActivity}'" para montar o CONTEXTO REAL DE USO, então aumentar
// mainActivity é o único gancho necessário para testar a ideia usando a
// função de produção `generateSugestao` inalterada (zero duplicação de
// prompt, zero risco de o teste divergir do comportamento real).
//
// Grounding: mesmo padrão de decomposeAtividadeEmItens (ancoraIsGrounded),
// mas contra um corpus mais largo — ATIVIDADE + DEMAIS PRODUTOS CADASTRADOS
// (sugestão do Fable no parecer: "grounding cruzado dentro do próprio kit").
// Sem âncora real nesse corpus, a hipótese é descartada — a função devolve
// null e o chamador usa a ATIVIDADE original, sem hint (mesmo comportamento
// de hoje = piso de segurança).
// ─────────────────────────────────────────────────────────────────────────

function normalizeForOverlap(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const OVERLAP_STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os",
  "para", "com", "em", "um", "uma", "no", "na", "ou",
]);

function ancoraIsGrounded(ancora: string, corpusNorm: string): boolean {
  const words = normalizeForOverlap(ancora)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !OVERLAP_STOPWORDS.has(w));
  if (words.length === 0) return false;
  return words.every((w) => corpusNorm.includes(w));
}

const HINT_TIMEOUT_MS = 6_000;

export async function generateContextHint(
  apiKey: string,
  item: string,
  mainActivity: string,
  otherProducts: string[],
): Promise<string | null> {
  const corpus = [mainActivity, ...otherProducts].join(" ").trim();
  if (!corpus) return null;

  try {
    const prompt = `Você recebe um produto/serviço GENÉRICO cadastrado por uma pequena empresa brasileira, e o contexto real dessa empresa.

ITEM GENÉRICO: "${item}"
ATIVIDADE DA EMPRESA: "${mainActivity}"
OUTROS PRODUTOS/SERVIÇOS CADASTRADOS: ${otherProducts.length ? otherProducts.map((p) => `"${p}"`).join(", ") : "(nenhum outro)"}

Gere de 1 a 3 hipóteses de CONTEXTO DE USO específico para esse item — NÃO reescreva o nome do item, NÃO invente um público ou segmento de cliente que não esteja implícito na atividade/outros produtos. Cada hipótese é uma situação concreta e curta (até 8 palavras) em que esse item genérico aparece dentro desse negócio específico.

Para cada hipótese, informe também a ÂNCORA: palavras da ATIVIDADE ou dos OUTROS PRODUTOS (podem combinar palavras de lugares diferentes, mas cada palavra da âncora precisa existir literalmente em algum dos dois textos acima) que justificam essa hipótese. Se você não conseguir apontar palavras reais que sustentem a hipótese, NÃO a inclua.

Se não houver base real para nenhuma hipótese, devolva lista vazia — não invente.

Responda JSON EXATAMENTE assim: { "hipoteses": [{ "contexto": "situação curta", "ancora": "trecho literal da atividade ou dos outros produtos" }] }`;

    const result = await fetchOpenAIChat(
      apiKey,
      {
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      },
      HINT_TIMEOUT_MS,
    );
    if (!result.ok) return null;
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) return null;

    let parsed: { hipoteses?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed.hipoteses)) return null;

    const corpusNorm = normalizeForOverlap(corpus);
    for (const raw of parsed.hipoteses) {
      if (!raw || typeof raw !== "object") continue;
      const contexto = String((raw as { contexto?: unknown }).contexto || "").trim();
      const ancora = String((raw as { ancora?: unknown }).ancora || "").trim();
      if (!contexto || !ancora) continue;
      if (!ancoraIsGrounded(ancora, corpusNorm)) continue;
      return contexto;
    }
    return null;
  } catch {
    return null;
  }
}
