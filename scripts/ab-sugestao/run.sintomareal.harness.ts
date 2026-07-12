import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao } from "@/core/sugestaoEngine";
import { runSintomaRealConector, type SintomaRealConectorRun } from "./sintomaReal";
import { fixturesSintomaReal } from "./fixtures.sintomareal";

// sleep/runVariant duplicados dos outros harnesses de scripts/ab-sugestao
// (não importados de lá): cada arquivo tem um describe/it de nível de
// módulo, e importar de outro harness registraria o teste dele junto
// (rodando e cobrando os dois sempre que só um for executado).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface VariantResult {
  sugestao?: string;
  error?: string;
}

async function runVariant<T>(fn: () => Promise<T>): Promise<Partial<T> & VariantResult> {
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
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
      return { error: message } as Partial<T> & VariantResult;
    }
  }
  return { error: "esgotou tentativas" } as Partial<T> & VariantResult;
}

// Harness de teste A/B OFFLINE da Sugestão — Variante A (produção, baseline
// de leitura) vs Variante "Sintoma Real por Conector" (hipótese de
// 12/07/2026, ver sintomaReal.ts para o racional completo: fluxo ITEM →
// RELAÇÃO REAL → CONECTOR NATURAL → FECHO, em vez de ITEM → CONECTOR →
// INVENTAR ALGO QUE CAIBA).
//
// Chama a API REAL da OpenAI (custa dinheiro real — cada fixture faz 1
// chamada da Variante A + 3 chamadas da variante nova: relação, 7 frases
// numa chamada só, juiz das 7 numa chamada só). Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.sintomareal.harness.ts
//
// Não decide sozinho qual variante é melhor — só GERA e AVALIA (o juiz
// multi-critério já roda aqui, ao contrário do harness de Premissa+
// Observador, porque aqui os 4 critérios são o próprio objeto do teste, não
// uma decisão de "aprovado/reprovado" a se ler depois) e grava em
// scripts/ab-sugestao/output/results-sintomareal-<timestamp>.json para
// leitura humana (e, na sequência, dos juízes Opus/Fable).
describe("A/B Sugestão — Variante A vs Sintoma Real por Conector (chamadas reais à OpenAI)", () => {
  it("gera relação+7 frases+avaliação para todos os fixtures reais e grava o relatório em output/", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
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
      sintomaReal: Partial<SintomaRealConectorRun> & VariantResult;
    }> = [];

    for (const fixture of fixturesSintomaReal) {
      console.log(`\n▶ ${fixture.label}`);
      await sleep(2000);

      const variantA = await runVariant(() => generateSugestao(apiKey!, fixture.input));
      console.log(`  A: ${variantA.sugestao ?? `ERRO: ${variantA.error}`}`);

      await sleep(1500);
      const sintomaReal = await runVariant(() => runSintomaRealConector(apiKey!, fixture.input));
      if (sintomaReal.error) {
        console.log(`  Sintoma Real: ERRO: ${sintomaReal.error}`);
      } else {
        console.log(`  Item: ${sintomaReal.concreteItem}`);
        console.log(
          `  Relação real: ${sintomaReal.relacaoReal ?? "(falhou — sem relação, sem frases)"}`,
        );
        for (const av of sintomaReal.avaliacoes ?? []) {
          const frase = sintomaReal.frases?.[av.conector] ?? "";
          const marks = [
            av.plausibilidadeOk ? "plaus✓" : "plaus✗",
            av.realidadeReconhecivelOk ? "real✓" : "real✗",
            av.especificidadeCategoriaOk ? "espec✓" : "espec✗",
            av.naturalidadeConectorOk ? "natural✓" : "natural✗",
          ].join(" ");
          console.log(
            `    ${av.conector}: "${frase}" [${marks}]${av.motivo ? ` — ${av.motivo}` : ""}`,
          );
        }
      }

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
        sintomaReal,
      });
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `results-sintomareal-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(fixturesSintomaReal.length);
  }, 900_000);
});
