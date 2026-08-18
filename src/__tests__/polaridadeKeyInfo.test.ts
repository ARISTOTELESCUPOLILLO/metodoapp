import { describe, it, expect } from "vitest";
import { detectarPolaridadeKeyInfo, buildRegraPolaridadeKeyInfo } from "@/core/polaridadeKeyInfo";

describe("detectarPolaridadeKeyInfo — contraposição de dois termos", () => {
  it.each([
    // O caso real que originou o módulo (peça R4, 18/08/2026).
    "Quem escreve o texto não é quem faz a arte",
    "Nosso plano não é assinatura, é compra única",
    "Isso não substitui a consulta presencial",
    "Atendemos por agendamento, e não por ordem de chegada",
    "A entrega é feita pela loja, mas não pelo aplicativo",
    "Trabalhamos com tecido natural em vez de sintético",
    "Usamos massa fresca ao invés de congelada",
    "Nem chapa quente nem química no cabelo",
    "Ao contrário da concorrência, a peça é montada aqui",
    "Nosso corte é diferente do industrial",
  ])("reconhece contraste em '%s'", (keyInfo) => {
    expect(detectarPolaridadeKeyInfo(keyInfo)).toBe("contraste");
  });

  it("aceita acento e caixa alta — a comparação é normalizada", () => {
    expect(detectarPolaridadeKeyInfo("QUEM ESCREVE NÃO É QUEM DESENHA")).toBe("contraste");
    expect(detectarPolaridadeKeyInfo("Em Vez De Plástico, usamos vidro")).toBe("contraste");
  });
});

describe("detectarPolaridadeKeyInfo — ausência declarada", () => {
  it.each([
    "Parcelamos em 10 vezes sem juros",
    "Atendimento sem hora marcada",
    "Nunca cobramos taxa de entrega",
    "Não precisa de fiador para alugar",
    "O plano não tem fidelidade",
    "Jamais usamos peça recondicionada",
    "Nada de burocracia para abrir a conta",
  ])("reconhece ausência em '%s'", (keyInfo) => {
    expect(detectarPolaridadeKeyInfo(keyInfo)).toBe("ausencia");
  });

  it("contraste vence ausência quando os dois aparecem na mesma frase", () => {
    // A oposição é estrutural: some a distinção inteira. A ausência perde um
    // dado, o que é menos grave.
    expect(
      detectarPolaridadeKeyInfo("Atendemos sem hora marcada, e não por ordem de chegada"),
    ).toBe("contraste");
  });
});

describe("detectarPolaridadeKeyInfo — o que NÃO pode disparar", () => {
  it.each([
    // As informações-chave das quatro peças do teste R1-R4 que saíram corretas.
    "Toda peça passa por revisão de duas pessoas antes de ir ao ar",
    "Tráfego pago nos meios digitais geram visitas rápidas",
    "Reunião presencial tira dúvida na hora",
    // Positivas comuns de varejo e serviço.
    "Óleo lubrificante 20W50 por R$ 39,90",
    "Capacete para motociclista por R$ 129,00 em 3 vezes",
    "A gente escreve o texto e faz a arte no mesmo dia",
    "Entrega em toda a região central no mesmo dia",
    // "nem sempre" tem um "nem" só — não é contraposição de dois termos.
    "Nem sempre o cliente sabe o que precisa, e a gente ajuda a descobrir",
  ])("não dispara em '%s'", (keyInfo) => {
    expect(detectarPolaridadeKeyInfo(keyInfo)).toBe(null);
  });

  it("string vazia ou ausente devolve null", () => {
    expect(detectarPolaridadeKeyInfo("")).toBe(null);
    expect(detectarPolaridadeKeyInfo(undefined)).toBe(null);
    expect(detectarPolaridadeKeyInfo("   ")).toBe(null);
  });
});

describe("buildRegraPolaridadeKeyInfo — contrato com o prompt", () => {
  it("devolve string VAZIA quando não há negação — o prompt de hoje fica intacto", () => {
    // Mesmo contrato de buildRegraProfissaoRegulamentada: concatenação
    // condicional no ponto de uso não pode acrescentar nem uma quebra de linha
    // ao prompt de quem escreveu um fato positivo.
    expect(buildRegraPolaridadeKeyInfo("Entrega em toda a região central")).toBe("");
    expect(buildRegraPolaridadeKeyInfo(undefined)).toBe("");
  });

  it("a regra de contraste nomeia os dois lados e traz o caso real como exemplo", () => {
    const regra = buildRegraPolaridadeKeyInfo("Quem escreve o texto não é quem faz a arte");
    expect(regra).toContain("A DIFERENÇA É O DADO");
    expect(regra).toContain("O QUE FAZER");
    // Proibição sem saída declarada já falhou três vezes no projeto — a regra
    // precisa dizer o que escrever no lugar, com exemplo.
    expect(regra).toContain("Dois profissionais, duas etapas");
  });

  it("a regra de ausência manda preservar o que não existe", () => {
    const regra = buildRegraPolaridadeKeyInfo("Parcelamos em 10 vezes sem juros");
    expect(regra).toContain("A AUSÊNCIA É O DADO");
    expect(regra).toContain("O QUE FAZER");
  });

  it("nenhuma das duas variantes começa ou termina com quebra de linha", () => {
    // Quem concatena decide o espaçamento — o mesmo contrato do bloco de ética
    // e do intencaoRegraApoio.
    for (const keyInfo of ["Quem escreve não é quem desenha", "Sem taxa de adesão"]) {
      const regra = buildRegraPolaridadeKeyInfo(keyInfo);
      expect(regra.startsWith("\n")).toBe(false);
      expect(regra.endsWith("\n")).toBe(false);
      expect(regra.startsWith("- ")).toBe(true);
    }
  });
});
