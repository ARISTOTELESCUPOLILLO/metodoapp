import { describe, it, expect } from "vitest";
import {
  buildCameraLine,
  moodTemEixosDeCamera,
  distanciaPreservaOAvatar,
  EIXO_DISTANCIA_CLAREZA,
  EIXO_ALTURA_CLAREZA,
  EIXO_OTICA_CLAREZA,
  EIXO_PROFUNDIDADE_CLAREZA,
  EIXO_LUZ_CLAREZA,
  EIXO_CORPO_CLAREZA,
  EIXO_DISTANCIA_IMPACTO,
  EIXO_ALTURA_IMPACTO,
  EIXO_OTICA_IMPACTO,
  EIXO_PROFUNDIDADE_IMPACTO,
  EIXO_LUZ_IMPACTO,
  EIXO_DISTANCIA_SILENCIO,
  EIXO_ALTURA_SILENCIO,
  EIXO_OTICA_SILENCIO,
  EIXO_PROFUNDIDADE_SILENCIO,
  EIXO_LUZ_SILENCIO,
  EIXO_DISTANCIA_DESVIO,
  EIXO_ALTURA_DESVIO,
  EIXO_OTICA_DESVIO,
  EIXO_PROFUNDIDADE_DESVIO,
  EIXO_LUZ_DESVIO,
} from "../core/cameraAxes";
import { buildVisualDirectionBlock, buildMoodGrammarBlock } from "../core/visualDirection";
import { pickImageVariationBlock } from "../core/imageVariationPicker";
import { buildSemPersonagemVariationBlock } from "../core/semPersonagem";
import { MoodCode } from "../types";

// Origem (12/08/2026): os três moods com personagem central tinham a câmera
// praticamente parada. CLAREZA e IMPACTO: 2 opções cada, e as duas de cada mood
// diziam a MESMA coisa em quase tudo. SILÊNCIO: 4 frases que amarravam
// distância, altura e lente entre si, sem profundidade nem luz. É esse conjunto
// que faz duas peças parecerem a mesma foto (project-moods-rodizio-fase1).
//
// Estes testes seguem a lição de feedback-medir-conteudo-nao-contar-distintos:
// contar strings distintas não é verificar. Aqui se valida o CONTEÚDO — que
// cada eixo percorre a faixa inteira, que nada sai "undefined" (a classe do P0
// de 11/08) e que a faixa não invade o que a gramática do mood proíbe.

const CICLO = 12; // mmc dos tamanhos de pool nos três moods

interface CasoDeMood {
  mood: MoodCode;
  nome: string;
  eixos: string[][];
  filtraAvatar: boolean;
}

const MOODS: CasoDeMood[] = [
  {
    mood: "OP-01",
    nome: "CLAREZA",
    eixos: [
      EIXO_DISTANCIA_CLAREZA,
      EIXO_ALTURA_CLAREZA,
      EIXO_OTICA_CLAREZA,
      EIXO_PROFUNDIDADE_CLAREZA,
      EIXO_LUZ_CLAREZA,
      // Sexto eixo, só do CLAREZA — corpo de câmera e textura de acabamento,
      // acrescentado em 13/08/2026 a pedido do Aristóteles.
      EIXO_CORPO_CLAREZA,
    ],
    filtraAvatar: true,
  },
  {
    mood: "OP-02",
    nome: "IMPACTO",
    eixos: [
      EIXO_DISTANCIA_IMPACTO,
      EIXO_ALTURA_IMPACTO,
      EIXO_OTICA_IMPACTO,
      EIXO_PROFUNDIDADE_IMPACTO,
      EIXO_LUZ_IMPACTO,
    ],
    filtraAvatar: true,
  },
  {
    mood: "OP-06",
    nome: "SILÊNCIO",
    eixos: [
      EIXO_DISTANCIA_SILENCIO,
      EIXO_ALTURA_SILENCIO,
      EIXO_OTICA_SILENCIO,
      EIXO_PROFUNDIDADE_SILENCIO,
      EIXO_LUZ_SILENCIO,
    ],
    filtraAvatar: false,
  },
  {
    mood: "OP-05",
    nome: "DESVIO",
    eixos: [
      EIXO_DISTANCIA_DESVIO,
      EIXO_ALTURA_DESVIO,
      EIXO_OTICA_DESVIO,
      EIXO_PROFUNDIDADE_DESVIO,
      EIXO_LUZ_DESVIO,
    ],
    filtraAvatar: true,
  },
];

const linhasDoCiclo = (mood: MoodCode, hasAvatarRef = false) =>
  Array.from({ length: CICLO }, (_, seed) => buildCameraLine(mood, { seed, hasAvatarRef }));

describe("eixos de câmera — quais moods já foram decupados", () => {
  it("CLAREZA, IMPACTO, SILÊNCIO e DESVIO têm eixos; INSTANTE e FRAGMENTO seguem com pool de frase", () => {
    expect(moodTemEixosDeCamera("OP-01")).toBe(true);
    expect(moodTemEixosDeCamera("OP-02")).toBe(true);
    expect(moodTemEixosDeCamera("OP-05")).toBe(true);
    expect(moodTemEixosDeCamera("OP-06")).toBe(true);
    // INSTANTE fica fora por decisão do Aristóteles (aprovado em peça real);
    // FRAGMENTO porque roda por bloco dentro da mesma peça, caso diferente.
    expect(moodTemEixosDeCamera("OP-03")).toBe(false);
    expect(moodTemEixosDeCamera("OP-04")).toBe(false);
    expect(moodTemEixosDeCamera(undefined)).toBe(false);
  });

  it("mood sem eixos devolve vazio, para quem chama manter o pool antigo", () => {
    expect(buildCameraLine("OP-03", { seed: 0 })).toBe("");
    expect(buildCameraLine(undefined, { seed: 0 })).toBe("");
  });
});

MOODS.forEach(({ mood, nome, eixos, filtraAvatar }) => {
  describe(`${nome} — a câmera é composta pelos seus eixos`, () => {
    it("toda linha traz todos os eixos do mood, na ordem", () => {
      const partes = buildCameraLine(mood, { seed: 0 }).split(" · ");
      expect(partes).toHaveLength(eixos.length);
      partes.forEach((parte, i) => expect(eixos[i]).toContain(parte));
    });

    it("nenhuma linha sai com buraco — sem 'undefined' em nenhuma posição da fila", () => {
      // 200 posições, muito além do ciclo: é a cauda que o snapshot com random
      // mockado em 0 não enxerga, e foi ali que o P0 de 11/08 se escondeu.
      for (let seed = 0; seed < 200; seed++) {
        expect(buildCameraLine(mood, { seed })).not.toContain("undefined");
        expect(buildCameraLine(mood, { seed, hasAvatarRef: true })).not.toContain("undefined");
      }
    });

    it("sem seed continua sorteando, e também sem buraco", () => {
      for (let i = 0; i < 200; i++) {
        const linha = buildCameraLine(mood, {});
        expect(linha).not.toContain("undefined");
        expect(linha.split(" · ")).toHaveLength(eixos.length);
      }
    });
  });

  describe(`${nome} — cada eixo percorre a faixa inteira antes de repetir`, () => {
    ["distância", "altura", "ótica", "profundidade", "luz"].forEach((rotulo, posicao) => {
      it(`o eixo de ${rotulo} usa TODOS os seus itens dentro de um ciclo`, () => {
        const usados = new Set(linhasDoCiclo(mood).map((l) => l.split(" · ")[posicao]));
        expect(usados.size).toBe(eixos[posicao].length);
        eixos[posicao].forEach((item) => expect(usados.has(item)).toBe(true));
      });
    });

    it("duas gerações consecutivas não repetem NENHUM eixo", () => {
      const linhas = linhasDoCiclo(mood);
      for (let i = 1; i < linhas.length; i++) {
        const anterior = linhas[i - 1].split(" · ");
        linhas[i].split(" · ").forEach((valor, eixo) => expect(valor).not.toBe(anterior[eixo]));
      }
    });

    it("a combinação inteira só se repete depois do ciclo completo", () => {
      expect(new Set(linhasDoCiclo(mood)).size).toBe(CICLO);
    });
  });

  describe(`${nome} — contrato do avatar`, () => {
    if (filtraAvatar) {
      it("com avatar, a distância mais afastada sai da faixa", () => {
        linhasDoCiclo(mood, true).forEach((l) => expect(l).not.toMatch(/^PLANO (GERAL|ABERTO)\b/));
      });

      it("sem avatar, a distância mais afastada continua na faixa", () => {
        expect(linhasDoCiclo(mood).some((l) => /^PLANO (GERAL|ABERTO)\b/.test(l))).toBe(true);
      });

      it("as outras distâncias continuam disponíveis com avatar", () => {
        const usadas = new Set(linhasDoCiclo(mood, true).map((l) => l.split(" · ")[0]));
        expect(usadas.size).toBe(eixos[0].length - 1);
      });
    } else {
      it("SILÊNCIO não filtra: a escala pequena é do próprio mood, não do avatar", () => {
        expect(linhasDoCiclo(mood, true)).toEqual(linhasDoCiclo(mood, false));
      });
    }
  });
});

describe("o filtro de avatar é por marcador de texto, nunca por índice", () => {
  it("reconhece a distância afastada em CLAREZA e em IMPACTO", () => {
    expect(EIXO_DISTANCIA_CLAREZA.filter(distanciaPreservaOAvatar)).toHaveLength(
      EIXO_DISTANCIA_CLAREZA.length - 1,
    );
    expect(EIXO_DISTANCIA_IMPACTO.filter(distanciaPreservaOAvatar)).toHaveLength(
      EIXO_DISTANCIA_IMPACTO.length - 1,
    );
  });
});

// A trava do DESVIO é a mais delicada dos quatro moods decupados: as outras
// travas são violáveis por UM eixo (basta uma altura não-ascendente no IMPACTO,
// uma distância que aproxime demais no SILÊNCIO), mas a frontal neutra do DESVIO
// nasceria da COMBINAÇÃO — altura dos olhos + plano médio + 50mm + profundidade
// ampla, cada parte inocente sozinha. Por isso a não-neutralidade vive dentro do
// eixo de altura, e é isso que estes testes travam.
describe("DESVIO — a trava de não-neutralidade sobrevive a qualquer combinação", () => {
  it("TODA opção de altura é não-neutra por si — nenhuma frontal reta possível", () => {
    EIXO_ALTURA_DESVIO.forEach((altura) => {
      const naoNeutra =
        /contra-plong|plong|rasante|holandesa|dutch|rotacionado|lateral marcada|três-quartos|tres-quartos/i.test(
          altura,
        );
      expect(naoNeutra, `altura sem desvio próprio: ${altura}`).toBe(true);
    });
  });

  it("a única altura na linha dos olhos é a holandesa, e ela obriga a rotação do quadro", () => {
    const naLinhaDosOlhos = EIXO_ALTURA_DESVIO.filter((a) => /altura dos olhos/i.test(a));
    expect(naLinhaDosOlhos).toHaveLength(1);
    expect(naLinhaDosOlhos[0]).toMatch(/rotacionado/i);
    expect(naLinhaDosOlhos[0]).toMatch(/obrigat/i);
  });

  it("nenhuma linha do ciclo pode ser lida como enquadramento frontal neutro", () => {
    for (let seed = 0; seed < 120; seed++) {
      const linha = buildCameraLine("OP-05", { seed });
      const altura = linha.split(" · ")[1];
      expect(altura).toBeTruthy();
      // Se a altura é a da linha dos olhos, a rotação precisa vir junto na mesma
      // parte — é ela que quebra a neutralidade.
      if (/altura dos olhos/i.test(altura)) expect(altura).toMatch(/rotacionado/i);
    }
  });

  it("a ótica para em 50mm — teleobjetiva apagaria a distorção, que é gramática do mood", () => {
    EIXO_OTICA_DESVIO.forEach((o) => {
      expect(o).not.toMatch(/85mm|100mm|135mm/);
    });
    expect(EIXO_OTICA_DESVIO.join(" ")).toMatch(/28mm/);
    expect(EIXO_OTICA_DESVIO.join(" ")).toMatch(/50mm/);
  });

  it("a luz fica nas três direções que o próprio mood nomeia", () => {
    const tudo = EIXO_LUZ_DESVIO.join(" ").toLowerCase();
    expect(tudo).toMatch(/de baixo/);
    expect(tudo).toMatch(/contraluz|por trás|de trás/);
    expect(tudo).toMatch(/lateral extrema/);
    // Nada de alta-chave serena, que é SILÊNCIO, nem difusa neutra, que é CLAREZA.
    expect(tudo).not.toContain("alta-chave");
  });

  it("a distância mais afastada mantém a ruptura legível — ela é o ponto da peça", () => {
    const aberto = EIXO_DISTANCIA_DESVIO.filter((d) => /^PLANO ABERTO/.test(d));
    expect(aberto).toHaveLength(1);
    expect(aberto[0]).toMatch(/ruptura/i);
  });

  it("o ciclo do DESVIO é 60, não 12 — o eixo de altura tem 5 opções", () => {
    const linhas = Array.from({ length: 60 }, (_, seed) => buildCameraLine("OP-05", { seed }));
    expect(new Set(linhas).size).toBe(60);
  });
});

describe("CLAREZA — a faixa respeita a gramática do mood", () => {
  it("nenhum eixo introduz ângulo dramático, que é IMPACTO ou DESVIO", () => {
    const tudo = [...EIXO_ALTURA_CLAREZA, ...EIXO_DISTANCIA_CLAREZA].join(" ").toLowerCase();
    expect(tudo).not.toContain("dutch");
    expect(tudo).not.toContain("holandes");
    expect(tudo).not.toContain("rasante ao chão");
    EIXO_ALTURA_CLAREZA.filter((a) => /plong/i.test(a)).forEach((a) => {
      expect(a).toMatch(/suave|discreto/i);
      expect(a).toMatch(/NUNCA/);
    });
  });

  it("a profundidade não chega a bokeh derretido — o ambiente é parte do mood", () => {
    EIXO_PROFUNDIDADE_CLAREZA.filter((p) => !/NUNCA fundo derretido/.test(p)).forEach((p) =>
      expect(p).not.toMatch(/derretido|bokeh forte/i),
    );
  });

  it("a luz continua na família difusa e suave, sem contraste dramático", () => {
    // "dia nublado" entrou em 13/08/2026: é a mesma família (fonte ampla,
    // sem direção marcada), sem a palavra "difusa" no texto.
    EIXO_LUZ_CLAREZA.forEach((l) => expect(l).toMatch(/difusa|alta-chave|nublado/i));
    expect(EIXO_LUZ_CLAREZA.join(" ")).not.toMatch(/contraste pronunciado|low-key|recortada/i);
    EIXO_LUZ_CLAREZA.filter((l) => /sombra dura/i.test(l)).forEach((l) =>
      expect(l).toMatch(/sem nenhuma sombra dura/i),
    );
  });

  it("a lente fica dentro da faixa 35-85mm declarada na assinatura do mood", () => {
    // 70mm entrou em 13/08/2026 — dentro da faixa, entre a neutralidade do 50 e
    // a compressão do 85. A checagem virou numérica para não precisar crescer a
    // lista literal a cada focal nova.
    EIXO_OTICA_CLAREZA.forEach((o) => {
      const mm = Number(o.match(/\b(\d+)mm\b/)?.[1]);
      expect(mm, o).toBeGreaterThanOrEqual(35);
      expect(mm, o).toBeLessThanOrEqual(85);
    });
  });
});

describe("IMPACTO — o contra-plongée obrigatório do mood continua valendo", () => {
  // IMPACTO_CAMERA_SENTENCE declara "OBRIGATÓRIO contra-plongée leve ou 3/4
  // dinâmico, PROIBIDO frontal reta na altura dos olhos, PROIBIDO plongée".
  // Isso é gramática — a força dramática vem do ângulo ascendente — e o eixo de
  // altura varia DENTRO dela.
  it("toda altura é ângulo ascendente ou 3/4 partindo de baixo", () => {
    EIXO_ALTURA_IMPACTO.forEach((a) =>
      expect(a).toMatch(/contra-plongée|abaixo da linha dos olhos/i),
    );
  });

  it("nenhuma altura é plongée nem frontal reta na altura dos olhos", () => {
    // "contra-plongée" contém "plongée" — o hífen é fronteira de palavra, então
    // o único jeito honesto de testar é remover o "contra-" antes de procurar.
    EIXO_ALTURA_IMPACTO.forEach((a) =>
      expect(a.toLowerCase().replace(/contra-plongée/g, "")).not.toContain("plongée"),
    );
    const tudo = EIXO_ALTURA_IMPACTO.join(" ").toLowerCase();
    expect(tudo).not.toContain("nivelada");
    expect(tudo).not.toContain("acima da linha dos olhos");
  });

  it("a regra inegociável do mood não mudou", () => {
    const bloco = buildMoodGrammarBlock("OP-02");
    expect(bloco).toContain("CÂMERA EM IMPACTO: OBRIGATÓRIO contra-plongée leve ou ângulo 3/4");
    expect(bloco).toContain("PROIBIDO plongée de cima para baixo");
  });

  it("a luz continua focal e direcional sobre fundo escuro", () => {
    EIXO_LUZ_IMPACTO.forEach((l) => expect(l).toMatch(/direcional|contraluz|dura|escuro/i));
    expect(EIXO_LUZ_IMPACTO.join(" ")).not.toMatch(/alta-chave|difusa e envolvente/i);
  });

  it("a lente fica dentro da faixa 35-85mm declarada na assinatura do mood", () => {
    EIXO_OTICA_IMPACTO.forEach((o) => expect(o).toMatch(/\b(35|50|85)mm\b/));
  });
});

describe("SILÊNCIO — a trava de escala do mood continua valendo", () => {
  // SILENCIO_ESCALA_SENTENCE exige sujeito em no máximo 30% do quadro. É a
  // identidade do mood ("o espaço vazio É a mensagem") e não foi tocada — cada
  // distância precisa dizer que o sujeito permanece pequeno, senão as duas
  // instruções competem dentro do mesmo prompt.
  it("toda distância declara que o sujeito continua pequeno no quadro", () => {
    EIXO_DISTANCIA_SILENCIO.forEach((d) =>
      expect(d).toMatch(/discreta|pequeno|mínimo|reduzido|quase perdido/i),
    );
  });

  it("a regra de espaço negativo do mood não mudou", () => {
    const bloco = buildMoodGrammarBlock("OP-06");
    expect(bloco).toContain("ESPAÇO NEGATIVO OBRIGATÓRIO");
    expect(bloco).toContain("NO MÁXIMO 30% da área total");
  });

  it("nenhum eixo introduz dramaticidade — o mood é sereno por definição", () => {
    const tudo = [...EIXO_ALTURA_SILENCIO, ...EIXO_LUZ_SILENCIO, ...EIXO_PROFUNDIDADE_SILENCIO]
      .join(" ")
      .toLowerCase();
    expect(tudo).not.toContain("dutch");
    expect(tudo).not.toContain("contraste pronunciado");
    expect(tudo).not.toContain("sombra dura");
    EIXO_LUZ_SILENCIO.forEach((l) => expect(l).toMatch(/difusa|alta-chave/i));
  });

  it("a lente fica dentro da faixa 50-100mm declarada na assinatura do mood", () => {
    EIXO_OTICA_SILENCIO.forEach((o) => expect(o).toMatch(/\b(50|70|100)mm\b/));
  });
});

describe("os motores recebem a câmera nova", () => {
  it("MOP: CLAREZA e SILÊNCIO trazem os eixos no bloco de direção visual", () => {
    (["OP-01", "OP-06"] as const).forEach((m) => {
      const bloco = buildVisualDirectionBlock(m, "SERVIÇOS", 0);
      expect(bloco).toContain("• Câmera: ");
      expect(bloco).toContain(" · ");
      expect(bloco).toContain("VARIAÇÕES SORTEADAS");
    });
  });

  it("PU: os três moods trazem os eixos no picker de imagem", () => {
    MOODS.forEach(({ mood }) => {
      const bloco = pickImageVariationBlock({ mood, seed: 0 });
      expect(bloco).toContain("Câmera: ");
      expect(bloco.split(" · ").length).toBeGreaterThanOrEqual(5);
    });
  });

  it("PU: com avatar, CLAREZA e IMPACTO não devolvem a distância afastada", () => {
    (["OP-01", "OP-02"] as const).forEach((mood) => {
      for (let seed = 0; seed < CICLO; seed++) {
        const bloco = pickImageVariationBlock({ mood, seed, hasAvatarRef: true });
        expect(bloco).not.toContain("PLANO GERAL:");
        expect(bloco).not.toContain("PLANO ABERTO:");
      }
    });
  });

  it("peça sem personagem: SILÊNCIO passou a compor pelos eixos", () => {
    const bloco = buildSemPersonagemVariationBlock("OP-06");
    expect(bloco).toContain("Câmera: ");
    expect(bloco.split(" · ").length).toBeGreaterThanOrEqual(5);
    expect(bloco).not.toContain("undefined");
  });

  it("peça sem personagem: os outros moods seguem com as câmeras próprias", () => {
    const bloco = buildSemPersonagemVariationBlock("OP-01");
    expect(bloco).toContain("Câmera: ");
    expect(bloco).toContain("SEM PERSONAGEM (CLAREZA)");
  });
});

describe("precedência de plano — necessária em todo mood com distância variável", () => {
  it("PU: CLAREZA e IMPACTO declaram a precedência da câmera sobre a pose", () => {
    (["OP-01", "OP-02"] as const).forEach((mood) => {
      const bloco = pickImageVariationBlock({ mood, seed: 0 });
      expect(bloco).toContain("PRECEDÊNCIA DE ENQUADRAMENTO NESTA PEÇA");
    });
  });

  it("MOP: CLAREZA declara a precedência, e o arco vence a câmera na distância", () => {
    const bloco = buildVisualDirectionBlock("OP-01", "SERVIÇOS", 0);
    expect(bloco).toContain("PRECEDÊNCIA DE ENQUADRAMENTO NESTA PEÇA");
    expect(bloco).toContain("PRECEDÊNCIA ENTRE A CÂMERA SORTEADA E O ARCO VISUAL");
    expect(bloco).toContain("arco > câmera > pose");
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
