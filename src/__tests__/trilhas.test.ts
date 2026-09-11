import { describe, it, expect } from "vitest";
import { TRILHAS, TRILHA_PADRAO_ID, arquivoDaTrilha } from "../domain/trilhas.config";

// Acervo curado (11/09/2026). O cliente ESCOLHE, nao envia arquivo: quem sobe
// musica propria sobe musica protegida, o Instagram silencia o post e o problema
// volta para a agencia.

describe("acervo de trilhas", () => {
  it("todo id e unico — o id fica guardado no Kit", () => {
    expect(new Set(TRILHAS.map((t) => t.id)).size).toBe(TRILHAS.length);
  });

  it("toda faixa aponta para um arquivo servido pelo proprio app", () => {
    for (const t of TRILHAS) expect(t.arquivo.startsWith("/trilhas/")).toBe(true);
  });

  it("a padrao existe no acervo", () => {
    expect(TRILHAS.some((t) => t.id === TRILHA_PADRAO_ID)).toBe(true);
  });

  it("toda faixa diz PARA QUE serve — e o que faz alguem conseguir escolher", () => {
    for (const t of TRILHAS) {
      expect(t.nome.length, t.id).toBeGreaterThan(3);
      expect(t.uso.length, t.id).toBeGreaterThan(10);
    }
  });
});

describe("resolucao do arquivo a partir da escolha", () => {
  it("devolve a faixa escolhida", () => {
    expect(arquivoDaTrilha("headphones")).toBe("/trilhas/headphones.mp3");
  });

  it('"nenhuma" e escolha legitima: filme so com a voz', () => {
    expect(arquivoDaTrilha("nenhuma")).toBe("");
  });

  it("sem escolha (conta antiga) cai na padrao, nao no silencio", () => {
    expect(arquivoDaTrilha(null)).toBe("/trilhas/vibe-mountain.mp3");
    expect(arquivoDaTrilha(undefined)).toBe("/trilhas/vibe-mountain.mp3");
  });

  it("id desconhecido nao quebra a montagem — cai na padrao", () => {
    // Caso real possivel: faixa retirada do acervo com contas ainda apontando.
    expect(arquivoDaTrilha("faixa-que-saiu-do-ar")).toBe("/trilhas/vibe-mountain.mp3");
  });
});
