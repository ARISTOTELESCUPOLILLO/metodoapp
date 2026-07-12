import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import { deriveRelacaoReal } from "./sintomaReal";

// FASE A (parte 2) — recomendação do Opus após a repetição em meta-processo
// expor que "Planejamento de Comunicação" tinha passado por SORTE no teste
// de n=1 (3/3 "vitória" continha um falso positivo): não assumir que os
// itens concretos estão seguros só porque a explicação mecanística
// (substantivo físico sobrevive à compressão) é plausível — testar também.
// Mesma disciplina: relação real derivada do ZERO a cada repetição, 3x por
// item, 4 clientes REAIS diferentes da carteira (2 SERVIÇOS-com-entregável-
// tangível + 2 VAREJO físico, os 2 tipos de "concreto" testados na rodada
// de 7 conectores).
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.sintomareal.repeticao-itensconcretos.harness.ts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REPETICOES = 3;

interface ItemConcreto {
  item: string;
  companyName: string;
  mainActivity: string;
  segment: string;
  audience: "B2C" | "B2B";
}

const ITENS_CONCRETOS: ItemConcreto[] = [
  {
    item: "Criação de sites",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    segment: "SERVIÇOS",
    audience: "B2B",
  },
  {
    item: "Criação de logomarca",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing Digital",
    segment: "SERVIÇOS",
    audience: "B2B",
  },
  {
    item: "Ternos Slim",
    companyName: "Loja Rocha",
    mainActivity: "Loja de Ternos e Moda Social Masculina",
    segment: "VAREJO",
    audience: "B2C",
  },
  {
    item: "kit relação",
    companyName: "Moto Vale",
    mainActivity: "Loja de peças e acessórios para motocicletas",
    segment: "VAREJO",
    audience: "B2C",
  },
];

// Duplicado de propósito — mesmo padrão dos outros harnesses de ab-sugestao.
async function gerarFraseComParaFixo(
  apiKey: string,
  concreteItem: string,
  relacaoReal: string,
  audience: "B2C" | "B2B",
): Promise<string> {
  const audienceDirective =
    audience === "B2C"
      ? "PÚBLICO-ALVO: CONSUMIDOR FINAL (B2C) — fale com a PESSOA, não com o empresário."
      : "PÚBLICO-ALVO: EMPRESARIAL (B2B) — fale com o dono/responsável do negócio.";

  const prompt = `Você recebe um ITEM concreto e uma RELAÇÃO REAL já validada entre esse item e uma situação/necessidade/consequência real. Escreva UMA frase curta de pauta de conteúdo (assunto de um conjunto de posts de Instagram) usando o conector "PARA" (finalidade: "${concreteItem} para [situação]"), expressando fielmente essa relação — sem inventar conteúdo novo.

ITEM: "${concreteItem}"
RELAÇÃO REAL: "${relacaoReal}"

${audienceDirective}
PROIBIDO inventar promoção, desconto, prazo ou dado que não esteja na relação real acima. Sem jargão de marketing. Sem tensão, urgência ou linguagem de campanha. Sem hashtag, sem emoji, sem aspas. Entre 4 e 7 palavras (máximo absoluto 7).

Responda JSON EXATAMENTE assim: { "frase": "..." }`;

  const result = await fetchOpenAIChat(apiKey, {
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: "Você é estrategista de conteúdo brasileiro. Responda SEMPRE com JSON válido.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  const content = result.data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia");
  const parsed = JSON.parse(content) as { frase?: string };
  return String(parsed.frase || "").trim();
}

interface Julgamento {
  plausibilidadeOk: boolean;
  realidadeReconhecivelOk: boolean;
  especificidadeCategoriaOk: boolean;
  naturalidadeConectorOk: boolean;
  motivo: string;
}

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

describe("Fase A parte 2 — repetição 3x em itens CONCRETOS (chamadas reais à OpenAI)", () => {
  it("roda 3 repetições por item e grava o relatório em output/", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      item: string;
      companyName: string;
      repeticoes: Array<{
        relacaoReal: string | null;
        frase: string | null;
        julgamento: Julgamento | null;
        error?: string;
      }>;
      especificidadeCategoriaOkCount: number;
      estavel: boolean;
    }> = [];

    for (const cfg of ITENS_CONCRETOS) {
      console.log(`\n▶ ${cfg.companyName} — ${cfg.item}`);
      const repeticoes: (typeof results)[number]["repeticoes"] = [];

      for (let rep = 1; rep <= REPETICOES; rep++) {
        console.log(`  Repetição ${rep}/${REPETICOES}`);
        await sleep(1500);
        try {
          const { relacao } = await deriveRelacaoReal(
            apiKey!,
            cfg.item,
            cfg.companyName,
            cfg.mainActivity,
            cfg.segment,
          );
          if (!relacao) {
            repeticoes.push({
              relacaoReal: null,
              frase: null,
              julgamento: null,
              error: "relação real falhou",
            });
            continue;
          }
          await sleep(1000);
          const frase = await gerarFraseComParaFixo(apiKey!, cfg.item, relacao, cfg.audience);
          await sleep(1000);
          const julgamento = await julgarFrase(
            apiKey!,
            cfg.item,
            relacao,
            frase,
            cfg.mainActivity,
            cfg.segment,
          );
          console.log(
            `    "${frase}" — espec:${julgamento.especificidadeCategoriaOk ? "✓" : "✗"} real:${julgamento.realidadeReconhecivelOk ? "✓" : "✗"}${julgamento.motivo ? ` (${julgamento.motivo})` : ""}`,
          );
          repeticoes.push({ relacaoReal: relacao, frase, julgamento });
        } catch (e) {
          repeticoes.push({
            relacaoReal: null,
            frase: null,
            julgamento: null,
            error: (e as Error).message,
          });
        }
      }

      const especificidadeCategoriaOkCount = repeticoes.filter(
        (r) => r.julgamento?.especificidadeCategoriaOk,
      ).length;
      results.push({
        item: cfg.item,
        companyName: cfg.companyName,
        repeticoes,
        especificidadeCategoriaOkCount,
        estavel:
          especificidadeCategoriaOkCount === 0 || especificidadeCategoriaOkCount === REPETICOES,
      });
    }

    console.log("\n═══ RESUMO ═══");
    for (const r of results) {
      console.log(
        `${r.companyName} — ${r.item}: especificidade passou ${r.especificidadeCategoriaOkCount}/${REPETICOES} — ${r.estavel ? "ESTÁVEL" : "OSCILOU (fronteira)"}`,
      );
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(
      outDir,
      `results-sintomareal-repeticao-itensconcretos-${Date.now()}.json`,
    );
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(ITENS_CONCRETOS.length);
  }, 600_000);
});
