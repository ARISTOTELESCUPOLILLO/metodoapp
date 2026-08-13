import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextVariacaoSeed } from "../utils/storage";
import { buildCameraLine } from "../core/cameraAxes";
import { VARIACAO_SEED_KEY } from "../lib/storage/keys";

// A fila de variação visual do usuário não tinha teste nenhum, e em 13/08/2026
// virou a fila COMPARTILHADA de MOP e PU: é ela que decide paleta, arquétipo e
// os cinco eixos de câmera de toda peça. Até aqui, a PU tinha fila própria e
// mais pobre — Math.floor(Math.random() * 5) num useRef, resetado a cada peça.
//
// Estes testes existem para travar as três propriedades que a versão antiga da
// PU NÃO tinha, e que são exatamente o que o item "arco visual na PU" pedia:
// memória entre peças, alcance da fila inteira e persistência.
//
// Segue feedback-medir-conteudo-nao-contar-distintos: não basta a fila "andar",
// é preciso que ela ALCANCE a cauda dos pools reais de câmera.

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {} as unknown as Window);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fila de variação visual — memória entre peças", () => {
  it("cada chamada devolve uma posição nova e nunca repete", () => {
    const vistas = Array.from({ length: 50 }, () => nextVariacaoSeed("ari"));
    expect(new Set(vistas).size).toBe(50);
    // E anda sempre para a frente, nunca para trás.
    vistas.forEach((v, i) => i > 0 && expect(v).toBeGreaterThan(vistas[i - 1]));
  });

  it("uma sequência do MOP reserva as posições dos seus cards", () => {
    expect(nextVariacaoSeed("ari", 5)).toBe(0);
    // A próxima começa DEPOIS dos 5 cards, não em cima deles.
    expect(nextVariacaoSeed("ari")).toBe(5);
  });

  it("a fila é de cada usuário — o admin atuando como outro não herda a posição", () => {
    nextVariacaoSeed("ari");
    nextVariacaoSeed("ari");
    expect(nextVariacaoSeed("outro-cliente")).toBe(0);
    expect(nextVariacaoSeed("ari")).toBe(2);
  });

  it("sobrevive a recarregar a página — a posição está no localStorage, não em memória", () => {
    nextVariacaoSeed("ari");
    nextVariacaoSeed("ari");
    const gravado = [...store.entries()].find(([k]) => k.includes("ari"));
    expect(gravado).toBeTruthy();
    // Simula recarga: nada em memória, só o que está no storage.
    expect(nextVariacaoSeed("ari")).toBe(2);
  });

  it("sem usuário carregado não quebra — cai numa fila não escopada, que ainda anda", () => {
    // O comentário de nextVariacaoSeed diz "devolve 0"; na prática devolve 0 só
    // na primeira chamada e depois continua andando na chave SEM escopo. É
    // melhor do que o comentário promete: mesmo antes do usuário carregar, duas
    // peças seguidas não caem na mesma posição.
    expect(nextVariacaoSeed(null)).toBe(0);
    expect(nextVariacaoSeed(undefined)).toBe(1);
    // E essa fila anônima não contamina a do usuário.
    expect(nextVariacaoSeed("ari")).toBe(0);
  });

  it("valor corrompido no storage não quebra a geração", () => {
    store.set(`${VARIACAO_SEED_KEY}:ari`, "não é número");
    expect(nextVariacaoSeed("ari")).toBe(0);
    store.set(`${VARIACAO_SEED_KEY}:ari`, "-7");
    expect(nextVariacaoSeed("ari")).toBe(0);
  });
});

// O defeito nº 1 da fila antiga da PU: o seed inicial saía de
// Math.floor(Math.random() * 5), então só 5 posições eram alcançáveis. Os eixos
// de câmera têm ciclo 12 (CLAREZA, IMPACTO, SILÊNCIO) e 60 (DESVIO) — a cauda
// NUNCA era visitada na primeira peça de uma sessão.
describe("a fila alcança a cauda dos pools reais de câmera", () => {
  it("60 posições consecutivas produzem 60 câmeras distintas no DESVIO", () => {
    const linhas = Array.from({ length: 60 }, () =>
      buildCameraLine("OP-05", { seed: nextVariacaoSeed("ari") }),
    );
    expect(new Set(linhas).size).toBe(60);
  });

  it("as 5 primeiras posições — tudo que a fila antiga da PU alcançava — cobrem menos de metade do ciclo do DESVIO", () => {
    const antigas = new Set(
      Array.from({ length: 5 }, (_, seed) => buildCameraLine("OP-05", { seed })),
    );
    expect(antigas.size).toBe(5);
    expect(antigas.size).toBeLessThan(60 / 2);
  });

  it("12 posições consecutivas cobrem o ciclo inteiro de CLAREZA, IMPACTO e SILÊNCIO", () => {
    (["OP-01", "OP-02", "OP-06"] as const).forEach((mood) => {
      store.clear();
      const linhas = Array.from({ length: 12 }, () =>
        buildCameraLine(mood, { seed: nextVariacaoSeed("ari") }),
      );
      expect(new Set(linhas).size, `${mood} não percorreu o ciclo inteiro`).toBe(12);
    });
  });
});
