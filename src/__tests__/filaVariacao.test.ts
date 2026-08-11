// A variação visual virou FILA em vez de sorteio (12/08/2026).
//
// Origem: as peças reais do Ari repetiam a mesma câmera com frequência alta.
// Sorteio com reposição num pool de 5 dá 20% de chance de repetir a cada
// geração — e "gerar novamente" trazendo a mesma câmera é exatamente o que o
// olho lê como "veio igual". A fila garante que a peça seguinte ande.
//
// Estes testes cobrem as duas propriedades que fazem a fila valer a pena e que
// falham em silêncio quando quebram: percorrer o pool INTEIRO antes de repetir
// (passo co-primo com o tamanho) e nunca repetir em posições consecutivas.

import { describe, it, expect } from "vitest";
import { pickRotating, coprimeStep } from "../core/colorRotation";
import { pickImageVariationBlock } from "../core/imageVariationPicker";
import { buildVisualDirectionBlock } from "../core/visualDirection";
import { MoodCode, Segment } from "../types";

const MOODS: MoodCode[] = ["OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06"];
const SEGMENTOS: Segment[] = ["VAREJO", "SERVIÇOS", "MARCA"];

describe("coprimeStep — a fila precisa visitar todo o pool", () => {
  it("mantém o passo quando ele já é co-primo com o tamanho", () => {
    expect(coprimeStep(5, 2)).toBe(2);
    expect(coprimeStep(9, 2)).toBe(2);
    expect(coprimeStep(4, 3)).toBe(3);
  });

  it("corrige o passo que dividiria o pool ao meio (o bug silencioso)", () => {
    // Passo 2 num pool de 4 visitaria só os índices 0 e 2, para sempre.
    expect(coprimeStep(4, 2)).toBe(3);
    // Passo 3 num pool de 9 visitaria 0, 3, 6 — um terço do pool.
    expect(coprimeStep(9, 3)).toBe(4);
    expect(coprimeStep(6, 3)).toBe(5);
  });

  it("não trava nem devolve 0 em pools degenerados", () => {
    expect(coprimeStep(0, 2)).toBe(1);
    expect(coprimeStep(1, 2)).toBe(1);
    expect(coprimeStep(5, 0)).toBeGreaterThan(0);
  });

  it.each([
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 3],
    [8, 2],
    [9, 3],
  ])("pool de %i com passo %i percorre TODOS os itens antes de repetir", (n, passo) => {
    const pool = Array.from({ length: n }, (_, i) => i);
    const vistos = new Set<number>();
    for (let seed = 0; seed < n; seed++) vistos.add(pickRotating(pool, seed, passo));
    expect(vistos.size).toBe(n);
  });

  it("nunca devolve o mesmo item em duas posições consecutivas da fila", () => {
    for (let n = 2; n <= 10; n++) {
      const pool = Array.from({ length: n }, (_, i) => i);
      for (const passo of [1, 2, 3]) {
        for (let seed = 0; seed < n * 2; seed++) {
          expect(pickRotating(pool, seed, passo)).not.toBe(pickRotating(pool, seed + 1, passo));
        }
      }
    }
  });
});

describe("blocos de variação em fila — imagem (PU)", () => {
  it.each(MOODS)("%s: duas peças seguidas nunca saem com o mesmo bloco", (mood) => {
    for (let seed = 0; seed < 12; seed++) {
      const atual = pickImageVariationBlock({ mood, hasAvatarRef: true, seed });
      const proxima = pickImageVariationBlock({ mood, hasAvatarRef: true, seed: seed + 1 });
      expect(atual).not.toBe(proxima);
    }
  });

  it("a mesma posição de fila devolve sempre o mesmo bloco (é fila, não sorteio)", () => {
    for (const mood of MOODS) {
      const primeira = pickImageVariationBlock({ mood, hasAvatarRef: true, seed: 7 });
      for (let i = 0; i < 20; i++) {
        expect(pickImageVariationBlock({ mood, hasAvatarRef: true, seed: 7 })).toBe(primeira);
      }
    }
  });

  it("sem posição de fila, continua sorteando (caminhos ainda não fiados seguem vivos)", () => {
    // 200 chamadas sem seed em CLAREZA, que tem mais de uma câmera no pool:
    // se tivesse virado determinístico, todas sairiam idênticas.
    const blocos = new Set(
      Array.from({ length: 200 }, () => pickImageVariationBlock({ mood: "OP-01" })),
    );
    expect(blocos.size).toBeGreaterThan(1);
  });

  it("nenhuma posição de fila produz 'undefined' no prompt", () => {
    for (const mood of MOODS) {
      for (const segment of SEGMENTOS) {
        for (const hasAvatarRef of [true, false]) {
          for (let seed = 0; seed < 30; seed++) {
            expect(pickImageVariationBlock({ mood, hasAvatarRef, segment, seed })).not.toContain(
              "undefined",
            );
          }
        }
      }
    }
  });
});

describe("blocos de variação em fila — conteúdo (MOP)", () => {
  it.each(MOODS)("%s: sequências seguidas mudam de câmera", (mood) => {
    for (let seed = 0; seed < 12; seed++) {
      // O bloco do MOP também sorteia gênero (que segue fora da fila de
      // propósito), então comparamos só a linha de câmera.
      const linhaCamera = (s: number) =>
        buildVisualDirectionBlock(mood, "SERVIÇOS", s)
          .split("\n")
          .find((l) => l.startsWith("• Câmera:"));
      const atual = linhaCamera(seed);
      // OP-02 e OP-04 não declaram câmera no lado do conteúdo — nada a comparar.
      if (!atual) continue;
      expect(atual).not.toBe(linhaCamera(seed + 1));
    }
  });

  it("a precedência do arco visual acompanha toda câmera declarada", () => {
    for (const mood of MOODS) {
      for (const segment of SEGMENTOS) {
        for (let seed = 0; seed < 8; seed++) {
          const bloco = buildVisualDirectionBlock(mood, segment, seed);
          if (bloco.includes("• Câmera:")) {
            expect(bloco).toContain("PRECEDÊNCIA ENTRE A CÂMERA SORTEADA E O ARCO VISUAL");
          }
        }
      }
    }
  });
});
