// Prova do conserto de 13/08/2026: a fila de câmera dava a volta no pool a cada
// n peças, e como quatro eixos do CLAREZA tinham 3 opções cada, todos voltavam
// ao mesmo tempo. O defeito foi achado na primeira amostra da telemetria de
// variação (core/variacaoTelemetria.ts), não no olho.
//
// Estes testes medem REPETIÇÃO REAL entre peças da fila — não contam valores
// distintos. Contar distintos já deixou passar um P0 em 11/08/2026.

import { describe, it, expect } from "vitest";
import {
  buildCameraLine,
  pickEixoNaFila,
  EIXO_CORPO_CLAREZA,
  EIXO_OTICA_CLAREZA,
  EIXO_LUZ_CLAREZA,
} from "../core/cameraAxes";
import { MoodCode } from "../types";

const MOODS_COM_EIXOS: MoodCode[] = ["OP-01", "OP-02", "OP-05", "OP-06"];

/** Quantos eixos duas linhas de câmera têm em comum, posição a posição. */
function eixosIguais(a: string, b: string): number {
  const ea = a.split(" · ");
  const eb = b.split(" · ");
  return ea.filter((v, i) => v === eb[i]).length;
}

describe("pickEixoNaFila — carry entre voltas", () => {
  it("não repete o próprio valor a cada volta do pool, que era o defeito", () => {
    // Pool de 2 fica de fora: com duas opções, repetir a cada 2 é o melhor
    // possível, e o carry ali custaria a troca entre peças vizinhas (ver
    // ressalva 2 em pickEixoNaFila).
    for (const n of [3, 4, 5]) {
      const pool = Array.from({ length: n }, (_, i) => `op${i}`);
      for (const passo of [1, 2, 3]) {
        for (let seed = 0; seed < n * 3; seed++) {
          const atual = pickEixoNaFila(pool, seed, passo);
          const umaVoltaDepois = pickEixoNaFila(pool, seed + n, passo);
          expect(
            atual,
            `pool ${n}, passo ${passo}, seed ${seed}: repetiu uma volta depois`,
          ).not.toBe(umaVoltaDepois);
        }
      }
    }
  });

  it("ainda visita TODAS as opções dentro de cada volta — a fila não pode perder item", () => {
    for (const n of [2, 3, 4, 5]) {
      const pool = Array.from({ length: n }, (_, i) => `op${i}`);
      for (const passo of [1, 2, 3]) {
        for (let volta = 0; volta < 4; volta++) {
          const vistos = new Set(
            Array.from({ length: n }, (_, k) => pickEixoNaFila(pool, volta * n + k, passo)),
          );
          expect(vistos.size, `pool ${n}, passo ${passo}, volta ${volta}`).toBe(n);
        }
      }
    }
  });

  it("distribui as opções por igual ao longo de um ciclo completo", () => {
    const n = 4;
    const pool = Array.from({ length: n }, (_, i) => `op${i}`);
    const contagem = new Map<string, number>();
    for (let seed = 0; seed < n * n; seed++) {
      const v = pickEixoNaFila(pool, seed, 3);
      contagem.set(v, (contagem.get(v) || 0) + 1);
    }
    expect([...contagem.values()]).toEqual([n, n, n, n]);
  });

  it("aceita pool de 1 item e seed negativa sem quebrar", () => {
    expect(pickEixoNaFila(["único"], 7, 2)).toBe("único");
    expect(typeof pickEixoNaFila(["a", "b", "c"], -5, 2)).toBe("string");
  });
});

describe("buildCameraLine — o defeito medido e corrigido", () => {
  it("CLAREZA com avatar: as posições 0 e 3 não repetem mais 4 dos 5 eixos", () => {
    // Era este o caso concreto da amostra: PLANO PRÓXIMO / altura dos olhos /
    // lente 35mm / luz de janela idênticos entre a 1ª e a 4ª peça da fila.
    const p0 = buildCameraLine("OP-01", { seed: 0, hasAvatarRef: true });
    const p3 = buildCameraLine("OP-01", { seed: 3, hasAvatarRef: true });
    expect(eixosIguais(p0, p3)).toBeLessThanOrEqual(1);
  });

  it("CLAREZA: nenhum par de peças próximas repete a câmera inteira", () => {
    for (const avatar of [true, false]) {
      for (let seed = 0; seed < 48; seed++) {
        for (let adiante = 1; adiante <= 12; adiante++) {
          const a = buildCameraLine("OP-01", { seed, hasAvatarRef: avatar });
          const b = buildCameraLine("OP-01", { seed: seed + adiante, hasAvatarRef: avatar });
          expect(a, `avatar=${avatar} seed ${seed} vs ${seed + adiante}`).not.toBe(b);
        }
      }
    }
  });

  it("ACHADO PRÉ-EXISTENTE, não regressão: IMPACTO repete a câmera inteira a cada 6 peças", () => {
    // Este teste documenta um defeito que já está em produção e que esta
    // mudança NÃO corrigiu — o IMPACTO segue no rodízio antigo porque seus
    // pools (4 eixos de 3 opções e 1 de 2) não suportam a fila nova. Ele tem
    // apenas 18 câmeras distintas. Quando os pools crescerem, este teste deve
    // ser invertido, não apagado.
    const a = buildCameraLine("OP-02", { seed: 0, hasAvatarRef: true });
    const b = buildCameraLine("OP-02", { seed: 6, hasAvatarRef: true });
    expect(a).toBe(b);
  });

  it("peças CONSECUTIVAS continuam trocando todos os eixos — a garantia antiga foi preservada", () => {
    // Esta garantia é anterior ao conserto e não podia ser perdida por ele. É
    // o que a regra do passo ≠ n-1 protege (ver pickEixoNaFila).
    for (const mood of MOODS_COM_EIXOS) {
      for (const avatar of [true, false]) {
        for (let seed = 0; seed < 48; seed++) {
          const a = buildCameraLine(mood, { seed, hasAvatarRef: avatar });
          const b = buildCameraLine(mood, { seed: seed + 1, hasAvatarRef: avatar });
          expect(eixosIguais(a, b), `${mood} avatar=${avatar} seed ${seed} vs ${seed + 1}`).toBe(0);
        }
      }
    }
  });

  it("CLAREZA: a semelhança média entre peças a 3 e a 4 de distância caiu para perto de zero", () => {
    // O número que importa: quantos eixos, em média, uma peça compartilha com
    // outra poucas posições à frente. Antes do carry, no CLAREZA com avatar,
    // a distância 3 dava 4 de 5 eixos iguais — cravado, em toda a fila.
    for (const distancia of [3, 4]) {
      let total = 0;
      let pares = 0;
      for (let seed = 0; seed < 36; seed++) {
        const a = buildCameraLine("OP-01", { seed, hasAvatarRef: true });
        const b = buildCameraLine("OP-01", { seed: seed + distancia, hasAvatarRef: true });
        total += eixosIguais(a, b);
        pares++;
      }
      const fracao = total / pares / 6;
      // Números reais medidos, para não perder a referência: ANTES do conserto,
      // 4 de 5 eixos iguais (80%), cravado, em toda a fila. AGORA ~35% — menos
      // da metade —, e deixou de ser valor fixo: varia ao longo da fila em vez
      // de repetir sempre o mesmo padrão.
      //
      // O resíduo vem do acoplamento entre distância e ótica, ambas com 4
      // opções e, pela regra do passo, forçadas ao mesmo. É uma TROCA
      // consciente: com a distância em 3 o número agregado era melhor (~22%),
      // mas aí distância e ALTURA é que andavam coladas — e essa dupla é a que
      // se enxerga na peça (PLANO PRÓXIMO saía sempre na altura dos olhos,
      // PLANO MÉDIO sempre em plongée suave). Plano+lente colados são bem menos
      // perceptíveis que plano+altura colados.
      expect(fracao, `fração de eixos iguais a ${distancia} de distância`).toBeLessThan(0.4);
    }
  });

  it("a câmera inteira, quando se repete, só se repete muito longe", () => {
    // A sequência com carry não é periódica-linear: coincidências pontuais
    // acontecem antes do ciclo formal. O que precisa valer é que elas sejam
    // RARAS e DISTANTES — a repetição que o olho pega é a próxima, não a
    // sexagésima.
    const vistas = new Map<string, number[]>();
    for (let seed = 0; seed < 200; seed++) {
      const linha = buildCameraLine("OP-01", { seed, hasAvatarRef: true });
      (vistas.get(linha) || vistas.set(linha, []).get(linha)!).push(seed);
    }
    const distancias = [...vistas.values()]
      .filter((posicoes) => posicoes.length > 1)
      .flatMap((posicoes) => posicoes.slice(1).map((p, i) => p - posicoes[i]));
    const combinacoesDistintas = vistas.size;
    // Em 200 peças, o usuário deve ver ao menos 100 câmeras distintas — o teto
    // real é ~144, limitado pelo acoplamento entre eixos de mesmo tamanho que
    // a regra do passo impõe (ver pickEixoNaFila). Antes do conserto eram 12.
    expect(combinacoesDistintas).toBeGreaterThan(100);
    // E nenhuma repetição pode acontecer a menos de 40 peças de distância.
    for (const d of distancias) expect(d).toBeGreaterThan(40);
  });
});

describe("CLAREZA — camada de corpo de câmera e textura", () => {
  it("entra na linha de câmera como sexto eixo", () => {
    for (let seed = 0; seed < 8; seed++) {
      const linha = buildCameraLine("OP-01", { seed, hasAvatarRef: true });
      expect(linha.split(" · ").length).toBe(6);
    }
  });

  it("a Sony FX3 que o Aristóteles pediu está no pool e sai na fila", () => {
    const fx3 = EIXO_CORPO_CLAREZA.find((o) => o.includes("Sony FX3"));
    expect(fx3).toBeDefined();
    const saiu = Array.from({ length: 16 }, (_, seed) =>
      buildCameraLine("OP-01", { seed, hasAvatarRef: true }),
    ).some((l) => l.includes("Sony FX3"));
    expect(saiu).toBe(true);
  });

  it("toda opção de corpo declara lente clara e acabamento de cinema — é uma família só", () => {
    for (const opcao of EIXO_CORPO_CLAREZA) {
      expect(opcao, opcao).toMatch(/lente (clara|esférica clara|prime clara)/);
      expect(opcao, opcao).toMatch(/textura de cinema|nitidez editorial/);
    }
  });

  it("nenhuma opção introduz drama, que é gramática do IMPACTO e não do CLAREZA", () => {
    for (const opcao of EIXO_CORPO_CLAREZA) {
      // Só o que é AFIRMADO conta — "sem grão pesado" é a proibição, não a
      // presença dela. Um regex que não distingue negação reprova o texto certo.
      const afirmado = opcao.toLowerCase().replace(/\bsem [^,.—]+/g, "");
      // "microcontraste alto" é nitidez editorial, não drama — a fronteira \b
      // impede que ele case com "contraste alto".
      expect(afirmado, opcao).not.toMatch(
        /dramátic|\bcontraste alto|sombra dura|teal|low-key|grão/,
      );
    }
  });

  it("os outros moods NÃO recebem a camada — o SILÊNCIO declara 'sem grão' e brigaria", () => {
    for (const mood of ["OP-02", "OP-05", "OP-06"] as MoodCode[]) {
      const linha = buildCameraLine(mood, { seed: 1, hasAvatarRef: true });
      expect(linha.split(" · ").length).toBe(5);
      expect(linha).not.toMatch(/Sony FX3|ARRI/);
    }
  });
});

describe("pools do CLAREZA que cresceram para desempatar tamanho", () => {
  it("os tamanhos deixaram de ser todos iguais — era isso que sincronizava as voltas", () => {
    // Antes: 4 eixos com 3 opções cada (altura, ótica, luz e a distância
    // filtrada por avatar), todos dando a volta juntos. Agora os tamanhos são
    // 3·3·4·2·5·5, e luz e corpo em 5 são o que permite passos de classes
    // diferentes — ver PASSO_LUZ/PASSO_CORPO.
    expect(EIXO_OTICA_CLAREZA.length).toBe(4);
    expect(EIXO_LUZ_CLAREZA.length).toBe(5);
    expect(EIXO_CORPO_CLAREZA.length).toBe(5);
  });

  it("a lente nova fica dentro da faixa 35-85mm que a assinatura do mood declara", () => {
    const nova = EIXO_OTICA_CLAREZA.find((o) => o.includes("70mm"));
    expect(nova).toBeDefined();
    for (const o of EIXO_OTICA_CLAREZA) {
      const mm = Number(o.match(/(\d+)mm/)?.[1]);
      expect(mm).toBeGreaterThanOrEqual(35);
      expect(mm).toBeLessThanOrEqual(85);
    }
  });

  it("a luz nova continua difusa e sem direção dura, como o mood exige", () => {
    const nova = EIXO_LUZ_CLAREZA.find((o) => o.includes("rebatida"));
    expect(nova).toBeDefined();
    for (const o of EIXO_LUZ_CLAREZA) {
      // Mesma correção do teste de corpo: "ainda sem nenhuma sombra dura" é
      // proibição, não presença. Só o afirmado é avaliado.
      const afirmado = o.toLowerCase().replace(/\b(sem|ainda sem) [^,.—]+/g, "");
      expect(afirmado, o).not.toMatch(/sombra dura|direcional|recortad|contraluz/);
      expect(o.toLowerCase(), o).toMatch(/difusa|alta-chave|nublado/);
    }
  });
});
