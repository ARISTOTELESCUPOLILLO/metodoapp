import { describe, it, expect } from "vitest";
import * as lexicon from "../core/visualDirection.lexicon";
import { pickImageVariationBlock } from "../core/imageVariationPicker";
import { buildVisualDirectionBlock } from "../core/visualDirection";
import { buildSemPersonagemVariationBlock } from "../core/semPersonagem";
import { MoodCode, Segment } from "../types";

// Escrito depois de um bug real (11/08/2026): INSTANTE_POOL_SEM_PDV referenciava
// INSTANTE_CHARACTER_VARIATIONS[8] num array de 8 posições (0-7). O resultado era
// `undefined` dentro do pool — que virava a palavra "undefined" literal no prompt
// do MOP em ~24% das gerações de SERVIÇOS/MARCA, e uma exceção no caminho de
// imagem com avatar (o filtro de contrato do avatar chama .includes() no item).
//
// Nada disso foi pego por tsc (sem noUncheckedIndexedAccess), eslint ou pela
// suíte: o snapshot do MOP mocka Math.random para 0 e só toca o primeiro item de
// cada pool, sendo estruturalmente cego à cauda.
//
// Estes testes cobrem a CLASSE do defeito, não a ocorrência: pools montados por
// índice a partir de outros arrays, e blocos de variação montados por sorteio.

const MOODS: MoodCode[] = ["OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06"];
const SEGMENTOS: Segment[] = ["VAREJO", "SERVIÇOS", "MARCA"];

// Amostra grande o bastante para tocar a cauda de qualquer pool do léxico — o
// maior tem 9 itens, e estes testes usam pickRandom REAL, sem mock.
const AMOSTRA = 300;

describe("pools de variação do léxico", () => {
  const pools = Object.entries(lexicon).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((v) => typeof v === "string" || v === undefined),
  );

  it("existe pelo menos um pool exportado (guarda contra o filtro parar de casar)", () => {
    expect(pools.length).toBeGreaterThan(5);
  });

  it.each(pools)("%s não tem buraco nem item vazio", (_nome, pool) => {
    pool.forEach((item) => {
      expect(item).toBeDefined();
      expect(typeof item).toBe("string");
      expect(item.trim().length).toBeGreaterThan(0);
    });
  });

  it("INSTANTE_POOL_SEM_PDV aponta para poses que existem no array de origem", () => {
    lexicon.INSTANTE_POOL_SEM_PDV.forEach((pose) => {
      expect(lexicon.INSTANTE_CHARACTER_VARIATIONS).toContain(pose);
    });
    // O pool reduzido existe para tirar léxico de PDV de SERVIÇOS/MARCA — se
    // ficar do tamanho do pool completo, ele perdeu a razão de ser.
    expect(lexicon.INSTANTE_POOL_SEM_PDV.length).toBeLessThan(
      lexicon.INSTANTE_CHARACTER_VARIATIONS.length,
    );
  });

  // O .filter(Boolean) do pool é rede de produção — impede que um índice errado
  // injete `undefined` no prompt. Mas ele TAMBÉM mascararia o erro em teste: o
  // pool encolheria em silêncio e a pose faltante simplesmente nunca sairia.
  // Estas duas asserções são o que de fato trava o índice.
  it("INSTANTE_POOL_SEM_PDV tem as 4 poses esperadas, sem encolher em silêncio", () => {
    expect(lexicon.INSTANTE_POOL_SEM_PDV).toHaveLength(4);
  });

  it("a pose relacional criada para SERVIÇOS/MARCA está de fato no pool reduzido", () => {
    // Sem ela, o segmento volta a não ter nenhuma opção com dois sujeitos em
    // cena — que é justamente o que TEMA_DERIVATION_RULE exige quando o título
    // é relacional. Foi o efeito silencioso do índice errado.
    const temConversaADois = lexicon.INSTANTE_POOL_SEM_PDV.some((p) =>
      p.startsWith("CONVERSA DE TRABALHO A DOIS"),
    );
    expect(temConversaADois).toBe(true);
  });
});

describe("blocos de variação nunca vazam 'undefined' para o prompt", () => {
  it.each(MOODS)("imagem — %s, todos os segmentos, com e sem avatar", (mood) => {
    for (let i = 0; i < AMOSTRA; i++) {
      for (const segment of SEGMENTOS) {
        for (const avatar of [true, false]) {
          const bloco = pickImageVariationBlock(
            mood,
            avatar,
            "titulo de teste",
            "texto de teste",
            undefined,
            undefined,
            undefined,
            false,
            segment,
          );
          expect(bloco).not.toContain("undefined");
        }
      }
    }
  });

  it.each(MOODS)("conteúdo (MOP) — %s, todos os segmentos", (mood) => {
    for (let i = 0; i < AMOSTRA; i++) {
      for (const segment of SEGMENTOS) {
        expect(buildVisualDirectionBlock(mood, segment)).not.toContain("undefined");
      }
    }
  });

  it.each(MOODS)("sem personagem — %s", (mood) => {
    for (let i = 0; i < AMOSTRA; i++) {
      expect(buildSemPersonagemVariationBlock(mood)).not.toContain("undefined");
    }
  });
});

describe("contrato do avatar sobrevive ao sorteio", () => {
  // O filtro de variações sem rosto (variationHasFaceNotDominant) roda sobre o
  // pool antes do sorteio e chama .includes() em cada item: um buraco no pool
  // estourava ali, em 100% das chamadas com avatar. Este teste exercita
  // exatamente esse caminho para todo mood × segmento.
  it("não lança com avatar de referência em nenhum mood × segmento", () => {
    for (const mood of MOODS) {
      for (const segment of SEGMENTOS) {
        for (let i = 0; i < 60; i++) {
          expect(() =>
            pickImageVariationBlock(
              mood,
              true,
              "titulo",
              "texto",
              undefined,
              undefined,
              undefined,
              false,
              segment,
            ),
          ).not.toThrow();
        }
      }
    }
  });
});
