import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import { deriveRelacaoReal } from "./sintomaReal";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";

// FASE A (parte 6) — validação final antes de travar a arquitetura
// bifurcada (recomendação do Opus, 12/07/2026): o padrão "item físico
// piora com relação-real, Variante A já ancora de graça pela textura do
// item" foi visto em UM item só (Ternos Slim). Testar mais 3-4 itens
// físicos REAIS de verticais diferentes, nos DOIS pipelines (novo vs.
// Variante A), 3x cada, pra ver se o padrão segura ou foi coincidência.
//
// 4 itens físicos REAIS, 3 negócios diferentes (dados do Supabase,
// 12/07/2026), nenhum repetido dos testes anteriores (terno/kit relação já
// testados):
// - FERRIMAQ — "Cadeiras para escritório" (móveis, B2B)
// - Barbosa Lubrificantes — "Correias industriais" (peça industrial, B2B)
// - Moto Vale — "Capacete de moto" (equipamento de segurança, B2C —
//   diferente textura de "kit relação", que é peça mecânica)
// - Malhação Sports — "Tênis" (vestuário/calçado esportivo, B2C — nome
//   literal na atividade cadastrada, sem lista de produtos própria)
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.sintomareal.validacao-itensfisicos-novos.harness.ts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REPETICOES = 3;

interface ItemFisico {
  item: string;
  companyName: string;
  mainActivity: string;
  segment: "VAREJO";
  audience: "B2C" | "B2B";
  objetivo: string;
  mode: "metodo" | "postunico";
}

const ITENS_FISICOS: ItemFisico[] = [
  {
    item: "Cadeiras para escritório",
    companyName: "FERRIMAQ",
    mainActivity:
      "Venda de Móveis para Escritório, Consultórios, Auditórios, Refeitório e Escolares",
    segment: "VAREJO",
    audience: "B2B",
    objetivo: "promocao",
    mode: "metodo",
  },
  {
    item: "Correias industriais",
    companyName: "Barbosa Lubrificantes",
    mainActivity: "Loja de lubrificantes, correias, mangueiras, ferramentas e EPI",
    segment: "VAREJO",
    audience: "B2B",
    objetivo: "oportunidade",
    mode: "postunico",
  },
  {
    item: "Capacete de moto",
    companyName: "Moto Vale",
    mainActivity: "Loja de peças e acessórios para motocicletas",
    segment: "VAREJO",
    audience: "B2C",
    objetivo: "promocao",
    mode: "metodo",
  },
  {
    item: "Tênis",
    companyName: "Malhação Sports",
    mainActivity:
      "Loja de tênis, chuteiras, camisas de clube, camisas de marca, moda fitness, relógios, perfumes etc",
    segment: "VAREJO",
    audience: "B2C",
    objetivo: "promocao",
    mode: "postunico",
  },
];

// Duplicado de propósito — mesmo padrão dos outros harnesses.
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
  motivo: string;
}

async function julgarFraseIndependente(
  apiKey: string,
  concreteItem: string,
  frase: string,
  mainActivity: string,
  segment: string,
): Promise<Julgamento> {
  const prompt = `Você é juiz de qualidade de frases de pauta de conteúdo (Sugestão) para uma empresa de "${mainActivity}" (segmento ${segment}).

ITEM DE ORIGEM DA SUGESTÃO: "${concreteItem}"
FRASE: "${frase}"

Avalie em 3 critérios INDEPENDENTES:
1. plausibilidadeOk — a frase descreve algo que poderia acontecer de verdade, sem causa-efeito absurdo?
2. realidadeReconhecivelOk — um cliente REAL desse ramo, lendo a frase, reconheceria na hora como algo que já viveu?
3. especificidadeCategoriaOk — TESTE DE TROCA: se trocasse "${concreteItem}" por outro item/serviço qualquer do segmento ${segment}, vendido por um negócio diferente, a frase ainda faria sentido do mesmo jeito? Se sim, FALSE.

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
  return JSON.parse(content) as Julgamento;
}

describe("Fase A parte 6 — validação de 4 itens físicos novos, pipeline novo vs Variante A (chamadas reais à OpenAI)", () => {
  it("roda 3 repetições por item em ambos pipelines e grava o relatório em output/", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      item: string;
      companyName: string;
      pipelineNovo: { especificidadeCategoriaOkCount: number; detalhes: unknown[] };
      variantA: { especificidadeCategoriaOkCount: number; detalhes: unknown[] };
    }> = [];

    for (const cfg of ITENS_FISICOS) {
      console.log(`\n▶ ${cfg.companyName} — ${cfg.item}`);

      // Pipeline novo: relação real + PARA fixo, 3x
      const detalhesNovo: unknown[] = [];
      for (let rep = 1; rep <= REPETICOES; rep++) {
        console.log(`  [Pipeline novo] repetição ${rep}/${REPETICOES}`);
        await sleep(1200);
        try {
          const { relacao } = await deriveRelacaoReal(
            apiKey!,
            cfg.item,
            cfg.companyName,
            cfg.mainActivity,
            cfg.segment,
          );
          if (!relacao) {
            detalhesNovo.push({ error: "relação real falhou" });
            continue;
          }
          await sleep(800);
          const frase = await gerarFraseComParaFixo(apiKey!, cfg.item, relacao, cfg.audience);
          await sleep(800);
          const julgamento = await julgarFraseIndependente(
            apiKey!,
            cfg.item,
            frase,
            cfg.mainActivity,
            cfg.segment,
          );
          console.log(`    "${frase}" — espec:${julgamento.especificidadeCategoriaOk ? "✓" : "✗"}`);
          detalhesNovo.push({ relacaoReal: relacao, frase, julgamento });
        } catch (e) {
          detalhesNovo.push({ error: (e as Error).message });
        }
      }

      // Variante A, 3x
      const detalhesVariantA: unknown[] = [];
      const inputVariantA: SugestaoEngineInput = {
        companyName: cfg.companyName,
        mainActivity: cfg.mainActivity,
        objetivo: cfg.objetivo,
        hint: "",
        mode: cfg.mode,
        attempt: 0,
        sessionSeed: 0,
        previousSuggestions: [],
        segment: cfg.segment,
        isPersonalBrand: false,
        selectedProducts: [cfg.item],
        audience: cfg.audience,
        brandVoice: "",
      };
      for (let rep = 1; rep <= REPETICOES; rep++) {
        console.log(`  [Variante A] repetição ${rep}/${REPETICOES}`);
        await sleep(1200);
        try {
          const { sugestao } = await generateSugestao(apiKey!, inputVariantA);
          await sleep(800);
          const julgamento = await julgarFraseIndependente(
            apiKey!,
            cfg.item,
            sugestao,
            cfg.mainActivity,
            cfg.segment,
          );
          console.log(
            `    "${sugestao}" — espec:${julgamento.especificidadeCategoriaOk ? "✓" : "✗"}`,
          );
          detalhesVariantA.push({ sugestao, julgamento });
        } catch (e) {
          detalhesVariantA.push({ error: (e as Error).message });
        }
      }

      const countNovo = detalhesNovo.filter(
        (d) => (d as { julgamento?: Julgamento }).julgamento?.especificidadeCategoriaOk,
      ).length;
      const countVariantA = detalhesVariantA.filter(
        (d) => (d as { julgamento?: Julgamento }).julgamento?.especificidadeCategoriaOk,
      ).length;

      results.push({
        item: cfg.item,
        companyName: cfg.companyName,
        pipelineNovo: { especificidadeCategoriaOkCount: countNovo, detalhes: detalhesNovo },
        variantA: { especificidadeCategoriaOkCount: countVariantA, detalhes: detalhesVariantA },
      });
    }

    console.log("\n═══ RESUMO — pipeline novo vs Variante A, especificidade/3 ═══");
    for (const r of results) {
      console.log(
        `${r.companyName} — ${r.item}: novo=${r.pipelineNovo.especificidadeCategoriaOkCount}/3, VarianteA=${r.variantA.especificidadeCategoriaOkCount}/3`,
      );
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(
      outDir,
      `results-sintomareal-validacao-itensfisicos-novos-${Date.now()}.json`,
    );
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(ITENS_FISICOS.length);
  }, 900_000);
});
