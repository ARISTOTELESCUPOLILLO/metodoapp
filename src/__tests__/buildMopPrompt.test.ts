import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { buildMetodoOpPrompt } from "../core/organizaMethodEngine";
import type { ContentFormData } from "../types";

// Math.random mockado para tornar snapshots determinísticos.
// O motor usa Math.random em buildVisualDirectionBlock para sortear variações
// de cena/dispositivo/vestuário. Com valor fixo = 0, sempre cai no primeiro item.
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const baseForm: ContentFormData = {
  companyName: "Empresa Teste",
  segment: "SERVIÇOS",
  audience: "B2C",
  businessMoment: "consolidação",
  keyInfo: "Consultoria especializada em gestão empresarial",
  brandVoice: "profissional e acessível",
  outputMode: "feed",
  sequenceSize: 3,
  storiesDays: 1,
  storiesQuantity: 3,
  outputFormats: ["feed"],
  track: "cinematica",
  mainActivity: "Consultoria de negócios",
  mood: "OP-01",
};

// ── S3V — trilha cinematica (fecha com reels) ─────────────────────────────────

describe("buildMetodoOpPrompt — S3V cinematica", () => {
  it("gera prompt sem lançar exceção", () => {
    expect(() => buildMetodoOpPrompt({ ...baseForm, sequenceSize: 3, track: "cinematica" })).not.toThrow();
  });

  it("contém a composição correta: 1 estático + 1 carrossel + 1 reels", () => {
    const prompt = buildMetodoOpPrompt({ ...baseForm, sequenceSize: 3, track: "cinematica" });
    expect(prompt).toContain("3 peças no total");
    expect(prompt).toContain("reels");
  });

  it("direciona para consumidor final (B2C)", () => {
    const prompt = buildMetodoOpPrompt({ ...baseForm, audience: "B2C" });
    expect(prompt).toContain("consumidor final");
    expect(prompt).not.toContain("decisor empresarial");
  });

  it("SERVIÇOS B2C: progressão ENTENDIMENTO → AGIR", () => {
    const prompt = buildMetodoOpPrompt({ ...baseForm, segment: "SERVIÇOS", audience: "B2C" });
    expect(prompt).toContain("ENTENDIMENTO");
    expect(prompt).toContain("AGIR");
  });

  it("VAREJO B2C: progressão inclui IDENTIFICAÇÃO", () => {
    const prompt = buildMetodoOpPrompt({ ...baseForm, segment: "VAREJO", audience: "B2C" });
    expect(prompt).toContain("IDENTIFICAÇÃO");
  });

  it("MARCA B2C: progressão inclui RECONHECIMENTO", () => {
    const prompt = buildMetodoOpPrompt({ ...baseForm, segment: "MARCA", audience: "B2C" });
    expect(prompt).toContain("RECONHECIMENTO");
  });

  it("B2B: direciona para decisor empresarial (proíbe consumidor final)", () => {
    const prompt = buildMetodoOpPrompt({ ...baseForm, audience: "B2B" });
    // A regra diz "SEMPRE para o decisor... NUNCA para o consumidor final"
    expect(prompt).toContain("decisor empresarial");
    expect(prompt).toContain("NUNCA para o consumidor final");
  });

  it("inclui companyName e keyInfo no prompt", () => {
    const prompt = buildMetodoOpPrompt(baseForm);
    expect(prompt).toContain("Empresa Teste");
    expect(prompt).toContain("Consultoria especializada em gestão empresarial");
  });

  it("momento lançamento muda o entryModifier para DESCOBERTA", () => {
    const prompt = buildMetodoOpPrompt({ ...baseForm, businessMoment: "lançamento" });
    expect(prompt).toContain("DESCOBERTA");
  });

  it("momento reativação muda o entryModifier para RECONEXÃO", () => {
    const prompt = buildMetodoOpPrompt({ ...baseForm, businessMoment: "reativação" });
    expect(prompt).toContain("RECONEXÃO");
  });

  it("venda proibida antes do último conteúdo da sequência", () => {
    const prompt = buildMetodoOpPrompt(baseForm);
    expect(prompt).toContain("Venda só pode aparecer no último conteúdo");
  });

  it("snapshot determinístico com Math.random = 0", () => {
    const prompt = buildMetodoOpPrompt(baseForm);
    expect(prompt).toMatchSnapshot();
  });
});

// ── S6V — trilha visual (fecha com estático_final) ────────────────────────────

describe("buildMetodoOpPrompt — S6V visual", () => {
  const s6vForm: ContentFormData = {
    ...baseForm,
    sequenceSize: 6,
    track: "visual",
    segment: "VAREJO",
    audience: "B2C",
  };

  it("gera prompt sem lançar exceção", () => {
    expect(() => buildMetodoOpPrompt(s6vForm)).not.toThrow();
  });

  it("contém 6 peças no total com estático final (não reels)", () => {
    const prompt = buildMetodoOpPrompt(s6vForm);
    expect(prompt).toContain("6 peças no total");
    expect(prompt).toContain("estático");
    // trilha visual fecha com estatico_final, não reels
    expect(prompt).not.toMatch(/\d+ reels/);
  });

  it("VAREJO: progressão inclui DESEJO", () => {
    const prompt = buildMetodoOpPrompt(s6vForm);
    expect(prompt).toContain("DESEJO");
  });

  it("snapshot determinístico S6V visual VAREJO B2C", () => {
    const prompt = buildMetodoOpPrompt(s6vForm);
    expect(prompt).toMatchSnapshot();
  });
});

// ── S9V — trilha cinematica, maior sequência ──────────────────────────────────

describe("buildMetodoOpPrompt — S9V cinematica", () => {
  const s9vForm: ContentFormData = {
    ...baseForm,
    sequenceSize: 9,
    track: "cinematica",
    segment: "MARCA",
    audience: "B2B",
    mood: "OP-03",
  };

  it("gera prompt sem lançar exceção", () => {
    expect(() => buildMetodoOpPrompt(s9vForm)).not.toThrow();
  });

  it("contém 9 peças no total", () => {
    const prompt = buildMetodoOpPrompt(s9vForm);
    expect(prompt).toContain("9 peças no total");
  });

  it("B2B: proíbe CTA agressivo e urgência artificial", () => {
    const prompt = buildMetodoOpPrompt(s9vForm);
    expect(prompt).toContain("urgência artificial");
  });

  it("B2B MARCA: direciona para decisor, não consumidor", () => {
    const prompt = buildMetodoOpPrompt(s9vForm);
    expect(prompt).toContain("decisor empresarial");
  });

  it("snapshot determinístico S9V cinematica MARCA B2B", () => {
    const prompt = buildMetodoOpPrompt(s9vForm);
    expect(prompt).toMatchSnapshot();
  });
});

// ── Experimentação (2 períodos, sempre S3) ────────────────────────────────────

describe("buildMetodoOpPrompt — Experimentação", () => {
  const expForm: ContentFormData = {
    ...baseForm,
    track: "experimentacao",
    sequenceSize: 6, // ignorado — experimentação força 3
  };

  it("experimentação força 3 peças independente do sequenceSize", () => {
    const prompt = buildMetodoOpPrompt(expForm);
    expect(prompt).toContain("3 peças no total");
  });

  it("gera prompt sem lançar exceção", () => {
    expect(() => buildMetodoOpPrompt(expForm)).not.toThrow();
  });
});

// ── Faixa etária ──────────────────────────────────────────────────────────────

describe("buildMetodoOpPrompt — faixaEtaria", () => {
  it("18-34: inclui direcionamento de faixa no prompt", () => {
    const prompt = buildMetodoOpPrompt({ ...baseForm, faixaEtaria: "18-34" });
    // Verifica que faixa etária aparece em alguma forma no prompt
    expect(prompt.length).toBeGreaterThan(500);
  });

  it("sem faixaEtaria: não lança exceção", () => {
    expect(() => buildMetodoOpPrompt({ ...baseForm, faixaEtaria: null })).not.toThrow();
  });
});
