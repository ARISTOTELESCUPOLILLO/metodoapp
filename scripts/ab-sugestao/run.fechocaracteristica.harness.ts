import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestaoFechoBaseline, generateSugestaoFechoCaracteristica } from "./fechoCaracteristica";
import { fixtures } from "./fixtures-contexthint";

// Harness OFFLINE do teste "fecho característica" (achado #1 da auditoria de
// conflitos do motor de Sugestão, 09/07/2026) — Baseline (juiz fechoOk igual
// a produção) vs Patched (juiz fechoOk aceitando característica/uso, não só
// benefício), sobre as MESMAS 5 fixtures reais já usadas em testes
// anteriores. Ambos os lados rodam a MESMA geração (idêntica a produção,
// já com a guarda COERÊNCIA DO COMPLEMENTO) — a única variável é o critério
// do juiz.
//
// Chama a API REAL da OpenAI (custa dinheiro real, pequeno). Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.fechocaracteristica.harness.ts

interface VariantResult {
  sugestao?: string;
  tentativas?: number;
  reprovadoPorFechoOk?: boolean;
  motivosPorTentativa?: string[][];
  error?: string;
}

interface FixtureResult {
  id: string;
  label: string;
  attempt: number;
  baseline: VariantResult;
  patched: VariantResult;
}

// Duplicado de propósito (não importar de run.harness.ts — importar aquele
// módulo dispara o describe/it dele junto, achado real em sessão anterior).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runVariant(
  fn: () => Promise<{
    sugestao: string;
    tentativas: number;
    reprovadoPorFechoOk: boolean;
    motivosPorTentativa: string[][];
  }>,
): Promise<VariantResult> {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { sugestao, tentativas, reprovadoPorFechoOk, motivosPorTentativa } = await fn();
      return { sugestao, tentativas, reprovadoPorFechoOk, motivosPorTentativa };
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

describe("Fecho característica — Baseline (juiz atual) vs Patched (juiz aceita característica) — chamadas reais à OpenAI", () => {
  it(
    "gera os pares baseline/patched dos 5 fixtures, 2 tentativas cada, e grava o relatório em output/",
    async () => {
      const apiKey = process.env.OPENAI_API_KEY_CONTENT;
      expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

      const results: FixtureResult[] = [];

      for (const fixture of fixtures) {
        for (const attempt of [0, 1]) {
          console.log(`\n▶ ${fixture.label} — tentativa ${attempt}`);
          const input = { ...fixture.input, attempt, sessionSeed: 0, previousSuggestions: [] };

          await sleep(1500);
          const baseline = await runVariant(() => generateSugestaoFechoBaseline(apiKey!, input));
          console.log(
            `  baseline: ${baseline.sugestao ?? `ERRO: ${baseline.error}`} (tentativas=${baseline.tentativas}, reprovadoPorFechoOk=${baseline.reprovadoPorFechoOk})`,
          );

          await sleep(1500);
          const patched = await runVariant(() => generateSugestaoFechoCaracteristica(apiKey!, input));
          console.log(
            `  patched:  ${patched.sugestao ?? `ERRO: ${patched.error}`} (tentativas=${patched.tentativas}, reprovadoPorFechoOk=${patched.reprovadoPorFechoOk})`,
          );

          results.push({
            id: fixture.id,
            label: fixture.label,
            attempt,
            baseline,
            patched,
          });
        }
      }

      const outDir = resolve(__dirname, "output");
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(outDir, `results-fechocaracteristica-${Date.now()}.json`);
      writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
      console.log(`\n✓ Relatório gravado em ${outPath}`);

      expect(results.length).toBe(fixtures.length * 2);
    },
    900_000,
  );
});
