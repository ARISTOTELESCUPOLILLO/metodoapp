import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import {
  pickConcreteItem,
  decomposeAtividadeEmItens,
  type SugestaoEngineInput,
} from "@/core/sugestaoEngine";

// ─────────────────────────────────────────────────────────────────────────
// VARIANTE "SINTOMA REAL" — hipótese da conversa de 12/07/2026 (ver memória
// do projeto: metodo-op-aristoteles-retorica-sugestao). Gatilho: print em
// AJUSTE_CONFLITO mostrando 3 sugestões pra Oficina de Propaganda ("Criação
// de sites PARA orçamentos recebidos online", "Planejamento de comunicação
// EM campanhas pontuais", "Criação de logomarca PARA abrir filiais") — o
// dono do produto rotulou o arquivo "só viagem da IA".
//
// DESENHO (revisado 12/07/2026 a partir de recomendação direta do usuário —
// não a 1ª versão deste arquivo): o motor de produção hoje efetivamente
// segue o fluxo ITEM → CONECTOR → INVENTAR ALGO QUE CAIBA (o conector já
// vem meio fixado pela estrutura do prompt/template, e a IA improvisa
// conteúdo pra caber ali). A hipótese testada aqui inverte a ordem causal:
//
//   ITEM → RELAÇÃO REAL (validada por teste de troca) → CONECTOR NATURAL → FECHO CURTO
//
// Isso isola DUAS variáveis que a 1ª versão deste arquivo misturava num
// prompt só: (a) o CONTEÚDO é real/específico deste item, ou inventado? e
// (b) o CONECTOR usado soa natural pra esse conteúdo, ou é só a estrutura
// do template? Só dá pra responder as duas perguntas separadamente se o
// conteúdo for FIXADO antes de qualquer conector entrar em cena — por isso
// 3 chamadas separadas abaixo, não uma só.
//
// Este arquivo existe só para o teste A/B offline (scripts/ab-sugestao) —
// NÃO é importado por nenhuma rota de produção. Reaproveita de
// sugestaoEngine.ts só a seleção do elemento concreto (pickConcreteItem/
// decomposeAtividadeEmItens) — nada da lógica de lente ou do prompt de
// produção, porque a hipótese aqui não é sobre lente, é sobre a ordem
// relação→conector.
// ─────────────────────────────────────────────────────────────────────────

const CALL_TIMEOUT_MS = 8_000;
export const CONECTORES = ["E", "COM", "EM", "NO", "NA", "PARA", "À"] as const;
export type Conector = (typeof CONECTORES)[number];

export interface RelacaoRealResult {
  concreteItem: string;
  relacao: string | null;
}

// Passo 1 — RELAÇÃO REAL: deriva uma relação verificável entre O ITEM
// CONCRETO (não o ramo em abstrato — lição do teste de 11/07/2026, onde a
// premissa vinha do ramo e por isso ignorava o item selecionado) e uma
// situação/necessidade/consequência real. Teste de troca embutido no
// próprio prompt de derivação, não só cobrado depois por um juiz.
export async function deriveRelacaoReal(
  apiKey: string,
  concreteItem: string,
  companyName: string,
  mainActivity: string,
  segment: string,
): Promise<RelacaoRealResult> {
  const prompt = `Você recebe um ITEM concreto que uma empresa brasileira vende ou oferece.

EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
SEGMENTO: ${segment}
ITEM CONCRETO: "${concreteItem}"

Identifique UMA relação real e verificável entre este item e uma situação, necessidade, momento ou consequência que um cliente DE VERDADE desse ramo reconheceria na hora como algo que já viveu — não invente uma situação "de negócio" que soa profissional mas ninguém confirmaria ter vivido.

TESTE OBRIGATÓRIO antes de responder: se você trocasse "${concreteItem}" por outro item ou serviço qualquer do segmento ${segment}, vendido por um negócio DIFERENTE, a MESMA relação ainda seria verdadeira e faria sentido do mesmo jeito? Se sim, ela é genérica demais (poderia ter sido escrita sem saber que o item é "${concreteItem}") — descarte e ache uma relação que só é verdadeira PARA ESTE item específico.

Responda em UMA frase curta e objetiva descrevendo a relação (uso interno, não é a frase final do post).

Responda JSON EXATAMENTE assim: { "relacao": "1 frase objetiva descrevendo a relação real" }`;

  try {
    const result = await fetchOpenAIChat(
      apiKey,
      {
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      },
      CALL_TIMEOUT_MS,
    );
    if (!result.ok) return { concreteItem, relacao: null };
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) return { concreteItem, relacao: null };
    const parsed = JSON.parse(content) as { relacao?: unknown };
    const relacao = String(parsed.relacao || "").trim();
    return { concreteItem, relacao: relacao || null };
  } catch {
    return { concreteItem, relacao: null };
  }
}

export type FrasesPorConector = Partial<Record<Conector, string>>;

// Passo 2 — CONECTOR NATURAL: gera as 7 frases (uma por conector) a partir
// da MESMA relação real — o conteúdo já está fixado no Passo 1, aqui só
// varia a forma de conectar item e situação. UMA chamada só (não 7) — mais
// barato e garante que as 7 frases realmente partem do mesmo conteúdo, sem
// deriva de contexto entre chamadas.
export async function gerarFrasesPorConector(
  apiKey: string,
  concreteItem: string,
  relacaoReal: string,
  audience: "B2C" | "B2B",
  mode: "metodo" | "postunico",
): Promise<FrasesPorConector> {
  const audienceDirective =
    audience === "B2C"
      ? "PÚBLICO-ALVO: CONSUMIDOR FINAL (B2C) — fale com a PESSOA, não com o empresário."
      : "PÚBLICO-ALVO: EMPRESARIAL (B2B) — fale com o dono/responsável do negócio.";

  const prompt = `Você recebe um ITEM concreto e uma RELAÇÃO REAL já validada entre esse item e uma situação/necessidade/consequência real. Sua tarefa é expressar essa MESMA relação em 7 frases curtas de pauta de conteúdo (${mode === "metodo" ? "assunto de um conjunto de posts" : "post único"} de Instagram), uma para cada CONECTOR gramatical listado abaixo — sem inventar conteúdo novo, só variando a forma de conectar item e situação.

ITEM: "${concreteItem}"
RELAÇÃO REAL (a mesma ideia deve aparecer nas 7 frases, só muda o conector): "${relacaoReal}"

CONECTORES (gere exatamente uma frase por conector, entre 4 e 7 palavras cada, máximo absoluto 7):
- E (coordenação: "${concreteItem} e [efeito]")
- COM (atributo/acompanhamento: "${concreteItem} com [característica/situação]")
- EM (locativo/temporal: "${concreteItem} em [situação/momento]")
- NO (locativo/temporal masculino: "${concreteItem} no [situação/momento]")
- NA (locativo/temporal feminino: "${concreteItem} na [situação/momento]")
- PARA (finalidade: "${concreteItem} para [situação/momento]")
- À (construção idiomática: "${concreteItem} à [altura/medida/moda de...]")

Se um conector não couber naturalmente na relação real, escreva mesmo assim a versão mais natural possível (não pule nenhum) — o objetivo deste teste é justamente comparar naturalidade entre eles, então frases forçadas também são dado útil.

${audienceDirective}
PROIBIDO inventar promoção, desconto, prazo ou dado que não esteja na relação real acima. Sem jargão de marketing ("leads", "funil", "conversão"). Sem tensão, urgência, promessa emocional ou linguagem de campanha. Sem hashtag, sem emoji, sem aspas.

Responda JSON EXATAMENTE assim:
{ "frases": { "E": "...", "COM": "...", "EM": "...", "NO": "...", "NA": "...", "PARA": "...", "À": "..." } }`;

  const systemMsg =
    "Você é estrategista de conteúdo brasileiro. Gramática e ortografia impecáveis, norma culta do português brasileiro. Responda SEMPRE com JSON válido.";

  const result = await fetchOpenAIChat(apiKey, {
    model: "gpt-4.1",
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  const content = result.data.choices?.[0]?.message?.content;
  if (!content) throw Object.assign(new Error("Resposta vazia"), { status: 502 });
  const parsed = JSON.parse(content) as { frases?: FrasesPorConector };
  return parsed.frases || {};
}

export interface ConectorAvaliacao {
  conector: Conector;
  plausibilidadeOk: boolean;
  realidadeReconhecivelOk: boolean;
  especificidadeCategoriaOk: boolean;
  naturalidadeConectorOk: boolean;
  motivo: string;
}

// Passo 3 — JUIZ MULTI-CRITÉRIO: avalia as 7 frases em 4 eixos
// INDEPENDENTES (não um score único) — recomendação direta do usuário
// (12/07/2026): separar "plausibilidade", "realidade reconhecível",
// "especificidade de categoria" e "naturalidade do conector" pra não
// misturar causa (conteúdo inventado) com sintoma (frase soa estranha).
export async function judgeConectores(
  apiKey: string,
  concreteItem: string,
  relacaoReal: string,
  frases: FrasesPorConector,
  mainActivity: string,
  segment: string,
): Promise<ConectorAvaliacao[]> {
  const frasesTexto = CONECTORES.map((c) => `${c}: "${frases[c] ?? "(não gerada)"}"`).join("\n");

  const prompt = `Você é juiz de qualidade de frases de pauta de conteúdo (Sugestão) para uma empresa do ramo "${mainActivity || segment}".

ITEM: "${concreteItem}"
RELAÇÃO REAL QUE AS FRASES DEVEM EXPRESSAR: "${relacaoReal}"

Avalie CADA uma das 7 frases abaixo (mesma relação, conector diferente) em 4 critérios INDEPENDENTES — um critério pode ser true e outro false na mesma frase, não misture:

1. plausibilidadeOk — a frase descreve algo que PODERIA acontecer de verdade, sem causa-efeito absurdo ou forçado?
2. realidadeReconhecivelOk — um cliente REAL desse ramo, lendo a frase, reconheceria na hora como algo que já viveu — ou soa "de negócio", inventado agora só pra parecer profissional?
3. especificidadeCategoriaOk — TESTE DE TROCA: se você trocasse "${concreteItem}" por outro item/serviço qualquer do segmento ${segment}, vendido por um negócio diferente, a frase ainda faria sentido do mesmo jeito? Se sim, marque FALSE (não é específica desta categoria de item) — só marque TRUE se a frase quebrar ou soar estranha com a troca.
4. naturalidadeConectorOk — o conector usado soa natural em português nessa frase específica, ou parece forçado/artificial só pra caber no conector pedido?

FRASES:
${frasesTexto}

Responda JSON EXATAMENTE assim (um item por conector, 7 no total, na mesma ordem E/COM/EM/NO/NA/PARA/À):
{ "avaliacoes": [ { "conector": "E", "plausibilidadeOk": true, "realidadeReconhecivelOk": true, "especificidadeCategoriaOk": true, "naturalidadeConectorOk": true, "motivo": "" }, ... ] }`;

  const result = await fetchOpenAIChat(apiKey, {
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" },
  });
  if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
  const content = result.data.choices?.[0]?.message?.content;
  if (!content) throw Object.assign(new Error("Resposta vazia"), { status: 502 });
  const parsed = JSON.parse(content) as { avaliacoes?: ConectorAvaliacao[] };
  return parsed.avaliacoes || [];
}

export interface SintomaRealConectorRun {
  concreteItem: string;
  relacaoReal: string | null;
  frases: FrasesPorConector;
  avaliacoes: ConectorAvaliacao[];
}

// Orquestra os 3 passos pra 1 fixture — usado pelo harness. Seleção do
// elemento concreto reaproveitada de sugestaoEngine.ts (mesma fonte de
// verdade da Variante A), o resto é só deste arquivo.
export async function runSintomaRealConector(
  apiKey: string,
  input: SugestaoEngineInput,
): Promise<SintomaRealConectorRun> {
  const {
    mainActivity,
    segment,
    selectedProducts,
    attempt,
    previousSuggestions,
    sessionSeed,
    companyName,
    audience,
    mode,
  } = input;

  const inferredProducts = selectedProducts.length
    ? []
    : await decomposeAtividadeEmItens(apiKey, mainActivity, segment);
  const productsPool = selectedProducts.length ? selectedProducts : inferredProducts;
  const { item } = pickConcreteItem(productsPool, attempt, previousSuggestions, sessionSeed);
  const concreteItem = item || mainActivity || companyName || "o negócio";

  const { relacao } = await deriveRelacaoReal(
    apiKey,
    concreteItem,
    companyName,
    mainActivity,
    segment,
  );
  if (!relacao) {
    return { concreteItem, relacaoReal: null, frases: {}, avaliacoes: [] };
  }

  const frases = await gerarFrasesPorConector(apiKey, concreteItem, relacao, audience, mode);
  const avaliacoes = await judgeConectores(
    apiKey,
    concreteItem,
    relacao,
    frases,
    mainActivity,
    segment,
  );

  return { concreteItem, relacaoReal: relacao, frases, avaliacoes };
}
