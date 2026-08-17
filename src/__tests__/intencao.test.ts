import { describe, expect, it } from "vitest";
import {
  buildIntencaoBlock,
  buildIntencaoBlockLegenda,
  buildIntencaoRegraOferta,
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

// ─────────────────────────────────────────────────────────────────────────────
// REGRA DE OFERTA — o conserto do modo AJUSTADO (achado do teste cego 16/08).
//
// No modo AJUSTADO o bloco de regras do título é trocado por "não busque ângulo
// diferente / preserve o preço", e o alvo perceptual — que estava só no contexto
// — sumia. Esta regra devolve o alvo ao FIM do bloco de regras, sem afrouxar a
// preservação dos dados concretos.
// ─────────────────────────────────────────────────────────────────────────────
describe("intenção — regra do modo AJUSTADO (oferta concreta)", () => {
  it("devolve string vazia quando não há intenção — prompt de oferta idêntico ao de hoje", () => {
    expect(
      buildIntencaoRegraOferta({
        intencao: null,
        transformacaoPrincipal: "loja",
        segment: "VAREJO",
        apoio: "texto",
      }),
    ).toBe("");
  });

  it("interpolar a regra vazia não altera o bloco de regras em volta", () => {
    const regra = buildIntencaoRegraOferta({
      intencao: null,
      transformacaoPrincipal: null,
      segment: "VAREJO",
      apoio: "topicos",
    });
    const comCampo = `- Título e texto reforçam a MESMA oferta.${regra}`;
    expect(comCampo).toBe("- Título e texto reforçam a MESMA oferta.");
  });

  it("abre em quebra de linha e não fecha em outra — cola no fim da última regra", () => {
    const regra = buildIntencaoRegraOferta({
      intencao: "confianca",
      transformacaoPrincipal: "loja",
      segment: "VAREJO",
      apoio: "texto",
    });
    expect(regra.startsWith("\n- ")).toBe(true);
    expect(regra.endsWith("\n")).toBe(false);
  });

  it("não afrouxa a preservação dos dados — preço/prazo/condição seguem intocáveis", () => {
    const regra = buildIntencaoRegraOferta({
      intencao: "seguranca",
      transformacaoPrincipal: "loja",
      segment: "VAREJO",
      apoio: "texto",
    });
    expect(regra).toContain("intocáveis");
    expect(regra).toContain("preço");
  });

  // A proibição de transcrever mora na regra BASE do modo AJUSTADO (vale com
  // ou sem intenção — o defeito não tem nada a ver com o piloto). Aqui a regra
  // do alvo só faz referência a ela, para não haver duas ordens concorrentes
  // sobre a mesma coisa.
  it("aponta para a regra base de composição em vez de repetir a proibição", () => {
    const regra = buildIntencaoRegraOferta({
      intencao: "confianca",
      transformacaoPrincipal: null,
      segment: "VAREJO",
      apoio: "texto",
    });
    expect(regra).toContain("COMPOR, NÃO TRANSCREVER");
    expect(regra).toContain("Componha");
  });

  it("nomeia o alvo e a manifestação da natureza do negócio", () => {
    const varejo = buildIntencaoRegraOferta({
      intencao: "autoridade",
      transformacaoPrincipal: null,
      segment: "VAREJO",
      apoio: "texto",
    });
    expect(varejo).toContain("Autoridade");
    expect(varejo).toContain("Curadoria");
  });

  it("segmento desconhecido não inventa manifestação", () => {
    const regra = buildIntencaoRegraOferta({
      intencao: "autoridade",
      transformacaoPrincipal: null,
      segment: "AGRO",
      apoio: "texto",
    });
    expect(regra).toContain("Autoridade");
    expect(regra).not.toContain("se constrói assim");
  });

  it("fala do apoio só quando ele existe nesta geração", () => {
    const base = {
      intencao: "confianca" as const,
      transformacaoPrincipal: null,
      segment: "VAREJO",
    };
    expect(buildIntencaoRegraOferta({ ...base, apoio: "texto" })).toContain("O texto de apoio");
    expect(buildIntencaoRegraOferta({ ...base, apoio: "topicos" })).toContain("Os tópicos");
    const soTitulo = buildIntencaoRegraOferta({ ...base, apoio: null });
    expect(soTitulo).not.toContain("texto de apoio");
    expect(soTitulo).not.toContain("tópicos");
  });

  it("a transformação pretendida só entra pela via do apoio, nunca como pedido no título", () => {
    const comApoio = buildIntencaoRegraOferta({
      intencao: "confianca",
      transformacaoPrincipal: "loja",
      segment: "VAREJO",
      apoio: "texto",
    });
    expect(comApoio).toContain("Ir à loja");
    expect(comApoio).toContain("sem exigi-la");
    const soTitulo = buildIntencaoRegraOferta({
      intencao: "confianca",
      transformacaoPrincipal: "loja",
      segment: "VAREJO",
      apoio: null,
    });
    expect(soTitulo).not.toContain("Ir à loja");
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
