import { describe, it, expect } from "vitest";
import { buildDeviceRule } from "../utils/promptRules";

// Regressão do bug real (PU, mood SILÊNCIO, 2026-07-17): produto referenciado
// sumia da peça quando o checkbox de tela estava desmarcado, porque a regra de
// "sem dispositivo" bania categoricamente o próprio produto se ele por acaso
// fosse um dispositivo com tela. Ver principios-comunicacao Parte 2.7.
describe("buildDeviceRule — produto referenciado sempre aparece", () => {
  it("com produto físico referenciado e checkbox de tela desmarcado, NÃO bane categoricamente tablet/celular/monitor (não pode apagar o próprio produto)", () => {
    const rule = buildDeviceRule(undefined, false, true, false);
    // A versão antiga do bug bania a categoria inteira, sem qualificador —
    // agora só pode aparecer qualificado como "extra invented" (2º aparelho).
    expect(rule).not.toMatch(/NEGATIVE:\s*laptop, notebook, tablet, smartphone/i);
    expect(rule).toMatch(/extra invented tablet/i);
    expect(rule).toMatch(/extra invented smartphone/i);
    expect(rule).toMatch(/extra invented computer monitor/i);
  });

  it("mesmo caso: ainda proíbe um segundo dispositivo inventado/sem relação com o produto", () => {
    const rule = buildDeviceRule(undefined, false, true, false);
    expect(rule).toMatch(/segundo dispositivo/i);
    expect(rule).toMatch(/second unrelated digital device/i);
  });

  it("mesmo caso: declara explicitamente que o produto deve aparecer, seja ele dispositivo ou não", () => {
    const rule = buildDeviceRule(undefined, false, true, false);
    expect(rule).toMatch(/DEVE aparecer normalmente/i);
  });

  it("sem produto referenciado e atividade não-digital: mantém o banimento total (buildNoDeviceRule) intacto", () => {
    const rule = buildDeviceRule("artesanato", false, false, false);
    expect(rule).toMatch(/PROIBIDOS NESTA CENA/);
    expect(rule).toMatch(/NEGATIVE:.*laptop.*notebook.*tablet.*smartphone/i);
  });

  it("checkbox de tela marcado (produtoEhDispositivo=true, preserveScreenContent=true): segue o modo PRODUTO EXPOSTO normalmente", () => {
    const rule = buildDeviceRule(undefined, true, true, true);
    expect(rule).toMatch(/PRODUTO EXPOSTO/);
    expect(rule).toMatch(/CONTEÚDO REAL da imagem de referência/);
  });
});
