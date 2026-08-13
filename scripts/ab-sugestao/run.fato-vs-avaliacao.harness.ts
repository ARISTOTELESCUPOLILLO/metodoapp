import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateSugestao, type SugestaoEngineInput } from "@/core/sugestaoEngine";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";

// TESTE DE REPERTÓRIO — 13/08/2026.
//
// PERGUNTA: o gargalo da Sugestão é a SINTAXE (conector, verbo, fecho) ou é o
// motor não SABER nenhum fato concreto sobre o item?
//
// De onde veio: lendo as ~60 frases das rodadas de conector deste dia, o que
// separa boa de ruim não é conector nem construção — é o que está no
// complemento. De um lado, substantivo de mundo (chuva repentina, dor lombar,
// paradas na colheita, vento forte, safra). Do outro, adjetivo de elogio
// (reuniões de impacto, festas marcantes, cerimônia inesquecível, troca
// rápida, reunião decisiva). Quem tem fato acha o conector certo sozinho.
//
// HIPÓTESE PRÉ-REGISTRADA (escrita ANTES de rodar, para não ser racionalizada
// depois do resultado):
//   H1. A taxa de FATO cai conforme o item fica mais abstrato. Itens físicos
//       (capacete, tênis, poltrona) alto; serviços com procedimento visível
//       (consulta veterinária, criação de sites) médio; serviços meta-processo
//       (planejamento, estratégia, gestão) baixo.
//   H2. Se H1 se confirmar, o "limite de categoria" achado em 12/07 (serviço
//       meta-processo reprova especificidade em 0-1 de 3, nos DOIS pipelines)
//       tem explicação: não é a frase que falha, é que não há fato para pôr
//       nela. Regra de forma nenhuma resolve isso.
//   H3. Se a taxa de FATO for alta em todo lugar, a hipótese está ERRADA e o
//       problema é mesmo de forma — aí o caminho é continuar na sintaxe.
//
// DESENHO: 10 itens × 3 gerações, SEM encadear previousSuggestions. Sem
// encadeamento é o caso MAIS FAVORÁVEL ao motor (nenhuma pressão para variar
// abertura). Se a taxa de fato já for baixa aqui, é baixa de verdade.
//
// O juiz classifica só o COMPLEMENTO, e nada mais — de propósito. Não mede
// especificidade (o critério de 12/07, que premia originalidade e não verdade,
// e foi justamente o que pode ter enterrado a "relação real" em VAREJO).
//
// Roda com:
//   node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.ab.config.ts scripts/ab-sugestao/run.fato-vs-avaliacao.harness.ts

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GERACOES = 3;

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
  // Classe esperada pela H1 — declarada antes de rodar.
  classeEsperada: "fisico" | "servico-visivel" | "meta-processo";
}

const CASOS: Caso[] = [
  // ── Físicos: o fato deveria ser fácil ──
  {
    label: "Capacete de moto",
    companyName: "Moto Vale",
    mainActivity: "Loja de peças e acessórios para motocicletas",
    item: "Capacete de moto",
    segment: "VAREJO",
    audience: "B2C",
    classeEsperada: "fisico",
  },
  {
    label: "Tênis",
    companyName: "Malhação Sports",
    mainActivity:
      "Loja de tênis, chuteiras, camisas de clube, camisas de marca, moda fitness, relógios, perfumes etc",
    item: "Tênis",
    segment: "VAREJO",
    audience: "B2C",
    classeEsperada: "fisico",
  },
  {
    label: "Ternos Slim",
    companyName: "Loja Rocha",
    mainActivity: "Loja de Ternos e Moda Social Masculina",
    item: "Ternos Slim",
    segment: "VAREJO",
    audience: "B2C",
    classeEsperada: "fisico",
  },
  {
    label: "Poltrona de trabalho",
    companyName: "FERRIMAQ",
    mainActivity:
      "Venda de Móveis para Escritório, Consultórios, Auditórios, Refeitório e Escolares",
    item: "Poltrona de trabalho",
    segment: "VAREJO",
    audience: "B2B",
    classeEsperada: "fisico",
  },
  {
    label: "Lubrificantes agrícolas",
    companyName: "Barbosa Lubrificantes",
    mainActivity: "Loja de lubrificantes, correias, mangueiras, ferramentas e EPI",
    item: "Lubrificantes agrícolas",
    segment: "VAREJO",
    audience: "B2B",
    classeEsperada: "fisico",
  },
  // ── Serviços com procedimento visível ──
  {
    label: "Consultas veterinárias",
    companyName: "Pronto Vet",
    mainActivity: "Clínica veterinária com loja de rações e acessórios para pets",
    item: "Consultas veterinárias",
    segment: "SERVIÇOS",
    audience: "B2C",
    classeEsperada: "servico-visivel",
  },
  {
    label: "Criação de sites",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    item: "Criação de sites",
    segment: "SERVIÇOS",
    audience: "B2B",
    classeEsperada: "servico-visivel",
  },
  // ── Meta-processo: onde 12/07 mostrou que os dois pipelines falham ──
  {
    label: "Planejamento de Comunicação",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    item: "Planejamento de Comunicação",
    segment: "SERVIÇOS",
    audience: "B2B",
    classeEsperada: "meta-processo",
  },
  {
    label: "Gestão de redes sociais",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    item: "Gestão de redes sociais",
    segment: "SERVIÇOS",
    audience: "B2B",
    classeEsperada: "meta-processo",
  },
  {
    label: "Estratégia de Marketing Digital",
    companyName: "Oficina de Propaganda",
    mainActivity: "Consultoria de Marketing e Marketing Digital",
    item: "Estratégia de Marketing Digital",
    segment: "SERVIÇOS",
    audience: "B2B",
    classeEsperada: "meta-processo",
  },
];

interface Veredito {
  complemento: string;
  classe: "FATO" | "AVALIACAO" | "MISTO";
  fatoNomeado: string;
  construcao: "LOCUCAO" | "VERBO" | "OUTRA";
  motivo: string;
}

// O prompt do juiz é calibrado por EXEMPLOS REAIS das rodadas deste dia — sem
// eles, "fato" e "avaliação" são abstrações e o juiz inventa a própria régua.
async function julgarComplemento(apiKey: string, item: string, frase: string): Promise<Veredito> {
  const prompt = `Você analisa frases curtas de pauta de conteúdo em português brasileiro. NÃO julgue se a frase é boa. Faça só uma classificação descritiva.

ITEM: "${item}"
FRASE: "${frase}"

O COMPLEMENTO é o que a frase diz sobre o item — tudo que vem além de nomear o item.

Classifique o COMPLEMENTO em uma destas classes:

FATO — nomeia coisa, evento, condição, parte do corpo, momento ou circunstância que EXISTE NO MUNDO independente da frase, e que alguém poderia observar ou verificar.
  Exemplos reais: "chuva repentina" · "dor lombar" · "paradas na colheita" · "vento forte" · "treino antes do jogo" · "dias de safra" · "troca de estação"

AVALIACAO — nomeia apenas um juízo, qualidade, grau ou elogio. Não há coisa observável, só a opinião de quem escreveu.
  Exemplos reais: "reuniões de impacto" · "festas marcantes" · "cerimônia inesquecível" · "troca rápida" · "reunião decisiva" · "experiência funcional"

MISTO — há um fato observável, mas enfeitado por um juízo que não acrescenta informação.
  Exemplos reais: "viagem longa" (viagem é fato, "longa" é grau) · "treino puxado"

Classifique também a CONSTRUCAO da frase:
LOCUCAO — não tem verbo conjugado (ex.: "Capacete de moto para chuva repentina")
VERBO — tem verbo conjugado afirmando algo (ex.: "Poltrona de trabalho tira a dor lombar")
OUTRA — pergunta, imperativo, 1ª pessoa (ex.: "Será que esse capacete serve pra mim")

Responda JSON EXATAMENTE assim:
{ "complemento": "o trecho do complemento, copiado da frase", "classe": "FATO", "fatoNomeado": "o fato do mundo que aparece, ou vazio se não houver", "construcao": "LOCUCAO", "motivo": "1 frase curta" }`;

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

describe("Repertório — o motor nomeia FATO ou só AVALIAÇÃO? (chamadas reais à OpenAI)", () => {
  it("gera 3 sugestões para 10 itens e classifica o complemento de cada uma", async () => {
    const apiKey = process.env.OPENAI_API_KEY_CONTENT;
    expect(apiKey, "OPENAI_API_KEY_CONTENT ausente — rode com node --env-file=.env").toBeTruthy();

    const results: Array<{
      label: string;
      item: string;
      classeEsperada: string;
      geracoes: Array<{ sugestao?: string; veredito?: Veredito; error?: string }>;
      fatoCount?: number;
    }> = [];

    for (const caso of CASOS) {
      console.log(`\n▶ ${caso.label} (${caso.classeEsperada})`);
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
          await sleep(1200);
          const veredito = await julgarComplemento(apiKey!, caso.item, sugestao);
          console.log(
            `  ${rep + 1}. "${sugestao}"\n       ${veredito.classe} (${veredito.construcao}) — complemento: "${veredito.complemento}"${veredito.fatoNomeado ? ` | fato: ${veredito.fatoNomeado}` : ""}`,
          );
          geracoes.push({ sugestao, veredito });
        } catch (e) {
          console.log(`  ${rep + 1}. ERRO: ${(e as Error).message}`);
          geracoes.push({ error: (e as Error).message });
        }
      }

      const fatoCount = geracoes.filter((g) => g.veredito?.classe === "FATO").length;
      results.push({
        label: caso.label,
        item: caso.item,
        classeEsperada: caso.classeEsperada,
        geracoes,
        fatoCount,
      });
    }

    // ── Resumo por classe esperada — é aqui que H1 passa ou cai ──
    const porClasse = new Map<string, { fato: number; misto: number; avaliacao: number }>();
    for (const r of results) {
      const acc = porClasse.get(r.classeEsperada) ?? { fato: 0, misto: 0, avaliacao: 0 };
      for (const g of r.geracoes) {
        if (g.veredito?.classe === "FATO") acc.fato++;
        else if (g.veredito?.classe === "MISTO") acc.misto++;
        else if (g.veredito?.classe === "AVALIACAO") acc.avaliacao++;
      }
      porClasse.set(r.classeEsperada, acc);
    }

    console.log("\n═══ TAXA DE FATO POR CLASSE DE ITEM ═══");
    for (const [classe, acc] of porClasse) {
      const total = acc.fato + acc.misto + acc.avaliacao;
      console.log(
        `  ${classe}: FATO ${acc.fato}/${total} · MISTO ${acc.misto} · AVALIACAO ${acc.avaliacao}`,
      );
    }
    console.log("\n═══ POR ITEM ═══");
    for (const r of results) {
      console.log(`  ${r.label}: FATO ${r.fatoCount}/${GERACOES}`);
    }

    const outDir = resolve(__dirname, "output");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `results-fato-vs-avaliacao-${Date.now()}.json`);
    writeFileSync(
      outPath,
      JSON.stringify({ porClasse: Object.fromEntries(porClasse), results }, null, 2),
      "utf-8",
    );
    console.log(`\n✓ Relatório gravado em ${outPath}`);

    expect(results.length).toBe(CASOS.length);
  }, 600_000);
});
