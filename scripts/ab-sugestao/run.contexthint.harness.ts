import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao } from "@/core/sugestaoEngine";
import { generateContextHint } from "./contextHint";
import { fixtures } from "./fixtures-contexthint";

// runVariant/sleep duplicados aqui (não importados de run.harness.ts) porque
// aquele módulo registra seu próprio describe/it no escopo do arquivo —
// importar de lá dispara o teste A/B antigo (Variante A vs B, 9 cenários)
// junto com este harness, gastando chamadas OpenAI reais à toa (achado real
// nesta sessão, 08/07/2026).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runVariant(
  fn: () => Promise<{ sugestao: string }>,
): Promise<{ sugestao?: string; error?: string }> {
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

// Harness OFFLINE do teste "hint de contexto" (ideia do Fable, 08/07/2026) —
// Variante A (produção, generateSugestao sem alteração) vs a MESMA função
// chamada com mainActivity aumentada por 1 hipótese de contexto de uso
// grounded (gerada por contextHint.ts). O item cadastrado (concreteItem)
// NUNCA muda — só a ATIVIDADE ganha um reforço opcional.
//
// Chama a API REAL da OpenAI (custa dinheiro real, pequeno). Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.contexthint.harness.ts

interface VariantResult {
  sugestao?: string;
  error?: string;
}

interface FixtureResult {
  id: string;
  label: string;
  genericItem: string;
  mainActivity: string;
  contextHint: string | null;
  mainActivityComHint: string | null;
  baseline: VariantResult;
  comHint: VariantResult;
}

describe("Hint de contexto — Variante A vs A+hint (chamadas reais à OpenAI)", () => {
  it(
    "gera os pares baseline/com-hint dos 5 fixtures e grava o relatório em output/",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY_CONTENT;
      expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

      const results: FixtureResult[] = [];

      for (const fixture of fixtures) {
        console.log(`\n▶ ${fixture.label}`);
        await sleep(1500);

        const contextHint = await generateContextHint(
          apiKey!,
          fixture.genericItem,
          fixture.input.mainActivity,
          fixture.otherProducts,
        );
        console.log(`  hint gerado: ${contextHint ?? "(nenhum grounded — cai no baseline)"}`);

        const mainActivityComHint = contextHint
          ? `${fixture.input.mainActivity} — nesta sugestão, considere especialmente: ${contextHint}`
          : null;

        await sleep(1500);
        const baseline = await runVariant(() => generateSugestao(apiKey!, fixture.input));
        console.log(`  baseline: ${baseline.sugestao ?? `ERRO: ${baseline.error}`}`);

        await sleep(1500);
        const comHint = mainActivityComHint
          ? await runVariant(() =>
              generateSugestao(apiKey!, { ...fixture.input, mainActivity: mainActivityComHint }),
            )
          : baseline;
        console.log(`  com hint: ${comHint.sugestao ?? `ERRO: ${comHint.error}`}`);

        results.push({
          id: fixture.id,
          label: fixture.label,
          genericItem: fixture.genericItem,
          mainActivity: fixture.input.mainActivity,
          contextHint,
          mainActivityComHint,
          baseline,
          comHint,
        });
      }

      const outDir = resolve(__dirname, "output");
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(outDir, `results-contexthint-${Date.now()}.json`);
      writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
      console.log(`\n✓ Relatório gravado em ${outPath}`);

      expect(results.length).toBe(fixtures.length);
    },
    600_000,
  );
});
