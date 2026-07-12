import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import { deriveRelacaoReal } from "./sintomaReal";

// FASE A da validação pós-Opus (12/07/2026) — recomendação: itens
// meta-processo/serviço-de-serviço (Planejamento de Comunicação e primos —
// consultoria, gestão de redes, planejamento estratégico) ficaram sempre
// PERTO da linha de corte de especificidadeCategoriaOk no teste de 7
// conectores (nunca um "passa fácil" como Criação de sites) — não dá pra
// confiar em n=1 pra esse subconjunto. Este harness roda o mesmo item 3x
// (relação real derivada do zero a cada vez — não reaproveita a relação
// entre repetições, pra medir a instabilidade REAL do pipeline, não só do
// juiz) e mede se o veredito de especificidade é estável ou oscila.
//
// 3 itens REAIS (todos produtos cadastrados de Oficina de Propaganda,
// mesma conta do print original — dados lidos do Supabase em 12/07/2026):
// "Planejamento de Comunicação" (o caso de fronteira já conhecido, repetido
// aqui pra medir estabilidade), "Gestão de redes sociais" e "Estratégia de
// Marketing Digital" (dois primos do mesmo tipo meta-processo, ainda não
// testados).
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.sintomareal.repeticao-metaprocesso.harness.ts

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

// Duplicado de run.sintomareal.paravalidacao.harness.ts de propósito (mesmo
// padrão dos outros harnesses de ab-sugestao — cada um autocontido, ver
// comentário no topo de run.premissaobservador.harness.ts).
async function gerarFraseComParaFixo(
  apiKey: string,
  concreteItem: string,
  relacaoReal: string,
): Promise<string> {
  const prompt = `Você recebe um ITEM concreto e uma RELAÇÃO REAL já validada entre esse item e uma situação/necessidade/consequência real. Escreva UMA frase curta de pauta de conteúdo (assunto de um conjunto de posts de Instagram) usando o conector "PARA" (finalidade: "${concreteItem} para [situação]"), expressando fielmente essa relação — sem inventar conteúdo novo.

ITEM: "${concreteItem}"
RELAÇÃO REAL: "${relacaoReal}"

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

describe("Fase A — repetição 3x em itens meta-processo (chamadas reais à OpenAI)", () => {
  it("roda 3 repetições por item e grava o relatório em output/", async () => {
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
          const frase = await gerarFraseComParaFixo(apiKey!, item, relacao);
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

    console.log("\n═══ RESUMO ═══");
    for (const r of results) {
      console.log(
        `${r.item}: especificidade passou ${r.especificidadeCategoriaOkCount}/${REPETICOES} — ${r.estavel ? "ESTÁVEL" : "OSCILOU (fronteira)"}`,
      );
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(
      outDir,
      `results-sintomareal-repeticao-metaprocesso-${Date.now()}.json`,
    );
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(ITENS_META_PROCESSO.length);
  }, 600_000);
});
