import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";

// Verificação ao vivo da mudança de 13/08/2026 (commit 324d563): "com" e
// "para" viraram os conectores padrão do prompt, e o aviso de lote parou de
// mandar trocar de conector.
//
// DESENHO: idêntico ao run.varejo-qualidade-amostra.harness.ts de 12/07 —
// mesmos 5 clientes, mesmo item, mesmo modo (PU/oportunidade), 3 repetições,
// SEM encadear previousSuggestions. Isso é de propósito: o arquivo
// output/results-varejo-qualidade-amostra-1783888756817.json guarda as 15
// frases geradas com o prompt ANTIGO nessa exata configuração, então rodar o
// mesmo desenho agora dá comparação antes/depois com uma variável só (o
// prompt). Mudar qualquer parâmetro aqui destrói a comparabilidade.
//
// LIMITE CONHECIDO: sem previousSuggestions o conectorWarning nunca dispara,
// então esta rodada mede APENAS a mudança nº 1 (hierarquia no bloco de
// contexto). A mudança nº 2 (aviso de lote) precisa de uma rodada encadeada
// própria — não confundir as duas na leitura do resultado.
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.conectores-pos-mudanca.harness.ts

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

// Copiado sem alteração de run.varejo-qualidade-amostra.harness.ts — qualquer
// divergência aqui invalidaria a comparação com o baseline de 12/07.
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

// Mesma lista e MESMA ORDEM do CONECTOR_PATTERNS de sugestaoEngine.ts — a
// ordem importa porque a detecção para no primeiro que casar.
const CONECTOR_PATTERNS: { nome: string; re: RegExp }[] = [
  { nome: "para", re: /\bpara\b/ },
  { nome: "com", re: /\bcom\b/ },
  { nome: "em", re: /\bem\b/ },
  { nome: "no", re: /\bno\b/ },
  { nome: "na", re: /\bna\b/ },
  { nome: "nos", re: /\bnos\b/ },
  { nome: "nas", re: /\bnas\b/ },
  { nome: "à", re: /\bà\b/ },
  { nome: "e", re: /\be\b/ },
];
const detectConector = (s: string): string | null =>
  CONECTOR_PATTERNS.find(({ re }) => re.test(s.toLowerCase()))?.nome ?? null;

const FORTES = new Set(["com", "para"]);

describe("Conectores pós-mudança — 15 gerações reais de VAREJO (chamadas reais à OpenAI)", () => {
  it("gera 3 sugestões PU/oportunidade por cliente e classifica o conector de cada uma", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      companyName: string;
      item: string;
      geracoes: Array<{ sugestao?: string; conector?: string | null; forte?: boolean; error?: string }>;
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
          const conector = detectConector(sugestao);
          const forte = conector ? FORTES.has(conector) : false;
          console.log(`  ${rep}. "${sugestao}"  [${conector ?? "sem conector"}]${forte ? " ✓" : ""}`);
          geracoes.push({ sugestao, conector, forte });
        } catch (e) {
          console.log(`  ${rep}. ERRO: ${(e as Error).message}`);
          geracoes.push({ error: (e as Error).message });
        }
      }

      results.push({ companyName: cfg.companyName, item: cfg.item, geracoes });
    }

    const todas = results.flatMap((r) => r.geracoes).filter((g) => g.sugestao);
    const porConector = new Map<string, number>();
    for (const g of todas) {
      const k = g.conector ?? "(sem conector)";
      porConector.set(k, (porConector.get(k) ?? 0) + 1);
    }
    console.log("\n── Distribuição de conectores ──");
    for (const [k, v] of [...porConector.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${v}`);
    }
    const fortes = todas.filter((g) => g.forte).length;
    console.log(`\n  com/para: ${fortes} de ${todas.length}`);

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `results-conectores-pos-mudanca-${Date.now()}.json`);
    writeFileSync(
      outPath,
      JSON.stringify(
        { totalGeracoes: todas.length, fortes, porConector: Object.fromEntries(porConector), results },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(CLIENTES_VAREJO.length);
  }, 300_000);
});
