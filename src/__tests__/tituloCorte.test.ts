import { describe, it, expect } from "vitest";
import { applyDeterministicFallback, validateTitulo } from "../core/textValidation";
import { checkDanglingEnding } from "../core/textWordUtils";

// CASO REAL — 09/09/2026, card 3 de um carrossel (linha Conhecimento, modo
// REFERIR SEM NOME). O titulo saiu assim na tela:
//
//   "Reunioes mostram o que os scripts"
//
// Nao e erro do modelo: ele escreveu a frase inteira. A limpeza deterministica
// (E4) cortou em 6 palavras e decapitou a oracao subordinada aberta por "que".
// O fragmento passa por TODAS as checagens porque termina num substantivo — o
// defeito e do CORTE, nao da terminacao.
const TITULO_INTEIRO = "Reunioes mostram o que os scripts nao mostram";
const FRAGMENTO = "Reunioes mostram o que os scripts";

describe("o corte de titulo nao pode decapitar oracao subordinada", () => {
  it("as checagens de terminacao aprovam o fragmento — por isso o corte tinha de mudar", () => {
    expect(checkDanglingEnding(FRAGMENTO)).toBeNull();
    expect(validateTitulo(FRAGMENTO)).toEqual([]);
  });

  it("titulo com subordinada aberta volta INTEIRO em vez de cortado", () => {
    const saida = applyDeterministicFallback(TITULO_INTEIRO, "titulo");
    expect(saida).toBe(TITULO_INTEIRO);
    expect(saida).not.toBe(FRAGMENTO);
  });

  it("titulo SEM subordinada continua sendo cortado como sempre foi", () => {
    const longo = "Consultoria digital organiza rotina interna da equipe toda";
    const saida = applyDeterministicFallback(longo, "titulo");
    expect(saida.split(/\s+/).length).toBeLessThanOrEqual(6);
  });

  it("titulo dentro do limite nao e tocado, mesmo com que", () => {
    const ok = "Por que isso acontece?";
    expect(applyDeterministicFallback(ok, "titulo")).toBe(ok);
  });
});
