import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";

// FASE A (parte 4) — recomendação do Opus: antes de aceitar que o pipeline
// de geração é instável, isolar se o RUÍDO está no JUIZ. Pega 2 pares
// (item, relação real, frase) JÁ GERADOS em testes anteriores (fixos, sem
// gerar nada novo) e roda o juiz 3x em cima do MESMO texto — se o veredito
// oscilar com entrada 100% idêntica, o ruído é do instrumento de medida,
// não do pipeline de geração testado até aqui.
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.sintomareal.ruidojuiz.harness.ts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REPETICOES_JUIZ = 3;

interface CasoFixo {
  label: string;
  concreteItem: string;
  mainActivity: string;
  segment: string;
  relacaoReal: string;
  frase: string;
}

// Retirados literalmente do output de
// results-sintomareal-repeticao-itensconcretos (12/07/2026) — um caso que
// tinha passado espec, outro que tinha reprovado, pra cobrir os dois lados.
const CASOS_FIXOS: CasoFixo[] = [
  {
    label: "Criação de sites — passou espec na rodada original",
    concreteItem: "Criação de sites",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    segment: "SERVIÇOS",
    relacaoReal:
      "Cliente percebe que o site antigo não é responsivo e perde visitas, então busca a criação de um site novo para melhorar a experiência mobile.",
    frase: "Criação de sites para melhorar experiência mobile",
  },
  {
    label: "Ternos Slim — reprovou espec na rodada original",
    concreteItem: "Ternos Slim",
    mainActivity: "Loja de Ternos e Moda Social Masculina",
    segment: "VAREJO",
    relacaoReal:
      "Cliente que já comprou terno slim sabe que precisa provar várias vezes para garantir o caimento perfeito no corpo.",
    frase: "Ternos Slim para garantir o caimento perfeito",
  },
];

interface Julgamento {
  plausibilidadeOk: boolean;
  realidadeReconhecivelOk: boolean;
  especificidadeCategoriaOk: boolean;
  naturalidadeConectorOk: boolean;
  motivo: string;
}

// Idêntico ao julgarFrase dos outros harnesses — texto do prompt igual,
// byte a byte, pra garantir que qualquer variação no veredito não venha de
// diferença de fiação entre chamadas.
async function julgarFrase(
  apiKey: string,
  concreteItem: string,
  relacaoReal: string,
  frase: string,
  mainActivity: string,
  segment: string,
): Promise<Julgamento> {
  const prompt = `Você é juiz de qualidade de frases de pauta de conteúdo (Sugestão) para uma empresa de "${mainActivity}" (segmento ${segment}).

ITEM: "${concreteItem}"
RELAÇÃO REAL QUE A FRASE DEVE EXPRESSAR: "${relacaoReal}"
FRASE: "${frase}"

Avalie em 4 critérios INDEPENDENTES:
1. plausibilidadeOk — descreve algo que poderia acontecer de verdade?
2. realidadeReconhecivelOk — um cliente REAL desse ramo reconheceria na hora como algo que já viveu?
3. especificidadeCategoriaOk — TESTE DE TROCA: se trocasse "${concreteItem}" por outro item/serviço do segmento ${segment} de outro negócio, a frase ainda faria sentido do mesmo jeito? Se sim, FALSE — não é específica desta categoria de item.
4. naturalidadeConectorOk — o "para" soa natural nessa frase?

Responda JSON EXATAMENTE assim:
{ "plausibilidadeOk": true, "realidadeReconhecivelOk": true, "especificidadeCategoriaOk": true, "naturalidadeConectorOk": true, "motivo": "1 frase curta se algum for false" }`;

  const result = await fetchOpenAIChat(apiKey, {
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  const content = result.data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia");
  return JSON.parse(content) as Julgamento;
}

describe("Fase A parte 4 — ruído do juiz em texto FIXO, 3x por caso (chamadas reais à OpenAI)", () => {
  it("julga o mesmo texto 3 vezes por caso e grava o relatório em output/", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      label: string;
      concreteItem: string;
      relacaoReal: string;
      frase: string;
      julgamentos: Julgamento[];
      especificidadeCategoriaOkCount: number;
      estavel: boolean;
    }> = [];

    for (const caso of CASOS_FIXOS) {
      console.log(`\n▶ ${caso.label}`);
      const julgamentos: Julgamento[] = [];

      for (let rep = 1; rep <= REPETICOES_JUIZ; rep++) {
        await sleep(1200);
        const julgamento = await julgarFrase(
          apiKey!,
          caso.concreteItem,
          caso.relacaoReal,
          caso.frase,
          caso.mainActivity,
          caso.segment,
        );
        console.log(
          `  Julgamento ${rep}/${REPETICOES_JUIZ}: espec:${julgamento.especificidadeCategoriaOk ? "✓" : "✗"} real:${julgamento.realidadeReconhecivelOk ? "✓" : "✗"}${julgamento.motivo ? ` — ${julgamento.motivo}` : ""}`,
        );
        julgamentos.push(julgamento);
      }

      const especificidadeCategoriaOkCount = julgamentos.filter(
        (j) => j.especificidadeCategoriaOk,
      ).length;
      results.push({
        label: caso.label,
        concreteItem: caso.concreteItem,
        relacaoReal: caso.relacaoReal,
        frase: caso.frase,
        julgamentos,
        especificidadeCategoriaOkCount,
        estavel:
          especificidadeCategoriaOkCount === 0 ||
          especificidadeCategoriaOkCount === REPETICOES_JUIZ,
      });
    }

    console.log("\n═══ RESUMO ═══");
    for (const r of results) {
      console.log(
        `${r.label}: espec passou ${r.especificidadeCategoriaOkCount}/${REPETICOES_JUIZ} em texto IDÊNTICO — ${r.estavel ? "JUIZ ESTÁVEL" : "JUIZ OSCILOU (ruído do instrumento)"}`,
      );
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `results-sintomareal-ruidojuiz-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(CASOS_FIXOS.length);
  }, 300_000);
});
