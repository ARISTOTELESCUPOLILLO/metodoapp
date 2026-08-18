import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isProfissaoRegulamentada,
  buildRegraProfissaoRegulamentada,
} from "@/core/profissaoRegulamentada";
import { buildMetodoOpPrompt } from "@/core/organizaMethodEngine";
import type { ContentFormData } from "@/types";

describe("isProfissaoRegulamentada — quem tem conselho em cima", () => {
  it.each([
    "Advocacia trabalhista",
    "Escritório de advocacia",
    "Advogado especialista em família",
    "Clínica médica",
    "Consultório de dermatologia",
    "Cirurgia plástica",
    "Odontologia estética",
    "Dentista clínico geral",
    "Ortodontia e implantes",
    "Contabilidade para pequenas empresas",
    "Contador autônomo",
    "Psicologia clínica",
    "Psicanálise e psicoterapia",
    "Nutricionista esportiva",
    "Fisioterapia ortopédica",
    "Clínica veterinária",
    "Fonoaudiologia infantil",
  ])("reconhece '%s'", (atividade) => {
    expect(isProfissaoRegulamentada(atividade)).toBe(true);
  });

  it("aceita acento e caixa alta — a comparação é normalizada", () => {
    expect(isProfissaoRegulamentada("ODONTOLOGIA")).toBe(true);
    expect(isProfissaoRegulamentada("Psicólogo clínico")).toBe(true);
    expect(isProfissaoRegulamentada("Clínica Médica")).toBe(true);
  });
});

describe("isProfissaoRegulamentada — quem NÃO tem, e pode falar de resultado", () => {
  it.each([
    "Padaria e confeitaria",
    "Oficina mecânica",
    "Loja de roupas femininas",
    "Agência de marketing digital",
    "Tráfego pago nos meios digitais",
    "Salão de beleza",
    "Restaurante japonês",
    "Academia de musculação",
    "Consultoria de negócios",
    "Pet shop e banho e tosa",
    "Material de construção",
  ])("não reconhece '%s'", (atividade) => {
    expect(isProfissaoRegulamentada(atividade)).toBe(false);
  });

  // Falsos positivos que a âncora \b existe para evitar — sem ela, "medic"
  // pegaria "medicamento" e "nutri" pegaria ração.
  it("não confunde farmácia/drogaria com médico", () => {
    expect(isProfissaoRegulamentada("Farmácia de manipulação")).toBe(false);
    expect(isProfissaoRegulamentada("Drogaria e medicamentos")).toBe(false);
    expect(isProfissaoRegulamentada("Venda de medicamentos genéricos")).toBe(false);
  });

  it("não confunde nutrição animal com nutricionista", () => {
    expect(isProfissaoRegulamentada("Nutrição animal e rações")).toBe(false);
  });

  it("vazio ou ausente não é regulamentada", () => {
    expect(isProfissaoRegulamentada()).toBe(false);
    expect(isProfissaoRegulamentada("")).toBe(false);
    expect(isProfissaoRegulamentada("   ")).toBe(false);
    expect(isProfissaoRegulamentada(undefined, undefined)).toBe(false);
  });
});

describe("isProfissaoRegulamentada — o nome da empresa é reforço", () => {
  // Muita gente escreve o ofício no nome e deixa a atividade vazia.
  it("reconhece pelo nome quando a atividade não diz", () => {
    expect(isProfissaoRegulamentada("", "Silva Advogados Associados")).toBe(true);
    expect(isProfissaoRegulamentada(undefined, "Clínica Odontológica Sorriso")).toBe(true);
  });

  it("basta um dos dois bater", () => {
    expect(isProfissaoRegulamentada("Advocacia previdenciária", "Grupo Andrade")).toBe(true);
  });

  it("nome neutro com atividade neutra continua fora", () => {
    expect(isProfissaoRegulamentada("Padaria", "Pão Quente")).toBe(false);
  });
});

describe("buildRegraProfissaoRegulamentada — retorno antecipado", () => {
  // Mesmo contrato de core/intencao.ts: quem não é regulamentado tem o prompt
  // idêntico ao de antes, byte a byte.
  it("devolve string VAZIA para quem não é regulamentado", () => {
    expect(buildRegraProfissaoRegulamentada("Padaria e confeitaria")).toBe("");
    expect(buildRegraProfissaoRegulamentada("Tráfego pago nos meios digitais")).toBe("");
    expect(buildRegraProfissaoRegulamentada()).toBe("");
  });

  it("devolve a regra para quem é", () => {
    const regra = buildRegraProfissaoRegulamentada("Advocacia trabalhista");
    expect(regra).not.toBe("");
    expect(regra).toContain("PROIBIDO PROMETER RESULTADO");
  });

  // O bloco precisa dizer o que fazer no lugar — proibição sem saída declarada
  // já falhou duas vezes neste projeto (carcaça do monitor, logo desenhada).
  it("não é só proibição: declara o que escrever no lugar", () => {
    const regra = buildRegraProfissaoRegulamentada("Clínica médica");
    expect(regra).toContain("O QUE ESCREVER NO LUGAR");
    expect(regra).toContain("TRABALHO");
  });

  it("cobre a promessa indireta, que é a que escapa da palavra 'resultado'", () => {
    // A peça 3G do piloto saiu com "garantir que os resultados se consolidem";
    // a 3F, com "todo dia você pode receber visitas" — nenhuma usava a palavra
    // proibida de forma isolada.
    const regra = buildRegraProfissaoRegulamentada("Advocacia");
    expect(regra).toContain("de forma indireta");
    expect(regra).toContain("antes/depois");
  });

  it("começa com o marcador de item de regra, para colar no bloco de regras", () => {
    expect(buildRegraProfissaoRegulamentada("Odontologia").startsWith("- ⚠")).toBe(true);
  });
});

// A régua só vale se CHEGAR ao prompt — o defeito que originou esta tarefa foi
// exatamente uma régua correta que governava a tabela e nunca a saída. Estes
// testes travam a fiação, não o texto.
describe("fiação no MOP — a regra chega ao prompt da sequência", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const base: ContentFormData = {
    companyName: "Empresa Teste",
    segment: "SERVIÇOS",
    audience: "B2C",
    businessMoment: "consolidação",
    keyInfo: "Atendimento com hora marcada",
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

  it("injeta a proibição quando a atividade é regulamentada", () => {
    const prompt = buildMetodoOpPrompt({ ...base, mainActivity: "Advocacia trabalhista" });
    expect(prompt).toContain("PROIBIDO PROMETER RESULTADO");
  });

  it("NÃO injeta nada quando a atividade não é regulamentada", () => {
    const prompt = buildMetodoOpPrompt({ ...base, mainActivity: "Padaria e confeitaria" });
    expect(prompt).not.toContain("PROIBIDO PROMETER RESULTADO");
  });

  // Contrato de retorno antecipado: o prompt de quem não é regulamentado tem de
  // ficar idêntico byte a byte — inclusive nas quebras de linha, que é onde a
  // concatenação condicional costuma vazar sem ninguém reportar.
  it("o prompt de quem não é regulamentado não ganha linha em branco extra", () => {
    const prompt = buildMetodoOpPrompt({ ...base, mainActivity: "Padaria e confeitaria" });
    expect(prompt).toContain(
      "- Evitar clichês: descubra, saiba mais, transforme, segredo, incrível.\n\nFORMATO DE SAÍDA:",
    );
  });

  it("reconhece pelo nome da empresa quando a atividade não denuncia", () => {
    const prompt = buildMetodoOpPrompt({
      ...base,
      companyName: "Silva Advogados Associados",
      mainActivity: "Atendimento a empresas",
    });
    expect(prompt).toContain("PROIBIDO PROMETER RESULTADO");
  });

  it("vale em qualquer segmento, não só SERVIÇOS", () => {
    const prompt = buildMetodoOpPrompt({
      ...base,
      segment: "MARCA",
      mainActivity: "Clínica odontológica",
    });
    expect(prompt).toContain("PROIBIDO PROMETER RESULTADO");
  });
});
