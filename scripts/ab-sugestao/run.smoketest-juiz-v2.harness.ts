import { describe, it, expect } from "vitest";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";

// Teste de fumaça pós-mudança do juiz (13/07/2026) — confirma ao vivo, contra
// a Variante A DE PRODUÇÃO já com: (1) juiz em gpt-4.1 (era mini), (2) 7º
// critério gramaticaOk, (3) rastreio de melhor tentativa em vez da última.
// Não é A/B (não compara nada) — só confirma que a mudança funciona ao vivo
// e que judgeVerdicts vem preenchido corretamente, antes do deploy.
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.smoketest-juiz-v2.harness.ts

const base: Omit<
  SugestaoEngineInput,
  "mainActivity" | "companyName" | "segment" | "objetivo" | "mode" | "selectedProducts" | "audience"
> = {
  hint: "",
  attempt: 0,
  sessionSeed: 0,
  previousSuggestions: [],
  isPersonalBrand: false,
  brandVoice: "",
};

describe("Smoke test — juiz v2 (gpt-4.1 + gramaticaOk + melhor tentativa)", () => {
  it("VAREJO (caso real FERRIMAQ) roda sem erro e judgeVerdicts vem preenchido", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const result = await generateSugestao(apiKey!, {
      ...base,
      companyName: "FERRIMAQ",
      mainActivity: "Venda de Móveis para Escritório, Consultórios, Auditórios, Refeitório e Escolares",
      segment: "VAREJO",
      objetivo: "oportunidade",
      mode: "postunico",
      selectedProducts: ["Poltrona de trabalho"],
      audience: "B2B",
    });

    console.log(`\nSugestão: "${result.sugestao}"`);
    console.log(`judgeVerdicts: ${JSON.stringify(result.judgeVerdicts, null, 2)}`);

    expect(result.sugestao.length).toBeGreaterThan(0);
    expect(Array.isArray(result.judgeVerdicts)).toBe(true);
    // Pelo menos 1 chamada ao juiz deve ter rodado (as determinísticas
    // raramente reprovam nas 3 tentativas nesse cenário simples).
    expect(result.judgeVerdicts.length).toBeGreaterThan(0);
    for (const v of result.judgeVerdicts) {
      expect(typeof v.ok).toBe("boolean");
      expect(typeof v.pass).toBe("number");
    }
  }, 60_000);

  it("SERVIÇOS (Oficina de Propaganda) roda sem erro", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const result = await generateSugestao(apiKey!, {
      ...base,
      companyName: "Oficina de Propaganda",
      mainActivity: "Consultoria de Marketing Digital",
      segment: "SERVIÇOS",
      objetivo: "institucional",
      mode: "metodo",
      selectedProducts: ["Planejamento de Comunicação"],
      audience: "B2B",
    });

    console.log(`\nSugestão: "${result.sugestao}"`);
    console.log(`judgeVerdicts: ${JSON.stringify(result.judgeVerdicts, null, 2)}`);

    expect(result.sugestao.length).toBeGreaterThan(0);
  }, 60_000);
});
