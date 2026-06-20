// Cliente compartilhado para chamadas não-streaming à API de chat da OpenAI,
// usado pelos endpoints secundários (regenerate-block, generate-pu-copy,
// generate-caption, suggest-keyinfo). Adiciona timeout (~25s) + 1 retry de
// conexão, com mensagens amigáveis no mesmo padrão de generate-content.ts.

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

// Forma parcial da resposta de chat completion da OpenAI: só os campos que os
// callers leem (result.data.choices[0].message.content). Os demais campos do
// payload existem mas não são consumidos, então ficam fora do tipo.
export type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export type OpenAIChatResult =
  | { ok: true; data: OpenAIChatResponse }
  | { ok: false; status: number; error: string };

export async function fetchOpenAIChat(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs = 25_000,
): Promise<OpenAIChatResult> {
  const requestBody = JSON.stringify(body);
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
        signal: controller.signal,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return { ok: false, status: 502, error: `OpenAI: ${txt}` };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (e) {
      if (attempt < maxAttempts) continue;
      const aborted = (e as Error).name === "AbortError";
      return {
        ok: false,
        status: 504,
        error: aborted
          ? "O servidor demorou demais pra responder. Tente novamente em alguns segundos."
          : "Falha ao conectar ao gerador de conteúdo.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: 504, error: "Falha ao conectar ao gerador de conteúdo." };
}
