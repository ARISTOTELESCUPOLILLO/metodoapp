import { describe, it, expect } from "vitest";
import {
  comRespiro,
  silencioAcrescentado,
  PAUSA_CURTA_S,
  PAUSA_NORMAL_S,
} from "../core/falaNatural";

// Pedido do Ari em 11/09/2026, depois de ouvir o primeiro filme montado: fala
// corrida, sem pausa, sem respiracao, ritmo constante. E a correcao NAO pode
// virar escolha na tela — o sistema resolve sozinho.

// Roteiro real que saiu na peca de 10/09 (MENSAGEM com virgula + FECHO).
const ROTEIRO =
  "Quem lidera produto novo ja busca apoio antes, nao so na hora de divulgar. O proximo passo e calibrar juntos.";

describe("respiro inserido antes da locucao", () => {
  it("poe pausa na virgula de respiro e antes do fecho", () => {
    const t = comRespiro(ROTEIRO);
    expect(t).toContain(`<break time="${PAUSA_CURTA_S}s" />`);
    expect(t).toContain(`<break time="${PAUSA_NORMAL_S}s" />`);
  });

  it("a pausa da virgula fica DEPOIS da virgula, nao antes", () => {
    const t = comRespiro(ROTEIRO);
    expect(t).toContain(`antes, <break time="${PAUSA_CURTA_S}s" />`);
  });

  it("uma pausa por frase — marcar toda virgula viraria solucos", () => {
    const muitasVirgulas =
      "Quando o cliente chega, olha o preco, pensa um pouco, e entao decide o que fazer. Fecho curto aqui.";
    const t = comRespiro(muitasVirgulas);
    const curtas = t.match(new RegExp(`<break time="${PAUSA_CURTA_S}s"`, "g")) || [];
    expect(curtas.length).toBe(1);
  });

  it("nao inventa pausa em frase sem virgula", () => {
    const semVirgula = "Criar conteudo mantem a marca viva. O proximo passo e comecar.";
    const t = comRespiro(semVirgula);
    const curtas = t.match(new RegExp(`<break time="${PAUSA_CURTA_S}s"`, "g")) || [];
    expect(curtas.length).toBe(0);
    // A pausa entre mensagem e fecho continua existindo — e a que mais importa.
    expect(t).toContain(`<break time="${PAUSA_NORMAL_S}s" />`);
  });

  it("ignora virgula grudada no comeco ou no fim — nao e respiro", () => {
    const t = comRespiro("Entao, o time decide. Agora vai.");
    const curtas = t.match(new RegExp(`<break time="${PAUSA_CURTA_S}s"`, "g")) || [];
    expect(curtas.length).toBe(0);
  });

  it("texto vazio nao vira marcacao solta", () => {
    expect(comRespiro("")).toBe("");
    expect(comRespiro("   ")).toBe("");
  });

  it("uma frase so nao ganha pausa de fecho", () => {
    const t = comRespiro("Criar conteudo mantem a marca viva e presente todo dia.");
    expect(t).not.toContain("<break");
  });
});

describe("custo do silencio", () => {
  // ⚠ O video e cobrado POR SEGUNDO de audio: cada pausa encarece a geracao.
  // Por isso as pausas sao poucas e escolhidas, nao espalhadas.
  it("mede quanto silencio foi acrescentado", () => {
    expect(silencioAcrescentado(ROTEIRO)).toBeCloseTo(PAUSA_CURTA_S + PAUSA_NORMAL_S, 2);
  });

  it("o roteiro tipico nao passa de 1 segundo de silencio", () => {
    expect(silencioAcrescentado(ROTEIRO)).toBeLessThanOrEqual(1);
  });
});
