import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao } from "@/core/sugestaoEngine";
import { generateItemSpecification } from "./itemSpecify";
import { fixtures } from "./fixtures-contexthint";

// Harness OFFLINE do teste "especificação do item" (ideia ORIGINAL do
// Aristóteles, 08/07/2026) — Variante A (produção, generateSugestao sem
// alteração, item genérico como o usuário escreveu) vs a MESMA função
// chamada com `selectedProducts` trocado pela versão especificada (gerada
// por itemSpecify.ts). Ao contrário de run.contexthint.harness.ts, aqui o
// TEXTO do item muda de verdade — é o que aciona checkItemNameDrift em
// produção, então este teste mostra o comportamento real desse caminho.
//
// Chama a API REAL da OpenAI (custa dinheiro real, pequeno). Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.itemspecify.harness.ts

interface VariantResult {
  sugestao?: string;
  error?: string;
}

interface FixtureResult {
  id: string;
  label: string;
  genericItem: string;
  mainActivity: string;
  specifiedItem: string | null;
  baseline: VariantResult;
  comEspecificacao: VariantResult;
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

describe("Especificação do item — Variante A vs A+item-especificado (chamadas reais à OpenAI)", () => {
  it(
    "gera os pares baseline/especificado dos 5 fixtures e grava o relatório em output/",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY_CONTENT;
      expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

      const results: FixtureResult[] = [];

      for (const fixture of fixtures) {
        console.log(`\n▶ ${fixture.label}`);
        await sleep(1500);

        const specifiedItem = await generateItemSpecification(
          apiKey!,
          fixture.genericItem,
          fixture.input.mainActivity,
          fixture.otherProducts,
        );
        console.log(`  item especificado: ${specifiedItem ?? "(nenhum grounded — cai no baseline)"}`);

        await sleep(1500);
        const baseline = await runVariant(() => generateSugestao(apiKey!, fixture.input));
        console.log(`  baseline: ${baseline.sugestao ?? `ERRO: ${baseline.error}`}`);

        await sleep(1500);
        const comEspecificacao = specifiedItem
          ? await runVariant(() =>
              generateSugestao(apiKey!, { ...fixture.input, selectedProducts: [specifiedItem] }),
            )
          : baseline;
        console.log(`  com especificação: ${comEspecificacao.sugestao ?? `ERRO: ${comEspecificacao.error}`}`);

        results.push({
          id: fixture.id,
          label: fixture.label,
          genericItem: fixture.genericItem,
          mainActivity: fixture.input.mainActivity,
          specifiedItem,
          baseline,
          comEspecificacao,
        });
      }

      const outDir = resolve(__dirname, "output");
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(outDir, `results-itemspecify-${Date.now()}.json`);
      writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
      console.log(`\n✓ Relatório gravado em ${outPath}`);

      expect(results.length).toBe(fixtures.length);
    },
    600_000,
  );
});
