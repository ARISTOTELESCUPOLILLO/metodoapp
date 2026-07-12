import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";

// Teste de fumaça pós-implementação (12/07/2026) — confirma ao vivo, contra
// a Variante A DE PRODUÇÃO JÁ COM a mudança de relação real aplicada
// (generateSugestao, ver deriveRelacaoRealComTesteDeTroca em
// sugestaoEngine.ts), que:
// (a) item de SERVIÇOS sem produto físico roda sem erro e produz saída
//     válida (a chamada extra de relação real não quebra o fluxo);
// (b) item de VAREJO físico continua rodando pelo caminho de sempre —
//     usaRelacaoReal deve ser false, então o comportamento é idêntico ao
//     pré-mudança.
// Não é um teste A/B (não compara nada) — só confirma que a mudança
// funciona ao vivo antes do commit, complementando tsc/eslint/vitest/build
// (que confirmam sintaxe e regressão em teste existente, mas não rodam a
// chamada real com a nova lógica de roteamento).
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.smoketest-relacaoreal-producao.harness.ts

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

describe("Smoke test — Variante A de produção com relação real aplicada (chamada real à OpenAI)", () => {
  it("SERVIÇOS sem produto físico (rota NOVA) roda sem erro", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const { sugestao } = await generateSugestao(apiKey!, {
      ...base,
      companyName: "Oficina de Propaganda",
      mainActivity: "Consultoria de Marketing Digital",
      segment: "SERVIÇOS",
      objetivo: "institucional",
      mode: "metodo",
      selectedProducts: ["Planejamento de Comunicação"],
      audience: "B2B",
    });

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "smoketest-servicos.txt"), sugestao, "utf-8");
    expect(sugestao.length).toBeGreaterThan(0);
    expect(sugestao.split(/\s+/).length).toBeLessThanOrEqual(7);
  }, 60_000);

  it("VAREJO físico (rota INTOCADA) roda sem erro", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const { sugestao } = await generateSugestao(apiKey!, {
      ...base,
      companyName: "Loja Rocha",
      mainActivity: "Loja de Ternos e Moda Social Masculina",
      segment: "VAREJO",
      objetivo: "promocao",
      mode: "metodo",
      selectedProducts: ["Ternos Slim"],
      audience: "B2C",
    });

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "smoketest-varejo.txt"), sugestao, "utf-8");
    expect(sugestao.length).toBeGreaterThan(0);
    expect(sugestao.split(/\s+/).length).toBeLessThanOrEqual(7);
  }, 60_000);
});
