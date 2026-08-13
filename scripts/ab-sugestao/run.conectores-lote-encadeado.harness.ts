import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";

// Verificação ao vivo da mudança nº 2 de 13/08/2026 (commit 324d563): o aviso
// de lote (`conectorWarning`) parou de mandar trocar de CONECTOR e passou a
// cobrar variação na CONSTRUÇÃO. Até aqui essa mudança nunca rodou de verdade
// — o harness anterior (run.conectores-pos-mudanca) não encadeia
// previousSuggestions, então o aviso simplesmente não entra no prompt.
//
// DESENHO — replica o uso REAL do app (PostUnicoForm.fetchSuggestion):
//   • previousSuggestions ACUMULA as sugestões da sessão (o servidor corta nas
//     últimas 6 em routes/api/suggest-keyinfo.ts) — aqui o lote é 3, não corta;
//   • attempt = número de cliques já dados (0, 1, 2);
//   • sessionSeed fixo dentro da sessão.
// Cada cliente é uma sessão: 3 cliques seguidos em "Gerar outra".
// Mesmos 5 clientes das rodadas anteriores para manter a leitura comparável.
//
// A PERGUNTA que esta rodada responde: agora que repetir "com"/"para" no lote
// é aceitável, as 3 sugestões seguidas ainda saem diferentes entre si — ou
// voltou a monotonia dos prints de 07/2026 (AJUSTE_CONFLITO/), que foi o
// motivo de o aviso existir?
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.conectores-lote-encadeado.harness.ts

const CLIQUES = 3;

const base: Omit<
  SugestaoEngineInput,
  | "mainActivity"
  | "companyName"
  | "segment"
  | "objetivo"
  | "mode"
  | "selectedProducts"
  | "audience"
  | "attempt"
  | "previousSuggestions"
> = {
  hint: "",
  sessionSeed: 0,
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

const CONECTORES = ["para", "com", "em", "no", "na", "nos", "nas", "à", "e"];

// Detecção por POSIÇÃO — o conector ESTRUTURAL é o primeiro que aparece na
// frase, não o primeiro da lista. Difere de propósito do detectConector de
// sugestaoEngine.ts, que testa "para" primeiro e por isso classifica "Tênis com
// sola macia para caminhadas longas" como "para". Aqui o objetivo é medir, não
// reproduzir o motor; o viés do motor está registrado como pendência.
const detectConectorPorPosicao = (s: string): { nome: string; pos: number } | null => {
  const l = s.toLowerCase();
  let melhor: { nome: string; pos: number } | null = null;
  for (const c of CONECTORES) {
    const m = l.match(new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
    if (m && m.index !== undefined && (melhor === null || m.index < melhor.pos)) {
      melhor = { nome: c, pos: m.index };
    }
  }
  return melhor;
};

// SINAL, não veredito: verbos de ação que já apareceram nas rodadas anteriores.
// A classificação final de construção (locução × frase com verbo) é leitura
// humana — esta regex só marca candidatos.
// MEDIDO: na rodada de 13/08 esta lista pegou 1 de 15, enquanto a leitura à mão
// achou 8 construções não-locução ("tira a dor lombar", "Será que esse capacete
// serve pra mim", "Coloco o capacete e saio rápido"). O sinal SUBESTIMA em ~8x —
// lista fechada de verbos não cobre pergunta, imperativo nem 1ª pessoa. Não usar
// este número como medida; ele serve só para achar candidatos rápido.
const VERBO_SINAL =
  /\b(evita|evitam|evitando|renova|renovam|ganha|ganham|resolve|resolvem|protege|protegem|facilita|facilitam|organiza|organizam|economiza|economizam|controla|controlam|dura|duram|aguenta|aguentam|rende|rendem|ajuda|ajudam|garante|garantem)\b/i;

const primeirasPalavras = (s: string, n = 3) =>
  s
    .toLowerCase()
    .replace(/[^\wà-ú\s]/g, "")
    .split(/\s+/)
    .slice(0, n)
    .join(" ");

describe("Aviso de lote encadeado — 15 gerações reais de VAREJO (chamadas reais à OpenAI)", () => {
  it("dá 3 cliques seguidos por cliente, acumulando previousSuggestions como o app", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      companyName: string;
      item: string;
      lote: Array<{
        clique: number;
        sugestao?: string;
        conectorEstrutural?: string | null;
        verboSinal?: boolean;
        aberturaRepetida?: boolean;
        error?: string;
      }>;
      conectoresDistintos?: number;
      aberturasDistintas?: number;
    }> = [];

    for (const cfg of CLIENTES_VAREJO) {
      console.log(`\n▶ ${cfg.companyName} — ${cfg.item}`);
      const lote: (typeof results)[number]["lote"] = [];
      // A sessão do cliente: acumula igual ao allSessionSuggestionsRef do app.
      const sessao: string[] = [];

      for (let clique = 0; clique < CLIQUES; clique++) {
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
            attempt: clique,
            previousSuggestions: [...sessao],
          });
          const conector = detectConectorPorPosicao(sugestao);
          const verboSinal = VERBO_SINAL.test(sugestao);
          const aberturaRepetida = sessao.some(
            (s) => primeirasPalavras(s) === primeirasPalavras(sugestao),
          );
          console.log(
            `  ${clique + 1}. "${sugestao}"  [${conector?.nome ?? "sem conector"}]${verboSinal ? " ⚙verbo" : ""}${aberturaRepetida ? " ⚠abertura repetida" : ""}`,
          );
          lote.push({
            clique: clique + 1,
            sugestao,
            conectorEstrutural: conector?.nome ?? null,
            verboSinal,
            aberturaRepetida,
          });
          sessao.push(sugestao);
        } catch (e) {
          console.log(`  ${clique + 1}. ERRO: ${(e as Error).message}`);
          lote.push({ clique: clique + 1, error: (e as Error).message });
        }
      }

      const frases = lote.map((l) => l.sugestao).filter((s): s is string => !!s);
      results.push({
        companyName: cfg.companyName,
        item: cfg.item,
        lote,
        conectoresDistintos: new Set(lote.map((l) => l.conectorEstrutural).filter(Boolean)).size,
        aberturasDistintas: new Set(frases.map((s) => primeirasPalavras(s))).size,
      });
    }

    const todas = results.flatMap((r) => r.lote).filter((l) => l.sugestao);
    const comVerbo = todas.filter((l) => l.verboSinal).length;
    const aberturasRepetidas = todas.filter((l) => l.aberturaRepetida).length;
    const porConector = new Map<string, number>();
    for (const l of todas) {
      const k = l.conectorEstrutural ?? "(sem conector)";
      porConector.set(k, (porConector.get(k) ?? 0) + 1);
    }

    console.log("\n── Conector estrutural (por posição) ──");
    for (const [k, v] of [...porConector.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${v}`);
    }
    console.log(`\n  sinal de verbo de ação: ${comVerbo} de ${todas.length}`);
    console.log(`  aberturas repetidas dentro do lote: ${aberturasRepetidas}`);
    console.log("\n── Variedade dentro de cada lote de 3 ──");
    for (const r of results) {
      console.log(
        `  ${r.companyName}: ${r.conectoresDistintos} conector(es) distinto(s), ${r.aberturasDistintas} abertura(s) distinta(s)`,
      );
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `results-conectores-lote-encadeado-${Date.now()}.json`);
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          totalGeracoes: todas.length,
          comVerboSinal: comVerbo,
          aberturasRepetidas,
          porConectorEstrutural: Object.fromEntries(porConector),
          results,
        },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(CLIENTES_VAREJO.length);
  }, 300_000);
});
