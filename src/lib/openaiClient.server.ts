// Cliente compartilhado para chamadas não-streaming à API de chat da OpenAI,
// usado pelos endpoints secundários (regenerate-block, generate-pu-copy,
// generate-caption, suggest-keyinfo). Adiciona timeout (~25s) + 1 retry de
// conexão, com mensagens amigáveis no mesmo padrão de generate-content.ts.

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 429 "rate_limit_exceeded" (tokens por minuto) é transitório e quase sempre
// some sozinho em poucos segundos — a própria OpenAI informa quanto esperar
// ("Please try again in 3.724s") no corpo do erro. Sem retry aqui, um pico
// normal de uso (ex.: várias tentativas da Sugestão em sequência) vira um
// erro cru na tela do usuário por um problema que se resolveria sozinho num
// piscar de olhos. Exportada pra reuso em generate-content.ts (streaming do
// MOP), que já reage a erro HTTP mas sem nenhuma espera entre tentativas.
export function parseRetryDelayFromText(bodyText: string): number {
  const match = bodyText.match(/try again in ([\d.]+)\s*s/i);
  if (match) {
    const secs = Number(match[1]);
    if (!Number.isNaN(secs) && secs > 0) return Math.min(secs * 1000 + 300, 10_000);
  }
  return 3000;
}

function parseRetryDelayMs(res: Response, bodyText: string): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (!Number.isNaN(secs) && secs > 0) return Math.min(secs * 1000, 10_000);
  }
  return parseRetryDelayFromText(bodyText);
}

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
  // Subido de 2 pra 3 pra abrir espaço pro retry específico de 429 (rate
  // limit) sem reduzir a tolerância já existente a erro de conexão/timeout.
  const maxAttempts = 3;

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
        if (res.status === 429 && attempt < maxAttempts) {
          clearTimeout(timer);
          await sleep(parseRetryDelayMs(res, txt));
          continue;
        }
        const friendly =
          res.status === 429
            ? "Limite de uso da OpenAI atingido no momento — tente novamente em alguns segundos."
            : `OpenAI: ${txt}`;
        return { ok: false, status: res.status === 429 ? 429 : 502, error: friendly };
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
