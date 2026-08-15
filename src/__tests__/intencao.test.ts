import { describe, expect, it } from "vitest";
import {
  buildIntencaoBlock,
  buildIntencaoBlockLegenda,
  checkCoerencia,
  ordenarTransformacoes,
  parseIntencao,
  parseTransformacao,
} from "../core/intencao";
import { TRANSFORMACOES } from "../domain/intencao.config";

// ─────────────────────────────────────────────────────────────────────────────
// O CAMINHO NULO — a regra crítica da seção 12.1 da spec.
//
// A geração de quem está FORA do piloto tem de ser idêntica à de hoje, byte a
// byte. Estes testes existem porque a falha correspondente é invisível: um
// separador vazio ou uma quebra de linha a mais mudam o prompt de quem nem sabe
// que existe campo novo, e ninguém reporta.
// ─────────────────────────────────────────────────────────────────────────────
describe("intenção — caminho nulo", () => {
  it("devolve string vazia (não ' ', não '\\n') quando não há intenção", () => {
    expect(
      buildIntencaoBlock({ intencao: null, transformacaoPrincipal: null, segment: null }),
    ).toBe("");
    expect(
      buildIntencaoBlockLegenda({ intencao: null, transformacaoPrincipal: null, segment: null }),
    ).toBe("");
  });

  it("ignora transformação e segmento quando a intenção está ausente", () => {
    expect(
      buildIntencaoBlock({
        intencao: null,
        transformacaoPrincipal: "whatsapp",
        segment: "VAREJO",
      }),
    ).toBe("");
  });

  it("interpolar o bloco vazio não altera o prompt em volta", () => {
    const bloco = buildIntencaoBlock({
      intencao: null,
      transformacaoPrincipal: null,
      segment: "SERVIÇOS",
    });
    const comCampo = `OBJETIVO: promocao\n${bloco}INFORMAÇÃO-CHAVE: "x"`;
    const semCampo = `OBJETIVO: promocao\nINFORMAÇÃO-CHAVE: "x"`;
    expect(comCampo).toBe(semCampo);
  });

  it("valor inválido vindo do corpo da requisição vira null (não vaza pro prompt)", () => {
    expect(parseIntencao("clareza")).toBeNull();
    expect(parseIntencao("CONFIANCA")).toBeNull();
    expect(parseIntencao(42)).toBeNull();
    expect(parseIntencao(undefined)).toBeNull();
    expect(parseIntencao("confianca")).toBe("confianca");
    expect(parseTransformacao("curtir")).toBeNull();
    expect(parseTransformacao("salvar")).toBe("salvar");
  });
});

describe("intenção — bloco de prompt", () => {
  it("não usa o rótulo 'INTENÇÃO:', que já pertence ao objetivo da peça", () => {
    const bloco = buildIntencaoBlock({
      intencao: "confianca",
      transformacaoPrincipal: "whatsapp",
      segment: "SERVIÇOS",
    });
    expect(bloco).toContain("ALVO PERCEPTUAL");
    expect(bloco).not.toMatch(/^INTENÇÃO:/m);
  });

  it("injeta a manifestação da natureza do negócio (mesma intenção, segmentos diferentes)", () => {
    const servicos = buildIntencaoBlock({
      intencao: "compreensao",
      transformacaoPrincipal: null,
      segment: "SERVIÇOS",
    });
    const varejo = buildIntencaoBlock({
      intencao: "compreensao",
      transformacaoPrincipal: null,
      segment: "VAREJO",
    });
    const marca = buildIntencaoBlock({
      intencao: "compreensao",
      transformacaoPrincipal: null,
      segment: "MARCA",
    });
    expect(servicos).toContain("Explica o que resolve");
    expect(varejo).toContain("sortimento");
    expect(marca).toContain("território que ocupa");
    expect(servicos).not.toBe(varejo);
    expect(varejo).not.toBe(marca);
  });

  it("proíbe nomear a percepção no texto — ela é produzida, não anunciada", () => {
    const bloco = buildIntencaoBlock({
      intencao: "autoridade",
      transformacaoPrincipal: "compartilhar",
      segment: "MARCA",
    });
    expect(bloco).toContain("PROIBIDO nomear a percepção");
  });

  it("segmento desconhecido não quebra nem inventa manifestação", () => {
    const bloco = buildIntencaoBlock({
      intencao: "seguranca",
      transformacaoPrincipal: null,
      segment: "AGRO",
    });
    expect(bloco).toContain("ALVO PERCEPTUAL");
    expect(bloco).not.toContain("COMO ESTE NEGÓCIO");
  });

  it("termina em quebra de linha única — o prompt continua na linha seguinte", () => {
    const bloco = buildIntencaoBlock({
      intencao: "confianca",
      transformacaoPrincipal: "orcamento",
      segment: "SERVIÇOS",
    });
    expect(bloco.endsWith("\n")).toBe(true);
    expect(bloco.endsWith("\n\n")).toBe(false);
  });
});

describe("intenção — avisos de coerência", () => {
  it("avisa, e o aviso é uma pergunta (nunca um bloqueio)", () => {
    const aviso = checkCoerencia("compreensao", "orcamento", "SERVIÇOS");
    expect(aviso).toBeTruthy();
    expect(aviso).toContain("?");
  });

  it("não avisa em par coerente", () => {
    expect(checkCoerencia("confianca", "orcamento", "SERVIÇOS")).toBeNull();
    expect(checkCoerencia("autoridade", "compartilhar", "MARCA")).toBeNull();
  });

  it("urgência só vale a partir de Confiança — regra transversal", () => {
    expect(checkCoerencia("compreensao", "urgencia", "SERVIÇOS")).toBeTruthy();
    expect(checkCoerencia("seguranca", "urgencia", "SERVIÇOS")).toBeTruthy();
    expect(checkCoerencia("confianca", "urgencia", "SERVIÇOS")).toBeNull();
    expect(checkCoerencia("autoridade", "urgencia", "SERVIÇOS")).toBeNull();
  });

  it("VAREJO tem régua mais curta: urgência já vale a partir de Segurança", () => {
    expect(checkCoerencia("seguranca", "urgencia", "VAREJO")).toBeNull();
    // Compreensão continua incoerente com urgência em TODOS os segmentos.
    expect(checkCoerencia("compreensao", "urgencia", "VAREJO")).toBeTruthy();
  });

  it("sem intenção ou sem transformação não há o que avisar", () => {
    expect(checkCoerencia(null, "urgencia", "VAREJO")).toBeNull();
    expect(checkCoerencia("compreensao", null, "VAREJO")).toBeNull();
  });
});

describe("intenção — ordenação por natureza", () => {
  it("ordena sem esconder: a lista muda de ordem, nunca de tamanho", () => {
    for (const seg of ["SERVIÇOS", "VAREJO", "MARCA"]) {
      const lista = ordenarTransformacoes(seg);
      expect(lista).toHaveLength(TRANSFORMACOES.length);
      expect(new Set(lista.map((t) => t.valor)).size).toBe(TRANSFORMACOES.length);
    }
  });

  it("põe na frente o que a natureza torna mais provável", () => {
    expect(ordenarTransformacoes("VAREJO")[0].valor).toBe("loja");
    expect(ordenarTransformacoes("SERVIÇOS")[0].valor).toBe("whatsapp");
    expect(ordenarTransformacoes("MARCA")[0].valor).toBe("preferencia");
  });

  it("sem segmento, mantém a ordem canônica", () => {
    expect(ordenarTransformacoes(null)).toEqual(TRANSFORMACOES);
  });

  it("curtida não é oferecida como alvo em nenhuma natureza", () => {
    for (const seg of ["SERVIÇOS", "VAREJO", "MARCA", null]) {
      expect(ordenarTransformacoes(seg).some((t) => t.valor === ("curtir" as never))).toBe(false);
    }
  });
});
