import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import { deriveRelacaoReal } from "./sintomaReal";

// FASE A (parte 3) — recomendação do Opus: antes de aceitar meta-processo
// como limite estrutural do formato curto, tentar uma correção barata no
// PASSO DE COMPRESSÃO (relação → frase de 4-7 palavras). Achado do harness
// de repetição anterior: quando relação e frase saem idênticas entre
// repetições, o juiz é consistente — a instabilidade está em como a
// compressão às vezes PRESERVA o gancho específico da relação ("mensagens
// desconexas") e às vezes PARAFRASEIA pra termo de categoria genérico
// ("esforços dispersos", "engajamento e visibilidade").
//
// Única mudança vs. run.sintomareal.repeticao-metaprocesso.harness.ts:
// gerarFraseComParaFixo ganha uma instrução explícita pra preservar o
// substantivo/verbo MAIS CONCRETO da relação real, em vez de resumir pra
// vocabulário abstrato de categoria. Mesmos 3 itens, mesma empresa, mesmas
// 3 repetições — comparação direta com o baseline (2/9 no teste anterior).
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.sintomareal.compressaopreserva-metaprocesso.harness.ts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const COMPANY_NAME = "Oficina de Propaganda";
const MAIN_ACTIVITY = "Consultoria de Marketing Digital";
const SEGMENT = "SERVIÇOS";
const REPETICOES = 3;

const ITENS_META_PROCESSO = [
  "Planejamento de Comunicação",
  "Gestão de redes sociais",
  "Estratégia de Marketing Digital",
];

// ÚNICA diferença real deste harness — instrução de preservação do gancho
// concreto adicionada ao prompt de compressão.
async function gerarFraseComParaFixoPreservaGancho(
  apiKey: string,
  concreteItem: string,
  relacaoReal: string,
): Promise<string> {
  const prompt = `Você recebe um ITEM concreto e uma RELAÇÃO REAL já validada entre esse item e uma situação/necessidade/consequência real. Escreva UMA frase curta de pauta de conteúdo (assunto de um conjunto de posts de Instagram) usando o conector "PARA" (finalidade: "${concreteItem} para [situação]"), expressando fielmente essa relação — sem inventar conteúdo novo.

ITEM: "${concreteItem}"
RELAÇÃO REAL: "${relacaoReal}"

PRESERVAÇÃO DO GANCHO (regra crítica): identifique na RELAÇÃO REAL acima a palavra ou expressão MAIS CONCRETA e ESPECÍFICA (o sintoma/situação exato, não a categoria geral) — ex.: se a relação fala em "mensagens digitais ficam desconexas", o gancho concreto é "mensagens desconexas", NÃO "falta de organização" ou "esforços dispersos" (isso é paráfrase genérica que perde a especificidade). A frase final PRECISA conter esse gancho concreto ou uma variação mínima dele — PROIBIDO substituir por sinônimo mais abstrato/genérico só para a frase soar mais "profissional". Prefira uma frase menos elegante que preserva o gancho a uma frase mais bonita que o perde.

PÚBLICO-ALVO: EMPRESARIAL (B2B) — fale com o dono/responsável do negócio.
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
): Promise<Julgamento> {
  const prompt = `Você é juiz de qualidade de frases de pauta de conteúdo (Sugestão) para uma empresa de "${MAIN_ACTIVITY}" (segmento ${SEGMENT}).

ITEM: "${concreteItem}"
RELAÇÃO REAL QUE A FRASE DEVE EXPRESSAR: "${relacaoReal}"
FRASE: "${frase}"

Avalie em 4 critérios INDEPENDENTES:
1. plausibilidadeOk — descreve algo que poderia acontecer de verdade?
2. realidadeReconhecivelOk — um cliente REAL desse ramo reconheceria na hora como algo que já viveu?
3. especificidadeCategoriaOk — TESTE DE TROCA: se trocasse "${concreteItem}" por outro item/serviço do segmento ${SEGMENT} de outro negócio, a frase ainda faria sentido do mesmo jeito? Se sim, FALSE — não é específica desta categoria de item.
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

describe("Fase A parte 3 — compressão preserva gancho, repetição 3x em meta-processo (chamadas reais à OpenAI)", () => {
  it("roda 3 repetições por item com a instrução nova e grava o relatório em output/", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      item: string;
      repeticoes: Array<{
        relacaoReal: string | null;
        frase: string | null;
        julgamento: Julgamento | null;
        error?: string;
      }>;
      especificidadeCategoriaOkCount: number;
      estavel: boolean;
    }> = [];

    for (const item of ITENS_META_PROCESSO) {
      console.log(`\n▶ ${item}`);
      const repeticoes: (typeof results)[number]["repeticoes"] = [];

      for (let rep = 1; rep <= REPETICOES; rep++) {
        console.log(`  Repetição ${rep}/${REPETICOES}`);
        await sleep(1500);
        try {
          const { relacao } = await deriveRelacaoReal(
            apiKey!,
            item,
            COMPANY_NAME,
            MAIN_ACTIVITY,
            SEGMENT,
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
          const frase = await gerarFraseComParaFixoPreservaGancho(apiKey!, item, relacao);
          await sleep(1000);
          const julgamento = await julgarFrase(apiKey!, item, relacao, frase);
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
        item,
        repeticoes,
        especificidadeCategoriaOkCount,
        estavel:
          especificidadeCategoriaOkCount === 0 || especificidadeCategoriaOkCount === REPETICOES,
      });
    }

    console.log(
      "\n═══ RESUMO (comparar com baseline 2/9 do harness sem preservação de gancho) ═══",
    );
    let totalOk = 0;
    for (const r of results) {
      totalOk += r.especificidadeCategoriaOkCount;
      console.log(
        `${r.item}: especificidade passou ${r.especificidadeCategoriaOkCount}/${REPETICOES}`,
      );
    }
    console.log(
      `TOTAL: ${totalOk}/${REPETICOES * ITENS_META_PROCESSO.length} (baseline sem a instrução nova: 2/9)`,
    );

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(
      outDir,
      `results-sintomareal-compressaopreserva-metaprocesso-${Date.now()}.json`,
    );
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(ITENS_META_PROCESSO.length);
  }, 600_000);
});
