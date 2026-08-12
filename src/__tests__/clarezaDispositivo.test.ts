import { describe, it, expect } from "vitest";
import { buildMoodGrammarBlock, buildVisualDirectionBlock } from "../core/visualDirection";
import {
  MOOD_RULES,
  CLAREZA_DEVICE_WELCOME_SENTENCE,
  CLAREZA_MATERIAL_TRABALHO_SENTENCE,
} from "../core/visualDirection.lexicon";

// Origem (12/08/2026): decisão do Aristóteles de tirar o "laptop obrigatório"
// do CLAREZA. A regra "papel DEVE coexistir com pelo menos 1 dispositivo
// digital" era a origem do notebook em quase toda peça. Ela saiu — mas o
// dispositivo continua BEM-VINDO em qualquer negócio (o ofício de agência
// passa por tela), e a trava que impede conteúdo na TELA/TAMPA/CARCAÇA, que
// custou muito tempo para acertar, NÃO podia sair junto.
//
// Estes testes existem porque as duas coisas moram na MESMA regra do mood: um
// corte grosseiro na frase de dispositivo do CLAREZA levaria a trava embora
// sem erro de compilação e sem sintoma até a próxima geração paga.

const OBRIGACAO_REMOVIDA = "DEVE coexistir com pelo menos 1 dispositivo digital";
const TRAVA_CARCACA = "NA TELA FRONTAL, NA TAMPA ou NA CARCAÇA";
const TRAVA_NEGATIVE =
  "NEGATIVE: image on laptop screen, visible screen content, image on laptop lid or casing.";

describe("CLAREZA — dispositivo deixou de ser obrigatório", () => {
  it("PU: a gramática do mood não exige mais coexistência com dispositivo", () => {
    const bloco = buildMoodGrammarBlock("OP-01");
    expect(bloco).not.toContain(OBRIGACAO_REMOVIDA);
    expect(bloco).toContain("NÃO é obrigatório");
    expect(bloco).toContain("NÃO é preenchimento automático de mesa");
  });

  it("MOP: idem no motor de sequência, que lê MOOD_RULES por outro caminho", () => {
    const bloco = buildVisualDirectionBlock("OP-01", "SERVIÇOS");
    expect(bloco).not.toContain(OBRIGACAO_REMOVIDA);
    expect(bloco).toContain("NÃO é obrigatório");
  });

  it("o dispositivo continua bem-vindo — não virou proibição", () => {
    const bloco = buildMoodGrammarBlock("OP-01");
    expect(bloco).toContain("notebook, laptop e tablet SÃO BEM-VINDOS");
    expect(bloco).toContain("continua bem-vindo sempre que tiver função na ação");
  });

  it("o notebook em toda peça entrou na lista de vícios visuais do mood", () => {
    const bloco = buildMoodGrammarBlock("OP-01");
    expect(bloco).toContain(
      "notebook ou laptop presente em todas as peças como recurso automático",
    );
  });
});

describe("CLAREZA — trava de tela/tampa/carcaça sobrevive à mudança", () => {
  it("PU: a proibição de conteúdo em tela, tampa e carcaça continua no prompt", () => {
    const bloco = buildMoodGrammarBlock("OP-01");
    expect(bloco).toContain(TRAVA_CARCACA);
    expect(bloco).toContain("tampa e carcaça lisas");
    expect(bloco).toContain(TRAVA_NEGATIVE);
  });

  it("MOP: mesma trava presente no bloco de direção visual da sequência", () => {
    const bloco = buildVisualDirectionBlock("OP-01", "SERVIÇOS");
    expect(bloco).toContain(TRAVA_CARCACA);
    expect(bloco).toContain(TRAVA_NEGATIVE);
  });
});

describe("CLAREZA — supressão quando a regra global já baniu dispositivo", () => {
  it("troca a opção digital pela versão sem dispositivo, sem apagar o resto", () => {
    const bloco = buildMoodGrammarBlock("OP-01", { noDeviceThisScene: true });
    expect(bloco).toContain("SEM DISPOSITIVO NESTA PEÇA");
    expect(bloco).not.toContain("continua bem-vindo sempre que tiver função na ação");
    // O que não é sobre dispositivo tem de sobreviver à supressão — antes a
    // frase inteira era apagada e estas duas exigências iam junto.
    expect(bloco).toContain("OBJETO REAL DO OFÍCIO");
    expect(bloco).toContain("não elementos gráficos flutuantes");
  });

  it("a cláusula de dispositivo do mood cede lugar à exceção declarada", () => {
    const bloco = buildMoodGrammarBlock("OP-01", { noDeviceThisScene: true });
    expect(bloco).toContain("DISPOSITIVOS EM CLAREZA — EXCEÇÃO NESTA PEÇA");
    expect(bloco).not.toContain("notebook, laptop e tablet SÃO BEM-VINDOS");
  });
});

describe("CLAREZA — MOOD_RULES usa as constantes, não cópias literais", () => {
  // Até 12/08/2026 o texto destas duas sentenças estava escrito DUAS vezes: na
  // constante e, palavra por palavra, dentro de MOOD_RULES["OP-01"]. A
  // supressão é feita por String.replace da constante — bastava alguém
  // reescrever uma das cópias para o replace virar no-op silencioso: prompt
  // válido, sem erro, e com a frase errada. Mesma armadilha registrada em
  // paletaMoods.test.ts. Estes testes travam a fonte única.
  it("a sentença de dispositivo vem da constante", () => {
    expect(MOOD_RULES["OP-01"]).toContain(CLAREZA_DEVICE_WELCOME_SENTENCE);
  });

  it("a sentença de material de trabalho vem da constante", () => {
    expect(MOOD_RULES["OP-01"]).toContain(CLAREZA_MATERIAL_TRABALHO_SENTENCE);
  });
});
