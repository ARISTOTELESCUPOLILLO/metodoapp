import { describe, expect, it } from "vitest";
import {
  buildIntencaoBlock,
  buildIntencaoBlockLegenda,
  buildIntencaoRegraApoio,
  buildIntencaoRegraLegenda,
  buildIntencaoRegraOferta,
  checkCoerencia,
  ordenarTransformacoes,
  parseIntencao,
  parseTransformacao,
} from "../core/intencao";
import {
  INTENCAO_MANIFESTACAO,
  TRANSFORMACAO_CAMADA,
  TRANSFORMACOES,
} from "../domain/intencao.config";

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
    // Sem transformação, cai na camada silenciosa (CAMADA_PADRAO).
    expect(servicos).toContain("Fixa qual problema aquele profissional resolve");
    expect(varejo).toContain("Fixa a loja como o lugar daquele tipo de produto");
    expect(marca).toContain("Fixa o assunto que é dela");
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
    expect(varejo).toContain("Mostra o repertório de quem vive daquilo");
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

// ─────────────────────────────────────────────────────────────────────────────
// MANIFESTAÇÃO POR CAMADA (17/08/2026).
//
// Até aqui cada casa intenção × segmento tinha UMA frase, então o mesmo cliente
// recebia sempre a mesma manifestação — variável constante, a mesma causa de
// repetição já provada nos moods. A camada da transformação passou a escolher a
// frase: a prova que faz alguém atravessar a cidade não é a que faz alguém
// compartilhar um post.
// ─────────────────────────────────────────────────────────────────────────────
describe("intenção — manifestação por camada", () => {
  const base = { intencao: "confianca" as const, segment: "VAREJO" };

  it("a camada da transformação escolhe a manifestação — mesma intenção, mesmo segmento", () => {
    const externa = buildIntencaoBlock({ ...base, transformacaoPrincipal: "loja" });
    const interna = buildIntencaoBlock({ ...base, transformacaoPrincipal: "compartilhar" });
    const silenciosa = buildIntencaoBlock({ ...base, transformacaoPrincipal: "preferencia" });

    expect(externa).toContain("O que está na peça está na loja");
    expect(interna).toContain("Mostra o movimento real do dia a dia");
    expect(silenciosa).toContain("O que foi anunciado se sustenta depois");
    expect(new Set([externa, interna, silenciosa]).size).toBe(3);
  });

  it("transformações da MESMA camada dão a MESMA manifestação — a camada é a variável, não o verbo", () => {
    const loja = buildIntencaoBlock({ ...base, transformacaoPrincipal: "loja" });
    const whatsapp = buildIntencaoBlock({ ...base, transformacaoPrincipal: "whatsapp" });
    // Só a linha da TRANSFORMAÇÃO difere; a da MANIFESTAÇÃO é a mesma.
    expect(whatsapp).toContain("O que está na peça está na loja");
    expect(loja).not.toBe(whatsapp);
  });

  it("sem transformação cai na camada silenciosa — a única que não pressupõe ação do leitor", () => {
    const semTransformacao = buildIntencaoBlock({ ...base, transformacaoPrincipal: null });
    const comPreferencia = buildIntencaoBlock({ ...base, transformacaoPrincipal: "preferencia" });
    expect(semTransformacao).toContain("O que foi anunciado se sustenta depois");
    // Só a linha da transformação separa os dois.
    expect(semTransformacao).not.toBe(comPreferencia);
  });

  it("as 36 casas estão preenchidas e nenhuma se repete dentro do mesmo segmento", () => {
    const intencoes = ["compreensao", "seguranca", "confianca", "autoridade"] as const;
    const segmentos = ["SERVIÇOS", "VAREJO", "MARCA"] as const;
    const camadas = {
      externa: "loja",
      interna: "salvar",
      silenciosa: "preferencia",
    } as const;

    for (const segmento of segmentos) {
      const vistas = new Set<string>();
      for (const intencao of intencoes) {
        for (const transformacao of Object.values(camadas)) {
          const manifestacao =
            INTENCAO_MANIFESTACAO[intencao][segmento][TRANSFORMACAO_CAMADA[transformacao]];
          expect(manifestacao.length).toBeGreaterThan(0);
          vistas.add(manifestacao);
        }
      }
      expect(vistas.size).toBe(12);
    }
  });

  // Régua declarada pelo Ari: cliente pequeno não quer prometer política
  // comercial nem lembrar o consumidor dos direitos dele; profissão
  // regulamentada não pode prometer resultado. Três frases foram aposentadas
  // por isso e nenhuma frase nova pode reintroduzir o problema.
  it("nenhuma manifestação obriga a prometer política comercial ou resultado", () => {
    const PROIBIDAS = /\btroca\b|\bdevolu|\bgarantia\b|\bentrega\b|\bprazo\b|\bresultado\b/i;
    for (const porSegmento of Object.values(INTENCAO_MANIFESTACAO)) {
      for (const porCamada of Object.values(porSegmento)) {
        for (const manifestacao of Object.values(porCamada)) {
          expect(manifestacao).not.toMatch(PROIBIDAS);
        }
      }
    }
  });

  it("toda transformação tem camada, e as três camadas existem", () => {
    for (const t of TRANSFORMACOES) {
      expect(TRANSFORMACAO_CAMADA[t.valor]).toBe(t.camada);
    }
    expect(new Set(TRANSFORMACOES.map((t) => t.camada))).toEqual(
      new Set(["externa", "interna", "silenciosa"]),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MANIFESTAÇÃO COMO ORDEM (teste ao vivo de 17/08 — Confiança × SERVIÇOS).
//
// Com a manifestação só no contexto, três peças com a mesma intenção e camadas
// diferentes saíram idênticas em conteúdo: "atrair visitantes com rapidez",
// "alcançar visitantes em pouco tempo", "atrair visitantes de forma ágil".
// Nenhuma mostrou quem faz o trabalho, o trabalho acontecendo ou constância. A
// tabela chegava ao prompt; faltava força de ORDEM.
// ─────────────────────────────────────────────────────────────────────────────
describe("intenção — manifestação como ordem no bloco de regras", () => {
  const base = {
    intencao: "confianca" as const,
    transformacaoPrincipal: "orcamento" as const,
    segment: "SERVIÇOS",
  };

  it("caminho nulo — sem intenção não há regra, nem no apoio nem na legenda", () => {
    const vazio = {
      intencao: null,
      transformacaoPrincipal: "orcamento" as const,
      segment: "SERVIÇOS",
    };
    expect(buildIntencaoRegraApoio({ ...vazio, apoio: "texto" })).toBe("");
    expect(buildIntencaoRegraLegenda(vazio)).toBe("");
  });

  it("leva a manifestação da camada para dentro das regras do apoio", () => {
    const regra = buildIntencaoRegraApoio({ ...base, apoio: "texto" });
    expect(regra).toContain("Mostra quem faz o trabalho");
    expect(regra).toContain("REGRA QUE DECIDE ESTE TEXTO");
    // Contrato de posição: a regra FECHA o prompt de generate-pu-copy (depois
    // de todas as regras do título), então abre com a própria quebra de linha
    // e não deixa nenhuma no fim. Ver o docblock do builder para o motivo.
    expect(regra.startsWith("\n- ")).toBe(true);
    expect(regra.endsWith("\n")).toBe(false);
  });

  it("a camada muda a ordem dada ao apoio — é o que o teste ao vivo não produziu", () => {
    const externa = buildIntencaoRegraApoio({ ...base, apoio: "texto" });
    const interna = buildIntencaoRegraApoio({
      ...base,
      transformacaoPrincipal: "salvar",
      apoio: "texto",
    });
    const silenciosa = buildIntencaoRegraApoio({
      ...base,
      transformacaoPrincipal: "preferencia",
      apoio: "texto",
    });
    expect(externa).toContain("Mostra quem faz o trabalho");
    expect(interna).toContain("Mostra o trabalho acontecendo");
    expect(silenciosa).toContain("Mostra a rotina de trabalho que se repete");
    expect(new Set([externa, interna, silenciosa]).size).toBe(3);
  });

  it("fala de tópicos quando o formato é tópicos", () => {
    const topicos = buildIntencaoRegraApoio({ ...base, apoio: "topicos" });
    expect(topicos).toContain("pelo menos um dos tópicos");
    expect(topicos).not.toContain("o texto de apoio existe");
  });

  it("sem apoio nesta geração não há ordem a dar", () => {
    expect(buildIntencaoRegraApoio({ ...base, apoio: null })).toBe("");
  });

  it("sem segmento não há manifestação — e sem manifestação não há regra", () => {
    expect(buildIntencaoRegraApoio({ ...base, segment: "AGRO", apoio: "texto" })).toBe("");
    expect(buildIntencaoRegraLegenda({ ...base, segment: null })).toBe("");
  });

  it("na legenda a regra governa o CORPO e declara que o CTA é da transformação", () => {
    const regra = buildIntencaoRegraLegenda(base);
    expect(regra).toContain("CORPO DA LEGENDA");
    expect(regra).toContain("Mostra quem faz o trabalho");
    expect(regra).toContain("CTA continua governado pela transformação");
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
