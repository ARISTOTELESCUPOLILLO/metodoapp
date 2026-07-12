import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";

// FASE A (parte 5) — recomendação do Opus: "devia ter sido o primeiro
// teste da cadeia inteira". Roda a VARIANTE A DE PRODUÇÃO (sem nenhuma das
// mudanças testadas neste diretório) 3x por item, e julga cada saída com o
// MESMO critério especificidadeCategoriaOk (teste de troca) usado em todos
// os outros harnesses de sintomaReal — dá a baseline que faltava pra saber
// se ~45-50% (a taxa que a gente vinha achando, com E sem as mudanças) é
// ganho real ou é só "a mesma coisa de sempre".
//
// Mesmos 3 itens usados no teste de ruído do juiz + no teste de itens
// concretos, pra comparação direta: Criação de sites (SERVIÇOS abstrato),
// Ternos Slim (VAREJO físico) e Estratégia de Marketing Digital
// (meta-processo, o subconjunto mais difícil).
//
// O juiz aqui NÃO recebe "relação real" (a Variante A não produz uma) —
// avalia a frase final diretamente, mesmos 4 critérios, adaptados pra não
// depender de uma relação externa declarada.
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.sintomareal.baseline-variantea.harness.ts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REPETICOES = 3;

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

interface ItemBaseline {
  label: string;
  input: SugestaoEngineInput;
}

const ITENS_BASELINE: ItemBaseline[] = [
  {
    label: "Criação de sites (SERVIÇOS/B2B)",
    input: {
      ...base,
      companyName: "Oficina de Propaganda",
      mainActivity: "Consultoria de Marketing e Marketing Digital",
      segment: "SERVIÇOS",
      objetivo: "promocao",
      mode: "postunico",
      selectedProducts: ["Criação de sites"],
      audience: "B2B",
    },
  },
  {
    label: "Ternos Slim (VAREJO/B2C)",
    input: {
      ...base,
      companyName: "Loja Rocha",
      mainActivity: "Loja de Ternos e Moda Social Masculina",
      segment: "VAREJO",
      objetivo: "promocao",
      mode: "metodo",
      selectedProducts: ["Ternos Slim"],
      audience: "B2C",
    },
  },
  {
    label: "Estratégia de Marketing Digital (SERVIÇOS/B2B, meta-processo)",
    input: {
      ...base,
      companyName: "Oficina de Propaganda",
      mainActivity: "Consultoria de Marketing Digital",
      segment: "SERVIÇOS",
      objetivo: "institucional",
      mode: "metodo",
      selectedProducts: ["Estratégia de Marketing Digital"],
      audience: "B2B",
    },
  },
];

interface JulgamentoIndependente {
  plausibilidadeOk: boolean;
  realidadeReconhecivelOk: boolean;
  especificidadeCategoriaOk: boolean;
  motivo: string;
}

async function julgarFraseIndependente(
  apiKey: string,
  concreteItem: string,
  frase: string,
  mainActivity: string,
  segment: string,
): Promise<JulgamentoIndependente> {
  const prompt = `Você é juiz de qualidade de frases de pauta de conteúdo (Sugestão) para uma empresa de "${mainActivity}" (segmento ${segment}).

ITEM DE ORIGEM DA SUGESTÃO: "${concreteItem}"
FRASE: "${frase}"

Avalie em 3 critérios INDEPENDENTES:
1. plausibilidadeOk — a frase descreve algo que poderia acontecer de verdade, sem causa-efeito absurdo?
2. realidadeReconhecivelOk — um cliente REAL desse ramo, lendo a frase, reconheceria na hora como algo que já viveu — ou soa "de negócio", inventado agora?
3. especificidadeCategoriaOk — TESTE DE TROCA: se trocasse "${concreteItem}" por outro item/serviço qualquer do segmento ${segment}, vendido por um negócio diferente, a frase ainda faria sentido do mesmo jeito? Se sim, FALSE — não é específica desta categoria de item.

Responda JSON EXATAMENTE assim:
{ "plausibilidadeOk": true, "realidadeReconhecivelOk": true, "especificidadeCategoriaOk": true, "motivo": "1 frase curta se algum for false" }`;

  const result = await fetchOpenAIChat(apiKey, {
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  const content = result.data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia");
  return JSON.parse(content) as JulgamentoIndependente;
}

describe("Fase A parte 5 — baseline Variante A de produção, 3x por item (chamadas reais à OpenAI)", () => {
  it("gera com a Variante A real e julga com o mesmo critério de especificidade, grava em output/", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      label: string;
      repeticoes: Array<{
        sugestao?: string;
        julgamento?: JulgamentoIndependente;
        error?: string;
      }>;
      especificidadeCategoriaOkCount: number;
      estavel: boolean;
    }> = [];

    for (const cfg of ITENS_BASELINE) {
      console.log(`\n▶ ${cfg.label}`);
      const repeticoes: (typeof results)[number]["repeticoes"] = [];

      for (let rep = 1; rep <= REPETICOES; rep++) {
        console.log(`  Repetição ${rep}/${REPETICOES}`);
        await sleep(1500);
        try {
          const { sugestao } = await generateSugestao(apiKey!, cfg.input);
          await sleep(1000);
          const julgamento = await julgarFraseIndependente(
            apiKey!,
            cfg.input.selectedProducts[0],
            sugestao,
            cfg.input.mainActivity,
            cfg.input.segment,
          );
          console.log(
            `    "${sugestao}" — espec:${julgamento.especificidadeCategoriaOk ? "✓" : "✗"} real:${julgamento.realidadeReconhecivelOk ? "✓" : "✗"}${julgamento.motivo ? ` (${julgamento.motivo})` : ""}`,
          );
          repeticoes.push({ sugestao, julgamento });
        } catch (e) {
          repeticoes.push({ error: (e as Error).message });
        }
      }

      const especificidadeCategoriaOkCount = repeticoes.filter(
        (r) => r.julgamento?.especificidadeCategoriaOk,
      ).length;
      results.push({
        label: cfg.label,
        repeticoes,
        especificidadeCategoriaOkCount,
        estavel:
          especificidadeCategoriaOkCount === 0 || especificidadeCategoriaOkCount === REPETICOES,
      });
    }

    console.log("\n═══ RESUMO — BASELINE VARIANTE A (produção atual, sem nenhuma mudança) ═══");
    let totalOk = 0;
    for (const r of results) {
      totalOk += r.especificidadeCategoriaOkCount;
      console.log(
        `${r.label}: especificidade passou ${r.especificidadeCategoriaOkCount}/${REPETICOES}`,
      );
    }
    console.log(`TOTAL BASELINE: ${totalOk}/${REPETICOES * ITENS_BASELINE.length}`);

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `results-sintomareal-baseline-variantea-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(ITENS_BASELINE.length);
  }, 600_000);
});
