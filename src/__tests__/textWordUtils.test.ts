import { describe, it, expect } from "vitest";
import { truncateWords, checkDanglingEnding } from "@/core/textWordUtils";

const ultima = (s: string) => s.trim().split(/\s+/).filter(Boolean).slice(-1)[0];

describe("truncateWords — a palavra pendurada depois do corte", () => {
  // O caso real: peça 3F do piloto de intenção saiu com o apoio
  // "…chegando nos seus canais digitais todos." O texto tinha 15 palavras
  // ("todos os dias"), o corte em 14 parou em "todos os", a limpeza tirou o
  // "os" e devolveu o quantificador órfão — que depois ainda ganhou ponto
  // final em generate-pu-copy.ts.
  it("não deixa quantificador órfão quando o corte cai em 'todos os dias'", () => {
    const texto =
      "Anúncios digitais bem feitos levam gente nova chegando nos seus canais digitais todos os dias";
    const cortado = truncateWords(texto, 14);
    expect(ultima(cortado)).not.toBe("todos");
    expect(ultima(cortado)).not.toBe("os");
    expect(cortado).toBe(
      "Anúncios digitais bem feitos levam gente nova chegando nos seus canais digitais",
    );
  });

  it("repete a limpeza — tirar uma palavra expõe a de trás", () => {
    // "com a" no fim: remover só "a" deixaria "com", que também pende.
    expect(
      ultima(truncateWords("um dois três quatro cinco seis sete oito nove dez com a mais", 12)),
    ).toBe("dez");
  });

  it("preserva o quantificador quando ele vem depois de preposição", () => {
    // "para todos" fecha frase; "digitais todos" não. A diferença é a
    // preposição antes — sem ela o corte comeria texto bom.
    const texto = "Um jeito simples de mostrar o trabalho que a equipe faz bem para todos hoje";
    expect(truncateWords(texto, 14)).toBe(
      "Um jeito simples de mostrar o trabalho que a equipe faz bem para todos",
    );
  });

  it("continua removendo contração de preposição+artigo no fim", () => {
    const texto =
      "O time monta a campanha completa e acompanha todo o resultado que aparece na loja";
    expect(ultima(truncateWords(texto, 14))).toBe("aparece");
  });

  it("não mexe em texto dentro do limite", () => {
    expect(truncateWords("Reunião presencial resolve na hora", 14)).toBe(
      "Reunião presencial resolve na hora",
    );
  });

  it("prefere cortar em limite de frase completa dentro do trecho", () => {
    expect(
      truncateWords("Chegou hoje. Vale a pena olhar antes que acabe o lote desta semana", 12),
    ).toBe("Chegou hoje.");
  });

  it("nunca devolve vazio, mesmo se o trecho inteiro for palavra pendurada", () => {
    expect(truncateWords("para de com em na e", 5)).not.toBe("");
  });
});

describe("checkDanglingEnding — acento e quantificador", () => {
  // A lista guardava a forma acentuada e a comparação era feita sem acento:
  // nove entradas nunca batiam.
  it.each(["até", "após", "são", "será", "serão", "tão", "vão", "então", "porém"])(
    "acusa fim em '%s', que a lista tinha e a comparação sem acento nunca alcançava",
    (palavra) => {
      expect(checkDanglingEnding(`A entrega da loja fica pronta ${palavra}`)).toBeTruthy();
    },
  );

  it("acusa quantificador órfão mesmo com ponto final já aplicado", () => {
    expect(checkDanglingEnding("Gente nova chegando nos seus canais digitais todos.")).toBeTruthy();
  });

  it("não acusa quantificador depois de preposição", () => {
    expect(checkDanglingEnding("Um preço que serve para todos.")).toBeNull();
    expect(checkDanglingEnding("A mesma atenção para ambos.")).toBeNull();
  });

  it("acusa 'cada', 'qualquer' e 'quaisquer' mesmo depois de preposição", () => {
    expect(checkDanglingEnding("Um atendimento pensado para cada.")).toBeTruthy();
    expect(checkDanglingEnding("Serve para qualquer.")).toBeTruthy();
  });
});

describe("invariante — o corte não produz o que a detecção acusa", () => {
  const corpus = [
    "Anúncios digitais bem feitos levam gente nova chegando nos seus canais digitais todos os dias",
    "O time monta a campanha completa e acompanha todo o resultado que aparece na loja",
    "Aqui você fala direto com quem monta as suas campanhas do começo ao fim sempre",
    "Cuidar do dia a dia online é o que mantém o telefone tocando por aqui",
    "A reunião presencial tira a dúvida na hora e evita a troca de mensagens até",
    "Cada peça sai revisada por duas pessoas antes de ir para o ar em qualquer",
  ];
  it.each(corpus)("corta sem deixar ponta pendurada: %s", (texto) => {
    for (const max of [6, 8, 10, 12, 14]) {
      const cortado = truncateWords(texto, max);
      const motivo = checkDanglingEnding(cortado);
      // Só interessa o motivo de PALAVRA — falta de pontuação final é
      // esperada num trecho cortado e é tratada por quem chama.
      expect(motivo === null || !motivo.includes("sugere frase incompleta")).toBe(true);
    }
  });
});

// Achado do teste ao vivo de 18/08 (caso 3 do marcador temporal): o apoio
// "…e sempre cabe mais uma dúvida no mesmo." saiu publicado. São 14 palavras
// exatas, e "…no mesmo encontro." cortado em 14 devolve essa frase letra por
// letra — o corte comeu o substantivo e nem o corte nem a detecção acusaram.
// Terceira vez que a mesma invariante é violada por um token fora das listas
// (as duas primeiras estão no commit 9fd9333).
describe("preposição + mesmo/mesma nunca fecha frase", () => {
  it("acusa a frase real que foi ao ar", () => {
    expect(
      checkDanglingEnding(
        "Aqui a conversa começa quando precisar e sempre cabe mais uma dúvida no mesmo.",
      ),
    ).toBeTruthy();
  });

  it.each([
    "A troca acontece no mesmo",
    "Resolvemos tudo ao mesmo",
    "A peça sai da mesma",
    "Entregamos pelo mesmo",
    "Trabalhamos do mesmo",
  ])("acusa: %s", (t) => {
    expect(checkDanglingEnding(t)).toBeTruthy();
  });

  it.each([
    // uso ADVERBIAL de "mesmo" fecha frase, e a palavra antes nunca é preposição
    "O conserto funciona mesmo",
    "O preço é bom mesmo",
    "A segunda pessoa faz o mesmo",
    "Vale a pena mesmo",
  ])("não acusa: %s", (t) => {
    expect(checkDanglingEnding(t)).toBeNull();
  });

  it("o corte não devolve o que a detecção acusa — a invariante do 9fd9333", () => {
    const cortado = truncateWords(
      "Aqui a conversa começa quando precisar e sempre cabe mais uma dúvida no mesmo encontro.",
      14,
    );
    expect(checkDanglingEnding(cortado)).toBeNull();
    expect(cortado.endsWith("no mesmo")).toBe(false);
  });
});
