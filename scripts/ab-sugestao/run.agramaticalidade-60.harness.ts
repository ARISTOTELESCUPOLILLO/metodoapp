import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";
import { checkAmputatedPredicate } from "@/core/sugestaoValidation";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";

// Mede a TAXA DE FRASE QUEBRADA em 60 gerações reais — 2x a amostra do teste
// de repertório (3043fb9), que achou 4 quebradas em 30 (13%) mas era pequena
// demais para confirmar queda.
//
// Mesmos 10 itens do teste de repertório, 6 gerações cada (lá eram 3), para
// que a comparação com aquele baseline tenha uma variável só.
//
// O juiz aqui é ESTREITO de propósito: pergunta só se a frase está
// gramaticalmente completa. É pergunta de gramática, não de gosto — bem mais
// confiável que o juiz de fato-vs-avaliação, que falhou justamente por ter de
// julgar semântica ("engajamento constante" é fato do mundo?).
//
// Rótulo da configuração vem de AB_LABEL, para os arquivos de saída das
// rodadas de 7 e de 9 palavras não se sobrescreverem.
//
// Roda com:
//   AB_LABEL=max7 node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.agramaticalidade-60.harness.ts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GERACOES = 6;
const LABEL = process.env.AB_LABEL || "sem-rotulo";

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

interface Caso {
  label: string;
  companyName: string;
  mainActivity: string;
  item: string;
  segment: "VAREJO" | "SERVIÇOS";
  audience: "B2C" | "B2B";
}

// Idênticos aos do run.fato-vs-avaliacao — não alterar sem perder o baseline.
const CASOS: Caso[] = [
  {
    label: "Capacete de moto",
    companyName: "Moto Vale",
    mainActivity: "Loja de peças e acessórios para motocicletas",
    item: "Capacete de moto",
    segment: "VAREJO",
    audience: "B2C",
  },
  {
    label: "Tênis",
    companyName: "Malhação Sports",
    mainActivity:
      "Loja de tênis, chuteiras, camisas de clube, camisas de marca, moda fitness, relógios, perfumes etc",
    item: "Tênis",
    segment: "VAREJO",
    audience: "B2C",
  },
  {
    label: "Ternos Slim",
    companyName: "Loja Rocha",
    mainActivity: "Loja de Ternos e Moda Social Masculina",
    item: "Ternos Slim",
    segment: "VAREJO",
    audience: "B2C",
  },
  {
    label: "Poltrona de trabalho",
    companyName: "FERRIMAQ",
    mainActivity:
      "Venda de Móveis para Escritório, Consultórios, Auditórios, Refeitório e Escolares",
    item: "Poltrona de trabalho",
    segment: "VAREJO",
    audience: "B2B",
  },
  {
    label: "Lubrificantes agrícolas",
    companyName: "Barbosa Lubrificantes",
    mainActivity: "Loja de lubrificantes, correias, mangueiras, ferramentas e EPI",
    item: "Lubrificantes agrícolas",
    segment: "VAREJO",
    audience: "B2B",
  },
  {
    label: "Consultas veterinárias",
    companyName: "Pronto Vet",
    mainActivity: "Clínica veterinária com loja de rações e acessórios para pets",
    item: "Consultas veterinárias",
    segment: "SERVIÇOS",
    audience: "B2C",
  },
  {
    label: "Criação de sites",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    item: "Criação de sites",
    segment: "SERVIÇOS",
    audience: "B2B",
  },
  {
    label: "Planejamento de Comunicação",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    item: "Planejamento de Comunicação",
    segment: "SERVIÇOS",
    audience: "B2B",
  },
  {
    label: "Gestão de redes sociais",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    item: "Gestão de redes sociais",
    segment: "SERVIÇOS",
    audience: "B2B",
  },
  {
    label: "Estratégia de Marketing Digital",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    item: "Estratégia de Marketing Digital",
    segment: "SERVIÇOS",
    audience: "B2B",
  },
];

interface Veredito {
  completa: boolean;
  problema: string;
  palavraFaltando: string;
}

async function julgarCompletude(apiKey: string, frase: string): Promise<Veredito> {
  const prompt = `Você é revisor de português brasileiro. Analise APENAS a gramática desta frase curta de pauta de conteúdo. NÃO julgue se ela é bonita, criativa, específica ou vendedora — só se está COMPLETA.

FRASE: "${frase}"

Uma frase está INCOMPLETA quando falta alguma palavra para ela fazer sentido sozinha:
- verbo transitivo sem objeto ("...em época promocional evita" — evita o quê?)
- substantivo que pede complemento e não tem ("...para apatia ou falta" — falta de quê?)
- preposição faltando ("ajuda reunião correr melhor" — falta o "a" antes de "correr")
- gerúndio solto, sem sujeito que o sustente ("Capacete de moto escolhendo novo visual")
- termina em conjunção, preposição ou artigo

Uma frase está COMPLETA mesmo sendo uma locução sem verbo — isso é normal e correto aqui:
- "Capacete de moto para chuva repentina" (COMPLETA)
- "Lubrificantes agrícolas em dias de safra" (COMPLETA)
- "Tênis novo para corrida amanhã cedo" (COMPLETA)
- "Poltrona de trabalho tira a dor lombar" (COMPLETA)

Responda JSON EXATAMENTE assim:
{ "completa": true, "problema": "vazio se completa; senão diga em 1 frase o que falta", "palavraFaltando": "a palavra ou tipo de palavra que falta, ou vazio" }`;

  const result = await fetchOpenAIChat(apiKey, {
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  const content = result.data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia");
  return JSON.parse(content) as Veredito;
}

describe(`Agramaticalidade — 60 gerações reais [${LABEL}] (chamadas reais à OpenAI)`, () => {
  it("gera 6 sugestões para 10 itens e mede a taxa de frase quebrada", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      label: string;
      item: string;
      geracoes: Array<{
        sugestao?: string;
        palavras?: number;
        completa?: boolean;
        problema?: string;
        pegaPelaRede?: boolean;
        error?: string;
      }>;
    }> = [];

    for (const caso of CASOS) {
      console.log(`\n▶ ${caso.label}`);
      const geracoes: (typeof results)[number]["geracoes"] = [];

      for (let rep = 0; rep < GERACOES; rep++) {
        try {
          const { sugestao } = await generateSugestao(apiKey!, {
            ...base,
            companyName: caso.companyName,
            mainActivity: caso.mainActivity,
            segment: caso.segment,
            objetivo: "oportunidade",
            mode: "postunico",
            selectedProducts: [caso.item],
            audience: caso.audience,
            attempt: rep,
          });
          await sleep(900);
          const veredito = await julgarCompletude(apiKey!, sugestao);
          // A rede determinística já rodou dentro do motor; aqui só registramos
          // se ELA teria pego esta frase, para separar o que a instrução
          // resolveu do que o check está segurando.
          const pegaPelaRede = checkAmputatedPredicate(sugestao).length > 0;
          const palavras = sugestao.trim().split(/\s+/).filter(Boolean).length;
          console.log(
            `  ${rep + 1}. [${palavras}p] "${sugestao}"${veredito.completa ? "" : `  ⚠ QUEBRADA — ${veredito.problema}`}`,
          );
          geracoes.push({
            sugestao,
            palavras,
            completa: veredito.completa,
            problema: veredito.problema,
            pegaPelaRede,
          });
        } catch (e) {
          console.log(`  ${rep + 1}. ERRO: ${(e as Error).message}`);
          geracoes.push({ error: (e as Error).message });
        }
      }

      results.push({ label: caso.label, item: caso.item, geracoes });
    }

    const todas = results.flatMap((r) => r.geracoes).filter((g) => g.sugestao);
    const quebradas = todas.filter((g) => g.completa === false);
    const mediaPalavras = todas.reduce((s, g) => s + (g.palavras ?? 0), 0) / (todas.length || 1);
    const noTeto = todas.filter((g) => (g.palavras ?? 0) >= 7).length;

    console.log(`\n═══ RESULTADO [${LABEL}] ═══`);
    console.log(`  quebradas: ${quebradas.length} de ${todas.length}`);
    console.log(`  média de palavras: ${mediaPalavras.toFixed(1)}`);
    console.log(`  com 7+ palavras: ${noTeto}`);
    if (quebradas.length) {
      console.log("\n  as quebradas:");
      for (const q of quebradas) console.log(`   [${q.palavras}p] "${q.sugestao}" — ${q.problema}`);
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `results-agramaticalidade-60-${LABEL}.json`);
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          label: LABEL,
          total: todas.length,
          quebradas: quebradas.length,
          mediaPalavras: Number(mediaPalavras.toFixed(2)),
          comSeteOuMais: noTeto,
          results,
        },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(CASOS.length);
  }, 1_200_000);
});
