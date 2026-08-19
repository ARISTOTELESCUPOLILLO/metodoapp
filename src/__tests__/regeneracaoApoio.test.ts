import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { checkExcessoPalavras, truncateWords } from "../core/textWordUtils";
import { checkExcessoPalavras as checkPelaFachada } from "../core/textValidation";

// Duas frentes da fila de 18/08 fechadas em 19/08 por decisão do Ari:
//
// 1. O CORTE DEIXOU DE SER MUDO. O apoio do PU vinha sendo truncado em 14
//    palavras sem que ninguém soubesse — a frase saía gramatical (a poda de
//    palavra pendurada garante isso desde 18/08) mas podia ter perdido o que ia
//    dizer. Caso 3 do teste daquela noite: "…sempre cabe mais uma dúvida no
//    mesmo encontro." chegou ao usuário como "…no mesmo." e o apoio não pôde
//    ser lido. Agora o excesso vira flag D1 e a orquestração (E3) pede outro
//    texto; o corte continua como rede.
//
// 2. A MANIFESTAÇÃO CHEGOU AO "GERAR OUTRO TEXTO". A peça nascia com a regra
//    (generate-pu-copy) e a perdia ao regenerar, porque regenerate-block nunca
//    a recebeu.

describe("checkExcessoPalavras — o corte avisa antes de cortar", () => {
  it("no limite exato não acusa nada", () => {
    const catorze = "uma duas tres quatro cinco seis sete oito nove dez onze doze treze catorze";
    expect(checkExcessoPalavras(catorze, 14)).toBeNull();
  });

  it("uma palavra acima acusa, com a contagem real", () => {
    const quinze =
      "uma duas tres quatro cinco seis sete oito nove dez onze doze treze catorze quinze";
    const motivo = checkExcessoPalavras(quinze, 14);
    expect(motivo).toContain("15 palavras");
    expect(motivo).toContain("máximo de 14");
  });

  it("o motivo diz o que fazer, não só o que está errado", () => {
    const motivo = checkExcessoPalavras("a b c d e f g h i j k l m n o p", 14);
    expect(motivo).toContain("reescreva dentro do limite");
  });

  // A contagem TEM de ser a mesma de truncateWords: se acusasse um excesso que
  // o corte não vê, a peça pediria regeneração (dinheiro) sem nada ter sido
  // cortado; se não acusasse um que ele vê, o defeito voltaria calado.
  it("acusa exatamente quando truncateWords muda o texto — o caso real de 18/08", () => {
    const caso3 =
      "Aqui a conversa comeca quando precisar e sempre cabe mais uma duvida no mesmo encontro";
    expect(truncateWords(caso3, 14)).not.toBe(caso3.trim());
    expect(checkExcessoPalavras(caso3, 14)).not.toBeNull();
  });

  it.each([
    ["", 14],
    ["frase curta", 14],
    ["a b c d e f g h i j k l m n", 14],
  ])("nao acusa o que cabe: %s", (texto, max) => {
    expect(truncateWords(texto, max)).toBe(texto.trim());
    expect(checkExcessoPalavras(texto, max)).toBeNull();
  });

  it("está na fachada de textValidation, que é por onde as rotas importam", () => {
    expect(checkPelaFachada).toBe(checkExcessoPalavras);
  });
});

// Os endpoints montam o prompt dentro do handler HTTP e não expõem builder puro
// — a fiação é verificada na fonte, mesmo padrão de fechoGenerico.test.ts. É o
// que impede a linha de sumir num refactor futuro.
describe("fiação do corte sinalizado", () => {
  it("generate-pu-copy mede o texto BRUTO, antes do corte", () => {
    const fonte = readFileSync(
      resolve(process.cwd(), "src/routes/api/generate-pu-copy.ts"),
      "utf8",
    );
    const posMedida = fonte.indexOf("checkExcessoPalavras(textoBruto, 14)");
    const posCorte = fonte.indexOf("truncateWords(textoBruto, 14)");
    expect(posMedida).toBeGreaterThan(-1);
    expect(posCorte).toBeGreaterThan(posMedida);
    expect(fonte).toContain('flags.push({ campo: "copy.texto", motivo: excessoApoio })');
  });

  it("regenerate-block também sinaliza — senão a 2ª volta cortava calada", () => {
    const fonte = readFileSync(
      resolve(process.cwd(), "src/routes/api/regenerate-block.ts"),
      "utf8",
    );
    expect(fonte).toContain("checkExcessoPalavras(value, rule.max)");
    expect(fonte).toContain("if (excessoApoio) motivos.push(excessoApoio)");
  });

  // O MOP não entra: o corte dele (12 palavras) nunca foi medido, e ligar a
  // regeneração lá mudaria custo e comportamento sem falha observada.
  it("o sinal é só do PU — o MOP continua como sempre esteve", () => {
    const fonte = readFileSync(
      resolve(process.cwd(), "src/routes/api/regenerate-block.ts"),
      "utf8",
    );
    expect(fonte).toContain('(formato || "").toLowerCase().startsWith("postunico")');
  });
});

describe("fiação da manifestação no 'Gerar outro'", () => {
  const fonte = () =>
    readFileSync(resolve(process.cwd(), "src/routes/api/regenerate-block.ts"), "utf8");

  it("o apoio regenerado recebe buildIntencaoRegraApoio, com a informação-chave", () => {
    const src = fonte();
    expect(src).toContain("buildIntencaoRegraApoio");
    expect(src).toContain('apoio: "texto"');
  });

  it("a legenda regenerada recebe buildIntencaoRegraLegenda", () => {
    expect(fonte()).toContain("buildIntencaoRegraLegenda");
  });

  // Mesmo contrato de posição travado em intencao.test.ts: a regra FECHA o
  // bloco de regras, depois do fecho genérico e antes do schema JSON.
  it("a regra fecha o prompt — depois do fecho genérico, antes do 'Retorne JSON'", () => {
    const src = fonte();
    const posFecho = src.indexOf("${FECHO_GENERICO_RULE}`}");
    const posManifestacao = src.indexOf("${intencaoRegraManifestacao}");
    const posSchema = src.indexOf("Retorne JSON EXATAMENTE assim");
    expect(posFecho).toBeGreaterThan(-1);
    expect(posManifestacao).toBeGreaterThan(posFecho);
    expect(posSchema).toBeGreaterThan(posManifestacao);
  });

  // O título tem a virada obrigatória e o elemento concreto a preservar — a
  // manifestação nunca entrou lá, nem no generate-pu-copy nem aqui.
  it("o título não recebe manifestação", () => {
    const src = fonte();
    const trecho = src.slice(
      src.indexOf("const intencaoRegraManifestacao"),
      src.indexOf("const apiKey"),
    );
    expect(trecho).toContain('kind === "texto"');
    expect(trecho).toContain('kind === "legenda"');
    expect(trecho).not.toContain('kind === "titulo"');
  });
});
