import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao } from "@/core/sugestaoEngine";
import { generateSugestaoVariantB } from "./variantB";
import { fixtures } from "./fixtures";

// Harness de teste A/B OFFLINE da Sugestão (MOP+PU) — Variante A (atual, em
// produção) vs Variante B (hipótese "Produto+Conector+Recorte"/"Produto+
// Benefício Percebido", documento do Aristóteles de 06/07/2026).
//
// Chama a API REAL da OpenAI (custa dinheiro real, pequeno) — por isso vive
// fora do `npm test`/`vitest run` normal: só roda com
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts
// (ver package.json, script "ab:sugestao").
//
// Não decide sozinho qual variante é melhor — só GERA os pares A/B e grava
// em scripts/ab-sugestao/output/results-<timestamp>.json para leitura humana
// e, na etapa seguinte, avaliação por Opus/Fable como juízes qualitativos
// (fora deste script, ver conversa/memória do projeto).

interface VariantResult {
  sugestao?: string;
  error?: string;
}

interface FixtureResult {
  id: string;
  label: string;
  input: {
    companyName: string;
    mainActivity: string;
    segment: string;
    mode: string;
    objetivo: string;
    audience: string;
    selectedProducts: string[];
  };
  variantA: VariantResult;
  variantB: VariantResult;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A Variante A monta um prompt bem mais longo que a B (blocos de ancoragem,
// critérios de qualidade etc. — ver sugestaoEngine.ts) e o TPM (tokens por
// minuto) da organização OpenAI usada nesta conta é baixo o suficiente para
// estourar em lotes de 9 fixtures × 2 variantes seguidos. Retry com backoff
// específico pra "rate_limit_exceeded" (a própria API já informa quantos
// segundos esperar na mensagem de erro) — não é bug de código, é o limite
// real da conta; sem isso o relatório fica incompleto.
export async function runVariant(
  fn: () => Promise<{ sugestao: string }>,
): Promise<VariantResult> {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { sugestao } = await fn();
      return { sugestao };
    } catch (e) {
      const message = (e as Error).message;
      const isRateLimit = message.includes("rate_limit_exceeded");
      if (isRateLimit && attempt < maxAttempts) {
        const waitMatch = message.match(/try again in ([\d.]+)s/);
        const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500 : 5000;
        console.log(`  (rate limit — aguardando ${waitMs}ms antes de tentar de novo)`);
        await sleep(waitMs);
        continue;
      }
      return { error: message };
    }
  }
  return { error: "esgotou tentativas" };
}

describe("A/B Sugestão — Variante A vs Variante B (chamadas reais à OpenAI)", () => {
  it(
    "gera os pares A/B de todos os fixtures e grava o relatório em output/",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY_CONTENT;
      expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

      const results: FixtureResult[] = [];

      for (const fixture of fixtures) {
        console.log(`\n▶ ${fixture.label}`);
        await sleep(2000);

        const variantA = await runVariant(() => generateSugestao(apiKey!, fixture.input));
        console.log(`  A: ${variantA.sugestao ?? `ERRO: ${variantA.error}`}`);

        const variantB = await runVariant(() => generateSugestaoVariantB(apiKey!, fixture.input));
        console.log(`  B: ${variantB.sugestao ?? `ERRO: ${variantB.error}`}`);

        results.push({
          id: fixture.id,
          label: fixture.label,
          input: {
            companyName: fixture.input.companyName,
            mainActivity: fixture.input.mainActivity,
            segment: fixture.input.segment,
            mode: fixture.input.mode,
            objetivo: fixture.input.objetivo,
            audience: fixture.input.audience,
            selectedProducts: fixture.input.selectedProducts,
          },
          variantA,
          variantB,
        });
      }

      const outDir = resolve(__dirname, "output");
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(outDir, `results-${Date.now()}.json`);
      writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
      console.log(`\n✓ Relatório gravado em ${outPath}`);

      expect(results.length).toBe(fixtures.length);
    },
    600_000,
  );
});
