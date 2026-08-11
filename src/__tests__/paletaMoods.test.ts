// Rodízio de paleta por mood (12/08/2026).
//
// Origem: o Ari relatou que via a MESMA cor voltando nos moods que usa pouco —
// SILÊNCIO, DESVIO e FRAGMENTO. Três causas somadas, todas cobertas aqui:
//   1. a cor do SILÊNCIO saía do hash do TÍTULO da peça (mesmo título → mesma
//      cor para sempre, e cards diferentes do mesmo carrossel em paletas
//      diferentes);
//   2. o pool do SILÊNCIO tinha 3 tonalidades, que se esgotam em três peças;
//   3. DESVIO e FRAGMENTO não tinham rodízio nenhum — paleta única, fixa.
//
// O teste mais importante deste arquivo é o da substituição não virar no-op:
// a paleta entra no prompt de imagem por String.replace de uma linha inteira.
// Se a constante e o texto se separarem, o replace falha EM SILÊNCIO — o prompt
// sai válido, sem erro, e simplesmente sem a paleta da vez. Nenhuma outra
// camada pegaria isso.

import { describe, it, expect } from "vitest";
import {
  pickPaletaDoMood,
  SILENCIO_TONALIDADES,
  DESVIO_TONALIDADES,
  FRAGMENTO_TONALIDADES,
} from "../core/colorRotation";
import {
  buildMoodVisualInstructions,
  moodVisualInstructions,
} from "../services/api/moodVisualInstructions";
import { buildVisualDirectionBlock, buildMoodGrammarBlock } from "../core/visualDirection";
import { MoodCode } from "../types";

const COM_RODIZIO: MoodCode[] = ["OP-04", "OP-05", "OP-06"];
const SEM_RODIZIO: MoodCode[] = ["OP-01", "OP-02", "OP-03"];

describe("pools de paleta", () => {
  it("SILÊNCIO tem 6 tonalidades (eram 3 até 12/08/2026)", () => {
    expect(SILENCIO_TONALIDADES).toHaveLength(6);
  });

  it("DESVIO tem as 5 combinações que a gramática do mood já listava", () => {
    expect(DESVIO_TONALIDADES).toHaveLength(5);
    const todas = DESVIO_TONALIDADES.map((t) => t.bloco).join(" ");
    // As mesmas cinco da regra do mood — nenhuma inventada na conversão para pool.
    for (const par of ["magenta", "ferrugem", "mostarda", "coral queimado", "azul elétrico"]) {
      expect(todas).toContain(par);
    }
  });

  it("FRAGMENTO tem 4 trios", () => {
    expect(FRAGMENTO_TONALIDADES).toHaveLength(4);
  });

  it.each([...COM_RODIZIO, ...SEM_RODIZIO])("%s: nenhum bloco vazio ou com buraco", (mood) => {
    for (let seed = 0; seed < 20; seed++) {
      const p = pickPaletaDoMood(mood, seed);
      if (!p) continue;
      expect(p.bloco).toBeTruthy();
      expect(p.bloco).not.toContain("undefined");
    }
  });
});

describe("quem tem rodízio e quem não tem", () => {
  it.each(COM_RODIZIO)("%s roda a paleta", (mood) => {
    expect(pickPaletaDoMood(mood, 0)).not.toBeNull();
  });

  it.each(SEM_RODIZIO)("%s mantém a paleta única do léxico", (mood) => {
    // Decisão do Ari: CLAREZA, IMPACTO e INSTANTE são os de uso diário e ficam
    // como estão. `null` aqui é o que faz o chamador manter v.paleta.
    expect(pickPaletaDoMood(mood, 0)).toBeNull();
  });
});

describe("a paleta anda em fila e é uma por sequência", () => {
  it.each(COM_RODIZIO)("%s: posições seguidas da fila dão paletas diferentes", (mood) => {
    for (let seed = 0; seed < 10; seed++) {
      expect(pickPaletaDoMood(mood, seed)?.bloco).not.toBe(pickPaletaDoMood(mood, seed + 1)?.bloco);
    }
  });

  it.each(COM_RODIZIO)("%s: a mesma posição dá sempre a mesma paleta", (mood) => {
    // É o que garante que os 5 cards de um carrossel — que compartilham a seed
    // da sequência — saiam todos na mesma cor.
    const primeira = pickPaletaDoMood(mood, 3)?.bloco;
    for (let i = 0; i < 10; i++) {
      expect(pickPaletaDoMood(mood, 3)?.bloco).toBe(primeira);
    }
  });

  it.each(COM_RODIZIO)("%s: a fila percorre o pool inteiro antes de repetir", (mood) => {
    const pool = pickPaletaDoMood(mood, 0) ? mood : null;
    expect(pool).not.toBeNull();
    const vistos = new Set<string>();
    const tamanho = { "OP-04": 4, "OP-05": 5, "OP-06": 6 }[mood as "OP-04" | "OP-05" | "OP-06"];
    for (let seed = 0; seed < tamanho; seed++) vistos.add(pickPaletaDoMood(mood, seed)!.bloco);
    expect(vistos.size).toBe(tamanho);
  });
});

describe("a paleta entra mesmo no prompt de imagem", () => {
  it.each(COM_RODIZIO)("%s: a substituição não é no-op", (mood) => {
    const base = moodVisualInstructions[mood];
    const comPaleta = buildMoodVisualInstructions(mood, 0);
    expect(comPaleta).not.toBe(base);
    expect(comPaleta).toContain("NESTA PEÇA");
  });

  it.each(COM_RODIZIO)("%s: o texto da paleta sorteada aparece no prompt", (mood) => {
    for (let seed = 0; seed < 8; seed++) {
      const esperado = pickPaletaDoMood(mood, seed)!.bloco;
      expect(buildMoodVisualInstructions(mood, seed)).toContain(esperado);
    }
  });

  it.each(SEM_RODIZIO)("%s: prompt intacto, sem paleta injetada", (mood) => {
    expect(buildMoodVisualInstructions(mood, 0)).toBe(moodVisualInstructions[mood]);
  });

  it("as travas da gramática sobrevivem à substituição", () => {
    // A linha nova substitui a antiga inteira — é onde se perderia uma
    // proibição sem ninguém notar.
    // Sem exigir o caixa: a linha nova começa frase onde a antiga tinha vírgula,
    // então "evitar" vira "Evitar". O que não pode é a trava sumir.
    expect(buildMoodVisualInstructions("OP-05", 0)).toMatch(/evitar excesso carnavalesco/i);
    expect(buildMoodVisualInstructions("OP-05", 0)).toMatch(/legível/i);
    expect(buildMoodVisualInstructions("OP-06", 0)).toMatch(/evitar branco puro dominante/i);
    expect(buildMoodVisualInstructions("OP-06", 0)).toMatch(
      /espaço vazio como elemento principal/i,
    );
    expect(buildMoodVisualInstructions("OP-04", 0)).toMatch(/unificando os blocos/i);
  });

  it("uma peça sem posição de fila não quebra nem sai sem paleta", () => {
    for (const mood of COM_RODIZIO) {
      const texto = buildMoodVisualInstructions(mood, undefined);
      expect(texto).toContain("NESTA PEÇA");
      expect(texto).not.toContain("undefined");
    }
  });
});

describe("a mesma paleta chega aos dois motores", () => {
  it.each(COM_RODIZIO)("%s: prompt de conteúdo do MOP acompanha a fila", (mood) => {
    for (let seed = 0; seed < 6; seed++) {
      const esperado = pickPaletaDoMood(mood, seed)!.bloco;
      expect(buildVisualDirectionBlock(mood, "SERVIÇOS", seed)).toContain(esperado);
    }
  });

  it.each(COM_RODIZIO)("%s: gramática usada pela PU acompanha a fila", (mood) => {
    for (let seed = 0; seed < 6; seed++) {
      const esperado = pickPaletaDoMood(mood, seed)!.bloco;
      expect(buildMoodGrammarBlock(mood, { tonalidadeSeed: seed })).toContain(esperado);
    }
  });
});
