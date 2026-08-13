import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";

// Investigação separada (12/07/2026) — 2 bugs reais achados em amostra ao
// vivo pós-deploy da relação real (FERRIMAQ "mudando teu expediente agora"
// — promessa inflada + registro "teu"; Barbosa "para trator render jornada
// longa" — agramatical). Ambos em itens VAREJO, caminho ANTIGO/intocado
// pela mudança de hoje — não é regressão, é bug pré-existente da Variante A.
// Este harness roda mais amostras reais de VAREJO (5 clientes, 3 repetições
// cada, modo PU/oportunidade — mesmo formato dos 2 exemplos ruins) pra ver
// se os dois padrões (registro "teu"/promessa inflada, agramaticalidade) são
// recorrentes ou coincidência de amostra pequena.
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.varejo-qualidade-amostra.harness.ts

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

interface ClienteVarejo {
  companyName: string;
  mainActivity: string;
  item: string;
  audience: "B2C" | "B2B";
}

const CLIENTES_VAREJO: ClienteVarejo[] = [
  {
    companyName: "FERRIMAQ",
    mainActivity:
      "Venda de Móveis para Escritório, Consultórios, Auditórios, Refeitório e Escolares",
    item: "Poltrona de trabalho",
    audience: "B2B",
  },
  {
    companyName: "Barbosa Lubrificantes",
    mainActivity: "Loja de lubrificantes, correias, mangueiras, ferramentas e EPI",
    item: "Lubrificantes agrícolas",
    audience: "B2B",
  },
  {
    companyName: "Loja Rocha",
    mainActivity: "Loja de Ternos e Moda Social Masculina",
    item: "Ternos Slim",
    audience: "B2C",
  },
  {
    companyName: "Moto Vale",
    mainActivity: "Loja de peças e acessórios para motocicletas",
    item: "Capacete de moto",
    audience: "B2C",
  },
  {
    companyName: "Malhação Sports",
    mainActivity:
      "Loja de tênis, chuteiras, camisas de clube, camisas de marca, moda fitness, relógios, perfumes etc",
    item: "Tênis",
    audience: "B2C",
  },
];

// Sinais determinísticos dos 2 padrões achados na amostra do usuário — não
// substitui leitura humana/Opus, só sinaliza candidato pra revisão rápida.
const REGISTRO_INFORMAL_RE = /\b(teu|tua|teus|tuas|tu)\b/i;
const PROMESSA_INFLADA_RE =
  /\b(transforma|revoluciona|muda(ndo)?\s+(a\s+)?(sua|tua)?\s*vida|realize\s+seu\s+sonho)\b/i;

describe("Investigação — qualidade de amostra VAREJO real, 3x por cliente (chamadas reais à OpenAI)", () => {
  it("gera 3 sugestões PU/oportunidade por cliente e sinaliza padrões suspeitos", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      companyName: string;
      item: string;
      geracoes: Array<{
        sugestao?: string;
        registroInformalSuspeito?: boolean;
        promessaInfladaSuspeita?: boolean;
        error?: string;
      }>;
    }> = [];

    for (const cfg of CLIENTES_VAREJO) {
      console.log(`\n▶ ${cfg.companyName} — ${cfg.item}`);
      const geracoes: (typeof results)[number]["geracoes"] = [];

      for (let rep = 1; rep <= REPETICOES; rep++) {
        try {
          const { sugestao } = await generateSugestao(apiKey!, {
            ...base,
            companyName: cfg.companyName,
            mainActivity: cfg.mainActivity,
            segment: "VAREJO",
            objetivo: "oportunidade",
            mode: "postunico",
            selectedProducts: [cfg.item],
            audience: cfg.audience,
            attempt: rep - 1,
          });
          const registroInformalSuspeito = REGISTRO_INFORMAL_RE.test(sugestao);
          const promessaInfladaSuspeita = PROMESSA_INFLADA_RE.test(sugestao);
          console.log(
            `  ${rep}. "${sugestao}"${registroInformalSuspeito ? " ⚠REGISTRO" : ""}${promessaInfladaSuspeita ? " ⚠PROMESSA" : ""}`,
          );
          geracoes.push({ sugestao, registroInformalSuspeito, promessaInfladaSuspeita });
        } catch (e) {
          geracoes.push({ error: (e as Error).message });
        }
      }

      results.push({ companyName: cfg.companyName, item: cfg.item, geracoes });
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `results-varejo-qualidade-amostra-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(CLIENTES_VAREJO.length);
  }, 300_000);
});
