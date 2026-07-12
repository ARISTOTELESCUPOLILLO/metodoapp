import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import { deriveRelacaoReal } from "./sintomaReal";

// Teste de validação FOCADO (12/07/2026) — recomendação direta do Opus após
// ler os resultados do harness de 7 conectores (ver
// run.sintomareal.harness.ts): antes de tocar em produção, isolar se o
// PASSO 1 SOZINHO (relação real com teste de troca) já resolve a queixa
// original, com conector FIXO em PARA (o vencedor empírico da rodada
// anterior — 8/8 em real-reconhecível e naturalidade) — sem nenhuma
// variação de conector no meio, pra não confundir "Passo 1 funciona" com
// "algum dos 7 conectores compensou o Passo 1 fraco".
//
// Roda contra os 3 itens EXATOS do print original em AJUSTE_CONFLITO
// ("Criação de sites PARA orçamentos recebidos online", "Planejamento de
// comunicação EM campanhas pontuais", "Criação de logomarca PARA abrir
// filiais" — a Variante A de produção nos 3 casos, pra comparação direta
// lado a lado).
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.sintomareal.paravalidacao.harness.ts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const COMPANY_NAME = "Oficina de Propaganda";
const MAIN_ACTIVITY = "Consultoria de Marketing Digital";
const SEGMENT = "SERVIÇOS";

// Os 3 itens exatos do print "só viagem da IA" — mesma empresa, mesmo
// segmento, todos SERVIÇOS abstratos (o caso mais difícil da rodada
// anterior: "Planejamento de Comunicação" foi o único que falhou em TODOS
// os 7 conectores).
const ITENS_DO_PRINT = ["Criação de sites", "Planejamento de Comunicação", "Criação de logomarca"];

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

interface JulgamentoFocado {
  plausibilidadeOk: boolean;
  realidadeReconhecivelOk: boolean;
  especificidadeCategoriaOk: boolean;
  naturalidadeConectorOk: boolean;
  resolveuOQueixaOriginalOk: boolean;
  motivo: string;
}

async function julgarFraseFocado(
  apiKey: string,
  concreteItem: string,
  relacaoReal: string,
  fraseNova: string,
  fraseVariantAOriginal: string,
): Promise<JulgamentoFocado> {
  const prompt = `Você é juiz de qualidade de frases de pauta de conteúdo (Sugestão) para uma empresa de "${MAIN_ACTIVITY}" (segmento ${SEGMENT}).

ITEM: "${concreteItem}"
RELAÇÃO REAL QUE A FRASE DEVE EXPRESSAR: "${relacaoReal}"

FRASE NOVA (Passo 1 + conector PARA fixo): "${fraseNova}"
FRASE ORIGINAL DA VARIANTE A DE PRODUÇÃO (pra comparação — o exemplo que motivou este teste, rotulado pelo dono do produto como "só viagem da IA"): "${fraseVariantAOriginal}"

Avalie a FRASE NOVA nos 4 critérios já usados no teste anterior, mais um 5º específico deste teste:

1. plausibilidadeOk — descreve algo que poderia acontecer de verdade?
2. realidadeReconhecivelOk — um cliente REAL desse ramo reconheceria na hora como algo que já viveu?
3. especificidadeCategoriaOk — TESTE DE TROCA: se trocasse "${concreteItem}" por outro item/serviço do segmento ${SEGMENT} de outro negócio, a frase ainda faria sentido do mesmo jeito? Se sim, FALSE.
4. naturalidadeConectorOk — o "para" soa natural nessa frase?
5. resolveuOQueixaOriginalOk — comparando a FRASE NOVA com a FRASE ORIGINAL DA VARIANTE A: a frase nova é CLARAMENTE menos "inventada"/mais ancorada numa situação real e reconhecível do que a original, ou o problema continua do mesmo jeito?

Responda JSON EXATAMENTE assim:
{ "plausibilidadeOk": true, "realidadeReconhecivelOk": true, "especificidadeCategoriaOk": true, "naturalidadeConectorOk": true, "resolveuOQueixaOriginalOk": true, "motivo": "1-2 frases comparando as duas" }`;

  const result = await fetchOpenAIChat(apiKey, {
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  const content = result.data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia");
  return JSON.parse(content) as JulgamentoFocado;
}

// Frases reais da Variante A de produção pros mesmos 3 itens, coletadas no
// print original de AJUSTE_CONFLITO (12/07/2026) — usadas aqui como
// baseline fixo de comparação, não regeradas (a Variante A já muda a cada
// chamada por causa de temperature; fixar o baseline no que o usuário
// realmente viu é mais honesto pro teste "isso resolve a queixa dele?").
const VARIANTE_A_ORIGINAL_DO_PRINT: Record<string, string> = {
  "Criação de sites": "Criação de sites para orçamentos recebidos online",
  "Planejamento de Comunicação": "Planejamento de comunicação em campanhas pontuais",
  "Criação de logomarca": "Criação de logomarca para abrir filiais",
};

describe("Validação focada — Passo 1 (relação real) + PARA fixo vs. print original (chamadas reais à OpenAI)", () => {
  it("gera e julga os 3 itens exatos do print 'só viagem da IA' e grava o relatório em output/", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      item: string;
      fraseVariantAOriginal: string;
      relacaoReal: string | null;
      fraseNova: string | null;
      julgamento: JulgamentoFocado | null;
      error?: string;
    }> = [];

    for (const item of ITENS_DO_PRINT) {
      console.log(`\n▶ ${item}`);
      await sleep(1500);
      try {
        const { relacao } = await deriveRelacaoReal(
          apiKey!,
          item,
          COMPANY_NAME,
          MAIN_ACTIVITY,
          SEGMENT,
        );
        console.log(`  Relação real: ${relacao ?? "(falhou)"}`);
        if (!relacao) {
          results.push({
            item,
            fraseVariantAOriginal: VARIANTE_A_ORIGINAL_DO_PRINT[item],
            relacaoReal: null,
            fraseNova: null,
            julgamento: null,
            error: "derivação da relação real falhou",
          });
          continue;
        }

        await sleep(1000);
        const fraseNova = await gerarFraseComParaFixo(apiKey!, item, relacao);
        console.log(`  Frase nova (Passo 1 + PARA): "${fraseNova}"`);
        console.log(`  Frase original (print/Variante A): "${VARIANTE_A_ORIGINAL_DO_PRINT[item]}"`);

        await sleep(1000);
        const julgamento = await julgarFraseFocado(
          apiKey!,
          item,
          relacao,
          fraseNova,
          VARIANTE_A_ORIGINAL_DO_PRINT[item],
        );
        console.log(`  Julgamento:`, julgamento);

        results.push({
          item,
          fraseVariantAOriginal: VARIANTE_A_ORIGINAL_DO_PRINT[item],
          relacaoReal: relacao,
          fraseNova,
          julgamento,
        });
      } catch (e) {
        results.push({
          item,
          fraseVariantAOriginal: VARIANTE_A_ORIGINAL_DO_PRINT[item],
          relacaoReal: null,
          fraseNova: null,
          julgamento: null,
          error: (e as Error).message,
        });
      }
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `results-sintomareal-paravalidacao-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(ITENS_DO_PRINT.length);
  }, 300_000);
});
