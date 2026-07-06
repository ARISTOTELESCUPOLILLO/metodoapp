import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import {
  truncateWords,
  validateSugestao,
  checkInventedPromotion,
  checkSupplierLanguage,
  checkRepeatedOpening,
  checkLensNameLeak,
  checkWeakEnding,
  checkItemNameDrift,
  pruneWeakEnding,
} from "@/core/textValidation";
import {
  pickConcreteItem,
  decomposeAtividadeEmItens,
  judgeSugestaoEstrutural,
  type SugestaoEngineInput,
} from "@/core/sugestaoEngine";

// ─────────────────────────────────────────────────────────────────────────
// VARIANTE B — hipótese conceitual enviada pelo Aristóteles em 06/07/2026:
// MOP e PU não devem compartilhar a mesma lógica de geração da Sugestão.
//
//   MOP = PRODUTO + CONECTOR + RECORTE (substantivado, produto como ÂNCORA
//         da sequência, não protagonista — o recorte sustenta a jornada).
//   PU  = PRODUTO + BENEFÍCIO PERCEBIDO (verbal, produto como PROTAGONISTA
//         — comunicação direta e autônoma).
//
// Este arquivo existe só para o teste A/B offline (scripts/ab-sugestao) —
// NÃO é importado por nenhuma rota de produção. Reaproveita deliberadamente
// a infraestrutura que NÃO faz parte da hipótese (seleção do elemento
// concreto, checagens determinísticas de segurança, juiz estrutural) da
// Variante A (src/core/sugestaoEngine.ts), para que a ÚNICA variável do
// teste seja a arquitetura da frase — não a seleção de item, não as
// proteções contra invenção, não o critério de avaliação.
// ─────────────────────────────────────────────────────────────────────────

// Lentes internas para encontrar o RECORTE (MOP) ou o ângulo do BENEFÍCIO
// PERCEBIDO (PU) — lista do documento conceitual do Aristóteles, adaptada
// ao mesmo formato { nome, guia } da Variante A para reaproveitar
// checkLensNameLeak.
const HYPOTHESIS_LENSES: { nome: string; guia: string }[] = [
  {
    nome: "Processo",
    guia: "Escolha uma etapa do processo em que o produto/serviço aparece — como ele é feito, escolhido, organizado ou mantido dentro da atividade da empresa.",
  },
  {
    nome: "Uso no dia a dia",
    guia: "Escolha um momento cotidiano e concreto em que o produto/serviço é usado dentro da rotina real do negócio ou do cliente.",
  },
  {
    nome: "Necessidade percebida",
    guia: 'Escolha uma necessidade CONCRETA (nunca abstrata como "praticidade" ou "qualidade de vida") que o produto/serviço atende, ancorada numa situação real e nomeável.',
  },
  {
    nome: "Problema recorrente",
    guia: "Escolha um problema comum e recorrente que o produto/serviço evita ou resolve dentro dessa atividade — descrito como fato, sem culpar o cliente.",
  },
  {
    nome: "Erro evitável",
    guia: "Escolha um erro comum e evitável relacionado ao uso, escolha ou manutenção do produto/serviço.",
  },
  {
    nome: "Oportunidade",
    guia: "Escolha um momento ou ocasião específica (estação, fase, situação concreta da rotina) em que o produto/serviço se encaixa bem.",
  },
  {
    nome: "Resultado observado",
    guia: "Escolha um resultado MEDÍVEL OU VISÍVEL (tempo, quantidade, estado antes/depois) que o produto/serviço entrega.",
  },
  {
    nome: "Situação comum",
    guia: "Escolha uma situação cotidiana e reconhecível do ramo em que o produto/serviço entra em cena.",
  },
  {
    nome: "Contexto de uso",
    guia: "Escolha o contexto específico (não genérico) em que esse produto/serviço é aplicado dentro da atividade informada.",
  },
  {
    nome: "Decisão do cliente",
    guia: "Escolha um critério ou dúvida que pesa na decisão do cliente de escolher, contratar ou comprar esse produto/serviço.",
  },
  {
    nome: "Benefício concreto",
    guia: "Escolha um ganho concreto e específico (não abstrato) que o produto/serviço proporciona.",
  },
];

const CONECTORES_EXEMPLOS =
  'conversacionais ("e", "com"), contextuais ("em", "no", "na", "nos", "nas") ou de direcionamento ("para", "voltado à", "aplicado à")';

const BENEFICIO_VERBOS_EXEMPLOS =
  '"organizar", "proteger", "controlar", "acompanhar", "planejar", "renovar", "economizar", "cuidar", "facilitar", "melhorar"';

const SUGESTAO_MAX_WORDS = 7;

export async function generateSugestaoVariantB(
  apiKey: string,
  input: SugestaoEngineInput,
): Promise<{ sugestao: string }> {
  const {
    companyName,
    mainActivity,
    objetivo,
    hint,
    mode,
    attempt,
    sessionSeed,
    previousSuggestions: previousSugs,
    segment,
    selectedProducts,
    audience,
  } = input;

  // Seleção do elemento concreto — IDÊNTICA à Variante A (não faz parte da
  // hipótese, que é só sobre a FORMA da frase a partir do item já escolhido).
  const inferredProducts = selectedProducts.length
    ? []
    : await decomposeAtividadeEmItens(apiKey, mainActivity, segment);
  const productsPool = selectedProducts.length ? selectedProducts : inferredProducts;
  const { item: concreteItem } = pickConcreteItem(productsPool, attempt, previousSugs, sessionSeed);
  const produto = concreteItem || mainActivity || companyName || "o negócio";

  const lensIndex = (attempt + sessionSeed) % HYPOTHESIS_LENSES.length;
  const lens = HYPOTHESIS_LENSES[lensIndex];

  const isB2C = audience === "B2C";
  const audienceDirective = isB2C
    ? 'PÚBLICO-ALVO: CONSUMIDOR FINAL (B2C) — fale com a PESSOA, não com o empresário. Não use "empreendedor", "gestor", "decisor", "equipe" como sujeito.'
    : 'PÚBLICO-ALVO: EMPRESARIAL (B2B) — fale com o dono, sócio ou responsável pelo negócio, em situações reais de trabalho. Não use "clientes"/"consumidores" como núcleo.';

  const allowedContext = [hint, mainActivity, companyName].filter(Boolean).join(" ");
  const allowPromoLanguagePU =
    mode === "postunico" && (objetivo === "promocao" || objetivo === "oportunidade");
  const proibicoesInventar = `PROIBIDO inventar promoção, desconto, percentual, prazo, data ou urgência que o usuário não tenha fornecido — só valem se já estiverem na pista ou na atividade informada acima.`;

  const previousBlock = previousSugs.length
    ? `SUGESTÕES ANTERIORES NESTA SESSÃO (não repita o assunto nem a abertura):\n${previousSugs.map((s) => `- "${s}"`).join("\n")}`
    : "";

  const ancoragem = mainActivity.trim()
    ? `A ATIVIDADE ("${mainActivity}") é a fonte principal do assunto — o nome "${companyName}" serve só para identificação, não é pista de assunto.`
    : "";

  const userPrompt =
    mode === "metodo"
      ? `Defina o ASSUNTO de uma Informação-chave para um conjunto de posts de Instagram em português brasileiro, seguindo a fórmula PRODUTO + CONECTOR + RECORTE.

EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
${ancoragem}

PRODUTO DESTA SUGESTÃO (ÂNCORA da sequência, não protagonista sozinho): "${produto}"
Ele dá identidade à sequência e impede um assunto genérico — mas quem sustenta a sequência editorial é o RECORTE escolhido a seguir, não uma promessa comercial sobre o produto.

O QUE É O RECORTE: um aspecto ESPECÍFICO da realidade deste produto/serviço dentro de "${mainActivity}" — nunca o produto inteiro, nunca um conceito abstrato de negócio ("confiança", "qualidade", "crescimento", "inovação"). O recorte é SUBSTANTIVADO (ex.: "organização dos pedidos", "controle do estoque", "renovação dos ambientes") — NUNCA um verbo de ação ou promessa.

LENTE INTERNA PARA ENCONTRAR O RECORTE (uso interno — não cite o nome nem deixe rastro dela na frase final): ${lens.guia}

FÓRMULA OBRIGATÓRIA DA FRASE: PRODUTO + CONECTOR + RECORTE.
- PRODUTO: o item acima (ou uma variação curta e direta dele).
- CONECTOR: liga produto e recorte — escolha o que soar mais natural entre os tipos ${CONECTORES_EXEMPLOS}.
- RECORTE: o substantivo/locução substantivada escolhido pela lente acima.
Exemplos de FORMATO (não copie o vocabulário, só a estrutura): "ERP na organização dos pedidos", "Consultoria no planejamento da empresa", "Pintura na renovação dos ambientes", "Vacinas na prevenção do pet".

A frase NÃO deve carregar tensão, conflito, promessa emocional, urgência, comparação com concorrentes nem linguagem de campanha ("não perca", "aproveite agora") — ela apenas ABRE uma conversa sobre o assunto; tensão e desenvolvimento vêm depois, em outra etapa do Método OP.

${audienceDirective}
${proibicoesInventar}
${previousBlock}

Entre 4 e 7 palavras (máximo absoluto 7). Sem hashtag, sem emoji, sem aspas.

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha no formato PRODUTO + CONECTOR + RECORTE, entre 4 e 7 palavras" }`
      : `Sugira UMA Informação-chave para um post único de Instagram em português brasileiro, seguindo a fórmula PRODUTO + BENEFÍCIO PERCEBIDO.

EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
${ancoragem}
OBJETIVO: ${objetivo}
${hint ? `PISTA DO USUÁRIO (refine a partir disso): "${hint}"` : "O usuário não deu pista — invente algo plausível e útil para a atividade."}

PRODUTO DESTA SUGESTÃO (PROTAGONISTA — toda a comunicação gira em torno dele): "${produto}"
O leitor precisa perceber imediatamente qual produto/serviço está sendo comunicado.

O QUE É BENEFÍCIO PERCEBIDO: aquilo que o cliente entende IMEDIATAMENTE como valor — nunca uma característica técnica ou de bastidor (ex.: especificação, processo interno), sempre um ganho percebido e concreto.

LENTE INTERNA PARA ENCONTRAR O BENEFÍCIO (uso interno — não cite o nome nem deixe rastro dela na frase final): ${lens.guia}

FÓRMULA OBRIGATÓRIA DA FRASE: PRODUTO + BENEFÍCIO PERCEBIDO, com um VERBO simples de ação percebida pelo cliente — exemplos de verbo: ${BENEFICIO_VERBOS_EXEMPLOS} (ou outro verbo igualmente simples e cotidiano). Nunca jargão técnico, nunca verbo nominalizado abstrato.
Exemplos de FORMATO (não copie o vocabulário, só a estrutura): "ERP para organizar pedidos", "Vacinas para proteger seu pet", "Consultoria para orientar empresas", "Pintura para renovar ambientes".

ESTILO: comunicação direta e autônoma — pode ser afirmação, pergunta direta ou chamada, conforme o objetivo. NÃO é abertura de sequência nem dica educativa (evite "como escolher...", "o que considerar antes de...").

${audienceDirective}
${proibicoesInventar}
${previousBlock}

Entre 4 e 7 palavras (máximo absoluto 7). Sem hashtag, sem emoji, sem aspas.

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 frase no formato PRODUTO + BENEFÍCIO PERCEBIDO, entre 4 e 7 palavras" }`;

  const systemMsg =
    "Você é estrategista de conteúdo brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. Siga rigorosamente a fórmula pedida no prompt (PRODUTO+CONECTOR+RECORTE ou PRODUTO+BENEFÍCIO PERCEBIDO, conforme o caso). PROIBIDO repetir a mesma palavra ou derivação morfológica da mesma raiz no mesmo texto. Limite: entre 4 e 7 palavras (máximo absoluto 7) — nunca ultrapasse 7.";

  const runDeterministicChecks = (text: string): string[] => {
    let m = validateSugestao(text, SUGESTAO_MAX_WORDS);
    m = m.concat(
      checkInventedPromotion(text, allowedContext, { allowPromoLanguage: allowPromoLanguagePU }),
    );
    if (mode === "postunico") m = m.concat(checkSupplierLanguage(text));
    m = m.concat(checkRepeatedOpening(text, previousSugs));
    m = m.concat(checkLensNameLeak(text, lens.nome));
    m = m.concat(checkWeakEnding(text, concreteItem));
    m = m.concat(checkItemNameDrift(text, concreteItem));
    return m;
  };

  const MAX_SUGGEST_ATTEMPTS = 3;
  let sugestao = "";
  let motivos: string[] = [];

  for (let pass = 1; pass <= MAX_SUGGEST_ATTEMPTS; pass++) {
    const reinforcement =
      pass > 1 && motivos.length > 0
        ? `\n\nATENÇÃO: a tentativa anterior teve este problema: ${motivos.join("; ")}. Gere uma NOVA versão que corrija isso, mantendo a mesma fórmula e o mesmo assunto.`
        : "";

    const result = await fetchOpenAIChat(apiKey, {
      model: "gpt-4.1",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: `${userPrompt}${reinforcement}` },
      ],
      temperature: 0.95,
      response_format: { type: "json_object" },
    });

    if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) throw Object.assign(new Error("Resposta vazia"), { status: 502 });

    let parsed: { sugestao?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw Object.assign(new Error("JSON inválido"), { status: 502 });
    }

    const rawSugestao = String(parsed.sugestao || "")
      .trim()
      .replace(/^"|"$/g, "");
    const rawWordCount = rawSugestao.split(/\s+/).filter(Boolean).length;
    sugestao = truncateWords(rawSugestao, SUGESTAO_MAX_WORDS);
    if (!sugestao) throw Object.assign(new Error("Sugestão vazia"), { status: 502 });

    motivos = runDeterministicChecks(sugestao);
    if (rawWordCount > SUGESTAO_MAX_WORDS) {
      motivos.push(
        `frase original tinha ${rawWordCount} palavras e foi cortada no meio — reescreva já dentro do limite de ${SUGESTAO_MAX_WORDS} palavras`,
      );
    }
    if (motivos.length === 0) {
      const veredito = await judgeSugestaoEstrutural(
        apiKey,
        sugestao,
        concreteItem,
        mainActivity,
        segment,
      );
      if (!veredito.ok) {
        motivos.push(`juiz estrutural: ${veredito.motivo ?? "frase reprovada"}`);
      }
    }
    if (motivos.length === 0) break;
  }

  if (motivos.length > 0) {
    const pruned = pruneWeakEnding(sugestao);
    if (pruned) {
      const prunedMotivos = runDeterministicChecks(pruned);
      if (prunedMotivos.length < motivos.length) {
        sugestao = pruned;
        motivos = prunedMotivos;
      }
    }
  }

  return { sugestao };
}
