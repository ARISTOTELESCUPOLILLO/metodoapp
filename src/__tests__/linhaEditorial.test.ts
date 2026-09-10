import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  resolverLinhaAuto,
  parseLinhaEditorial,
  parseUsoDoObjeto,
  LINHA_EDITORIAL_SPEC,
} from "../domain/linhaEditorial.config";
import {
  buildRegraLinhaEditorial,
  regraNomeNaLegenda,
  buildCriterioEditorialJuiz,
  checkNomeNoTitulo,
  tetoTituloPorUso,
  TITULO_MAX_WORDS_COM_NOME,
  classificarFalaEditorial,
  validarProposicaoEditorial,
  EDITORIAL_MIN_WORDS,
  EDITORIAL_MAX_WORDS,
} from "../core/linhaEditorialRules";
import { tokensDeConteudo } from "../core/sugestaoValidation";
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
    // Decisão do Ari (09/09): no título, não "título OU texto".
    expect(nome).toContain("TÍTULO");
    expect(nome).not.toContain("no título OU no texto");

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

// ── MOSTRAR NOME: as três colisões de regra (decisão de 09/09/2026) ──────────

describe("MOSTRAR NOME — arbitragem das regras que colidem", () => {
  const mopNome = () =>
    buildRegraLinhaEditorial({
      linhaEditorial: "conhecimento",
      usoObjeto: "nome",
      objeto: "Consultoria de Comunicação Integrada",
      alvo: "mop",
    });

  it("no MOP, exige o nome no título da PRIMEIRA e da ÚLTIMA peça", () => {
    const regra = mopNome();
    expect(regra).toContain("TÍTULO do PRIMEIRO Estático");
    expect(regra).toContain("TÍTULO da última peça");
    // As do meio ficam livres — senão a sequência vira catálogo.
    expect(regra).toContain("peças do meio é opcional");
  });

  it("isenta o nome do teto de sílabas e proíbe a troca por sinônimo curto", () => {
    // "consultoria" tem 5 sílabas e "comunicação" 5 — as duas estourariam a
    // régua de 4, e a exceção de 5 vale só para o núcleo da informação-chave.
    const regra = mopNome();
    expect(regra).toContain("ISENÇÃO DE SÍLABAS");
    expect(regra).toContain("vence a regra de sílabas");
    expect(regra).toContain("Consultoria de Comunicação Integrada");
    expect(regra).toContain("sinônimo mais curto");
    // Encurtar para o núcleo continua permitido — é o que faz o nome caber no
    // limite de 6 palavras do título.
    expect(regra).toContain("NÚCLEO COMERCIAL RECONHECÍVEL");
  });

  it("no MOP, abre exceção à diversidade lexical sem liberar título repetido", () => {
    const regra = mopNome();
    expect(regra).toContain("EXCEÇÃO à diversidade lexical");
    // A proibição de abertura e fechamento soarem a mesma frase CONTINUA.
    expect(regra).toContain("CONTINUA valendo");
  });

  it("revoga a 'Alternativa preferível' que tirava o nome do título de abertura", () => {
    // Teste real de 09/09/2026: com MOSTRAR NOME e o produto "Diagnóstico
    // Digital", o Dia 3 nomeou ("Diagnóstico Digital vai além do papel") e o
    // Dia 1 não ("Quando a decisão pede presença?"). A causa é uma frase do
    // keyInfoBlock que RECOMENDA ancorar o elemento no TEXTO de uma das peças,
    // "liberando o título" — o modelo seguiu o conselho mais antigo.
    const regra = mopNome();
    expect(regra).toContain("REVOGA");
    expect(regra).toContain("ALTERNATIVA PREFERÍVEL");
    // Cita a frase de lá para o modelo saber exatamente qual está sendo revogada.
    expect(regra).toContain("liberando o título");
  });

  it("a revogação não existe no PU — a frase revogada é do keyInfoBlock do MOP", () => {
    const pu = buildRegraLinhaEditorial({
      linhaEditorial: "decisao",
      usoObjeto: "nome",
      objeto: "Diagnóstico Digital",
      alvo: "pu",
    });
    expect(pu).not.toContain("ALTERNATIVA PREFERÍVEL");
  });

  it("no PU não há cláusula de diversidade lexical (é peça única)", () => {
    const pu = buildRegraLinhaEditorial({
      linhaEditorial: "conhecimento",
      usoObjeto: "nome",
      objeto: "Consultoria de Comunicação Integrada",
      alvo: "pu",
    });
    expect(pu).toContain("ISENÇÃO DE SÍLABAS");
    expect(pu).not.toContain("diversidade lexical");
    expect(pu).not.toContain("PRIMEIRO Estático");
  });

  it("dá critério de encurtamento e usa os produtos irmãos como teste", () => {
    const regra = buildRegraLinhaEditorial({
      linhaEditorial: "diagnostico",
      usoObjeto: "nome",
      objeto: "Ração para cão adulto",
      irmaos: ["Ração para gato filhote", "Vacinas para cães e gatos"],
      alvo: "mop",
    });
    expect(regra).toContain("2 palavras de conteúdo");
    expect(regra).toContain("TESTE OBRIGATÓRIO ANTES DE CORTAR");
    // Os irmãos entram nominalmente — é o que torna o teste verificável.
    expect(regra).toContain("Ração para gato filhote");
    expect(regra).toContain("Vacinas para cães e gatos");
    // E o qualificador é protegido explicitamente.
    expect(regra).toContain("qualificador que DEFINE o produto");
  });

  it("sem irmãos cadastrados, cai num teste genérico em vez de citar lista vazia", () => {
    const regra = buildRegraLinhaEditorial({
      linhaEditorial: "diagnostico",
      usoObjeto: "nome",
      objeto: "Ração para cão adulto",
      irmaos: [],
      alvo: "mop",
    });
    expect(regra).toContain("TESTE ANTES DE CORTAR");
    expect(regra).not.toContain("esta empresa também vende:");
  });

  it("limita a lista de irmãos para não inchar o prompt", () => {
    const muitos = Array.from({ length: 20 }, (_, i) => `Produto ${i}`);
    const regra = buildRegraLinhaEditorial({
      linhaEditorial: "diagnostico",
      usoObjeto: "nome",
      objeto: "Ração para cão adulto",
      irmaos: muitos,
      alvo: "mop",
    });
    expect(regra).toContain("Produto 8");
    expect(regra).not.toContain("Produto 9");
  });

  it("a isenção de sílabas NÃO aparece nos outros modos de uso", () => {
    for (const uso of ["sem_nome", "nao_usar"] as const) {
      const regra = buildRegraLinhaEditorial({
        linhaEditorial: "conhecimento",
        usoObjeto: uso,
        objeto: "Consultoria de Comunicação Integrada",
        alvo: "mop",
      });
      expect(regra, uso).not.toContain("ISENÇÃO DE SÍLABAS");
    }
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

// ── Tokens de conteúdo: a régua que decide "nome longo" ─────────────────────
// Calibrada contra os 97 produtos reais do banco (09/09/2026): o teto de 3
// tokens precisa deixar passar os nomes bons de 4-5 PALAVRAS e pegar só os de
// fato longos.

describe("tokensDeConteudo", () => {
  it("ignora artigos e preposições — palavras não são ideias", () => {
    expect(tokensDeConteudo("Ração para cão adulto")).toEqual(["racao", "cao", "adulto"]);
    expect(tokensDeConteudo("Vacinas para cães e gatos")).toEqual(["vacinas", "caes", "gatos"]);
  });

  it("deixa passar os nomes bons de 4 palavras do banco", () => {
    for (const nome of [
      "Ração para cão adulto",
      "Ração para gato filhote",
      "Consultoria em Marketing Digital",
      "Curso Boneca de Pano",
      "Vacinas para cães e gatos",
      "Cadeira estofada de escritório",
    ]) {
      expect(tokensDeConteudo(nome).length, nome).toBeLessThanOrEqual(3);
    }
  });

  it("pega os que de fato não cabem num título", () => {
    for (const nome of [
      "Tráfego pago nos meios digitais",
      "Bomba de transferência do óleo do câmbio",
      "Ebook 6 Estilos Artísticos para Criar Conteúdo",
      "Método OP para geração de conteúdo",
    ]) {
      expect(tokensDeConteudo(nome).length, nome).toBeGreaterThan(3);
    }
  });
});

// ── Linha DECISÃO: comparar formato não é comparar critério ──────────────────
// Caso real 09/09/2026: "Ao escolher o Diagnóstico Digital, a decisão passa por
// comparar análises feitas somente por e-mail com aquelas realizadas em
// entrevistas presenciais." Duas alternativas, nenhum critério — o leitor não
// tem base para decidir. A guia dizia "duas alternativas OU o critério"; o "ou"
// tornava o critério opcional.

describe("guia da linha DECISÃO", () => {
  const decisao = LINHA_EDITORIAL_SPEC.decisao;

  it("exige o que MUDA entre as alternativas, não só as alternativas", () => {
    expect(decisao.guia).toContain("NÃO BASTA");
    expect(decisao.guia).toContain("O QUE MUDA");
    // O "ou" que tornava o critério opcional saiu.
    expect(decisao.guia).not.toContain("ou nomeando o critério");
  });

  it("nomeia a armadilha de comparar canais/formatos", () => {
    expect(decisao.evitar).toContain("CANAIS OU FORMATOS");
    expect(decisao.evitar).toContain("e-mail");
    expect(decisao.evitar).toContain("NOMES DE FORMATO");
  });

  it("a guia nova chega ao prompt da peça", () => {
    const regra = buildRegraLinhaEditorial({ linhaEditorial: "decisao", alvo: "pu" });
    expect(regra).toContain("O QUE MUDA");
  });
});

// ── Teste real de 09/09/2026, 14:30 ──────────────────────────────────────────
// Com MOSTRAR NOME o nome entrou nos dois títulos (a revogação funcionou), mas
// os dois viraram a MESMA frase com o verbo trocado:
//   "Diagnóstico Digital guia a rota" / "Diagnóstico Digital decide resultados reais"
// que é o padrão que a regra de abertura×fechamento já proibia — e o segundo
// ainda atribui ao serviço um poder que ele não tem.

describe("MOSTRAR NOME — diferenciação dos dois títulos", () => {
  const regra = () =>
    buildRegraLinhaEditorial({
      linhaEditorial: "decisao",
      usoObjeto: "nome",
      objeto: "Diagnóstico Digital",
      alvo: "mop",
    });

  it("vira teste conferível, não conselho solto", () => {
    const r = regra();
    expect(r).toContain("TESTE DOS DOIS TÍTULOS");
    expect(r).toContain("COMEÇAM com a mesma palavra");
    expect(r).toContain("só o verbo trocado");
  });

  it("o exemplo NÃO usa o produto real do cliente", () => {
    // Teste real 09/09 14:46: o exemplo que eu tinha escrito usava o nome do
    // produto do cliente, e o modelo copiou quase literal — o titulo do Dia 3
    // saiu "Quem começa pelo Diagnóstico Digital erra?", perdendo o "menos" do
    // exemplo e virando dúvida sobre o próprio serviço. Exemplo no prompt não é
    // ilustração, é molde: com o nome real dentro, há o que copiar.
    const r = regra();
    expect(r).not.toContain("Diagnóstico Digital guia");
    expect(r).toContain("OUTRO ramo");
    expect(r).toContain("NÃO copie as palavras");
  });

  it("o exemplo não abre com 'Quem' — o item 11 do MOP proíbe", () => {
    // "Quem decide…", "Quem usa…" são proibidos por nomear o leitor de fora. O
    // detector checkObserverSubject tem lista fechada de verbos e não cobria
    // "começa", então o exemplo antigo passava batido e ensinava o proibido.
    const r = regra();
    expect(r).not.toContain('"Quem ');
  });

  it("proíbe o item como agente do resultado", () => {
    const r = regra();
    expect(r).toContain("NÃO É O AGENTE DO RESULTADO");
    expect(r).toContain("garante vendas");
    // Dá o que fazer no lugar — proibição sem saída declarada já falhou antes.
    expect(r).toContain("mostrar, apontar, revelar");
  });

  // A regra do agente MUDOU DE ESCOPO em 09/09/2026 (tarde). Ela nasceu dentro
  // do MOSTRAR NOME, mas o convite a fazer o item agir não vem do NOME — vem de
  // ele ser o assunto da peça. Caso real no REFERIR SEM NOME, card 5 de um
  // carrossel: "Treinamento que sente o campo funciona". A regra não estava no
  // prompt porque estava presa ao outro modo.
  it("a regra do agente vale também no REFERIR SEM NOME", () => {
    const r = buildRegraLinhaEditorial({
      linhaEditorial: "decisao",
      usoObjeto: "sem_nome",
      objeto: "Diagnóstico Digital",
      alvo: "mop",
    });
    expect(r).toContain("NÃO É O AGENTE DO RESULTADO");
    // A personificação é o caso que escapava da lista original de verbos.
    expect(r).toContain("que sente");
  });

  it("o resto do MOSTRAR NOME não vaza para os outros modos", () => {
    for (const uso of ["sem_nome", "nao_usar", "auto"] as const) {
      const r = buildRegraLinhaEditorial({
        linhaEditorial: "decisao",
        usoObjeto: uso,
        objeto: "Diagnóstico Digital",
        alvo: "mop",
      });
      expect(r, uso).not.toContain("TESTE DOS DOIS TÍTULOS");
    }
    for (const uso of ["nao_usar", "auto"] as const) {
      const r = buildRegraLinhaEditorial({
        linhaEditorial: "decisao",
        usoObjeto: uso,
        objeto: "Diagnóstico Digital",
        alvo: "mop",
      });
      expect(r, uso).not.toContain("AGENTE DO RESULTADO");
    }
  });

  it("NENHUMA variante da regra usa palavra banida do MOP", () => {
    // "claro/clara" é proibida no conteúdo final (item 7 do prompt do MOP).
    // Tê-la no texto da INSTRUÇÃO prima o modelo a usá-la — foi assim que o
    // defeito apareceu: a variante SEM produtos irmãos dizia "deixa claro QUAL
    // produto é". Por isso o teste varre todas as combinações, não uma só.
    for (const uso of ["nome", "sem_nome", "nao_usar", "auto"] as const) {
      for (const irmaos of [[], ["Consultoria em Marketing Digital"]]) {
        for (const alvo of ["pu", "mop"] as const) {
          const r = buildRegraLinhaEditorial({
            linhaEditorial: "decisao",
            usoObjeto: uso,
            objeto: "Diagnóstico Digital",
            irmaos,
            alvo,
          });
          expect(r, `${uso}/${alvo}/irmaos:${irmaos.length}`).not.toMatch(/\bclar[oa]s?\b/i);
        }
      }
    }
  });
});

describe("REFERIR SEM NOME — a legenda e a excecao", () => {
  // Decisao do Ari (09/09/2026): o modo existe para a PECA nao virar etiqueta,
  // mas quem le a legenda ja parou no post e precisa saber do que se trata.
  // A peca convida pela ideia; a legenda diz o nome.
  it("proibe o nome na peca e o exige uma vez no corpo da legenda", () => {
    const regra = buildRegraLinhaEditorial({
      linhaEditorial: "conhecimento",
      usoObjeto: "sem_nome",
      objeto: "Minicurso de vendas",
      alvo: "mop",
    });
    expect(regra).toContain("NÃO pode ser escrito NA PEÇA");
    expect(regra).toContain("A LEGENDA É A ÚNICA EXCEÇÃO");
    expect(regra).toContain('o nome "Minicurso de vendas" DEVE aparecer escrito UMA vez');
    expect(regra).toContain("PROIBIDO deixar o nome só na hashtag");
  });

  it("MOSTRAR NOME nao ganha a excecao — o nome ja esta no titulo", () => {
    const regra = buildRegraLinhaEditorial({
      linhaEditorial: "conhecimento",
      usoObjeto: "nome",
      objeto: "Minicurso de vendas",
      alvo: "mop",
    });
    expect(regra).not.toContain("A LEGENDA É A ÚNICA EXCEÇÃO");
  });

  it("NAO USAR nao ganha a excecao — o item nao e a ancora da peca", () => {
    const regra = buildRegraLinhaEditorial({
      linhaEditorial: "conhecimento",
      usoObjeto: "nao_usar",
      objeto: "Minicurso de vendas",
      alvo: "pu",
    });
    expect(regra).not.toContain("A LEGENDA É A ÚNICA EXCEÇÃO");
  });

  it("sem objeto a regra da legenda nao existe", () => {
    expect(regraNomeNaLegenda("")).toBe("");
    expect(regraNomeNaLegenda("   ")).toBe("");
  });
});

describe("criterio editorial do juiz D2", () => {
  // Caso real de 10/09: proposicao CONHECIMENTO impecavel e titulo
  // "Criacao de logomarca: o que muda" — a pergunta da TRANSFORMACAO e uma
  // formula que serve a qualquer anunciante do ramo. Nenhuma regua pegava:
  // as validacoes deterministicas aprovaram os dois campos e o criterio 3 do
  // juiz ("generico demais") nao pega titulo que NOMEIA o produto.
  it("sem linha editorial, nao existe criterio nenhum", () => {
    expect(buildCriterioEditorialJuiz({ linhaEditorial: null, alvo: "pu", numero: 6 })).toBe("");
  });

  it("no PU cobra titulo e texto, e nomeia a armadilha do 'o que muda'", () => {
    const c = buildCriterioEditorialJuiz({
      linhaEditorial: "conhecimento",
      alvo: "pu",
      numero: 6,
    });
    expect(c.startsWith("6. ABANDONOU A LINHA EDITORIAL")).toBe(true);
    expect(c).toContain("CONHECIMENTO");
    expect(c).toContain("O que é importante compreender?");
    expect(c).toContain("Vale para o TÍTULO e para o TEXTO desta peça.");
    expect(c).toContain('"o que muda"');
    // Condensar continua permitido — o defeito e trocar a ideia, nao encurtar.
    expect(c).toContain("NÃO reprove por não repetir as palavras da informação-chave");
  });

  it("no MOP cobra so a primeira peca — a linha e origem, nao molde", () => {
    const c = buildCriterioEditorialJuiz({
      linhaEditorial: "conhecimento",
      alvo: "mop",
      numero: 6,
    });
    expect(c).toContain("SOMENTE para o PRIMEIRO item");
    expect(c).toContain("ORIGEM da sequência");
    expect(c).toContain("CONTRADIZER");
    expect(c).not.toContain("Vale para o TÍTULO e para o TEXTO desta peça.");
  });

  it("as cinco linhas produzem criterio, cada uma com a sua pergunta", () => {
    const linhas = [
      "diagnostico",
      "conhecimento",
      "experiencia",
      "transformacao",
      "decisao",
    ] as const;
    for (const linha of linhas) {
      const c = buildCriterioEditorialJuiz({ linhaEditorial: linha, alvo: "pu", numero: 6 });
      expect(c, linha).toContain(LINHA_EDITORIAL_SPEC[linha].pergunta);
      expect(c, linha).toContain(LINHA_EDITORIAL_SPEC[linha].label.toUpperCase());
    }
  });
});

describe("MOSTRAR NOME cobrado no TITULO DA PECA", () => {
  // CASO REAL (10/09, PU, linha CONHECIMENTO, item "Consultoria de Marketing
  // Digital"): saiu o melhor titulo da serie — "Clique nao e contato ainda" — e
  // o nome sumiu da peca INTEIRA. O juiz D2 aprovou, e com razao: ele cobra a
  // linha editorial, nao o nome. A checagem do nome so existia para a
  // PROPOSICAO; do titulo em diante era instrucao dentro do prompt, e instrucao
  // perde quando o modelo acha uma frase melhor sem o nome.
  const OBJETO = "Consultoria de Marketing Digital";

  it("reprova o titulo real que perdeu o nome, e diz que sumiu da peca", () => {
    const motivo = checkNomeNoTitulo({
      titulo: "Clique não é contato ainda",
      texto: "Cliques mostram interesse. Contato verdadeiro revela quem quer conversar para valer.",
      objeto: OBJETO,
      usoObjeto: "nome",
    });
    expect(motivo).toBeTruthy();
    expect(motivo).toContain("não aparece em lugar nenhum da peça");
  });

  it("distingue 'esta so no apoio' de 'sumiu' — sao correcoes diferentes", () => {
    const motivo = checkNomeNoTitulo({
      titulo: "Clique não é contato ainda",
      texto: "A Consultoria de Marketing ajuda a entender essa diferença.",
      objeto: OBJETO,
      usoObjeto: "nome",
    });
    expect(motivo).toContain("aparece só no texto de apoio");
    expect(motivo).toContain("TÍTULO");
  });

  it("aceita o NUCLEO COMERCIAL no titulo — encurtar e permitido", () => {
    expect(
      checkNomeNoTitulo({
        titulo: "Consultoria mostra o que trava",
        objeto: OBJETO,
        usoObjeto: "nome",
      }),
    ).toBeNull();
  });

  it("nao cobra nada fora do modo MOSTRAR NOME", () => {
    for (const uso of ["sem_nome", "nao_usar", "auto"] as const) {
      expect(
        checkNomeNoTitulo({ titulo: "Clique não é contato ainda", objeto: OBJETO, usoObjeto: uso }),
        uso,
      ).toBeNull();
    }
    expect(checkNomeNoTitulo({ titulo: "Qualquer", objeto: "", usoObjeto: "nome" })).toBeNull();
  });

  it("o teto do titulo sobe para 7 somente com MOSTRAR NOME", () => {
    expect(tetoTituloPorUso("nome", OBJETO)).toBe(TITULO_MAX_WORDS_COM_NOME);
    expect(TITULO_MAX_WORDS_COM_NOME).toBe(7);
    expect(tetoTituloPorUso("sem_nome", OBJETO)).toBeNull();
    expect(tetoTituloPorUso("nome", "")).toBeNull();
  });

  it("a regra do prompt declara o teto novo e diz que ele vence o 6", () => {
    const regra = buildRegraLinhaEditorial({
      linhaEditorial: "conhecimento",
      usoObjeto: "nome",
      objeto: OBJETO,
      alvo: "mop",
    });
    expect(regra).toContain(`TETO DE PALAVRAS DO TÍTULO SOBE PARA ${TITULO_MAX_WORDS_COM_NOME}`);
    expect(regra).toContain("os demais seguem com 6");
  });
});
