import { describe, it, expect } from "vitest";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";

// Smoke test PEQUENO (2 chamadas reais à OpenAI, custo baixo) pra confirmar
// que o fix de 14/07/2026 (CONTEXTO REAL DE USO agora ramifica por audience,
// ver conversa/memória do projeto) muda de fato o resultado — mesmo item,
// mesma empresa, só troca B2C↔B2B. Não decide sozinho se ficou bom; só
// imprime os dois resultados lado a lado pro Aristóteles avaliar.
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.audiencia-b2c-b2b.smoketest.harness.ts

const base: Omit<SugestaoEngineInput, "audience"> = {
  companyName: "Barbosa Lubrificantes",
  mainActivity:
    "Loja de lubrificantes, correias, mangueiras, ferramentas, EPI e serviço de prensa de mangueiras",
  segment: "VAREJO",
  objetivo: "oportunidade",
  mode: "metodo",
  hint: "",
  attempt: 0,
  sessionSeed: 0,
  previousSuggestions: [],
  isPersonalBrand: false,
  selectedProducts: ["Óleos lubrificantes"],
  brandVoice: "",
};

describe("Smoke test — audiência governa CONTEXTO REAL DE USO (B2C vs B2B)", () => {
  it(
    "gera a mesma sugestão em B2C e B2B e imprime lado a lado",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY_CONTENT;
      expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

      const b2c = await generateSugestao(apiKey!, { ...base, audience: "B2C" });
      console.log(`\nB2C: ${b2c.sugestao}`);

      const b2b = await generateSugestao(apiKey!, { ...base, audience: "B2B" });
      console.log(`B2B: ${b2b.sugestao}`);

      expect(b2c.sugestao).toBeTruthy();
      expect(b2b.sugestao).toBeTruthy();
    },
    120_000,
  );
});
