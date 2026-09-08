import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  resolverLinhaAuto,
  parseLinhaEditorial,
  parseUsoDoObjeto,
  LINHA_EDITORIAL_SPEC,
} from "../domain/linhaEditorial.config";
import {
  buildRegraLinhaEditorial,
  classificarFalaEditorial,
  validarProposicaoEditorial,
  EDITORIAL_MIN_WORDS,
  EDITORIAL_MAX_WORDS,
} from "../core/linhaEditorialRules";
import { buildMetodoOpPrompt } from "../core/organizaMethodEngine";
import type { ContentFormData } from "../types";

// ── AUTO: a linha muda a cada sugestão da rodada ─────────────────────────────

describe("resolverLinhaAuto", () => {
  it("no PU, a 1ª sugestão nasce da linha preferida do objetivo", () => {
    expect(
      resolverLinhaAuto({ mode: "postunico", objetivo: "promocao", linhasUsadas: [], attempt: 0 }),
    ).toBe("decisao");
    expect(
      resolverLinhaAuto({
        mode: "postunico",
        objetivo: "institucional",
        linhasUsadas: [],
        attempt: 0,
      }),
    ).toBe("experiencia");
  });

  it("não repete linha já usada na mesma rodada", () => {
    const usadas: ReturnType<typeof resolverLinhaAuto>[] = [];
    for (let i = 0; i < 3; i++) {
      usadas.push(
        resolverLinhaAuto({
          mode: "postunico",
          objetivo: "promocao",
          linhasUsadas: usadas,
          attempt: i,
        }),
      );
    }
    expect(new Set(usadas).size).toBe(3);
  });

  it("quando a lista de preferidas esgota, volta a girar em vez de falhar", () => {
    // "homenagem" só tem 3 linhas preferidas — com as 3 usadas, ainda devolve uma.
    const linha = resolverLinhaAuto({
      mode: "postunico",
      objetivo: "homenagem",
      linhasUsadas: ["experiencia", "conhecimento", "transformacao"],
      attempt: 3,
    });
    expect(["experiencia", "conhecimento", "transformacao"]).toContain(linha);
  });

  it("objetivo desconhecido cai no rodízio completo de 'nenhum'", () => {
    expect(
      resolverLinhaAuto({
        mode: "postunico",
        objetivo: "inexistente",
        linhasUsadas: [],
        attempt: 0,
      }),
    ).toBe("diagnostico");
  });

  it("no MOP ignora objetivo e usa a ordem canônica", () => {
    expect(resolverLinhaAuto({ mode: "metodo", linhasUsadas: [], attempt: 0 })).toBe("diagnostico");
  });
});

describe("parse de entrada do cliente", () => {
  it("descarta valor inválido em vez de confiar no corpo da requisição", () => {
    expect(parseLinhaEditorial("diagnostico")).toBe("diagnostico");
    expect(parseLinhaEditorial("auto")).toBeNull();
    expect(parseLinhaEditorial("<script>")).toBeNull();
    expect(parseLinhaEditorial(undefined)).toBeNull();
    expect(parseUsoDoObjeto("nome")).toBe("nome");
    expect(parseUsoDoObjeto("qualquer")).toBe("auto");
  });
});

// ── Microfone: comando × pista (item 28) ─────────────────────────────────────

describe("classificarFalaEditorial", () => {
  it("reconhece comando puro", () => {
    for (const fala of [
      "Outra.",
      "Outra sugestão.",
      "Me dê uma sugestão.",
      "Quero outra",
      "Gera outra.",
      "De novo",
    ]) {
      expect(classificarFalaEditorial(fala).tipo, fala).toBe("comando");
      expect(classificarFalaEditorial(fala).hint, fala).toBe("");
    }
  });

  it("separa comando de pista quando há conectivo", () => {
    const r = classificarFalaEditorial("Outra, mas falando de preço.");
    expect(r.tipo).toBe("comando_com_pista");
    expect(r.hint).toBe("preco");
  });

  it("trata fala de conteúdo como pista inteira, preservando o texto original", () => {
    const fala = "Quero falar daqueles anúncios que têm clique mas ninguém chama no WhatsApp";
    const r = classificarFalaEditorial(fala);
    expect(r.tipo).toBe("pista");
    expect(r.hint).toBe(fala);
  });

  it("fala vazia não vira comando (não dispara geração sozinha)", () => {
    expect(classificarFalaEditorial("   ").tipo).toBe("pista");
    expect(classificarFalaEditorial("").hint).toBe("");
  });
});

// ── Validação da proposição ──────────────────────────────────────────────────

describe("validarProposicaoEditorial", () => {
  const ok =
    "Uma campanha pode gerar muitas visualizações e poucos contatos quando a oferta não diz por que agir.";

  it("aprova proposição dentro da faixa", () => {
    expect(validarProposicaoEditorial(ok, "")).toEqual([]);
  });

  it("reprova frase curta demais (é assunto, não proposição)", () => {
    const motivos = validarProposicaoEditorial("Tráfego pago para lojas locais", "");
    expect(motivos.join(" ")).toContain("curta demais");
    expect(motivos.join(" ")).toContain(String(EDITORIAL_MIN_WORDS));
  });

  it("reprova palavra reservada do sistema", () => {
    const motivos = validarProposicaoEditorial(
      "A falta de clareza na oferta faz o cliente desistir antes mesmo de perguntar o preço do serviço.",
      "",
    );
    expect(motivos.join(" ")).toContain("reservada");
  });

  it("reprova quando MOSTRAR NOME não nomeia o objeto", () => {
    const motivos = validarProposicaoEditorial(
      "Quem procura uma peça social versátil costuma precisar dela para trabalho e para eventos da família.",
      "",
      { objeto: "Terno Slim Preto", usoObjeto: "nome" },
    );
    expect(motivos.join(" ")).toContain("MOSTRAR NOME");
  });

  it("aceita quando MOSTRAR NOME usa o núcleo comercial do cadastro", () => {
    const motivos = validarProposicaoEditorial(
      "O Terno Slim Preto atende quem precisa de uma peça só para o trabalho e para eventos sociais.",
      "",
      {
        objeto: "Terno Masculino Slim Corte Italiano Microfibra Preto Ref. 4758",
        usoObjeto: "nome",
      },
    );
    expect(motivos.join(" ")).not.toContain("MOSTRAR NOME");
  });

  it("reprova oferta inventada que não veio do contexto do usuário", () => {
    const motivos = validarProposicaoEditorial(
      "Nesta semana a loja oferece 30% de desconto em todos os ternos sociais para quem comprar pelo site.",
      "",
    );
    expect(motivos.length).toBeGreaterThan(0);
  });

  it("não trunca: a faixa é teto declarado, não corte", () => {
    // Uma frase 2 palavras acima da faixa desejada continua aprovada — o teto
    // duro é maior de propósito (o pedido admite passar um pouco).
    const vinteEQuatro =
      "Antes de aumentar a verba dos anúncios, vale decidir se a empresa precisa de mais alcance ou de uma mensagem bem mais direta.";
    expect(vinteEQuatro.split(/\s+/).length).toBeGreaterThan(EDITORIAL_MAX_WORDS);
    expect(validarProposicaoEditorial(vinteEQuatro, "")).toEqual([]);
  });
});

// ── Regra colada no prompt das peças ─────────────────────────────────────────

describe("buildRegraLinhaEditorial", () => {
  it("devolve string VAZIA sem linha — quem está fora do beta não muda de prompt", () => {
    expect(buildRegraLinhaEditorial({ linhaEditorial: null, alvo: "pu" })).toBe("");
    expect(buildRegraLinhaEditorial({ linhaEditorial: null, alvo: "mop" })).toBe("");
  });

  it("no PU, delimita a virada sem revogá-la e preserva o objetivo da peça", () => {
    const regra = buildRegraLinhaEditorial({ linhaEditorial: "diagnostico", alvo: "pu" });
    expect(regra).toContain(LINHA_EDITORIAL_SPEC.diagnostico.label.toUpperCase());
    expect(regra).toContain("NÃO revoga a VIRADA OBRIGATÓRIA");
    expect(regra).toContain("O OBJETIVO DA PEÇA CONTINUA VALENDO");
  });

  it("no MOP, declara que a linha é origem e não substitui a progressão", () => {
    const regra = buildRegraLinhaEditorial({ linhaEditorial: "transformacao", alvo: "mop" });
    expect(regra).toContain("ORIGEM, NÃO MOLDE");
    expect(regra).toContain("progressão psicológica");
    expect(regra).not.toContain("VIRADA OBRIGATÓRIA");
  });

  it("EXPERIÊNCIA carrega a proibição de virar experimento", () => {
    const regra = buildRegraLinhaEditorial({ linhaEditorial: "experiencia", alvo: "pu" });
    expect(regra).toContain("EXPERIÊNCIA NÃO É EXPERIMENTO");
  });

  it("modo de uso do objeto entra na regra, e AUTO não impõe nada", () => {
    const nome = buildRegraLinhaEditorial({
      linhaEditorial: "decisao",
      usoObjeto: "nome",
      objeto: "Terno Slim Preto",
      alvo: "pu",
    });
    expect(nome).toContain("MOSTRAR NOME");
    expect(nome).toContain("Terno Slim Preto");

    const semNome = buildRegraLinhaEditorial({
      linhaEditorial: "decisao",
      usoObjeto: "sem_nome",
      objeto: "Terno Slim Preto",
      alvo: "pu",
    });
    expect(semNome).toContain("REFERIR SEM NOME");

    const naoUsar = buildRegraLinhaEditorial({
      linhaEditorial: "decisao",
      usoObjeto: "nao_usar",
      objeto: "Terno Slim Preto",
      alvo: "pu",
    });
    expect(naoUsar).toContain("NÃO USAR");

    const auto = buildRegraLinhaEditorial({
      linhaEditorial: "decisao",
      usoObjeto: "auto",
      objeto: "Terno Slim Preto",
      alvo: "pu",
    });
    expect(auto).not.toContain("OBJETO DESTA PEÇA");
  });
});

// ── Regressão: o prompt do MOP não muda para quem está fora do piloto ────────

describe("buildMetodoOpPrompt — regressão do piloto editorial", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const base: ContentFormData = {
    companyName: "Empresa Teste",
    segment: "SERVIÇOS",
    audience: "B2B",
    businessMoment: "consolidação",
    keyInfo: "Gestão de tráfego pago para pequenas empresas",
    brandVoice: "profissional e acessível",
    outputMode: "feed",
    sequenceSize: 6,
    storiesDays: 1,
    storiesQuantity: 3,
    outputFormats: ["feed"],
    track: "cinematica",
    mainActivity: "Agência de comunicação e tráfego pago",
    mood: "OP-01",
  };

  it("sem `editorial`, o prompt é idêntico ao de um form sem o campo", () => {
    const semCampo = buildMetodoOpPrompt(base, 1);
    const comCampoVazio = buildMetodoOpPrompt({ ...base, editorial: undefined }, 1);
    expect(comCampoVazio).toBe(semCampo);
    expect(semCampo).not.toContain("LINHA EDITORIAL DE ORIGEM");
  });

  it("com `editorial`, a regra entra no fim do prompt sem apagar as existentes", () => {
    const comLinha = buildMetodoOpPrompt(
      {
        ...base,
        editorial: {
          linhaEditorial: "diagnostico",
          usoObjeto: "sem_nome",
          objetoEditorial: "Gestão de Tráfego Pago",
          proposicao: base.keyInfo,
        },
      },
      1,
    );
    expect(comLinha).toContain("LINHA EDITORIAL DE ORIGEM");
    expect(comLinha).toContain("ORIGEM, NÃO MOLDE");
    expect(comLinha).toContain("REFERIR SEM NOME");
    // A progressão psicológica e o eixo continuam declarados.
    expect(comLinha).toContain("EIXO OBRIGATÓRIO DA SEQUÊNCIA");
    expect(comLinha).toContain("ENTENDIMENTO → CONFIANÇA → SEGURANÇA → AUTORIDADE → AGIR");
  });

  it("escolha editorial se dissolve quando a informação-chave é editada à mão", () => {
    // O usuário aceitou uma sugestão e depois reescreveu o campo: a linha
    // daquela sugestão não pode continuar regendo a sequência.
    const editada = buildMetodoOpPrompt(
      {
        ...base,
        keyInfo: "Outro assunto escrito à mão pelo usuário",
        editorial: {
          linhaEditorial: "diagnostico",
          usoObjeto: "nome",
          objetoEditorial: "Gestão de Tráfego Pago",
          proposicao: base.keyInfo,
        },
      },
      1,
    );
    expect(editada).not.toContain("LINHA EDITORIAL DE ORIGEM");
    expect(editada).not.toContain("MOSTRAR NOME");
  });
});
