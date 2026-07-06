import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocka a chamada de rede à OpenAI — este teste não pode custar dinheiro real
// nem depender de resposta do modelo. Ele existe só para provar que a
// extração de suggest-keyinfo.ts para sugestaoEngine.ts (06/07/2026) NÃO
// mudou o TEXTO do prompt final montado — é a rede de segurança golden/
// snapshot recomendada pelo Agente de Conformidade Estrutural na auditoria
// dessa extração. Se qualquer bloco de prompt (lente, ancoragem, critérios
// de qualidade etc.) mudar de texto no futuro, o snapshot quebra e avisa.
const fetchOpenAIChatMock = vi.fn();
vi.mock("@/lib/openaiClient.server", () => ({
  fetchOpenAIChat: (...args: unknown[]) =>
    fetchOpenAIChatMock(...(args as [string, Record<string, unknown>, number?])),
}));

import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";

function jsonContent(obj: unknown) {
  return { choices: [{ message: { content: JSON.stringify(obj) } }] };
}

// Distingue as 3 chamadas que o motor faz pela `temperature` (única pista
// estável entre elas): 0.3 = decompoe atividade em itens, 0.1 = juiz
// estrutural, 0.95 = geração principal da sugestão. Captura os `messages`
// exatos enviados na chamada principal (0.95) para o snapshot.
let capturedMainMessages: unknown;
// Cada teste define o texto que o "modelo" devolve na chamada principal —
// precisa conter literalmente as palavras do concreteItem do fixture usado,
// senão checkItemNameDrift (checagem determinística real) reprova e o motor
// tenta de novo, quebrando a suposição de 1 única passada deste teste.
let mockAnswer = "";

beforeEach(() => {
  capturedMainMessages = undefined;
  mockAnswer = "";
  fetchOpenAIChatMock.mockReset();
  fetchOpenAIChatMock.mockImplementation(async (_apiKey: string, body: Record<string, unknown>) => {
    const temperature = body.temperature;
    if (temperature === 0.95) {
      capturedMainMessages = body.messages;
      return { ok: true, data: jsonContent({ sugestao: mockAnswer }) };
    }
    if (temperature === 0.1) {
      return {
        ok: true,
        data: jsonContent({
          fechoOk: true,
          nucleoOk: true,
          linguagemOk: true,
          especificoOk: true,
          economiaOk: true,
          motivo: "",
        }),
      };
    }
    if (temperature === 0.3) {
      return { ok: true, data: jsonContent({ itens: [] }) };
    }
    throw new Error(`fetchOpenAIChat mockado sem branch para temperature=${temperature}`);
  });
});

// ── Fixtures — mesmas empresas reais usadas na auditoria da Sugestão ────────

const mopInput: SugestaoEngineInput = {
  companyName: "Ferrimaq Máquinas",
  mainActivity: "Venda e manutenção de máquinas industriais e peças",
  objetivo: "promocao",
  hint: "",
  mode: "metodo",
  attempt: 0,
  sessionSeed: 0,
  previousSuggestions: [],
  segment: "VAREJO",
  isPersonalBrand: false,
  selectedProducts: ["Correias industriais"],
  audience: "B2B",
  brandVoice: "",
};

const puInput: SugestaoEngineInput = {
  companyName: "Pronto Vet",
  mainActivity: "Clínica veterinária com loja de rações e acessórios para pets",
  objetivo: "promocao",
  hint: "",
  mode: "postunico",
  attempt: 0,
  sessionSeed: 0,
  previousSuggestions: [],
  segment: "SERVIÇOS",
  isPersonalBrand: false,
  selectedProducts: ["Ração premium para cães"],
  audience: "B2C",
  brandVoice: "",
};

describe("generateSugestao — snapshot do prompt final (golden, sem IA real)", () => {
  it("MOP (metodo): monta o mesmo prompt de sempre para um cenário VAREJO/B2B", async () => {
    mockAnswer = "Correias industriais evitam parada da linha";
    const result = await generateSugestao("fake-api-key", mopInput);

    expect(capturedMainMessages).toMatchSnapshot();
    expect(result.sugestao).toBe(mockAnswer);
  });

  it("PU (postunico): monta o mesmo prompt de sempre para um cenário SERVIÇOS/B2C com item VAREJO", async () => {
    mockAnswer = "Ração premium para cães sem faltar";
    const result = await generateSugestao("fake-api-key", puInput);

    expect(capturedMainMessages).toMatchSnapshot();
    expect(result.sugestao).toBe(mockAnswer);
  });

  it("não repete o juiz estrutural nem o retry quando a 1ª tentativa já passa em tudo", async () => {
    mockAnswer = "Correias industriais evitam parada da linha";
    await generateSugestao("fake-api-key", mopInput);
    // 1 chamada de geração (0.95) + 1 chamada de juiz (0.1); decompose (0.3)
    // nem roda aqui porque selectedProducts já veio preenchido.
    expect(fetchOpenAIChatMock).toHaveBeenCalledTimes(2);
  });
});
