// Trava da assimetria de repertório entre moods (14/08/2026).
//
// Por que este teste existe: uma peça de SILÊNCIO saiu indistinguível de uma de
// CLAREZA em geração real. A causa não era o sorteio nem a fila — era GEOMETRIA
// DE CONJUNTO. Os dois moods compartilhavam 3 de 4 alturas, 2 de 3 lentes, 2 de
// 3 luzes e as duas profundidades, quase palavra por palavra. Enquanto existe
// interseção entre os pools, ela vai ser sorteada: era ~33% de chance de o
// SILÊNCIO compor uma câmera 100% legal em CLAREZA.
//
// O risco de repetir o erro é concreto e já documentado: em 13/08/2026 o pool de
// ótica do CLAREZA cresceu para desempatar tamanhos de fila, e o valor escolhido
// (70mm) era justamente um valor do SILÊNCIO. Variedade interna comprada com
// identidade entre moods. Este teste é o que impede a próxima vez.
import { describe, it, expect } from "vitest";
import { NAO_COMPARTILHAVEL_COM_CLAREZA, EIXOS_CLAREZA_PARA_COMPARACAO } from "../core/cameraAxes";

const normaliza = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Maior trecho contínuo de palavras que duas frases têm em comum. Comparar por
 *  PALAVRA, e não por caractere, evita falso positivo em pedaço de palavra. */
function maiorTrechoComum(a: string, b: string): string {
  const pa = normaliza(a).split(" ");
  const pb = normaliza(b).split(" ");
  const trechosDeB = new Set<string>();
  for (let i = 0; i < pb.length; i++) {
    for (let j = i + 1; j <= pb.length; j++) trechosDeB.add(pb.slice(i, j).join(" "));
  }
  let maior = "";
  for (let i = 0; i < pa.length; i++) {
    for (let j = i + 1; j <= pa.length; j++) {
      const trecho = pa.slice(i, j).join(" ");
      if (trechosDeB.has(trecho) && trecho.length > maior.length) maior = trecho;
    }
  }
  return maior;
}

describe("assimetria de repertório: SILÊNCIO × CLAREZA", () => {
  it("nenhum valor do SILÊNCIO é idêntico a um valor do CLAREZA, em nenhum eixo", () => {
    const todosClareza = Object.values(EIXOS_CLAREZA_PARA_COMPARACAO).flat().map(normaliza);
    for (const [eixo, pool] of Object.entries(NAO_COMPARTILHAVEL_COM_CLAREZA)) {
      for (const valor of pool) {
        expect(
          todosClareza,
          `eixo ${eixo}: "${valor.slice(0, 60)}…" existe idêntico no CLAREZA`,
        ).not.toContain(normaliza(valor));
      }
    }
  });

  // O teste acima só pega cópia literal. O defeito real era mais sutil: frases
  // diferentes descrevendo a MESMA câmera ("câmera nivelada com o sujeito" ×
  // "altura dos olhos, câmera nivelada com o horizonte"). Por isso a trava de
  // fundo é por MARCADOR: os termos que definem a zona neutra compartilhada não
  // podem aparecer no SILÊNCIO, venham na frase que vierem.
  const MARCADORES_DA_ZONA_NEUTRA: Array<[RegExp, string]> = [
    [/altura dos olhos/, "altura dos olhos (câmera do CLAREZA)"],
    [/\bnivelad/, "câmera nivelada (câmera do CLAREZA)"],
    [/\bplongee suave\b/, "plongée suave (câmera do CLAREZA)"],
    [/contra plongee/, "contra-plongée (câmera do IMPACTO e do CLAREZA)"],
    [/\b(28|35|50|70|85)mm\b/, "lente da faixa neutra, presente em outros moods"],
    [/janela (ampla )?lateral/, "janela lateral difusa (luz do CLAREZA)"],
    [/levemente fora de foco/, "separação suave (profundidade do CLAREZA)"],
    [/alta chave (difusa|frontal) e envolvente/, "alta-chave envolvente (luz do CLAREZA)"],
  ];

  it("nenhum valor do SILÊNCIO usa os marcadores da zona neutra compartilhada", () => {
    for (const [eixo, pool] of Object.entries(NAO_COMPARTILHAVEL_COM_CLAREZA)) {
      for (const valor of pool) {
        const texto = normaliza(valor);
        for (const [re, oQueE] of MARCADORES_DA_ZONA_NEUTRA) {
          expect(re.test(texto), `eixo ${eixo}: "${valor.slice(0, 60)}…" contém ${oQueE}`).toBe(
            false,
          );
        }
      }
    }
  });

  it("nenhum par SILÊNCIO×CLAREZA compartilha um trecho longo de descrição", () => {
    const LIMITE_PALAVRAS = 5;
    for (const [eixo, pool] of Object.entries(NAO_COMPARTILHAVEL_COM_CLAREZA)) {
      const poolClareza = EIXOS_CLAREZA_PARA_COMPARACAO[eixo] || [];
      for (const valor of pool) {
        for (const doClareza of poolClareza) {
          const comum = maiorTrechoComum(valor, doClareza);
          expect(
            comum.split(" ").filter(Boolean).length,
            `eixo ${eixo}: trecho comum "${comum}" entre SILÊNCIO e CLAREZA`,
          ).toBeLessThan(LIMITE_PALAVRAS);
        }
      }
    }
  });

  // A contrapartida da exclusividade: se o repertório vai ser estreito, ele
  // precisa ao menos ser COERENTE. Toda altura do SILÊNCIO carrega o próprio
  // eixo geométrico, do mesmo modo que toda altura do IMPACTO carrega o ângulo
  // ascendente e toda altura do DESVIO carrega o próprio desvio. É o que impede
  // a COMBINAÇÃO de eixos de recompor a câmera neutra sem nenhum eixo errar
  // sozinho — o risco que o DESVIO já tinha documentado.
  it("toda altura do SILÊNCIO declara um eixo geométrico próprio", () => {
    const GEOMETRIA = /zenital|ortogonal|rasante|alta e distante/;
    for (const altura of NAO_COMPARTILHAVEL_COM_CLAREZA.altura) {
      expect(GEOMETRIA.test(normaliza(altura)), altura.slice(0, 60)).toBe(true);
    }
  });

  it("toda ótica do SILÊNCIO é teleobjetiva longa (100mm ou mais)", () => {
    for (const otica of NAO_COMPARTILHAVEL_COM_CLAREZA.otica) {
      const mm = normaliza(otica).match(/(\d+)mm/);
      expect(mm, otica.slice(0, 60)).not.toBeNull();
      expect(Number(mm?.[1]), otica.slice(0, 60)).toBeGreaterThanOrEqual(100);
    }
  });
});
