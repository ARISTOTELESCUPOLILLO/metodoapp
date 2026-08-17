import { describe, expect, it } from "vitest";
import { checkEcoKeyInfo, validateTitulo } from "../core/textValidation";

// ─────────────────────────────────────────────────────────────────────────────
// ECO DA INFORMAÇÃO-CHAVE — trava determinística do modo AJUSTADO.
//
// Caso que originou a checagem (Ari, 17/08/2026): informação-chave "Capacete
// para motociclista por R$ 129,00" devolveu "Capacete para motociclista por
// R$129,00 chegou agora". Regra de prompt sozinha não resolve — trocar o fecho
// proibido por outro custa nada ao modelo, e a obrigação de preservar os dados
// continua valendo. Estes testes fixam o critério: transcrição reprova,
// composição com os mesmos dados passa.
// ─────────────────────────────────────────────────────────────────────────────
describe("eco da informação-chave", () => {
  const CAPACETE = "Capacete para motociclista por R$ 129,00";

  it("reprova o caso real — a frase do usuário com duas palavras coladas no fim", () => {
    expect(
      checkEcoKeyInfo("Capacete para motociclista por R$129,00 chegou agora", CAPACETE),
    ).toMatch(/transcrita/);
  });

  it("reprova qualquer fecho — o defeito é a transcrição, não a palavra colada", () => {
    for (const fecho of ["aproveite hoje", "confira já", "não perca", "corra"]) {
      expect(
        checkEcoKeyInfo(`Capacete para motociclista por R$129,00 ${fecho}`, CAPACETE),
      ).toBeTruthy();
    }
  });

  it("reprova também a chamada colada no COMEÇO", () => {
    expect(
      checkEcoKeyInfo("Chegou o capacete para motociclista por R$ 129,00", CAPACETE),
    ).toBeTruthy();
  });

  it("reprova a transcrição pura, sem acréscimo nenhum", () => {
    expect(checkEcoKeyInfo(CAPACETE, CAPACETE)).toBeTruthy();
  });

  it("não escapa por diferença de acento, caixa ou pontuação do preço", () => {
    expect(
      checkEcoKeyInfo("CAPACETE PARA MOTOCICLISTA POR R$129,00 JÁ CHEGOU", CAPACETE),
    ).toBeTruthy();
  });

  it("não escapa trocando a preposição — 'por' vira 'a' e continua transcrição", () => {
    expect(checkEcoKeyInfo("Capacete para motociclista a R$ 129,00 chegou", CAPACETE)).toBeTruthy();
  });

  it("APROVA a manchete composta com os mesmos dados obrigatórios", () => {
    expect(checkEcoKeyInfo("R$ 129,00 leva o capacete certo pra estrada", CAPACETE)).toBeNull();
    expect(checkEcoKeyInfo("Sua cabeça vale mais que R$ 129,00", CAPACETE)).toBeNull();
  });

  it("APROVA quando o título deixa um elemento de fora e traz material próprio", () => {
    expect(checkEcoKeyInfo("Capacete por R$ 129,00 na loja", CAPACETE)).toBeNull();
  });

  // 2ª rodada de 17/08: reordenar sozinho NÃO é compor. O título abaixo passou
  // no critério (A) por ter mudado a ordem, mas continua uma etiqueta de
  // vitrine — nenhum verbo, nenhuma afirmação sobre a oferta.
  it("reprova o rearranjo — mesmos elementos trocados de lugar, sem nada de próprio", () => {
    expect(checkEcoKeyInfo("Seu capacete novo por R$129,00 para motociclista", CAPACETE)).toMatch(
      /etiqueta de vitrine/,
    );
  });

  it("reprova o rearranjo mesmo com um adjetivo a mais — um adjetivo não compõe", () => {
    expect(checkEcoKeyInfo("Capacete R$ 129,00 motociclista bom", CAPACETE)).toBeTruthy();
  });

  it("APROVA o rearranjo que traz material próprio de verdade", () => {
    expect(
      checkEcoKeyInfo("Motociclista protege a cabeça com capacete de R$ 129,00", CAPACETE),
    ).toBeNull();
  });

  it("informação-chave curta demais não dispara — preservar 2 dados é obrigação, não cópia", () => {
    expect(checkEcoKeyInfo("Capacete R$ 129,00 chegou", "Capacete R$ 129")).toBeNull();
  });

  it("entrada vazia não quebra", () => {
    expect(checkEcoKeyInfo("", CAPACETE)).toBeNull();
    expect(checkEcoKeyInfo("Título qualquer", "")).toBeNull();
  });
});

describe("eco — ligação em validateTitulo", () => {
  const CAPACETE = "Capacete para motociclista por R$ 129,00";
  const TITULO_ECO = "Capacete para motociclista por R$129,00 chegou agora";

  it("só roda quando ecoKeyInfo é passada — o caminho de sempre não muda", () => {
    expect(validateTitulo(TITULO_ECO, { maxWords: 9, skipUrgencyCheck: true })).toEqual([]);
  });

  it("flaga no modo AJUSTADO, junto das demais checagens", () => {
    const motivos = validateTitulo(TITULO_ECO, {
      maxWords: 9,
      skipUrgencyCheck: true,
      ecoKeyInfo: CAPACETE,
    });
    expect(motivos.some((m) => m.includes("transcrita"))).toBe(true);
  });

  it("título composto passa limpo no modo AJUSTADO", () => {
    expect(
      validateTitulo("R$ 129,00 leva o capacete certo pra estrada", {
        maxWords: 9,
        skipUrgencyCheck: true,
        ecoKeyInfo: CAPACETE,
      }),
    ).toEqual([]);
  });
});
