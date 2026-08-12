import { describe, it, expect } from "vitest";
import {
  buildClarezaCameraLine,
  EIXO_DISTANCIA_CLAREZA,
  EIXO_ALTURA_CLAREZA,
  EIXO_OTICA_CLAREZA,
  EIXO_PROFUNDIDADE_CLAREZA,
  EIXO_LUZ_CLAREZA,
  distanciaPreservaOAvatar,
} from "../core/cameraAxes";
import { buildVisualDirectionBlock, buildMoodGrammarBlock } from "../core/visualDirection";
import { pickImageVariationBlock } from "../core/imageVariationPicker";

// Origem (12/08/2026): a câmera do CLAREZA eram 2 frases que diziam a MESMA
// coisa em quase tudo — 50mm, plano médio ou americano, altura dos olhos —,
// variando só frontal × 3/4 lateral. Distância, altura, lente, profundidade e
// luz ficavam congeladas, e é esse conjunto que faz duas peças parecerem a
// mesma foto (project-moods-rodizio-fase1).
//
// Estes testes seguem a lição de feedback-medir-conteudo-nao-contar-distintos:
// contar strings distintas não é verificar. Aqui se valida o CONTEÚDO — que
// cada eixo percorre a faixa inteira, que nenhum item some, que nada sai
// "undefined" (a classe do P0 de 11/08) e que a faixa não invade o que a
// gramática do mood proíbe.

const CICLO = 12; // mmc dos tamanhos de pool (4·3·3·2·3 → lcm = 12)

const linhasDoCiclo = (hasAvatarRef = false) =>
  Array.from({ length: CICLO }, (_, seed) => buildClarezaCameraLine({ seed, hasAvatarRef }));

describe("CLAREZA — a câmera é composta pelos cinco eixos", () => {
  it("toda linha traz os cinco eixos, na ordem", () => {
    const linha = buildClarezaCameraLine({ seed: 0 });
    const partes = linha.split(" · ");
    expect(partes).toHaveLength(5);
    expect(EIXO_DISTANCIA_CLAREZA).toContain(partes[0]);
    expect(EIXO_ALTURA_CLAREZA).toContain(partes[1]);
    expect(EIXO_OTICA_CLAREZA).toContain(partes[2]);
    expect(EIXO_PROFUNDIDADE_CLAREZA).toContain(partes[3]);
    expect(EIXO_LUZ_CLAREZA).toContain(partes[4]);
  });

  it("nenhuma linha sai com buraco — sem 'undefined' em nenhuma posição da fila", () => {
    // 200 posições, muito além do ciclo: é a cauda que o snapshot com random
    // mockado em 0 não enxerga, e foi ali que o P0 de 11/08 se escondeu.
    for (let seed = 0; seed < 200; seed++) {
      expect(buildClarezaCameraLine({ seed })).not.toContain("undefined");
      expect(buildClarezaCameraLine({ seed, hasAvatarRef: true })).not.toContain("undefined");
    }
  });

  it("sem seed continua sorteando, e também sem buraco", () => {
    for (let i = 0; i < 200; i++) {
      const linha = buildClarezaCameraLine({});
      expect(linha).not.toContain("undefined");
      expect(linha.split(" · ")).toHaveLength(5);
    }
  });
});

describe("CLAREZA — cada eixo percorre a faixa inteira antes de repetir", () => {
  const eixos: Array<[string, string[], number]> = [
    ["distância", EIXO_DISTANCIA_CLAREZA, 0],
    ["altura", EIXO_ALTURA_CLAREZA, 1],
    ["ótica", EIXO_OTICA_CLAREZA, 2],
    ["profundidade", EIXO_PROFUNDIDADE_CLAREZA, 3],
    ["luz", EIXO_LUZ_CLAREZA, 4],
  ];

  eixos.forEach(([nome, pool, posicao]) => {
    it(`o eixo de ${nome} usa TODOS os seus itens dentro de um ciclo`, () => {
      const usados = new Set(linhasDoCiclo().map((l) => l.split(" · ")[posicao]));
      expect(usados.size).toBe(pool.length);
      pool.forEach((item) => expect(usados.has(item)).toBe(true));
    });
  });

  it("duas gerações consecutivas não repetem NENHUM eixo", () => {
    const linhas = linhasDoCiclo();
    for (let i = 1; i < linhas.length; i++) {
      const anterior = linhas[i - 1].split(" · ");
      const atual = linhas[i].split(" · ");
      atual.forEach((valor, eixo) => expect(valor).not.toBe(anterior[eixo]));
    }
  });

  it("a combinação inteira só se repete depois do ciclo completo", () => {
    const linhas = linhasDoCiclo();
    expect(new Set(linhas).size).toBe(CICLO);
  });
});

describe("CLAREZA — a faixa respeita a gramática do mood", () => {
  it("nenhum eixo introduz ângulo dramático, que é IMPACTO ou DESVIO", () => {
    const tudo = [...EIXO_ALTURA_CLAREZA, ...EIXO_DISTANCIA_CLAREZA].join(" ").toLowerCase();
    expect(tudo).not.toContain("dutch");
    expect(tudo).not.toContain("holandes");
    expect(tudo).not.toContain("rasante ao chão");
    // Plongée e contra-plongée existem na faixa, mas só na forma suave.
    EIXO_ALTURA_CLAREZA.filter((a) => /plong/i.test(a)).forEach((a) => {
      expect(a).toMatch(/suave|discreto/i);
      expect(a).toMatch(/NUNCA/);
    });
  });

  it("a profundidade não chega a bokeh derretido — o ambiente é parte do mood", () => {
    const derretido = EIXO_PROFUNDIDADE_CLAREZA.filter((p) => !/NUNCA fundo derretido/.test(p));
    derretido.forEach((p) => expect(p).not.toMatch(/derretido|bokeh forte/i));
  });

  it("a luz continua na família difusa e suave, sem contraste dramático", () => {
    EIXO_LUZ_CLAREZA.forEach((l) => expect(l).toMatch(/difusa|alta-chave/i));
    expect(EIXO_LUZ_CLAREZA.join(" ")).not.toMatch(/contraste pronunciado|low-key|recortada/i);
    // Sombra dura só pode aparecer negada — "ainda sem nenhuma sombra dura".
    EIXO_LUZ_CLAREZA.filter((l) => /sombra dura/i.test(l)).forEach((l) =>
      expect(l).toMatch(/sem nenhuma sombra dura/i),
    );
  });

  it("a lente fica dentro da faixa 35-85mm declarada na assinatura do mood", () => {
    EIXO_OTICA_CLAREZA.forEach((o) => expect(o).toMatch(/\b(35|50|85)mm\b/));
  });
});

describe("CLAREZA — avatar marcado tira o plano geral da faixa", () => {
  it("o filtro é por marcador de texto, nunca por índice", () => {
    expect(EIXO_DISTANCIA_CLAREZA.filter(distanciaPreservaOAvatar)).toHaveLength(
      EIXO_DISTANCIA_CLAREZA.length - 1,
    );
    expect(EIXO_DISTANCIA_CLAREZA.some((d) => !distanciaPreservaOAvatar(d))).toBe(true);
  });

  it("com avatar, nenhuma posição da fila devolve plano geral", () => {
    linhasDoCiclo(true).forEach((l) => expect(l).not.toContain("PLANO GERAL"));
  });

  it("sem avatar, o plano geral continua na faixa", () => {
    expect(linhasDoCiclo().some((l) => l.includes("PLANO GERAL"))).toBe(true);
  });

  it("as outras três distâncias continuam disponíveis com avatar", () => {
    const usadas = new Set(linhasDoCiclo(true).map((l) => l.split(" · ")[0]));
    expect(usadas.size).toBe(EIXO_DISTANCIA_CLAREZA.length - 1);
  });
});

describe("CLAREZA — os dois motores recebem a câmera nova", () => {
  it("MOP: o bloco de direção visual traz os cinco eixos", () => {
    const bloco = buildVisualDirectionBlock("OP-01", "SERVIÇOS", 0);
    expect(bloco).toContain("• Câmera: ");
    expect(bloco).toContain(EIXO_OTICA_CLAREZA[0].slice(0, 20));
    expect(bloco).toContain("VARIAÇÕES SORTEADAS");
  });

  it("PU: o picker de imagem traz os cinco eixos", () => {
    const bloco = pickImageVariationBlock({ mood: "OP-01", seed: 0 });
    expect(bloco).toContain("Câmera: ");
    expect(bloco.split(" · ").length).toBeGreaterThanOrEqual(5);
  });

  it("PU: com avatar, o picker não devolve plano geral em nenhuma posição", () => {
    for (let seed = 0; seed < CICLO; seed++) {
      const bloco = pickImageVariationBlock({ mood: "OP-01", seed, hasAvatarRef: true });
      expect(bloco).not.toContain("PLANO GERAL");
    }
  });
});

describe("CLAREZA — precedência de plano agora é necessária nos dois motores", () => {
  // Com a distância variando, câmera e pose declaram plano de forma
  // independente e podem discordar — o mesmo conflito que o INSTANTE já tinha.
  // Antes disso a trava do mood resolvia sozinha; agora precisa ser dita.
  it("MOP: o bloco declara a precedência da câmera sobre a pose", () => {
    const bloco = buildVisualDirectionBlock("OP-01", "SERVIÇOS", 0);
    expect(bloco).toContain("PRECEDÊNCIA DE ENQUADRAMENTO NESTA PEÇA");
  });

  it("MOP: e declara que o arco vence a câmera na distância", () => {
    const bloco = buildVisualDirectionBlock("OP-01", "SERVIÇOS", 0);
    expect(bloco).toContain("PRECEDÊNCIA ENTRE A CÂMERA SORTEADA E O ARCO VISUAL");
    expect(bloco).toContain("arco > câmera > pose");
  });

  it("PU: o picker declara a precedência quando há câmera e pose juntas", () => {
    const bloco = pickImageVariationBlock({ mood: "OP-01", seed: 0 });
    expect(bloco).toContain("PRECEDÊNCIA DE ENQUADRAMENTO NESTA PEÇA");
  });
});

describe("CLAREZA — a trava de plano virou regra de rosto", () => {
  it("o mood não fixa mais o enquadramento na cintura", () => {
    const bloco = buildMoodGrammarBlock("OP-01");
    expect(bloco).not.toContain("PLANO MÉDIO EM CLAREZA — OBRIGATÓRIO");
    expect(bloco).not.toContain("o enquadramento vai da cintura ou quadril ao TOPO DA CABEÇA");
  });

  it("mas a cabeça continua inteira no quadro, em qualquer distância", () => {
    const bloco = buildMoodGrammarBlock("OP-01");
    expect(bloco).toContain("ROSTO INTEIRO EM CLAREZA — INEGOCIÁVEL");
    expect(bloco).toContain("em QUALQUER distância de câmera");
    expect(bloco).toContain("PROIBIDO cortar no pescoço, no queixo, na testa");
  });

  it("o plano próximo carrega a proteção do rosto na própria descrição", () => {
    const proximo = EIXO_DISTANCIA_CLAREZA.find((d) => d.startsWith("PLANO PRÓXIMO"));
    expect(proximo).toBeDefined();
    expect(proximo).toContain("CABEÇA INTEIRA dentro do quadro");
  });
});
