import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { checkFechoGenerico, FECHO_GENERICO_RULE } from "../core/fechoGenerico";
import { validateTexto, validateLegenda } from "../core/textValidation";
import { validateTopico } from "../core/topicoValidation";
import { buildMetodoOpPrompt } from "../core/organizaMethodEngine";
import { buildRegraProfissaoRegulamentada } from "../core/profissaoRegulamentada";

// Corpus REAL do teste de 17-18/08/2026 (AJUSTE_CONFLITO/TESTE-repertorio-18-08.md
// e os nomes de arquivo das peças, que são as legendas). Nada aqui é inventado:
// são as frases que a IA devolveu ao Ari.

const APOIOS_COM_FECHO_VAZIO = [
  // R2 — o qualificador fecha a PRIMEIRA oração, não o texto todo
  "Antes de publicar, dois profissionais conferem tudo com atenção. Seu conteúdo vai mais seguro.",
  // R4
  "Todo dia traduzo sua ideia em imagem e palavra, sempre com atenção.",
  // R5 — sobreviveu ao conserto da polaridade e continuava vivo
  "Cada projeto passa por mãos diferentes que dominam rotinas para chegar ao melhor resultado.",
  // R6
  "Acompanhar seu dia vira rotina aqui. Atendimento contínuo, sempre com atenção ao seu momento.",
];

const LEGENDAS_COM_FECHO_VAZIO = [
  // legenda da R3
  "Cada peça recebe análise cuidadosa de dois profissionais distintos para garantir precisão e qualidade antes da publicação final.",
  // rodada de tráfego (17-18/08)
  "Manter uma rotina de análise constante permite identificar o comportamento dos visitantes e ajustar as estratégias para ampliar o acesso ao seu site de forma consistente.",
  "Campanhas estruturadas geram um fluxo constante de pessoas interessadas, alinhando estratégias que repetem resultados e fortalecem a presença digital de forma consistente.",
  "Investir em anúncios digitais possibilita atrair visitantes de forma ágil, favorecendo a análise rápida dos resultados para ajustes precisos na estratégia.",
  "Investir em anúncios digitais permite atrair visitantes com rapidez, facilitando análises objetivas sobre a resposta do público em diferentes canais online.",
];

// As peças LIMPAS do mesmo corpus — o detector não pode acusar nenhuma delas.
const APOIOS_LIMPOS = [
  // R1
  "Aqui, dois profissionais conferem todo conteúdo antes dele aparecer para você.",
  // R3 — "garantem QUE cada frase" não é o padrão de finalidade vazia
  "Antes de publicar, duas revisões garantem que cada frase cumpre sua intenção.",
  // R7
  "Paro para escutar, analisar e propor o que faz sentido na sua rotina.",
  // 1C — a peça que provou o conserto da manifestação
  "Aqui, você fala direto com quem monta suas campanhas do começo ao fim. Ponto.",
];

const LEGENDAS_LIMPAS = [
  "Nossa equipe analisa dados e estrutura ações que aceleram a chegada de visitantes por canais digitais, ajustando estratégias conforme as respostas do público.",
  "Nossa equipe analisa o perfil do seu público e ajusta estratégias para acelerar o fluxo de visitantes qualificados aos seus canais digitais.",
  // "constante" NÃO é vazio — é o vocabulário da camada silenciosa da tabela
  "Em projetos que se repetem, a análise contínua dos resultados guia ajustes que mantêm a atração constante de novos clientes digitais.",
];

describe("checkFechoGenerico — corpus real R1-R7 e rodada de tráfego", () => {
  it.each(APOIOS_COM_FECHO_VAZIO)("acusa o apoio: %s", (texto) => {
    expect(checkFechoGenerico(texto)).toBeTruthy();
  });

  it.each(LEGENDAS_COM_FECHO_VAZIO)("acusa a legenda: %s", (texto) => {
    expect(checkFechoGenerico(texto)).toBeTruthy();
  });

  it.each(APOIOS_LIMPOS)("não acusa o apoio limpo: %s", (texto) => {
    expect(checkFechoGenerico(texto)).toBeNull();
  });

  it.each(LEGENDAS_LIMPAS)("não acusa a legenda limpa: %s", (texto) => {
    expect(checkFechoGenerico(texto)).toBeNull();
  });

  it("cita o trecho acusado no motivo, para o retry saber o que trocar", () => {
    const motivo = checkFechoGenerico("Dois olhares conferem tudo com atenção.");
    expect(motivo).toContain("com atenção");
    expect(motivo).toContain("teto, não meta");
  });

  it("texto vazio não acusa nada", () => {
    expect(checkFechoGenerico("")).toBeNull();
    expect(checkFechoGenerico("   ")).toBeNull();
  });
});

describe("checkFechoGenerico — famílias do padrão", () => {
  it.each([
    "Nossa equipe atende com todo o cuidado.",
    "A revisão acontece com máxima precisão.",
    "Entregamos o projeto de maneira ágil.",
    "O time trabalha de um jeito cuidadoso.",
    "Cada etapa busca a melhor experiência.",
    "Fazemos tudo para garantir qualidade.",
    "Trabalhamos visando excelência no dia a dia.",
    "Seu pedido sai com mais segurança.",
  ])("acusa: %s", (texto) => {
    expect(checkFechoGenerico(texto)).toBeTruthy();
  });

  it.each([
    // dado concreto com superlativo é oferta, não vazio
    "Leve dois pares pelo melhor preço da cidade.",
    // adjunto de modo que carrega informação real do serviço
    "Atendemos de forma presencial na loja da avenida.",
    "O orçamento sai de forma gratuita pelo WhatsApp.",
    // "precisa" como verbo, não como adjetivo de modo
    "Você precisa trocar o filtro a cada dez mil quilômetros.",
    // "segura" como verbo
    "A prensa segura a peça enquanto a solda esfria.",
    // recorrência da camada silenciosa não pode ser confundida com vazio
    "Todo dia a equipe confere o estoque antes de abrir.",
  ])("não acusa: %s", (texto) => {
    expect(checkFechoGenerico(texto)).toBeNull();
  });
});

describe("fiação nas fachadas de validação", () => {
  it("validateTexto acusa o apoio da R2", () => {
    const motivos = validateTexto(
      "Antes de publicar, dois profissionais conferem tudo com atenção. Seu conteúdo vai mais seguro.",
    );
    expect(motivos.some((m) => m.includes("qualificador vazio"))).toBe(true);
  });

  it("validateLegenda acusa a legenda da R3", () => {
    const motivos = validateLegenda(
      "Cada peça recebe análise cuidadosa de dois profissionais distintos para garantir precisão e qualidade antes da publicação final.",
    );
    expect(motivos.some((m) => m.includes("qualificador vazio"))).toBe(true);
  });

  it("validateTopico acusa o tópico com qualificador vazio", () => {
    const motivos = validateTopico("Revisão feita com atenção");
    expect(motivos.some((m) => m.includes("qualificador vazio"))).toBe(true);
  });

  it("validateTexto continua limpo no apoio da R7", () => {
    expect(
      validateTexto("Paro para escutar, analisar e propor o que faz sentido na sua rotina."),
    ).toEqual([]);
  });
});

describe("FECHO_GENERICO_RULE", () => {
  it("é uma linha de regra e declara a saída, não só a proibição", () => {
    expect(FECHO_GENERICO_RULE.startsWith("- ")).toBe(true);
    expect(FECHO_GENERICO_RULE).toContain("NO LUGAR");
    expect(FECHO_GENERICO_RULE).toContain("TETO e não meta");
    expect(FECHO_GENERICO_RULE.includes("\n")).toBe(false);
  });

  it("a régua cita os fechos que proíbe — logo o detector a acusa, e isso é esperado", () => {
    // Documenta a única armadilha: a regra NÃO pode ser concatenada dentro de
    // um campo que passe por validateTexto/validateLegenda. Ela é prompt, não
    // conteúdo.
    expect(checkFechoGenerico(FECHO_GENERICO_RULE)).toBeTruthy();
  });
});

// Duas réguas no mesmo prompt não podem mandar coisas opostas. A régua de ética
// oferecia "o cuidado no processo" e "descrever o serviço com precisão" como
// alternativa à promessa de resultado — dois dos qualificadores que esta aqui
// proíbe. Ver o docblock de core/profissaoRegulamentada.ts.
describe("convivência com a régua de profissão regulamentada", () => {
  it("a alternativa declarada pela régua de ética não é um qualificador vazio", () => {
    const regra = buildRegraProfissaoRegulamentada("Advocacia trabalhista", "Silva Advogados");
    expect(regra).not.toBe("");
    expect(checkFechoGenerico(regra)).toBeNull();
  });

  it("a régua de ética continua dizendo o que escrever no lugar", () => {
    const regra = buildRegraProfissaoRegulamentada("Advocacia trabalhista", "Silva Advogados");
    expect(regra).toContain("O QUE ESCREVER NO LUGAR");
    expect(regra).toContain("o que se confere antes de entregar");
  });
});

// A régua só vale se CHEGAR ao prompt. É a lição de
// project-etica-profissao-regulamentada-2026-08-18: uma régua correta governava
// a tabela e nunca a saída, e ninguém notou porque nada verificava a fiação.
describe("fiação nos quatro motores de texto", () => {
  it("MOP — a regra chega ao prompt da sequência", () => {
    const prompt = buildMetodoOpPrompt({
      companyName: "Empresa Teste",
      segment: "SERVIÇOS",
      audience: "B2C",
      businessMoment: "consolidação",
      keyInfo: "Toda peça passa por revisão de duas pessoas",
      brandVoice: "profissional e acessível",
      outputMode: "feed",
      sequenceSize: 3,
      storiesDays: 1,
      storiesQuantity: 3,
      outputFormats: ["feed"],
      track: "cinematica",
      mainActivity: "Consultoria de negócios",
      mood: "OP-01",
    });
    expect(prompt).toContain("PROIBIDO QUALIFICADOR VAZIO");
  });

  // Os três endpoints montam o prompt dentro do handler HTTP e não expõem
  // builder puro — a fiação é verificada na fonte, que é o que impede a linha
  // de sumir num refactor futuro.
  it.each([
    "src/routes/api/generate-pu-copy.ts",
    "src/routes/api/generate-caption.ts",
    "src/routes/api/regenerate-block.ts",
  ])("%s injeta FECHO_GENERICO_RULE no prompt", (arquivo) => {
    const fonte = readFileSync(resolve(process.cwd(), arquivo), "utf8");
    expect(fonte).toContain("FECHO_GENERICO_RULE");
    expect(fonte).toContain("${FECHO_GENERICO_RULE}");
  });

  it("a PU mantém intencaoRegraApoio como ÚLTIMA linha, depois do fecho", () => {
    // Contrato de posição travado em intencao.test.ts — a regra nova entra
    // ANTES dela, nunca depois.
    const fonte = readFileSync(
      resolve(process.cwd(), "src/routes/api/generate-pu-copy.ts"),
      "utf8",
    );
    const posFecho = fonte.indexOf("${FECHO_GENERICO_RULE}");
    const posApoio = fonte.indexOf("${intencaoRegraApoio}`;");
    expect(posFecho).toBeGreaterThan(-1);
    expect(posApoio).toBeGreaterThan(posFecho);
  });

  it("a legenda tem o degrau de retry interno (não consome regeneração do plano)", () => {
    const fonte = readFileSync(
      resolve(process.cwd(), "src/routes/api/generate-caption.ts"),
      "utf8",
    );
    expect(fonte).toContain("checkFechoGenerico(rawTexto)");
  });

  it("o regenerate-block não repete a regra no título, que já tem a sua", () => {
    const fonte = readFileSync(
      resolve(process.cwd(), "src/routes/api/regenerate-block.ts"),
      "utf8",
    );
    expect(fonte).toContain('kind === "titulo" ? "" : `\\n${FECHO_GENERICO_RULE}`');
  });
});
