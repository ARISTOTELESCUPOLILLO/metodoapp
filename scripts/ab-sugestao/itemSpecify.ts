import { fetchOpenAIChat } from "@/lib/openaiClient.server";

// ─────────────────────────────────────────────────────────────────────────
// Teste da ideia ORIGINAL do Aristóteles (08/07/2026): pega o TEXTO EXATO
// que o usuário escreveu no campo produto/serviço (ex.: "ração") e ajusta
// SILENCIOSAMENTE esse mesmo item para uma versão mais específica (ex.:
// "ração para cães adultos") — ao contrário de contextHint.ts (ideia do
// Fable), aqui o item que vira `concreteItem`/`selectedProducts` MUDA de
// texto de verdade. É a versão mais arriscada (ver conversa): o validador
// de produção `checkItemNameDrift` obriga a Sugestão final a ecoar as
// palavras do item, então uma especificação errada não fica escondida —
// aparece na frase que o dono da empresa lê.
//
// Grounding fail-closed (mesmo padrão de contextHint.ts/decomposeAtividade-
// EmItens): cada palavra significativa ADICIONADA ao item precisa ter
// âncora literal na ATIVIDADE ou nos OUTROS PRODUTOS cadastrados. Sem
// âncora, devolve null — o chamador usa o item genérico original (piso de
// segurança = igual a hoje).
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

const SPECIFY_TIMEOUT_MS = 6_000;

export async function generateItemSpecification(
  apiKey: string,
  item: string,
  mainActivity: string,
  otherProducts: string[],
): Promise<string | null> {
  const corpus = [mainActivity, ...otherProducts].join(" ").trim();
  if (!corpus) return null;

  try {
    const prompt = `Você recebe um produto/serviço GENÉRICO que um pequeno empresário brasileiro cadastrou no próprio app (ele digitou de forma vaga, sem detalhar).

ITEM COMO O USUÁRIO ESCREVEU: "${item}"
ATIVIDADE DA EMPRESA: "${mainActivity}"
OUTROS PRODUTOS/SERVIÇOS QUE ELE TAMBÉM CADASTROU: ${otherProducts.length ? otherProducts.map((p) => `"${p}"`).join(", ") : "(nenhum outro)"}

Sua tarefa: reescrever "${item}" numa versão MAIS ESPECÍFICA e concreta — mesmo produto/serviço, só que nomeado com mais precisão (ex.: "ração" → "ração para cães adultos", "óleo lubrificante" → "óleo lubrificante para motores agrícolas"). NÃO troque de produto, NÃO invente um público/segmento de cliente que a empresa não sirva.

Gere de 1 a 3 candidatos. Para cada um, informe a ÂNCORA: palavras da ATIVIDADE ou dos OUTROS PRODUTOS (podem combinar palavras de lugares diferentes, mas cada palavra da âncora precisa existir literalmente em algum dos dois textos acima) que JUSTIFICAM essa especificação. Se você não conseguir apontar palavras reais que sustentem um candidato, NÃO o inclua.

Se não houver base real para nenhum candidato mais específico, devolva lista vazia — mantenha o item genérico, não invente.

Responda JSON EXATAMENTE assim: { "candidatos": [{ "item": "versão específica do produto/serviço", "ancora": "trecho literal da atividade ou dos outros produtos" }] }`;

    const result = await fetchOpenAIChat(
      apiKey,
      {
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      },
      SPECIFY_TIMEOUT_MS,
    );
    if (!result.ok) return null;
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) return null;

    let parsed: { candidatos?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed.candidatos)) return null;

    const corpusNorm = normalizeForOverlap(corpus);
    for (const raw of parsed.candidatos) {
      if (!raw || typeof raw !== "object") continue;
      const specifiedItem = String((raw as { item?: unknown }).item || "").trim();
      const ancora = String((raw as { ancora?: unknown }).ancora || "").trim();
      if (!specifiedItem || !ancora) continue;
      if (!ancoraIsGrounded(ancora, corpusNorm)) continue;
      return specifiedItem;
    }
    return null;
  } catch {
    return null;
  }
}
