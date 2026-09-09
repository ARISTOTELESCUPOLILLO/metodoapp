import { describe, it, expect } from "vitest";
import {
  validateScriptReels,
  frasesDoScript,
  SCRIPT_MIN_WORDS,
  SCRIPT_MAX_WORDS,
  SCRIPT_FECHO_MAX_WORDS,
} from "../core/scriptValidation";
import { buildMetodoOpPrompt } from "../core/organizaMethodEngine";

// Régua do roteiro falado — nasceu do caso real de 09/09/2026 (S3C, conta
// admin). O roteiro que saiu está no primeiro teste: 17 palavras, duas frases
// de mensagem, nenhum fecho. O vídeo terminou no meio de uma ideia.

const ROTEIRO_DEFEITUOSO =
  "Muitos cliques não trazem consulta real. Só número alto não resolve o dia a dia do time.";

describe("validateScriptReels — o caso que originou a régua", () => {
  it("reprova o roteiro real que gerou o vídeo sem fecho", () => {
    const motivos = validateScriptReels(ROTEIRO_DEFEITUOSO);
    expect(motivos.length).toBeGreaterThan(0);
    // Duas frases, mas a última tem 11 palavras — é continuação, não fecho.
    expect(motivos.join(" ")).toContain("não é um fecho");
  });

  it("reprova por tamanho: 17 palavras ficam abaixo do mínimo", () => {
    expect(ROTEIRO_DEFEITUOSO.split(/\s+/).length).toBe(17);
    expect(validateScriptReels(ROTEIRO_DEFEITUOSO).join(" ")).toContain(String(SCRIPT_MIN_WORDS));
  });
});

describe("validateScriptReels — o que passa", () => {
  const BOM =
    "Muitos cliques chegam todo dia, e quase nenhum vira conversa de verdade com o time. O número sozinho não sustenta.";

  it("aprova roteiro com mensagem, vírgula de respiro e fecho curto", () => {
    expect(validateScriptReels(BOM)).toEqual([]);
  });

  it("as duas partes são reconhecidas como frases separadas", () => {
    const frases = frasesDoScript(BOM);
    expect(frases).toHaveLength(2);
    expect(frases[1].split(/\s+/).length).toBeLessThanOrEqual(SCRIPT_FECHO_MAX_WORDS);
  });
});

describe("validateScriptReels — cada defeito isolado", () => {
  it("cobra a vírgula: sem pausa escrita a locução sai corrida", () => {
    const semVirgula =
      "Muitos cliques chegam todo dia e quase nenhum vira conversa de verdade com o time. O número sozinho não sustenta.";
    expect(validateScriptReels(semVirgula).join(" ")).toContain("nenhuma vírgula");
  });

  it("cobra a existência de duas frases", () => {
    const umaFrase =
      "Muitos cliques chegam todo dia, e quase nenhum deles vira conversa de verdade com o seu time comercial.";
    expect(validateScriptReels(umaFrase).join(" ")).toContain("uma frase só");
  });

  it("reprova roteiro longo demais para caber na locução", () => {
    const longo =
      "Muitos cliques chegam todo dia, e quase nenhum deles vira uma conversa de verdade com o seu time comercial que atende, responde e acompanha cada pessoa. O número sozinho não sustenta.";
    expect(longo.split(/\s+/).length).toBeGreaterThan(SCRIPT_MAX_WORDS);
    expect(validateScriptReels(longo).join(" ")).toContain(String(SCRIPT_MAX_WORDS));
  });

  it("reprova fecho de uma palavra", () => {
    const fechoCurto =
      "Muitos cliques chegam todo dia, e quase nenhum vira conversa de verdade com o time. Pronto.";
    expect(validateScriptReels(fechoCurto).join(" ")).toContain("curta demais");
  });

  it("roteiro vazio não passa em silêncio", () => {
    expect(validateScriptReels("")).toEqual(["roteiro falado vazio"]);
    expect(validateScriptReels("   ")).toEqual(["roteiro falado vazio"]);
  });
});

// ── O roteiro entra no prompt com os mesmos números da validação ────────────

describe("prompt e validação leem o mesmo número", () => {
  it("as constantes aparecem na regra do MOP", () => {
    const prompt = buildMetodoOpPrompt(
      {
        companyName: "Empresa Teste",
        segment: "SERVIÇOS",
        audience: "B2B",
        businessMoment: "consolidação",
        keyInfo: "Gestão de tráfego pago",
        brandVoice: "profissional",
        outputMode: "feed",
        sequenceSize: 3,
        storiesDays: 1,
        storiesQuantity: 3,
        outputFormats: ["feed"],
        track: "cinematica",
        mainActivity: "Agência",
        mood: "OP-01",
      },
      1,
    );
    expect(prompt).toContain(`${SCRIPT_MIN_WORDS} a ${SCRIPT_MAX_WORDS} palavras`);
    expect(prompt).toContain("ISTO É FALA, NÃO TEXTO");
    expect(prompt).toContain("FECHO");
    // A pausa escrita precisa estar pedida explicitamente.
    expect(prompt).toContain("VÍRGULA");
    // E a lista de CTAs prontos deixou de ser o que se pede.
    expect(prompt).toContain("PROIBIDO colar uma frase pronta");
  });
});

// O exemplo que o prompt ensina precisa OBEDECER a régua — se ensinar outra
// coisa, o modelo copia o exemplo e ignora a regra.
describe("o exemplo do prompt obedece a própria régua", () => {
  const EXEMPLO =
    "Muitos cliques chegam todo dia, e quase nenhum vira conversa com o time. O número sozinho não sustenta.";

  it("o exemplo passa na validação", () => {
    expect(validateScriptReels(EXEMPLO)).toEqual([]);
  });

  it("o exemplo está escrito no prompt, e o antigo saiu", () => {
    const prompt = buildMetodoOpPrompt(
      {
        companyName: "Empresa Teste",
        segment: "SERVIÇOS",
        audience: "B2B",
        businessMoment: "consolidação",
        keyInfo: "Gestão de tráfego pago",
        brandVoice: "profissional",
        outputMode: "feed",
        sequenceSize: 3,
        storiesDays: 1,
        storiesQuantity: 3,
        outputFormats: ["feed"],
        track: "cinematica",
        mainActivity: "Agência",
        mood: "OP-01",
      },
      1,
    );
    expect(prompt).toContain(EXEMPLO);
    // O exemplo antigo tinha 5 frases e terminava no CTA de lista — ensinava
    // exatamente o que a régua nova proíbe.
    expect(prompt).not.toContain("Sua marca fala. Seu time entrega.");
  });
});
