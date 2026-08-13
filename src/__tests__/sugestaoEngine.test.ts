import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocka a chamada de rede à OpenAI — este teste não pode custar dinheiro real
// nem depender de resposta do modelo. É a rede de segurança golden/snapshot
// recomendada pelo Agente de Conformidade Estrutural na auditoria da
// extração de suggest-keyinfo.ts para sugestaoEngine.ts (06/07/2026): trava
// o TEXTO do prompt final montado, para que qualquer bloco (lente,
// ancoragem, critérios de qualidade etc.) que mudar sem querer no futuro
// quebre o snapshot e avise.
const fetchOpenAIChatMock = vi.fn();
vi.mock("@/lib/openaiClient.server", () => ({
  fetchOpenAIChat: (...args: unknown[]) =>
    fetchOpenAIChatMock(...(args as [string, Record<string, unknown>, number?])),
}));

import {
  generateSugestao,
  pickConcreteItem,
  type SugestaoEngineInput,
} from "@/core/sugestaoEngine";
import { checkAmputatedPredicate } from "@/core/sugestaoValidation";

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
          contextoOk: true,
          gramaticaOk: true,
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

  it("avisa sobre construção já usada no lote quando há sugestões anteriores com 'para'", async () => {
    mockAnswer = "Correias industriais em revisão evitam parada";
    await generateSugestao("fake-api-key", {
      ...mopInput,
      previousSuggestions: ["Correias industriais para evitar paradas"],
    });
    const promptText = JSON.stringify(capturedMainMessages);
    expect(promptText).toContain("CONSTRUÇÃO/VERBO JÁ USADO NESTE LOTE");
    expect(promptText).toContain("usaram o conector");
    expect(promptText).toContain("para");
  });

  // 13/08/2026 — o aviso de lote NÃO pode voltar a mandar trocar de conector:
  // era ele que empurrava para "à"/"na"/"no", os piores da medição de 12/07.
  it("manda variar a construção, não o conector, e libera repetir com/para", async () => {
    mockAnswer = "Correias industriais em revisão evitam parada";
    await generateSugestao("fake-api-key", {
      ...mopInput,
      previousSuggestions: ["Correias industriais para evitar paradas"],
    });
    const promptText = JSON.stringify(capturedMainMessages);
    expect(promptText).toContain('Repetir \\"com\\" ou \\"para\\" aqui é ACEITÁVEL');
    expect(promptText).toContain("O que NÃO pode repetir é a CONSTRUÇÃO");
    expect(promptText).not.toContain("prefira variar (outro conector");
  });

  // A hierarquia com/para precisa chegar ao prompt SEMPRE, não só quando há
  // sugestões anteriores no lote — o bloco de contexto entra em toda geração.
  it("declara com/para como conectores padrão em toda geração", async () => {
    mockAnswer = "Correias industriais evitam parada da linha";
    await generateSugestao("fake-api-key", mopInput);
    const promptText = JSON.stringify(capturedMainMessages);
    expect(promptText).toContain("devem ser a escolha padrão");
    expect(promptText).toContain("TESTE DO CONECTOR");
  });

  // 13/08/2026 — as 15 gerações reais mostraram que a hierarquia com/para
  // zerou as frases com verbo de ação (4 de 15 antes, 0 depois). A preferência
  // de CONECTOR não pode virar preferência de FORMA: o prompt precisa declarar
  // o escopo dela junto, senão o molde locução engole a construção com verbo.
  it("limita a hierarquia de conector à frase que usa conector, preservando o verbo de ação", async () => {
    mockAnswer = "Correias industriais evitam parada da linha";
    await generateSugestao("fake-api-key", mopInput);
    const promptText = JSON.stringify(capturedMainMessages);
    expect(promptText).toContain("SÓ VALE QUANDO A FRASE USA CONECTOR");
    expect(promptText).toContain("TÃO BOA QUANTO");
    expect(promptText).toContain("As duas formas precisam conviver");
  });
});

// 13/08/2026 — 4 das 30 frases do teste de repertório saíram amputadas, todas
// com 6-7 palavras (o teto). O limite faz o modelo cortar em vez de escolher
// ideia menor. checkDanglingEnding já pegava preposição solta; faltava o verbo
// transitivo sem objeto.
describe("checkAmputatedPredicate — frase cortada para caber no limite", () => {
  // Casos REAIS, colhidos em results-fato-vs-avaliacao-1786623747535.json.
  it.each([
    "Planejamento de comunicação em época promocional evita",
    "Consultas veterinárias para apatia ou falta",
  ])("reprova a frase amputada real: %s", (frase) => {
    const motivos = checkAmputatedPredicate(frase);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("frase amputada");
  });

  it.each([
    "Lubrificantes agrícolas evitam paradas no campo",
    "Capacete de moto para chuva repentina",
    "Poltrona de trabalho tira a dor lombar",
    "Tênis novo renova passeios pela cidade",
  ])("aprova a frase completa: %s", (frase) => {
    expect(checkAmputatedPredicate(frase)).toEqual([]);
  });

  // Os falsos positivos que a lista evita de propósito: formas que também são
  // substantivo comum. Se alguém adicionar "tira"/"conta"/"cria" à lista, estes
  // testes quebram e explicam por quê.
  it.each([
    "Tênis com tira refletiva na lateral",
    "Poltrona de trabalho para quem faz conta",
    "Ração premium para cadela com cria",
  ])("não reprova substantivo homônimo de verbo: %s", (frase) => {
    expect(checkAmputatedPredicate(frase)).toEqual([]);
  });

  it("pega a forma no plural e ignora pontuação final", () => {
    expect(checkAmputatedPredicate("Correias industriais boas evitam.")).toHaveLength(1);
  });

  it("não quebra com entrada vazia", () => {
    expect(checkAmputatedPredicate("   ")).toEqual([]);
  });
});

describe("pickConcreteItem — guarda de família semântica (achado real AJUSTE_CONFLITO 07/2026)", () => {
  // Pool real do print "Tudo MESA": 8 itens, os 3 últimos cadastrados em
  // sequência são todos mesa/escrivaninha — antes do embaralhamento
  // determinístico + guarda de família, o passeio por índice consecutivo
  // podia entregar os 3 do mesmo lote, mesmo sendo itens distintos.
  const items = [
    "Armário de escritório",
    "Poltrona de trabalho",
    "Estante de escritório",
    "Cadeira estofada de escritório",
    "Cadeira de recepção de consultório",
    "Mesa de secretária",
    "Mesa de escritório",
    "Mesa para gestores",
  ];

  it("não entrega 2+ itens da mesma família (mesma 1ª palavra significativa) no mesmo lote de 3", () => {
    for (let sessionSeed = 0; sessionSeed < 200; sessionSeed++) {
      const prev: string[] = [];
      const picks: string[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const { item } = pickConcreteItem(items, attempt, prev, sessionSeed);
        picks.push(item!);
        prev.push(`${item} verbo qualquer aqui`);
      }
      const mesaCount = picks.filter((p) => p.toLowerCase().includes("mesa")).length;
      expect(mesaCount, `seed=${sessionSeed}: ${picks.join(" | ")}`).toBeLessThan(2);
    }
  });

  it("com 1 único item marcado, continua devolvendo sempre o mesmo item (âncora automática)", () => {
    const single = ["Mesa para gestores"];
    for (let attempt = 0; attempt < 3; attempt++) {
      const { item } = pickConcreteItem(single, attempt, [], 42);
      expect(item).toBe("Mesa para gestores");
    }
  });
});
