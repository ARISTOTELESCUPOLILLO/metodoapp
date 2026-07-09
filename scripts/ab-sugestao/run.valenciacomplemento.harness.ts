import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao } from "@/core/sugestaoEngine";
import { generateSugestaoValenciaComplemento } from "./valenciaComplemento";
import { fixtures } from "./fixtures-contexthint";

// Harness OFFLINE do teste "valência dos exemplos + coerência do
// complemento" (09/07/2026) — baseline (generateSugestao de produção, sem
// alteração) vs a cópia com 2 patches cirúrgicos (valenciaComplemento.ts:
// exemplos balanceados ataque/defesa + frase de guarda de coerência do
// complemento). Mesmas 5 contas reais de fixtures-contexthint.ts, com o
// item ORIGINAL de cada uma (sem hint, sem especificação); 2 tentativas
// por conta (attempt 0 e 1, sessionSeed 0) para amostrar 2 lentes
// distintas do rodízio. previousSuggestions fica vazio nas duas tentativas
// de propósito: a ÚNICA variável entre attempt 0 e 1 é a lente sorteada,
// mantendo o teste direcionado.
//
// Chama a API REAL da OpenAI (custa dinheiro real, pequeno). Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.valenciacomplemento.harness.ts

interface VariantResult {
  sugestao?: string;
  error?: string;
}

interface AttemptPair {
  attempt: number;
  baseline: VariantResult;
  comPatch: VariantResult;
}

interface FixtureResult {
  id: string;
  label: string;
  item: string;
  mainActivity: string;
  tentativas: AttemptPair[];
}

// Duplicado de propósito (não importar de run.harness.ts — importar aquele
// módulo dispara o describe/it dele junto, achado real em sessão anterior).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runVariant(fn: () => Promise<{ sugestao: string }>): Promise<VariantResult> {
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

describe("Valência + coerência do complemento — baseline vs baseline+2 patches (chamadas reais à OpenAI)", () => {
  it(
    "gera os pares baseline/patch (2 tentativas) dos 5 fixtures e grava o relatório em output/",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY_CONTENT;
      expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

      const results: FixtureResult[] = [];

      for (const fixture of fixtures) {
        console.log(`\n▶ ${fixture.label}`);
        const tentativas: AttemptPair[] = [];

        for (const attempt of [0, 1]) {
          const input = { ...fixture.input, attempt, sessionSeed: 0 };

          await sleep(1500);
          const baseline = await runVariant(() => generateSugestao(apiKey!, input));
          console.log(`  [attempt ${attempt}] baseline: ${baseline.sugestao ?? `ERRO: ${baseline.error}`}`);

          await sleep(1500);
          const comPatch = await runVariant(() =>
            generateSugestaoValenciaComplemento(apiKey!, input),
          );
          console.log(`  [attempt ${attempt}] com patch: ${comPatch.sugestao ?? `ERRO: ${comPatch.error}`}`);

          tentativas.push({ attempt, baseline, comPatch });
        }

        results.push({
          id: fixture.id,
          label: fixture.label,
          item: fixture.input.selectedProducts[0] ?? "",
          mainActivity: fixture.input.mainActivity,
          tentativas,
        });
      }

      const outDir = resolve(__dirname, "output");
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(outDir, `results-valenciacomplemento-${Date.now()}.json`);
      writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
      console.log(`\n✓ Relatório gravado em ${outPath}`);

      expect(results.length).toBe(fixtures.length);
    },
    600_000,
  );
});
