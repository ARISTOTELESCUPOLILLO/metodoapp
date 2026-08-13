import { getVoiceProfile } from "@/data/brandVoice";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import {
  truncateWords,
  validateSugestao,
  checkInventedPromotion,
  checkSupplierLanguage,
  checkRepeatedOpening,
  checkLensNameLeak,
  checkWeakEnding,
  checkVagueAdjectiveMidSentence,
  checkItemNameDrift,
  checkInformalRegister,
  checkB2CAudienceVocabulary,
  checkAmputatedPredicate,
  pruneWeakEnding,
} from "@/core/textValidation";
import { OBJETIVO_TOM } from "@/domain/objetivo.config";

// Escolhe o item da lista de produtos/serviços marcados que vira a semente
// concreta desta sugestão — rotação determinística por "attempt", evitando
// (quando possível) repetir um item cujo assunto já apareceu nas sugestões
// anteriores desta sessão. Quando o pool de itens marcados é menor que o
// número de tentativas (ex.: 1-2 itens para 3 cliques em "Sugestão"), repetir
// o mesmo item é matematicamente inevitável — `repeated` sinaliza esse caso
// para o chamador reforçar no prompt que o ÂNGULO precisa variar bastante
// (ver elementoConcretoBlock), já que a lente sozinha não basta quando o
// núcleo da frase é forçosamente o mesmo (ver SINTAXE — NÚCLEO DA FRASE).
// Decisão de produto (Aristóteles, 05/07/2026, ver Bloco C da auditoria de
// 05/07/2026): quando só 1 item está marcado, ele vira ÂNCORA automática —
// nunca sai do rodízio, só varia o ÂNGULO (lente) entre tentativas. Isso já
// acontece matematicamente aqui embaixo (startIdx = (attempt+seed) % 1 é
// sempre 0), então não precisa de ramo condicional novo: com 1 único item,
// a rotação degenera pra sempre devolver esse mesmo item. Com 2+ itens
// marcados, o rodízio normal entre eles continua sendo o comportamento
// correto (o usuário marcou vários de propósito, pool de variação).
// PRNG determinístico simples (mulberry32) — só pra embaralhar a ORDEM dos
// itens 1x por sessão (seeded por sessionSeed, sem dependência externa).
// Achado real de produção (07/2026, prints em AJUSTE_CONFLITO/): o passeio
// antigo por ÍNDICE CONSECUTIVO (startIdx, startIdx+1, startIdx+2) batia
// sempre nos mesmos vizinhos de cadastro — como o usuário tende a cadastrar
// variações do mesmo produto em sequência (3 tipos de mesa seguidos, 2
// "Marketing digital" seguidos), o lote de 3 sugestões saía todo da MESMA
// família ("tudo mesa"), mesmo sem repetir o item literal nenhuma vez.
// Embaralhar 1x por sessão quebra essa correlação sem perder determinismo
// (mesma sessão sempre gera a mesma sequência; sessões diferentes variam).
function seededShuffle<T>(arr: T[], seed: number): T[] {
  let s = seed >>> 0 || 1;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Palavras de ligação ignoradas ao achar a "primeira palavra significativa"
// de um item (ex.: "Mesa de escritório" → "mesa", não "de").
const FIRST_WORD_STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "para",
  "com",
  "em",
  "no",
  "na",
  "e",
  "a",
  "o",
]);

export function pickConcreteItem(
  items: string[],
  attempt: number,
  previousSuggestions: string[],
  sessionSeed: number = 0,
): { item: string | null; repeated: boolean } {
  if (!items.length) return { item: null, repeated: false };
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[áàãâä]/g, "a")
      .replace(/[éèêë]/g, "e")
      .replace(/[íìîï]/g, "i")
      .replace(/[óòõôö]/g, "o")
      .replace(/[úùûü]/g, "u")
      .replace(/ç/g, "c");
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word-boundary em vez de substring puro: evita falso positivo de um item
  // curto (ex.: "TEF") "casar" por coincidência dentro de outra palavra de
  // uma sugestão anterior não relacionada.
  const isUsed = (itemNorm: string) =>
    previousSuggestions.some((sugg) =>
      new RegExp(`\\b${escapeRegex(itemNorm)}\\b`).test(norm(sugg)),
    );
  // familyUsed — guarda de família semântica (achado real de produção,
  // ver comentário do seededShuffle acima): pega o caso em que o shuffle
  // sozinho não é suficiente (a "primeira palavra significativa" do item
  // candidato — ex.: "mesa" — já aparece em alguma sugestão anterior deste
  // MESMO lote/sessão, mesmo sendo um item CADASTRADO diferente).
  const familyUsed = (itemName: string) => {
    const words = norm(itemName).split(/\s+/).filter(Boolean);
    const fw = words.find((w) => !FIRST_WORD_STOPWORDS.has(w)) ?? words[0];
    if (!fw) return false;
    return previousSuggestions.some((sugg) =>
      new RegExp(`\\b${escapeRegex(fw)}\\b`).test(norm(sugg)),
    );
  };
  const shuffled = seededShuffle(items, sessionSeed);
  const startIdx = ((attempt % shuffled.length) + shuffled.length) % shuffled.length;
  // 1ª passada: evita item já citado literalmente E item da mesma família.
  for (let i = 0; i < shuffled.length; i++) {
    const idx = (startIdx + i) % shuffled.length;
    const candidate = shuffled[idx];
    if (!isUsed(norm(candidate)) && !familyUsed(candidate))
      return { item: candidate, repeated: false };
  }
  // 2ª passada: aceita mesma família (melhor um item de família repetida do
  // que travar a geração), só evita repetir o item literal.
  for (let i = 0; i < shuffled.length; i++) {
    const idx = (startIdx + i) % shuffled.length;
    const candidate = shuffled[idx];
    if (!isUsed(norm(candidate))) return { item: candidate, repeated: false };
  }
  return { item: shuffled[startIdx], repeated: previousSuggestions.length > 0 };
}

// Classifica o ELEMENTO CONCRETO desta sugestão como produto físico (VAREJO)
// ou serviço/procedimento (SERVIÇOS) — independente do segmento cadastrado
// da empresa. Usado na PU para escolher a LENTE DO SEGMENTO certa quando a
// empresa registra itens dos dois tipos (ex.: empresa de SERVIÇOS que também
// vende produtos de VAREJO no Kit de Marca).
export function classifyItemType(item: string): "VAREJO" | "SERVIÇOS" | null {
  const norm = item.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const SERVICO_KEYWORDS = [
    "consulta",
    "atendimento",
    "sessao",
    "sessoes",
    "exame",
    "avaliacao",
    "diagnostico",
    "tratamento",
    "procedimento",
    "terapia",
    "manutencao",
    "instalacao",
    "conserto",
    "reparo",
    "revisao",
    "montagem",
    "limpeza",
    "banho e tosa",
    "tosa",
    "aula",
    "curso",
    "treinamento",
    "consultoria",
    "assessoria",
    "acompanhamento",
    "suporte",
    "plano",
    "pacote",
    "servico",
    "entrega",
    "aplicacao",
    "vacina",
    "cirurgia",
    "castracao",
    "adestramento",
    "massagem",
  ];

  const PRODUTO_KEYWORDS = [
    "racao",
    "racoes",
    "acessorio",
    "produto",
    "equipamento",
    "peca",
    "kit",
    "roupa",
    "calcado",
    "bolsa",
    "brinquedo",
    "alimento",
    "bebida",
    "movel",
    "moveis",
    "decoracao",
    "cosmetico",
    "suplemento",
    "ferramenta",
    "material",
    "coleira",
    "caminha",
    "aquario",
    "gaiola",
  ];

  const hasService = SERVICO_KEYWORDS.some((kw) => norm.includes(kw));
  const hasProduct = PRODUTO_KEYWORDS.some((kw) => norm.includes(kw));

  if (hasService && !hasProduct) return "SERVIÇOS";
  if (hasProduct && !hasService) return "VAREJO";
  return null;
}

// Decompõe a ATIVIDADE da empresa em itens concretos (produto/serviço/
// categoria) via IA — usado como POOL do rodízio de pickConcreteItem quando
// o usuário não tem produtos cadastrados no Kit de Marca. Reproduz a lição
// do caso Ferrimaq (ver histórico do produto): decompor a atividade em itens
// e ESCREVER a frase final precisam ser chamadas separadas — pedir pro mesmo
// modelo fazer as duas coisas na mesma chamada produzia rodízio instável
// (sempre "cadeira de escritório", nunca "poltrona de consultório").
// GROUNDING (evita alucinação de produto que a empresa não vende): a IA é
// obrigada a citar, para cada item, uma ÂNCORA — um trecho literal da
// atividade que justifica o item — e o código descarta qualquer item cuja
// âncora não seja de fato um substring da atividade informada. Isso não
// impede sinônimo/generalização (o ITEM em si pode usar palavra diferente da
// atividade, ex. "cadeira giratória" para atividade "móveis para
// escritório"), só impede a IA inventar uma justificativa que não existe no
// texto do usuário.
const DECOMPOSE_TIMEOUT_MS = 6_000;

function normalizeForOverlap(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const OVERLAP_STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
  "para",
  "com",
  "em",
  "um",
  "uma",
  "no",
  "na",
  "ou",
]);

// Cada palavra significativa da ÂNCORA precisa existir em algum lugar da
// ATIVIDADE — não exige TRECHO CONTÍNUO (substring), porque a IA legitimamente
// combina palavras de partes diferentes de uma lista (ex.: atividade "Móveis
// para Escritório, Consultórios, Auditórios" → item "Móveis para
// Consultórios" é uma combinação válida de "Móveis" + "Consultórios", mas não
// é um substring contíguo do texto original). Ainda assim bloqueia âncora
// inventada: só passa se TODAS as palavras relevantes forem reais.
function ancoraIsGrounded(ancora: string, activityNorm: string): boolean {
  const words = normalizeForOverlap(ancora)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !OVERLAP_STOPWORDS.has(w));
  if (words.length === 0) return false;
  return words.every((w) => activityNorm.includes(w));
}

export async function decomposeAtividadeEmItens(
  apiKey: string,
  mainActivity: string,
  segment: string,
): Promise<string[]> {
  const activity = mainActivity.trim();
  // Atividade curta demais (ex.: "Consultoria", 1 palavra) não dá base real
  // pra decompor — a IA tende a INVENTAR subcategorias plausíveis mas não
  // confirmadas (ex.: "Consultoria financeira", "Consultoria em RH") só para
  // preencher a lista, e o grounding por palavra não pega isso porque a
  // própria palavra da atividade aparece dentro do item inventado. Nesse
  // caso é melhor cair no fallback já existente (ancoragemAtividade, sem
  // elemento concreto) do que arriscar afirmar uma especialidade que a
  // empresa pode não ter.
  if (activity.split(/\s+/).filter(Boolean).length < 3) return [];
  try {
    const prompt = `Você recebe a descrição da ATIVIDADE de uma pequena empresa brasileira do segmento "${segment}". Decomponha essa atividade em 5 a 8 produtos, serviços, categorias ou procedimentos CONCRETOS e específicos que essa empresa provavelmente vende ou oferece — coisas reais e do dia a dia desse ramo, não conceitos abstratos de negócio.

ATIVIDADE: "${activity}"

Para cada item, informe também a ÂNCORA: as palavras da ATIVIDADE acima (podem vir de partes diferentes da descrição, mas cada palavra da âncora precisa existir literalmente na ATIVIDADE) que justificam esse item. Se você não conseguir apontar palavras reais da ATIVIDADE que sustentem o item, NÃO inclua esse item na lista.

Se a atividade for vaga ou genérica demais para decompor em itens concretos e verificáveis, devolva uma lista vazia — NÃO invente item que a descrição não sustente.

Responda JSON EXATAMENTE assim: { "itens": [{ "item": "nome curto do produto/serviço/categoria", "ancora": "trecho literal da atividade" }] }`;

    const result = await fetchOpenAIChat(
      apiKey,
      {
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      },
      DECOMPOSE_TIMEOUT_MS,
    );
    if (!result.ok) return [];
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) return [];

    let parsed: { itens?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed.itens)) return [];

    const activityNorm = normalizeForOverlap(activity);
    const seen = new Set<string>();
    const itens: string[] = [];
    for (const raw of parsed.itens) {
      if (!raw || typeof raw !== "object") continue;
      const item = String((raw as { item?: unknown }).item || "")
        .trim()
        .slice(0, 80);
      const ancora = String((raw as { ancora?: unknown }).ancora || "").trim();
      if (!item || !ancora) continue;
      // Grounding: todas as palavras significativas da ÂNCORA precisam ser
      // reais na atividade — impede o modelo de inventar item sem base no
      // texto do usuário (ver ancoraIsGrounded acima).
      if (!ancoraIsGrounded(ancora, activityNorm)) continue;
      const key = normalizeForOverlap(item);
      if (seen.has(key)) continue;
      seen.add(key);
      itens.push(item);
      if (itens.length >= 8) break;
    }
    return itens;
  } catch {
    return [];
  }
}

// Relação real com teste de troca — investigação de 12/07/2026 (ver memória
// do projeto: metodo-op-aristoteles-retorica-sugestao). Achado validado com
// múltiplos itens reais da carteira, 2 juízes independentes (Opus) e
// comparação contra baseline real da Variante A: pra item de SERVIÇOS sem
// textura física (ex.: "Planejamento de Comunicação", "Criação de sites"),
// o motor tende a INVENTAR uma cena de negócio plausível-soante em vez de
// usar uma relação real e reconhecível — a ATIVIDADE sozinha não dá a
// textura de uso que um produto físico dá de graça (ver ancoragemAtividade
// mais abaixo, que já pede isso, mas sem uma chamada dedicada a validar a
// relação ANTES de escrever a frase final).
//
// Escopo DELIBERADAMENTE restrito a SERVIÇOS sem produto físico (ver
// `usaRelacaoReal` em generateSugestao): testado com N=5 itens físicos de
// VAREJO (terno, cadeira de escritório, correia industrial, capacete de
// moto, tênis) e a Variante A JÁ ganha sozinha em 4 de 5 — a textura física
// do item ancora a cena sem precisar desta chamada extra, e adicionar uma
// camada de abstração aqui SÓ PIORA o resultado nesse caso. Por isso esta
// função nunca é chamada para item classificado como VAREJO.
const RELACAO_REAL_TIMEOUT_MS = 6_000;

export async function deriveRelacaoRealComTesteDeTroca(
  apiKey: string,
  concreteItem: string,
  companyName: string,
  mainActivity: string,
  segment: string,
): Promise<string | null> {
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
      RELACAO_REAL_TIMEOUT_MS,
    );
    if (!result.ok) return null;
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as { relacao?: unknown };
    const relacao = String(parsed.relacao || "").trim();
    return relacao || null;
  } catch {
    return null;
  }
}

// Lentes de abertura — 11 formas internas de variar o ÂNGULO da
// Informação-chave (Sugestão MOP e PU) sobre o CONTEXTO REAL DE USO já
// identificado a partir do elemento concreto e da atividade. São orientação
// de geração apenas: nunca aparecem no JSON de saída nem na UI, não criam
// uma situação nova (o contexto real de uso já foi definido antes) e não
// introduzem tensão, promessa emocional, progressão ou linguagem de
// campanha — apenas escolhem um recorte dentro do contexto já identificado.
// Exportado (11/07/2026) só pra reaproveitamento do harness de teste A/B
// offline (scripts/ab-sugestao) — nenhum comportamento de produção muda.
export const OPENING_LENSES: { nome: string; guia: string }[] = [
  {
    nome: "Situação real",
    guia: "Dentro do contexto real de uso já identificado, escolha um momento específico e cotidiano em que ele acontece — descrito sem dramatizar.",
  },
  {
    nome: "Dúvida comum",
    guia: "Dentro do contexto real de uso já identificado, escolha uma dúvida comum que clientes têm antes de usar, contratar ou comprar nesse contexto.",
  },
  {
    nome: "Oportunidade",
    guia: 'Dentro do contexto real de uso já identificado, escolha um momento ou ocasião ESPECÍFICA (estação, fase, evento, situação concreta do calendário ou da rotina do cliente) em que o elemento se encaixa bem — descrito com um detalhe real e datável, nunca uma afirmação vaga de que "serve bem" ou "é uma boa opção".',
  },
  {
    // Redação ajustada em 07/2026 (teste A/B Variante C, validado por Opus e
    // Fable como juízes independentes): a versão original ("como ele é
    // feito, escolhido ou mantido") não distinguia DE QUEM é essa etapa — o
    // modelo podia descrever bastidor de quem VENDE (estoque, fabricação,
    // preparo), o mesmo formato das falhas reais da Variante B rejeitada
    // ("no armazenamento", "na escolha de acabamentos"). Esta versão amarra
    // a etapa ao CLIENTE que a vive, nunca à empresa.
    nome: "Processo",
    guia: "Dentro do contexto real de uso já identificado, escolha uma etapa do processo que o PRÓPRIO CLIENTE vive ao usar, escolher, ajustar ou manter o elemento (ex.: como ele decide, guarda, renova ou prepara isso na vida/rotina dele) — NUNCA uma etapa de bastidor de quem vende ou produz (estoque, fabricação, preparo interno, organização de fornecedores).",
  },
  {
    nome: "Resultado observável",
    guia: "Dentro do contexto real de uso já identificado, escolha um resultado MEDÍVEL OU VISÍVEL (tempo ganho/perdido, problema resolvido, estado antes/depois, frequência, quantidade) que o elemento entrega ou permite nesse contexto — nunca uma sensação vaga de melhoria genérica.",
  },
  {
    nome: "Escolha antes da compra",
    guia: "Dentro do contexto real de uso já identificado, escolha um critério ou detalhe que faz diferença na hora de escolher o elemento para esse uso.",
  },
  {
    nome: "Necessidade percebida",
    guia: 'Dentro do contexto real de uso já identificado, escolha uma necessidade CONCRETA e específica (nunca abstrata como "praticidade", "organização" ou "qualidade de vida") que o elemento atende — ancorada numa situação real e nomeável em que essa necessidade aparece.',
  },
  {
    nome: "Erro evitável",
    guia: "Dentro do contexto real de uso já identificado, escolha um erro comum e evitável relacionado a esse uso — descrito como fato, sem culpar o cliente.",
  },
  {
    nome: "Comparação concreta",
    guia: 'Dentro do contexto real de uso já identificado, compare duas opções, modelos, tamanhos, versões ou jeitos reais de usar/escolher o elemento — apontando uma diferença prática e específica entre eles, nunca uma comparação genérica tipo "X é melhor que Y".',
  },
  {
    nome: "Sinal de hora de agir",
    guia: "Dentro do contexto real de uso já identificado, escolha um sinal concreto e perceptível (desgaste, comportamento, data, sintoma, mudança visível) que indica a hora de trocar, revisar, repor, renovar ou cuidar do elemento.",
  },
  {
    nome: "Detalhe que passa despercebido",
    guia: 'Dentro do contexto real de uso já identificado, escolha um detalhe específico do elemento que o cliente costuma não notar ou só percebe tarde demais — um aspecto concreto, nunca uma qualidade abstrata como "atenção aos detalhes".',
  },
];

// Lentes seguras pro formato positivo "[item] para [resultado]" (uma das
// construções preferenciais no MOP, não mais exclusiva — ver
// elementoConcretoBlock) — comparação/dúvida/erro/sinal/detalhe tendem a
// produzir condicional, defeito ou pergunta, o que colide com a proibição de
// crítica ao cliente do metodoPrompt ("PROIBIDO... crítica ou cobrança ao
// cliente"). Ficam disponíveis só no PU, onde esse formato é legítimo.
// Exportado (11/07/2026) só pra reaproveitamento do harness de teste A/B
// offline — nenhum comportamento de produção muda.
export const MOP_SAFE_LENS_NAMES = new Set([
  "Resultado observável",
  "Necessidade percebida",
  "Escolha antes da compra",
  "Processo",
  "Oportunidade",
]);

// No PU, "Sinal de hora de agir" e "Erro evitável" pressupõem um ciclo de
// desgaste/troca ou um erro de uso físico — non-sequitur quando o elemento
// concreto desta sugestão é um serviço/procedimento (sem esse ciclo). Exclui
// as duas só nesse caso; produto físico (VAREJO) ou item não classificado
// mantém o pool cheio, já que ali a premissa das duas lentes faz sentido.
// Exportado (11/07/2026) pelo mesmo motivo de MOP_SAFE_LENS_NAMES acima.
export const SERVICE_RISKY_LENS_NAMES = new Set(["Sinal de hora de agir", "Erro evitável"]);

// ── Juiz estrutural único da Sugestão (backstop, fail-closed em dúvida real) ──
// PRINCÍPIO DO FECHO DA FRASE (documento de princípios, topo + entrada 1.6,
// refinado em 05/07/2026) + auditoria de casos reais de 05/07/2026: o juiz
// anterior avaliava só o FECHO e tinha viés de aprovar em dúvida — o que
// deixava passar fecho vago fora dos exemplos do prompt, núcleo abstrato
// ("Escolha certa", "Falta do..."), jargão de marketing ("leads", "tráfego",
// "briefing") e slogan genérico ("Marketing digital para gerar mais vendas").
// Nenhuma dessas falhas cabe em lista fixa de palavras — são semânticas,
// então viram critério de um juiz único (1 chamada, 5 perguntas) em vez de
// checagens de regex fadadas a ficar sempre incompletas.
// 5º critério (economiaOk, auditoria AJUSTE_CONFLITO 05/07/2026): screenshots
// reais mostraram sugestões gramaticalmente corretas mas com adjetivo de
// recheio redundante no fecho ("susto inesperado", "negociações digitais",
// "contatos ativos") — os 4 critérios originais não pegavam isso porque o
// fecho apontava pra um resultado concreto de verdade; só o adjetivo colado
// nele era vazio. economiaOk testa especificamente essa redundância/recheio.
// As checagens determinísticas (checkWeakEnding + as demais) continuam
// sendo a primeira linha, mais barata; este juiz só roda quando TODAS elas
// passaram — é o backstop que generaliza onde regex não alcança.
// VIÉS INVERTIDO (mudança central desta auditoria): o juiz anterior tratava
// "dúvida real" igual a "falha técnica" (as duas aprovavam). Aqui as duas
// são tratadas diferente — falha TÉCNICA (erro de rede, timeout, JSON
// inválido) continua fail-open (nunca trava o clique do usuário por
// instabilidade de infraestrutura); mas dúvida REAL sobre o conteúdo (o
// juiz respondeu, o JSON é válido, mas algum critério não veio
// explicitamente `true`) passa a REPROVAR — porque aqui a chamada teve
// sucesso técnico, a IA já avaliou o texto, e "não tenho certeza que está
// bom" deve pesar a favor de reescrever, não de aprovar às cegas. Custo
// absorvido no mesmo evento de Sugestão (COST_USD.sugestao).
const JUDGE_ESTRUTURAL_TIMEOUT_MS = 6_000;

// audience (6º critério contextoOk) — pivô COMPRADOR vs VENDEDOR adicionado
// em 07/2026 (teste A/B Variante C, validado por Opus e Fable como juízes
// independentes): fecha um buraco que o especificoOk não pegava — uma frase
// pode ter ancoragem concreta (item + local real) e ainda assim descrever
// bastidor de quem vende, não a vida de quem compra (ex.: "Vacinas no
// armazenamento" tem âncora concreta, mas não é cena do cliente final).
export interface JudgeVerdict {
  ok: boolean;
  motivo?: string;
  // Só presente quando ok:true veio de falha TÉCNICA (timeout, rede, JSON
  // inválido) — distingue "aprovado de verdade" de "passou sem checagem
  // nenhuma" (ver project-juiz-llm-veto-descartado-2026-07-13 na memória:
  // sem isso, era impossível medir quantas Sugestões escapavam do juiz).
  failReason?: "falha_tecnica";
}

export async function judgeSugestaoEstrutural(
  apiKey: string,
  sugestao: string,
  concreteItem: string | null | undefined,
  mainActivity: string,
  segment: string,
  audience: SugestaoAudience,
): Promise<JudgeVerdict> {
  try {
    const criterioContexto = `
6. contextoOk — se a frase ancora o item numa situação/momento/local, quem VIVE essa cena é quem COMPRA ou USA o item (ele se imagina usando, recebendo, escolhendo, precisando) — e não uma etapa interna de quem VENDE (estoque, armazenamento, preparo, escolha de insumos, organização interna)? Reprove só quando a cena existir apenas do lado de dentro do balcão (ex.: "no armazenamento", "na escolha de acabamentos", "na organização interna"). NÃO reprove frases sem situação nenhuma (isso é papel do especificoOk) nem rotina operacional que é do próprio cliente comprador (ex.: em B2B, "no fechamento dos pedidos" é rotina de quem compra, não bastidor de quem vende). PÚBLICO-ALVO desta empresa: ${audience === "B2C" ? "consumidor final (B2C) — a cena precisa ser vivida pela pessoa que usa o item na própria vida" : "empresarial (B2B) — o comprador é o dono/gestor do negócio, e a rotina de trabalho DELE (não da empresa que vende) conta como contexto legítimo"}.
7. gramaticaOk — a frase está gramaticalmente correta na norma culta do português brasileiro (concordância verbal e nominal, regência, verbo bem formado — sem construções estranhas ou sem sentido, ex.: "render jornada", "faz jus a paz"; sem pronome de 2ª pessoa informal/regional como "tu/te/ti/teu/tua/contigo")? E, além disso, ela evita AFIRMAR como fato uma característica ESPECÍFICA do item (medida, material, número, certificação, funcionalidade técnica) que NÃO dá pra confirmar só com o nome do item e a atividade informados acima — ou seja, não inventa um dado concreto que soa plausível mas não há como saber se é real (ex.: dizer que uma cadeira tem "ajuste lombar" ou que um lubrificante "aguenta 500 graus" quando isso não foi informado em lugar nenhum)? Em dúvida sobre gramática OU sobre se um dado específico é inventado, marque false.

Avalie os 7 critérios abaixo com RIGOR — em caso de DÚVIDA REAL sobre qualquer um deles, considere REPROVADO (false). Só marque true quando tiver certeza razoável de que o critério foi cumprido:`;

    const prompt = `Avalie esta frase de pauta de conteúdo (Sugestão/Informação-chave) em português brasileiro, para uma empresa do ramo "${mainActivity || segment}":

FRASE: "${sugestao}"${concreteItem ? `\nELEMENTO CONCRETO DE ORIGEM: "${concreteItem}"` : ""}
${criterioContexto}

1. fechoOk — as últimas 2-3 palavras nomeiam um resultado, necessidade, benefício OU uma característica/uso CONCRETO e específico deste item/negócio (não precisa ser necessariamente um ganho — uma característica real e verificável do item também conta como fecho válido, ex.: "com nome do pet", "em madeira maciça", "para filhotes pequenos")? Reprove se o fecho for: ocasião de calendário solta (ex.: "durante feriados", "no verão", "no fim do verão", "no começo do inverno" — QUALQUER variação com conector no meio conta igual), o nome do próprio item sem nada específico agregado, um qualificador ADJETIVO genérico (o teste é o PADRÃO, não uma lista fixa: "certo", "ideal", "exclusivo", "seguro", "preciso", "qualificado", "disponível" são exemplos, mas QUALQUER adjetivo cujo oposto seria absurdo de anunciar conta como vazio), OU um SUBSTANTIVO ABSTRATO genérico de sensação/qualidade (ex.: "aconchego", "praticidade", "bem-estar", "conforto", "satisfação"). O TESTE CENTRAL não é "é um benefício?" — é "é específico e verificável PARA ESTE item, ou serviria pra qualquer outro produto/serviço do mercado sem dizer nada particular?". Se colaria em qualquer coisa, é vazio mesmo sendo um substantivo "positivo" ou um benefício genérico ("melhora", "facilita a vida").
2. nucleoOk — o centro GRAMATICAL da frase (o sujeito ou a locução que abre a frase) é o elemento concreto em si — e NÃO um termo abstrato/nominalização mesmo quando o item concreto aparece DEPOIS dele como complemento? Reprove construções do tipo "a escolha certa DE [item]", "a falta DE [item]", "o uso DE [item]", "planejamento DE [item]" — nelas o item aparece na frase, mas GRAMATICALMENTE é só complemento de um conceito abstrato ("escolha", "falta", "uso", "planejamento") que ocupa o lugar do núcleo; isso reprova mesmo com o item mencionado. Só aprove quando o próprio item/categoria/atividade for o sujeito ou abrir a locução (ex.: "Mesa para reuniões longas", "Cadeira que ajusta altura").
3. linguagemOk — uma pessoa comum, leiga no assunto, entende a frase de primeira, SEM jargão técnico ou anglicismo de marketing/vendas (ex.: "leads", "tráfego pago", "briefing", "funil", "contatos quentes", "targeting", "conversão")? EXCEÇÃO: se o ELEMENTO CONCRETO DE ORIGEM informado acima já É esse termo (o próprio produto/serviço cadastrado se chama assim — ex.: a empresa vende literalmente "Tráfego pago" como serviço), NÃO reprove por nomear o item pelo nome dele mesmo; reprove aqui só jargão ADICIONAL além do necessário pra nomear o item (ex.: mesmo citando "Tráfego pago" corretamente, "leads qualificados" ou "funil de conversão" no resto da frase ainda reprovam).
4. especificoOk — a frase tem ALGUMA ancoragem concreta (um item, categoria, procedimento ou situação real) — ou é um slogan institucional que não nomeia NADA concreto e serviria com as MESMAS palavras mesmo trocando o produto/serviço por outro completamente diferente (ex.: "Marketing digital para gerar mais vendas", "Qualidade que você pode confiar")? IMPORTANTE: uma frase que nomeia um item/categoria real (mesmo um item comum, tipo "cadeira", "mesa", "consulta") e descreve um resultado/característica verificável dele NÃO é genérica só porque um concorrente que vende o mesmo TIPO de item poderia dizer algo parecido — isso é esperado e correto, reprove aqui SÓ quando a frase não tiver nenhum item/situação concreta identificável, e sim apenas um conceito abstrato de negócio.
5. economiaOk — a última palavra (ou as últimas 2-3) é redundante/pleonástica com o resto da frase (ex.: "susto inesperado" — susto já é inesperado por definição), OU é um qualificador (adjetivo/particípio) colado ao substantivo final que NÃO muda nem especifica o resultado central (ex.: "negociações digitais", "contatos ativos", "demandas híbridas", "internações longas" — tire a palavra e o resultado continua o mesmo), OU está semanticamente deslocada do tipo real desse item/negócio (ex.: um acessório anunciado por um benefício que não é a função dele)? TESTE: apague mentalmente essa última palavra — se a frase perde informação real, marque economiaOk true (está OK); se a frase fica dizendo exatamente a mesma coisa, só mais curta, marque economiaOk false (é recheio, reprovado).

Responda JSON EXATAMENTE assim: { "fechoOk": true ou false, "nucleoOk": true ou false, "linguagemOk": true ou false, "especificoOk": true ou false, "economiaOk": true ou false, "contextoOk": true ou false, "gramaticaOk": true ou false, "motivo": "se algum item for false, 1 frase curta e objetiva dizendo o que corrigir; se todos forem true, string vazia" }`;

    const result = await fetchOpenAIChat(
      apiKey,
      {
        // Subido de gpt-4.1-mini pra gpt-4.1 (achado 13/07/2026, investigação
        // Opus+Fable): o juiz era mais FRACO que o gerador (que já usa
        // gpt-4.1), assimetria invertida — um juiz de nível igual/superior é
        // pré-requisito pra pegar o que o mini deixava passar. Custo marginal
        // baixo: roda 1x por tentativa, prompt curto.
        model: "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      },
      JUDGE_ESTRUTURAL_TIMEOUT_MS,
    );
    // Falha TÉCNICA (rede, timeout, status de erro) — fail-open: nunca trava
    // o clique do usuário por instabilidade de infraestrutura. Sinaliza
    // failReason pra quem loga o veredito distinguir isto de aprovação real.
    if (!result.ok) return { ok: true, failReason: "falha_tecnica" };
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) return { ok: true, failReason: "falha_tecnica" };

    let parsed: {
      fechoOk?: unknown;
      nucleoOk?: unknown;
      linguagemOk?: unknown;
      especificoOk?: unknown;
      economiaOk?: unknown;
      contextoOk?: unknown;
      gramaticaOk?: unknown;
      motivo?: unknown;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: true, failReason: "falha_tecnica" }; // JSON inválido é falha técnica, não dúvida de conteúdo.
    }

    // Fail-closed em dúvida REAL: diferente do juiz anterior (que só reprovava
    // com `false` explícito), aqui qualquer valor que não seja EXATAMENTE
    // `true` conta como reprovado — a chamada teve sucesso técnico, então
    // ambiguidade é dúvida sobre o CONTEÚDO, e o produto pede rigor aqui.
    const allOk =
      parsed.fechoOk === true &&
      parsed.nucleoOk === true &&
      parsed.linguagemOk === true &&
      parsed.especificoOk === true &&
      parsed.economiaOk === true &&
      parsed.contextoOk === true &&
      parsed.gramaticaOk === true;
    if (allOk) return { ok: true };

    return {
      ok: false,
      motivo:
        typeof parsed.motivo === "string" && parsed.motivo.trim()
          ? parsed.motivo.trim()
          : "juiz estrutural reprovou a frase (fecho, núcleo, linguagem, especificidade, economia, contexto ou gramática) sem detalhar o motivo — reescreva com mais concretude, sem jargão e sem palavra de recheio no fim",
    };
  } catch {
    return { ok: true, failReason: "falha_tecnica" }; // erro técnico (rede, exceção) — fail-open.
  }
}

export type SugestaoSegment = "VAREJO" | "SERVIÇOS" | "MARCA";
export type SugestaoAudience = "B2C" | "B2B";
export type SugestaoMode = "postunico" | "metodo";

// Entrada pura do motor de geração da Sugestão — já sanitizada pelo chamador
// (rota HTTP ou script de teste). Nenhum campo aqui lê `request`/`body`
// diretamente: isso mantém o motor testável fora do contexto de uma request
// real (ver scripts/ab-test-sugestao.ts).
export interface SugestaoEngineInput {
  companyName: string;
  mainActivity: string;
  objetivo: string;
  hint: string;
  mode: SugestaoMode;
  attempt: number;
  sessionSeed: number;
  previousSuggestions: string[];
  segment: SugestaoSegment;
  isPersonalBrand: boolean;
  selectedProducts: string[];
  audience: SugestaoAudience;
  brandVoice: string;
}

// Motor puro de geração da Sugestão (MOP + PU) — extraído mecanicamente de
// src/routes/api/suggest-keyinfo.ts (extração de 06/07/2026, zero mudança de
// lógica/texto/comportamento) para poder ser chamado tanto pela rota HTTP
// quanto por um harness de teste A/B offline. Autenticação, rate limit,
// saldo/débito de plano e parsing de request continuam só na rota — este
// módulo não sabe nada sobre usuário, billing ou HTTP.
export async function generateSugestao(
  apiKey: string,
  input: SugestaoEngineInput,
): Promise<{ sugestao: string; judgeVerdicts: Array<JudgeVerdict & { pass: number }> }> {
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
    isPersonalBrand,
    selectedProducts,
    audience,
    brandVoice,
  } = input;

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Sem produtos cadastrados pelo usuário no Kit de Marca: decompõe a
  // ATIVIDADE em itens concretos via IA (gpt-4.1-mini, barato) em vez
  // de cair direto no fallback genérico de ancoragemAtividade — mesma
  // lição do caso Ferrimaq (decompor precisa ser uma chamada separada
  // de escrever a frase final), só que agora sem exigir que o usuário
  // digite a lista. Ver decomposeAtividadeEmItens acima para o
  // grounding contra alucinação (âncora literal na atividade).
  const inferredProducts = selectedProducts.length
    ? []
    : await decomposeAtividadeEmItens(apiKey, mainActivity, segment);
  const productsPool = selectedProducts.length ? selectedProducts : inferredProducts;

  // Elemento concreto — semente determinística escolhida a partir da
  // lista de produtos/serviços marcados pelo usuário no Kit de Marca
  // (ou, na ausência dela, da lista inferida da atividade acima).
  // Calculado antes da ancoragem na atividade porque define quem é o
  // dono do CONTEXTO REAL DE USO (ver ancoragemAtividade abaixo): com
  // elemento concreto, é o elementoConcretoBlock; sem ele, é a
  // ancoragem na atividade (fallback).
  const { item: concreteItem, repeated: concreteItemRepeated } = pickConcreteItem(
    productsPool,
    attempt,
    previousSugs,
    sessionSeed,
  );

  // Relação real com teste de troca (ver deriveRelacaoRealComTesteDeTroca
  // acima) — só pra SERVIÇOS sem textura física de produto: item físico já
  // ancora a cena sozinho (validado com N=5 itens de VAREJO, ver comentário
  // da função), então a chamada extra só roda quando pode ajudar.
  const itemTypeParaRelacaoReal = concreteItem ? classifyItemType(concreteItem) : null;
  const usaRelacaoReal =
    !!concreteItem && segment === "SERVIÇOS" && itemTypeParaRelacaoReal !== "VAREJO";
  const relacaoReal = usaRelacaoReal
    ? await deriveRelacaoRealComTesteDeTroca(
        apiKey,
        concreteItem!,
        companyName,
        mainActivity,
        segment,
      )
    : null;
  const relacaoRealBlock = relacaoReal
    ? `\nRELAÇÃO REAL JÁ IDENTIFICADA (uso interno, embasa a frase — não precisa citar literalmente): "${relacaoReal}". A frase final deve preservar o GANCHO mais concreto e específico dessa relação (o sintoma/situação exato) — não parafraseie para um termo mais abstrato ou genérico de categoria só para soar mais "profissional"; prefira uma frase menos elegante que preserva o gancho a uma mais bonita que o perde.\n`
    : "";

  // Eixos de leitura por segmento — direcionam a sugestão sem virar
  // biblioteca fixa de respostas.
  const SEGMENT_LENS: Record<SugestaoSegment, string> = {
    VAREJO:
      "o momento em que o cliente usa o produto no dia a dia e sente a diferença — conforto, espaço, facilidade, agilidade, resultado — não um atributo do produto isolado (embalagem, especificação técnica, disponibilidade em estoque)",
    SERVIÇOS:
      "o que muda na rotina do cliente antes ou depois do serviço — uma dúvida, decisão, dificuldade ou alívio que ele mesmo vive — não o processo ou método de quem presta o serviço",
    MARCA:
      "o momento em que o público se reconhece, se identifica ou desenvolve confiança ao se conectar com a identidade da marca — os valores, a cultura ou o propósito vividos por ele através dela — não um atributo isolado da própria empresa (bastidor, história institucional, conquista interna) sem ligação com quem está vendo",
  };
  // Marca pessoal (documento de princípios, Parte 2.1): o dono/profissional
  // É a marca — o eixo de leitura passa a ser a trajetória, o jeito de
  // trabalhar ou a experiência da PESSOA, não valores/cultura de uma
  // empresa abstrata por trás dela.
  const MARCA_LENS_PESSOAL =
    "o momento em que o público se reconhece, se identifica ou desenvolve confiança ao acompanhar a trajetória, o jeito de trabalhar ou a experiência real do profissional por trás da marca — não um atributo isolado de uma empresa abstrata (bastidor institucional, história corporativa) sem ligação direta com a pessoa";

  // Ancoragem na atividade — a ATIVIDADE é a fonte PRINCIPAL do
  // assunto da sugestão; o nome da empresa serve só para
  // identificação. Reúne 2 regras: (1) atividade como fonte
  // principal de entendimento do negócio, e (2) cena concreta — a
  // sugestão nasce de uma situação real e reconhecível do ramo, não
  // de um conceito amplo que serviria para qualquer empresa do
  // segmento. A escolha do assunto concreto em si vem de
  // elementoConcretoBlock (lista de produtos/serviços do Kit).
  // Exemplos fixos de "Contraste esperado" (achado 14/07/2026, auditoria
  // Fable+Opus): 3 ramos hardcoded ("consultoria de marketing", "peças e
  // lubrificantes", "ferramentas e máquinas") sempre presentes, iguais pra
  // qualquer audiência. Quando o ramo real da empresa coincide com um deles
  // (ex.: Barbosa Lubrificantes ≈ "peças e lubrificantes"), o vocabulário do
  // exemplo ("filtro", "mangueira") vaza pro resultado mesmo sem estar no
  // catálogo real — caso real: "Filtros para motores agrícolas" na Barbosa,
  // que não vende filtro (só Óleos, Correias, Mangueiras, Ferramentas, EPI).
  // Só entra quando NÃO há elemento concreto: nesse caso o `elementoConcretoBlock`
  // já ancora a cena num item real e específico, tornando os exemplos
  // genéricos redundantes e só arriscados; sem elemento concreto (atividade
  // curta ou decomposição vazia), eles continuam ensinando o TIPO de
  // especificidade esperado sem alternativa melhor disponível.
  const contrasteExemplosBlock = concreteItem
    ? ""
    : `\nContraste esperado — exemplos de FORMATO de OUTROS RAMOS (não copie o vocabulário ou os produtos destes exemplos; servem só para mostrar o tipo de especificidade esperado — a sua sugestão deve usar vocabulário de "${mainActivity}", não destes exemplos): em vez de conceitos amplos como esses, prefira algo do tipo: "Instagram sem gerar oportunidades" ou "WhatsApp sem resposta reduz conversões" (exemplo do ramo consultoria de marketing); "filtro correto protege o equipamento" ou "mangueira inadequada gera vazamentos" (exemplo do ramo peças e lubrificantes); "correia desgastada pode parar a operação" ou "ferramenta certa evita retrabalho" (exemplo do ramo ferramentas e máquinas).`;

  const ancoragemAtividade = mainActivity.trim()
    ? `FONTE PRINCIPAL DO ASSUNTO — ATIVIDADE DA EMPRESA:
A ATIVIDADE descrita acima ("${mainActivity}") é a PRINCIPAL fonte para entender o que essa empresa faz, vende, resolve ou oferece — é dali que a sugestão deve nascer. O NOME DA EMPRESA serve apenas para IDENTIFICAÇÃO: não use o nome como pista de assunto, a menos que o que ele sugere também esteja descrito na ATIVIDADE.

CENA CONCRETA: a sugestão deve partir de uma situação real e reconhecível desse ramo — um produto, peça, ferramenta, canal, procedimento ou momento específico do dia a dia — e NÃO de um conceito amplo que serviria para qualquer empresa do segmento ${segment} (ex.: "atendimento gera confiança", "escolha certa evita problemas", "empresa próxima vira referência").${contrasteExemplosBlock}
TESTE: se a frase serviria igual para qualquer outra empresa do segmento ${segment}, reescreva ancorando em algo reconhecível do ramo "${mainActivity}". Para atividades mais abstratas (sem produto físico), a cena concreta pode ser um canal, um momento de decisão ou uma interação típica desse ramo — não force um elemento artificial.${concreteItem ? "" : " Essa cena é o CONTEXTO REAL DE USO da sugestão — a lente interna de geração (mais abaixo) escolhe apenas o ÂNGULO dentro dela, sem criar uma situação nova."}`
    : "";
  const ancoragemAtividadeMarca = mainActivity.trim()
    ? `FONTE PRINCIPAL DO ASSUNTO — ATIVIDADE DA MARCA:
A ATIVIDADE descrita acima ("${mainActivity}") é a PRINCIPAL fonte para entender o que essa marca faz, oferece ou representa — é dali que a sugestão deve nascer. O NOME DA MARCA serve apenas para IDENTIFICAÇÃO: não use o nome como pista de assunto, a menos que o que ele sugere também esteja descrito na ATIVIDADE.

CENA CONCRETA: a sugestão deve partir de um elemento real e reconhecível dessa marca — um ingrediente, material, processo, ritual, território, gesto ou característica específica${mode === "metodo" ? " (sem dor do cliente, sem linguagem de venda)" : ""} — e NÃO de um conceito amplo que serviria para qualquer marca do segmento (ex.: "reconhecimento", "identificação", "vínculo", "valor percebido").
TESTE: se a frase serviria igual para qualquer outra marca do segmento, reescreva ancorando em algo reconhecível da marca "${mainActivity}". Para atividades mais abstratas, não force um elemento artificial.${concreteItem ? "" : " Esse elemento é o CONTEXTO REAL DE USO da sugestão — a lente interna de geração (mais abaixo) escolhe apenas o ÂNGULO dentro dele, sem criar uma situação nova."}`
    : "";
  const ancoragemBlock = segment === "MARCA" ? ancoragemAtividadeMarca : ancoragemAtividade;

  // Definido aqui (antes de contextoFormaBlock/elementoConcretoBlock) porque os
  // dois blocos abaixo agora ramificam por audiência — achado de auditoria
  // 14/07/2026: audience só entrava no audienceDirective (proibição de
  // vocabulário) e no juiz (contextoOk), nunca no bloco que de fato instrui a
  // IA a imaginar a cena — por isso B2C e B2B convergiam pro mesmo esqueleto
  // de frase, só trocando substantivo.
  const isB2C = audience === "B2C";

  // contextoFormaBlock — ajustado em 07/2026 (teste A/B Variante C, validado
  // por Opus e Fable como juízes independentes): a regra anterior mandava
  // SEMPRE preferir resultado/efeito sobre cenário/momento ("cenário é
  // exceção, não padrão") — regra que contradizia o princípio "Contexto na
  // MOP" do Aristóteles (bons exemplos dele são majoritariamente momento/
  // cenário: "em manhãs frias", "antes de uma viagem") e a própria lente
  // "Situação real" já em produção (que pede exatamente "um momento
  // específico e cotidiano"). Descarta a hierarquia por TIPO (resultado vs
  // cenário) e usa o eixo que os dois juízes convergiram ser o certo: QUEM
  // VIVE a situação — comprador/usuário do item, nunca bastidor de quem
  // vende — com a rotina do próprio cliente comprador (ex.: B2B) contando
  // como legítima. Inclui também o princípio dos conectores (e/com/em/
  // no-na/para/à) SEM listá-los como menu — listar as 6 formas recriaria o
  // "molde forçado" da fórmula PRODUTO+CONECTOR+RECORTE já testada e
  // rejeitada (scripts/ab-sugestao/variantB.ts).
  // HIERARQUIA ENTRE CONECTORES (13/08/2026) — medição de 12/07 commitada em
  // 91308b5: a mesma relação real escrita com os 7 conectores, julgada em 8
  // casos (56 frases). Plausibilidade passou em 63 de 64 — a IDEIA quase nunca
  // é o problema; o que reprova é a NATURALIDADE do conector. Frases 100%
  // aprovadas: com 7/8, para 6/8, em 3/8, e 2/8, no 2/8, à 1/8, na 1/8. Os
  // cinco fracos produzem construção encaixada à força ("à medida de mensagens
  // eficazes", "na necessidade do cliente", "no contexto de atualização"). Por
  // isso "com"/"para" viram PADRÃO e os outros passam a exigir naturalidade
  // genuína — preferência, não proibição: banir os cinco recriaria o menu
  // fechado que o parágrafo acima descarta. RESSALVA do dado: o experimento
  // FORÇOU um conector por frase; em produção o modelo escolhe livre, então
  // parte do lixo do "à" pode ser artefato da coerção, não do uso real.
  // CORREÇÃO no mesmo dia (13/08/2026, commit 0fab144) — 15 gerações reais
  // mediram a mudança acima e acharam um efeito colateral não previsto: antes
  // dela, 4 das 15 frases eram construídas com VERBO DE AÇÃO ("Tênis leve
  // evita cansaço rápido"); depois, ZERO — as 15 viraram locução [item] +
  // conector + situação. Promover com/para empurrou o modelo para a forma que
  // mais combina com eles e matou a alternância que o parágrafo do "molde
  // forçado" existe para proteger. Por isso a hierarquia passou a declarar seu
  // próprio ESCOPO: ela só governa a frase que USA conector; a frase com verbo
  // não é candidata a troca. A preferência de conector nunca pode virar
  // preferência de FORMA.
  const contextoFormaBlock = `O CONTEXTO REAL DE USO pode ser um resultado/efeito, um momento/ocasião, uma finalidade ou uma característica — NENHUMA forma é preferida sobre outra. O único requisito é QUEM VIVE essa situação: precisa ser o CLIENTE/COMPRADOR/USUÁRIO de "${concreteItem}" (ele se imagina usando, recebendo, escolhendo, precisando) — nunca uma etapa de bastidor de quem VENDE (estoque, armazenamento, preparo, organização interna, escolha de insumos)${isB2C ? "" : `, exceto quando essa etapa É a própria rotina de trabalho do cliente comprador — em B2B, "o fechamento dos pedidos" é rotina de quem compra o ERP, não bastidor de quem vende`}. Os conectores não escolhem o assunto — eles só aproximam o produto de uma situação real vivida pelo cliente. "com" e "para" são os que sustentam a frase em português falado e devem ser a escolha padrão; "e", "em", "no/na" e "à" só entram quando soarem genuinamente naturais para este item. TESTE DO CONECTOR: se ele precisou ser encaixado à força ("à medida de...", "na necessidade do...", "no contexto de...", "em situação de..."), a construção está errada — reescreva com "com"/"para" ou com um verbo de ação direto, sem mudar a situação que a frase descreve. ESTA PREFERÊNCIA SÓ VALE QUANDO A FRASE USA CONECTOR: a frase com VERBO DE AÇÃO (ex.: "Tênis leve evita cansaço rápido", "Lubrificantes agrícolas evitam parada no campo") não usa conector nenhum e é TÃO BOA QUANTO a locução — nunca a troque por "[item] para [situação]" só para cumprir a preferência acima. As duas formas precisam conviver: se toda sugestão sair no molde "[item] + conector + situação", a Sugestão volta a soar montada por fórmula. TESTE: o cliente consegue imaginar essa situação acontecendo de verdade com ele? Bons exemplos: "Café em manhãs frias", "Vacinas para filhotes", "ERP no fechamento dos pedidos". Maus exemplos (bastidor de quem vende, não do cliente): "Café na escolha dos grãos", "Vacinas no armazenamento", "ERP na organização interna". VARIE A CONSTRUÇÃO: alterne entre essas formas e entre locução sem verbo ou frase com sujeito e predicado (ver SINTAXE — NÚCLEO DA FRASE), conforme o que soar mais natural para este item; repetir sempre a mesma estrutura entre sugestões é o que faz a Sugestão soar montada por fórmula. PROIBIDO colar um adjetivo ou particípio de recheio na última palavra só para o fecho "parecer" mais específico (ex.: "negociações digitais", "contatos ativos", "demandas híbridas", "sustos inesperados", "internações longas") quando essa palavra não muda nem especifica o efeito central — TESTE: apague a última palavra; se a frase continua dizendo exatamente a mesma coisa, ela é recheio e deve ser cortada ou trocada por um efeito que dependa dela para fazer sentido.`;

  // Elemento concreto — substitui a antiga "COBERTURA DA ATIVIDADE"
  // (rodízio mental por grupos da atividade) por um dado real e
  // explícito (concreteItem definido acima, antes da ancoragem).
  // CONTEXTO REAL DE USO (ramo B2C) ajustado em 14/07/2026 (achado
  // Fable+Opus, caso Pronto Vet): a versão anterior bania "fora do
  // ambiente de trabalho" — mas pra negócios onde o uso legítimo do
  // cliente acontece DENTRO do próprio estabelecimento (clínica
  // veterinária, salão, oficina com espera), essa regra de LOCAL forçava
  // uma cena artificial (ex.: "na saída do consultório", um gancho de
  // balcão) só pra evitar citar o próprio ambiente. O requisito real
  // nunca foi o local — é o PAPEL de quem vive a cena (cliente, não dono/
  // funcionário) — por isso a regra passou a permitir uso no
  // estabelecimento quando a cena é a experiência de quem recebe o
  // produto/serviço.
  const elementoConcretoBlock = concreteItem
    ? `ELEMENTO CONCRETO DESTA SUGESTÃO: "${concreteItem}"
Este é um produto, serviço, categoria ou especialidade real ${segment === "MARCA" ? "da marca" : "da empresa"} — ele é o NÚCLEO da sugestão (ver SINTAXE — NÚCLEO DA FRASE): a frase nomeia ou se refere diretamente a ele, e a cena, situação, dúvida, escolha, característica ou momento se constroem em torno dele.${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — serve só para identificação.` : ""}${
        concreteItemRepeated
          ? `
⚠ ESTE ELEMENTO JÁ FOI USADO EM UMA SUGESTÃO ANTERIOR DESTA SESSÃO (não há outro item marcado disponível): a frase final DEVE ter estrutura sintática, verbo e situação completamente diferentes da(s) anterior(es) sobre este mesmo elemento — não troque apenas 1-2 palavras (ex.: trocar só o verbo final como "resolver" → "tirar" não é variação suficiente). Mude o ÂNGULO de verdade: se a anterior falou de uma dúvida do cliente, esta pode falar de um momento de uso, um resultado observável ou um critério de escolha — sempre seguindo a LENTE sorteada abaixo, mas com vocabulário e construção visivelmente distintos.`
          : ""
      }

CONTEXTO REAL DE USO: antes de aplicar a lente abaixo, identifique para que "${concreteItem}" é usado, em que situação aparece, que problema resolve ou que rotina envolve dentro de "${mainActivity}" especificamente — e não em outro contexto onde o mesmo tipo de item também existiria (uso doméstico, social, outro ramo). ${isB2C ? "Essa situação precisa ser vivida pela PESSOA que usa ou consome o item na própria vida, como CLIENTE — não pelo dono do negócio, não por um funcionário. Quando o uso acontece dentro do próprio estabelecimento (ex.: uma consulta, um banho e tosa, um corte de cabelo, uma prova de roupa), isso CONTA como uso real do cliente — o requisito não é o LOCAL, é o PAPEL: a cena precisa ser a experiência de quem recebe o produto/serviço, nunca o bastidor de quem o vende ou presta (estoque, agenda interna, preparo)." : "Essa situação precisa ser vivida por quem COMPRA ou USA o item dentro do próprio negócio — o dono, sócio ou responsável, na rotina DELE como comprador/usuário do item (recebendo, aplicando, decidindo, mantendo) — nunca uma etapa de quem VENDE o item para ele."} A frase nasce desse contexto real; a lente só escolhe o ÂNGULO dentro dele, sem criar uma situação nova.
${contextoFormaBlock}
DIREÇÃO DE ENTREGA: se a frase envolver entrega, envio ou deslocamento de "${concreteItem}" até alguém (ex.: "entregue", "leva até", "chega em"), o DESTINO é o CLIENTE/USO FINAL (a casa dele, o local onde ele vai usar) — NÃO o endereço da própria empresa/loja/clínica, salvo se "${mainActivity}" disser explicitamente que a entrega é feita até o estabelecimento. Se o destino exato não estiver claro em "${mainActivity}", não mencione local nenhum — descreva pelo RESULTADO/EFEITO direto ("[item] para [resultado]").`
    : "";

  // Reforço final (recência) — repete, já perto do JSON de saída, que o
  // assunto vem da ATIVIDADE e que o nome da empresa/marca não é pista.
  const sementeLembreteAtividade = mainActivity.trim()
    ? `\nLEMBRETE FINAL: a semente concreta deve nomear algo presente em "${mainActivity}".${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — se o que ele sugere não estiver na ATIVIDADE, ignore essa pista.` : ""}\n`
    : "";
  const sementeLembreteMarca = mainActivity.trim()
    ? `\nLEMBRETE FINAL: a semente concreta deve nomear um elemento real de "${mainActivity}".${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — se o que ele sugere não estiver na ATIVIDADE, ignore essa pista.` : ""}\n`
    : "";

  // PU: a LENTE DO SEGMENTO segue o TIPO do elemento concreto desta
  // sugestão (produto físico vs serviço/procedimento) quando ele
  // difere do segmento cadastrado da empresa — ex.: empresa de
  // SERVIÇOS (Pronto Vet) sugerindo a partir de "Rações e acessórios
  // para pet" usa a lente de VAREJO nesta sugestão, não a de
  // SERVIÇOS. MARCA não entra nessa troca: seu eixo (reconhecimento,
  // vínculo, percepção) não é substituído por um eixo de
  // compra/atendimento.
  // segmentLensBlock só é usado no postUnicoPrompt — no MOP (mode
  // "metodo") esse cálculo nunca é lido, então é pulado por completo.
  const segmentLensBlock = (() => {
    if (mode !== "postunico") return "";
    const itemType = concreteItem ? classifyItemType(concreteItem) : null;
    const segmentForLens: SugestaoSegment =
      itemType && itemType !== segment && segment !== "MARCA" ? itemType : segment;
    const lensTextForSegment =
      segmentForLens === "MARCA" && isPersonalBrand
        ? MARCA_LENS_PESSOAL
        : SEGMENT_LENS[segmentForLens];
    return `LENTE DO SEGMENTO (${segmentForLens}): estes eixos indicam o TIPO de situação — o ÂNGULO, não o vocabulário — ${lensTextForSegment}. Evite usar essas palavras literalmente na frase; expresse o eixo escolhido com elementos concretos da atividade da empresa.
TESTE DE IDENTIFICAÇÃO DO CLIENTE: a frase final precisa ser algo que o CLIENTE (quem vê o post) diria, perguntaria, sentiria ou viveria. Se a frase descrever um atributo, processo ou metodologia do ponto de vista da empresa/fornecedor — e não uma situação, ganho ou rotina do cliente —, reescreva pelo que o cliente ganha ou pela situação que ele reconhece.
PROIBIDO (ou variações próximas): "indicada por"/"indicado por", "ajustado conforme", "alinhada com análise", "humanizado"/"humanizada", "pronta(s)/pronto(s) para", "em tempo real", "bem vedada(s)" — são marcas de fala de catálogo ou de metodologia interna do fornecedor, não algo que o cliente diria.`;
  })();

  const voiceProfile = getVoiceProfile(brandVoice);
  const voiceBlock = voiceProfile
    ? `VOZ DA MARCA — "${voiceProfile.label}": ritmo: ${voiceProfile.ritmo}. Vocabulário: ${voiceProfile.vocabulario}. Registro: ${voiceProfile.registro}. Evitar: ${voiceProfile.evitar}.\n`
    : `LINGUAGEM: frases curtas, ordem direta, palavras do dia a dia. Profissional e mercadológico, sem jargão corporativo, sem termos técnicos. Uma ideia por frase.\n`;

  const preservaHint = hint
    ? `REGRA CRÍTICA DA PISTA: preserve o SENTIDO da pista do usuário (positivo, neutro ou crítico). Refine a FORMA, NUNCA inverta a intenção. Se a pista é positiva (ex.: "20 anos fazendo parte da vida da cidade"), NÃO transforme em dor/estagnação/crítica. Se é neutra, mantenha neutra. Se já carrega tensão, pode aprofundar.`
    : "";

  // Na MOP, objetivo de peça (ex.: 'promocao') pertence à PU e não deve
  // remover a proteção contra invenções — vale independente do objetivo
  // enviado, e a checkInventedPromotion continua rodando para o MOP sem
  // allowPromoLanguage: dados específicos (%, R$, brinde, prazo/data,
  // condição de compra) seguem bloqueados pelo D1 se o modelo não
  // seguir a instrução. Pista promocional não é descartada — é
  // descrita sem a promessa comercial.
  const proibicoesInventarMop =
    mode === "metodo"
      ? ' A Informação-chave é apenas o ASSUNTO desta peça — não é uma peça de promoção: ela NÃO promete oferta, desconto ou condição diretamente. SE a pista do usuário trouxer promoção/oferta com dados específicos (percentual, valor, brinde, prazo, data, "até X", "hoje", condição de compra), NÃO repita esses dados nem mantenha a promessa direta — extraia o ASSUNTO por trás da promoção (o produto/serviço/categoria em destaque) e descreva-o de forma objetiva, sem a promessa comercial. Exemplo: pista "30% off até domingo" → "como escolher peças certas para o carro". O assunto da pista NÃO deve ser descartado — apenas descrito sem a promessa.'
      : "";
  const proibicoesInventar =
    mode === "metodo" || (objetivo !== "promocao" && objetivo !== "oportunidade")
      ? `PROIBIDO inventar promoção, desconto, percentual, prazo, data, urgência ou oferta que o usuário não tenha fornecido — isso inclui termos como "promoção", "desconto", "off", "grátis", "oferta especial", "lançamento", "agenda aberta", "hoje", "até domingo" (ou qualquer outro dia/data/prazo) e chamadas de urgência ("não perca", "última chance", "por tempo limitado"). Esses termos só podem aparecer se já estiverem na pista do usuário ou na atividade da empresa informada acima.${proibicoesInventarMop} PROIBIDO também inventar: eventos • garantias • condições especiais • números • promessas absolutas que o usuário não forneceu.`
      : "";

  // allowedContext: termos de promoção/desconto/prazo/urgência só passam
  // pela checkInventedPromotion (D1) se já estiverem aqui — pista do
  // usuário ou atividade/empresa.
  const allowedContext = [hint, mainActivity, companyName].filter(Boolean).join(" ");
  // PU com objetivo 'promocao'/'oportunidade': o próprio objetivo da peça
  // pede tom promocional — a linguagem genérica ("promoção", "oferta",
  // "desconto" solto) é liberada, mas dados ESPECÍFICOS inventados
  // (%, R$, brinde, prazo/data, condição de compra) continuam bloqueados
  // pela checkInventedPromotion, que agora roda SEMPRE.
  const allowPromoLanguagePU =
    mode === "postunico" && (objetivo === "promocao" || objetivo === "oportunidade");

  // Verbo de benefício (auditoria A/B 06/07/2026, estendido ao MOP em
  // 07/2026): mérito salvado do teste da hipótese "Produto+Conector+Recorte
  // / Produto+Benefício Percebido" (ver memória do projeto) — os dois
  // juízes (Opus e Fable) notaram, de forma independente, que a Variante A
  // às vezes usa verbo de PROMESSA INFLADA ("transforma suas reuniões")
  // onde um verbo de benefício verificável ("facilita reuniões produtivas")
  // seria mais crível para o pequeno empresário. Nasceu isolado só na PU
  // (a fórmula rígida da hipótese foi rejeitada, então o ajuste de verbo
  // não mexeu no MOP na época); estendido ao MOP no teste da Variante C
  // (07/2026, mesmos dois juízes) depois que a Variante C mostrou o mesmo
  // deslize em um cenário MOP ("valoriza reuniões produtivas").
  const verboBeneficioBlock = `VERBO DE BENEFÍCIO: quando a frase usar um verbo de ação sobre o produto/serviço, prefira um verbo que descreva um BENEFÍCIO VERIFICÁVEL e concreto (ex.: "organiza", "protege", "facilita", "controla", "economiza", "renova", "resolve") em vez de um verbo de PROMESSA INFLADA que soa exagerado e vazio (ex.: "transforma", "revoluciona", "muda sua vida", "valoriza"). TESTE: o verbo descreve algo que o produto/serviço realmente FAZ, ou é um exagero de propaganda que qualquer produto poderia prometer? Se for exagero, troque por um verbo mais concreto e crível.\n`;

  const criteriosQualidadeSugestao = `CRITÉRIOS DE QUALIDADE:
${
  mode === "metodo"
    ? "Construa 1 frase direta, objetiva e concreta: assunto + situação real e específica da atividade — sem tensão emocional, sem promessa e sem linguagem de campanha."
    : "Construa 1 frase direta, objetiva e concreta: assunto + situação real e específica da atividade."
} Entre 4 e 7 palavras (máximo absoluto 7).
FRASE INTEIRA (esta regra vem ANTES do limite de palavras): a frase precisa estar gramaticalmente COMPLETA — todo verbo com seu complemento, toda preposição no lugar, nada faltando no fim. Se a ideia não couber em 7 palavras, ESCOLHA UMA IDEIA MENOR que caiba inteira; NUNCA corte palavras da ideia grande para fazê-la caber. Cortar produz frase quebrada: "Planejamento de comunicação em época promocional evita" (evita o quê?), "Consultas veterinárias para apatia ou falta" (falta de quê?), "Poltrona de trabalho ajuda reunião correr melhor" (falta "a"). Prefira sempre a frase curta e inteira à frase longa e amputada — antes de responder, releia sua frase e pergunte: ela termina? falta alguma palavra para ela fazer sentido sozinha?
SINTAXE — NÚCLEO DA FRASE: o núcleo (sujeito da frase ou centro da locução) segue esta ordem de prioridade: (1) o ELEMENTO CONCRETO desta sugestão (produto/serviço ou variação direta dele), quando houver; (2) categoria, procedimento, ferramenta, equipamento, recurso ou solução real da atividade; (3) a própria ATIVIDADE da empresa, quando não houver elemento concreto. A frase pode ser uma locução sem verbo (ex.: "[item] para [situação/uso]") ou uma frase com sujeito e predicado — ambas válidas, desde que o núcleo siga essa ordem. NÃO use como núcleo principal: termos abstratos ("confiança", "qualidade", "segurança", "clareza", "crescimento", "inovação", "autoridade", "relacionamento", "resultado", "presença", "organização"), verbos no infinitivo nominalizados ("crescer", "confiar", "melhorar", "transformar", "organizar") ou locuções genéricas ("o cuidado", "o diferencial", "a escolha certa") — esses termos só valem como consequência, predicado ou qualificador, nunca como núcleo.
COMPLEMENTO ÚNICO: depois do núcleo, a frase carrega só UM traço — um resultado, uma situação ou uma característica. PROIBIDO empilhar mais de um traço (núcleo + traço + outro traço/qualificação/cenário) e PROIBIDO mais de uma oração subordinada ("que"); havendo uma relativa, ela é a única adição depois do núcleo e fecha a frase ali — sem encadear mais nada. Isso vale também DENTRO do traço único: um adjetivo ou particípio colado ao substantivo do complemento (ex.: "negociações digitais", "contatos ativos") conta como um SEGUNDO traço enfeitando o primeiro, não como parte do mesmo traço — só mantenha esse adjetivo se ele for a própria característica que define o resultado (sem ele a frase perde informação real).
FECHO DA FRASE: as últimas 2-3 palavras precisam nomear um resultado, necessidade ou benefício CONCRETO e reconhecível pelo cliente final — algo específico que ele ganha, resolve ou evita com este item. PROIBIDO fechar com generalidade de bula/institucional: "sempre", "de qualidade", "com segurança", "do jeito certo", "na medida certa", "evita problemas comuns", "recaídas comuns", ou qualquer qualificador vazio que serviria igual para outro produto/serviço. PROIBIDO TAMBÉM fechar com um qualificador redundante ou de recheio — que repete uma ideia já implícita ("susto inesperado": susto já é inesperado) ou que só finge especificidade sem mudar o resultado ("digital", "ativo", "híbrido", "longo/a", "especial", "feito" coladas a um substantivo que já fazia sentido sozinho). Essa mesma regra vale se o adjetivo vazio aparecer no MEIO da frase, colado ao núcleo ou a outro substantivo, não só no fecho (ex.: "Óleos lubrificantes diferentes" é tão vazio quanto terminar a frase em "diferentes" — diferentes de quê?). TESTE: lendo só o fecho (as últimas palavras), ele descreve um efeito específico deste item, ou colaria em qualquer produto/serviço do mercado? E, tirando a última palavra, a frase perde algum sentido real, ou fica exatamente igual (só mais curta)? Se colar em qualquer coisa, OU se a frase ficar igual sem a última palavra, reescreva o fecho com o efeito concreto deste item, sem o enfeite. COERÊNCIA DO COMPLEMENTO: quando o item não tiver um resultado ou benefício concreto e prontamente verificável nesse contexto, NÃO force uma abstração nem invente um benefício pouco plausível só para cumprir esta regra — prefira um traço mais simples e genuíno do próprio item (um uso comum, uma característica real, um momento verdadeiro em que ele aparece na vida do cliente), desde que específico deste item. Um fecho modesto e verdadeiro vale mais que um benefício colado que não combina com o item.
VEROSSIMILHANÇA: a frase precisa ser algo que poderia acontecer de verdade com este produto, serviço ou atividade — sem função, causa-efeito, condição, benefício técnico ou comportamento não informado e implausível para o segmento ${segment}. Teste: "isso poderia acontecer de verdade com esse produto/serviço/atividade?" — se não, reescreva. O efeito citado precisa estar na escala do que o item FAZ diretamente (ex.: "ERP organiza pedidos"), não um resultado comercial dois passos depois que o item não controla sozinho (ex.: NÃO "ERP para vendas sem atraso" — um sistema não garante venda).
TESTE DO CONTEXTO REAL DE USO (já identificado acima): a situação descrita combina com o contexto já estabelecido dentro de "${mainActivity}" — não é um cenário genérico que serviria igual para o mesmo item ou atividade em outro contexto (uso doméstico, social, outro ramo, outro tipo de cliente).${isB2C ? ` EXCEÇÃO: para público B2C, a cena do CLIENTE FINAL usando o item na própria vida pessoal não conta como "uso doméstico" nem "outro tipo de cliente" proibidos acima — é o uso real de quem compra neste negócio, mesmo que "${mainActivity}" esteja descrito em termos técnicos/profissionais.` : ""} Teste: "essa situação só faz sentido porque está em '${mainActivity}', ou serviria igual em qualquer outro lugar?" — se servir igual em qualquer lugar, reescreva ancorando no contexto real desse ramo.
NATURALIDADE: a frase deve parecer uma pauta de conteúdo real, do jeito que alguém do ramo falaria — não um slogan, conceito institucional ou frase tecnicamente correta porém artificial. Locuções sem verbo são bem-vindas quando soarem mais naturais que uma frase completa. Se a frase parecer academicamente correta mas estranha ao jeito comum de falar do segmento ${segment}, reescreva de forma mais direta e reconhecível.
${mode === "postunico" ? 'Se a categoria for "Novidade ou Oportunidade", use tendências e comportamentos emergentes — não invente datas ou promoções inexistentes.\n' : ""}${proibicoesInventar}
LINGUAGEM: uma ideia principal, ordem direta, palavras curtas e do dia a dia — priorize termos de até 3 sílabas sempre que houver opção mais simples (ex.: "jeito" em vez de "organização", "bom"/"rápido" em vez de "eficiente", "passos" em vez de "procedimentos", "clientes" em vez de "compradores", "perdem"/"deixam passar" em vez de "ignoram"). Uma pessoa com ensino médio deve entender de primeira, sem reler. PROIBIDO: "decisores", "receita previsível", "riscos operacionais", "maximizar resultados", "estruturar processos", "estratégias digitais eficazes", "impacto real", "organização", "eficiente", "procedimentos", "compradores", termos técnicos de consultoria e qualquer palavra formal/comprida quando existir alternativa popular mais curta. Prefira: "vendas" a "receita", "empresas" a "decisores", "melhorar" a "otimizar", "clientes" a "compradores", "jeito" a "organização", "bom" a "eficiente". Se precisar trocar uma palavra grande por palavras mais curtas e isso aproximar a frase do limite de 7, prefira isso a manter um termo difícil — mas nunca ultrapasse 7 palavras. EXCEÇÃO: se houver um elemento concreto central (produto, peça, serviço, objeto, procedimento) vindo do texto do usuário ou da atividade, esse termo pode ter mais de 3 sílabas (ex.: "equipamento", "manutenção", "lubrificante", "orçamento", "diagnóstico", "estratégia") — não o troque por palavra genérica só para simplificar.`;

  // ── Público-alvo — regra crítica para B2C vs B2B ──────────────────
  const audienceDirective = isB2C
    ? `PÚBLICO-ALVO: CONSUMIDOR FINAL (B2C).
A Informação-chave deve falar com a PESSOA, não com o empresário.
PROIBIDO no texto gerado: "empreendedor", "empresário", "empresária", "gestor", "gestora", "decisor", "liderança", "equipe", "time", "empresa cliente", "negócio" como sujeito.
Escreva como se estivesse falando com alguém que usa o produto/serviço na própria vida.`
    : `PÚBLICO-ALVO: EMPRESARIAL (B2B).
A Informação-chave deve falar com o dono, sócio, gestor ou responsável pelo negócio.
Foque em situações reais de trabalho: atendimento, resultado, organização, vendas, prazo, confiança ou crescimento.
Evite linguagem de grande consultoria e termos frios como "decisores", "receita previsível", "riscos operacionais".
NÚCLEO DA FRASE (B2B): siga a hierarquia de SINTAXE — NÚCLEO DA FRASE abaixo — produto/serviço/categoria/atividade no núcleo, nunca um papel pessoal ("gestores", "equipes", "donos") nem um conceito abstrato de gestão. Exemplos de FORMATO de referência (não copie o vocabulário, mostram apenas a estrutura): "mesa de reunião para equipes maiores", "módulo financeiro para contas a pagar", "correia industrial para manutenção preventiva". NUNCA use "clientes", "consumidores" ou "compradores" como núcleo principal — esses termos fazem a frase soar como crítica ao cliente da empresa, não como espelho da realidade do receptor.`;

  // Conector já usado no lote — achado real de produção (07/2026, prints em
  // AJUSTE_CONFLITO/): mesmo sem bug nenhum, as 3 sugestões do mesmo lote são
  // geradas por chamadas INDEPENDENTES, então "para" (o conector mais fácil/
  // natural) dominava 2-3 de 3 sugestões seguidas. Detecta o conector de cada
  // sugestão anterior por regex (lista fechada e pequena, sem NLP) e avisa —
  // não bane (só repita "para" se nenhuma alternativa soar natural), pra não
  // recriar o molde forçado da fórmula PRODUTO+CONECTOR+RECORTE já rejeitada.
  // REDIRECIONADO em 13/08/2026: o aviso mandava trocar de CONECTOR, o que
  // empurrava justamente para os cinco que a medição de 12/07 reprova (ver
  // hierarquia no comentário de contextoFormaBlock) — pedir variedade aqui e
  // qualidade lá era o prompt mandando e proibindo a mesma coisa. Agora a
  // variação é cobrada na CONSTRUÇÃO (locução sem verbo × frase com sujeito e
  // predicado × verbo de ação) e no VERBO, não no conector: repetir "com"/
  // "para" no lote passa a ser aceitável, encaixar "à"/"na" à força não.
  // A detecção por regex continua servindo para nomear o que já saiu.
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
  const detectConector = (sugestao: string): string | null => {
    const s = sugestao.toLowerCase();
    return CONECTOR_PATTERNS.find(({ re }) => re.test(s))?.nome ?? null;
  };
  const conectoresUsados = Array.from(
    new Set(previousSugs.map(detectConector).filter((c): c is string => !!c)),
  );
  const conectorWarning = conectoresUsados.length
    ? ` CONSTRUÇÃO/VERBO JÁ USADO NESTE LOTE: as sugestões acima já usaram o conector ${conectoresUsados.map((c) => `"${c}"`).join(", ")}. Repetir "com" ou "para" aqui é ACEITÁVEL — eles são os conectores que sustentam a frase, e trocar por um conector forçado só para não repetir piora a sugestão. O que NÃO pode repetir é a CONSTRUÇÃO: se as anteriores são locuções sem verbo ("[item] para [situação]"), esta deve ser uma frase com sujeito e predicado, ou trazer um verbo de ação direto — e vice-versa. O VERBO DE AÇÃO principal desta frase (se houver) também precisa ser diferente do das sugestões acima (ex.: não use "agiliza"/"agilizam" de novo se já apareceu).`
    : "";

  const previousBlock = previousSugs.length
    ? `SUGESTÕES ANTERIORES NESTA SESSÃO (NÃO repita estes assuntos — gere algo completamente diferente, sobre outro produto, serviço ou situação):\n${previousSugs.map((s) => `- "${s}"`).join("\n")}\n⚠ ABERTURA TAMBÉM PRECISA SER DIFERENTE: mesmo se o produto/serviço de origem desta sugestão tiver nome parecido com algum item acima (ex.: dois serviços cadastrados começando com as mesmas palavras), a FRASE FINAL não pode começar com as mesmas palavras de nenhuma sugestão acima — não preserve o nome literal do item como abertura fixa; extraia o conceito e construa uma frase nova, com estrutura e primeiras palavras visivelmente diferentes.${conectorWarning}`
    : "";

  const tom = OBJETIVO_TOM[objetivo as keyof typeof OBJETIVO_TOM] ?? OBJETIVO_TOM.promocao;

  // ── Lente de abertura (Sugestão MOP e PU) ─────────────────────────
  // Varia a FORMA de encontrar o assunto entre as tentativas — nunca
  // aparece no JSON de saída nem na UI, e não carrega tensão,
  // promessa, progressão ou linguagem de campanha.
  // O ponto de partida é o `sessionSeed` fixado pelo CLIENTE no início
  // da sessão (não mais um seed determinístico de companyName, que
  // fazia toda sessão nova da mesma empresa começar sempre na mesma
  // lente). `attempt` é somado sobre essa base FIXA dentro da sessão —
  // por isso as tentativas 0/1/2 caem em lentes consecutivas e
  // distintas (sem repetir até esgotar o conjunto); usar Math.random()
  // aqui de novo quebraria essa garantia, porque o servidor reavalia a
  // cada request HTTP independente, perdendo a relação entre tentativas.
  // Lentes seguras pro formato positivo "[item] para [resultado]"
  // (uma das construções preferenciais no MOP, não mais exclusiva —
  // ver elementoConcretoBlock acima) — comparação/dúvida/erro/sinal/
  // detalhe tendem a produzir
  // condicional, defeito ou pergunta, o que colide com a proibição
  // de crítica ao cliente do metodoPrompt ("PROIBIDO... crítica ou
  // cobrança ao cliente", mais abaixo). Ficam disponíveis só no PU,
  // onde esse formato é legítimo (ver ESTILO DA SUGESTÃO (POST
  // ÚNICO) mais abaixo).
  const itemType = concreteItem ? classifyItemType(concreteItem) : null;
  const lensPool =
    mode === "metodo"
      ? OPENING_LENSES.filter((l) => MOP_SAFE_LENS_NAMES.has(l.nome))
      : itemType === "SERVIÇOS"
        ? OPENING_LENSES.filter((l) => !SERVICE_RISKY_LENS_NAMES.has(l.nome))
        : OPENING_LENSES;
  const lensIndex = (attempt + sessionSeed) % lensPool.length;
  const lens = lensPool[lensIndex];
  // Reconciliação da lente "Oportunidade" com o FECHO DA FRASE (e com
  // o "PROIBIDO ... datas ou prazos não informados" do metodoPrompt,
  // mais abaixo): a lente pede citar uma ocasião ESPECÍFICA do
  // calendário/rotina, mas não dizia ONDE ela entra na frase — e o
  // modelo tendia a fechar a frase nela ("Uso do Método OP no
  // carnaval"), violando o critério FECHO DA FRASE. A cláusula
  // condicional abaixo (mesmo padrão da cláusula de segment !==
  // "MARCA") fixa a posição: a ocasião é CONTEXTO no MEIO da frase, o
  // fecho continua sendo o resultado/benefício concreto do elemento.
  // Ela também desfaz a aparente contradição com a proibição de datas/
  // prazos não informados: a ocasião permitida pela lente é um momento
  // reconhecível (estação, época, situação da rotina), nunca uma data
  // ou prazo específico inventado.
  const lensGuardrail = ` Esta lente define apenas o ÂNGULO da frase dentro do CONTEXTO REAL DE USO já identificado — não cria uma situação nova, não substitui o núcleo definido em SINTAXE — NÚCLEO DA FRASE, e não deve transformar conceito abstrato em núcleo principal. A lente é um mecanismo interno: a frase final não deve deixar reconhecível qual lente foi usada — só devem aparecer produto/serviço, contexto real de uso e situação plausível em linguagem natural.${segment !== "MARCA" ? ` PROIBIDO usar tom de vínculo/comunidade com o público — "nosso(s)", "nossa(s)", "juntos", "nossa comunidade", "cuidar juntos", "fazemos parte da sua vida" — esse registro pertence ao segmento MARCA; em ${segment}, descreva produto/serviço e situação na 3ª pessoa, sem incluir o público como coautor ou parceiro emocional.` : ""}${lens.nome === "Oportunidade" ? ` POSIÇÃO DA OCASIÃO (regra desta lente): a ocasião/momento de calendário ou rotina escolhido entra como CONTEXTO no MEIO da frase — NUNCA como as últimas palavras. O FECHO da frase (ver FECHO DA FRASE nos critérios de qualidade) continua sendo o resultado, necessidade ou benefício concreto que o elemento entrega: a ocasião situa, o fecho resolve. A ocasião é um momento reconhecível (estação, época, situação da rotina do cliente), não uma data ou prazo específico não informado.` : ""}`;
  const lensBlock = `LENTE INTERNA DE GERAÇÃO (uso interno apenas — NÃO cite o nome da lente nem deixe rastro dela na frase final): ${lens.guia}${lensGuardrail}`;
  // Na PU, a lente serve só para variar o ASSUNTO do post único — não
  // altera o formato definido em ESTILO DA SUGESTÃO (POST ÚNICO) e não
  // introduz tensão, motivação ou progressão de sequência.
  const lensBlockPU = `${lensBlock} Use esta lente apenas para variar o ASSUNTO do post único — mantenha o formato definido em ESTILO DA SUGESTÃO e não introduza tensão, motivação ou progressão de sequência.`;

  const sementeLembrete = segment === "MARCA" ? sementeLembreteMarca : sementeLembreteAtividade;

  // ── Prompt do Método (Sugestão = seleção de assunto) ──────────────
  // A Sugestão MOP é só a escolha do ASSUNTO desta peça — tensão,
  // motivação, momento do negócio, progressão e estágios pertencem à
  // etapa do Método OP que vem DEPOIS, com a Informação-chave já
  // escolhida pelo usuário.
  const metodoPrompt = `Defina o ASSUNTO de uma Informação-chave para um conjunto de posts de Instagram em português brasileiro.

EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
${voiceBlock}${
    hint
      ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO com base na ATIVIDADE da empresa e nas regras de ancoragem abaixo): "${hint}"\n${preservaHint}`
      : "Campo vazio — crie a partir da ATIVIDADE da empresa, do elemento concreto e da lente interna abaixo."
  }

${audienceDirective}

${elementoConcretoBlock}
${relacaoRealBlock}
${ancoragemBlock}

${previousBlock}

${lensBlock}

${criteriosQualidadeSugestao}

A Informação-chave é APENAS o ASSUNTO escolhido para esta peça — um produto, serviço, situação, dúvida, processo, escolha, comparação ou característica real e concreta dessa atividade. Ela NÃO precisa (e NÃO deve) carregar tensão, conflito, promessa emocional, urgência, comparação com concorrentes, nem qualquer ideia de progressão, estágio ou momento de relacionamento com o público — isso é decidido em outra etapa, depois que o assunto for escolhido.

PROIBIDO: linguagem de campanha ("não perca", "aproveite agora", "garanta já"), promessa emocional ("transforme", "mude sua vida", "realize seu sonho"), crítica ou cobrança ao cliente ("não sabem", "estão perdendo"), urgência, datas ou prazos não informados.
${sementeLembrete}
${verboBeneficioBlock}
Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 4 e 7 palavras (máximo absoluto 7), sem hashtag, sem emoji, sem aspas, concreta, objetiva e específica, ligada à atividade" }`;

  const OBJETIVO_RULES: Record<string, string> = {
    promocao:
      'REGRAS PARA PROMOÇÃO: use tom comercial/promocional — esse é o tom esperado para o objetivo (palavras como "promoção", "oferta", "aproveite", "garanta o seu" são bem-vindas). PROIBIDO inventar percentual de desconto, valor em reais, brinde/cortesia, prazo, data/dia da semana, "última chance" ou condição de compra (acima de/a partir de/sem juros/parcelamento) que o usuário não tenha informado. Esses dados só podem aparecer se já estiverem na pista do usuário ou na atividade/empresa. Se nada disso foi informado, descreva a oportunidade comercial de forma genérica — sem números, datas ou condições inventadas.',
    oportunidade:
      "REGRAS PARA OPORTUNIDADE: represente a oportunidade por escassez, momento único ou contexto sazonal — sem especificar quando. PROIBIDO citar datas, prazos, dias ou períodos específicos, e PROIBIDO inventar percentual de desconto, valor em reais, brinde/cortesia ou condição de compra (acima de/a partir de/sem juros/parcelamento) que o usuário não tenha informado. Esses dados só podem aparecer se já estiverem na pista do usuário ou na atividade/empresa.",
    homenagem: `REGRAS PARA HOMENAGEM: datas comemorativas de referência (use APENAS se forem FUTURAS à DATA DE HOJE):
- Dia das Mães: 2º domingo de maio
- Dia dos Pais: 2º domingo de agosto
- Dia do Cliente: 15 de setembro
- Dia do Marketing: 27 de setembro
- Dia das Crianças: 12 de outubro
- Natal: 25 de dezembro
Para qualquer outra data comemorativa, use apenas se tiver certeza absoluta da data e ela for futura. Em caso de dúvida, homenageie uma pessoa, conquista ou marco da própria empresa.`,
    aviso:
      'REGRAS PARA AVISO: o comunicado deve ser concreto e acionável — mudança de horário, nova política, prazo de cadastro, atualização de serviço. Evite avisos vagos como "novidades em breve".',
    institucional:
      "REGRAS PARA INSTITUCIONAL: foque em um valor, propósito ou diferencial específico da empresa — não genérico. Prefira fatos concretos (anos de mercado, número de clientes, certificação, metodologia própria) a afirmações abstratas.",
  };

  const dateLine = objetivo === "homenagem" ? `DATA DE HOJE: ${today}\n` : "";

  // audienceDirective (definido acima, antes de contextoFormaBlock) era
  // interpolado só no metodoPrompt — a PU nunca recebia a lista PROIBIDO de
  // vocabulário B2C nem a regra de núcleo B2B (achado 14/07/2026, auditoria
  // Fable+Opus da regressão VAREJO/B2C: todos os exemplos reportados eram de
  // PU). Mesmo bloco do metodoPrompt, sem reescrita.
  const postUnicoPrompt = `Sugira UMA Informação-chave para um post único de Instagram em português brasileiro.

${dateLine}EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
${voiceBlock}${segmentLensBlock}
OBJETIVO: ${objetivo} (tom: ${tom})
${hint ? `PISTA DO USUÁRIO (refine/melhore a partir disso): "${hint}"` : "O usuário não deu pista — invente algo plausível e útil para a atividade."}

${audienceDirective}
${elementoConcretoBlock ? `\n${elementoConcretoBlock}\n` : ""}${relacaoRealBlock}${ancoragemBlock ? `\n${ancoragemBlock}\n` : ""}${previousBlock ? `\n${previousBlock}\n` : ""}
A Informação-chave é o FATO central que a peça vai comunicar (uma promoção concreta, um aviso, uma homenagem, uma oportunidade). Deve ser específica com nome ou fato real quando fizer sentido. NÃO é a legenda nem o título — é a matéria-prima do post.

ESTILO DA SUGESTÃO (POST ÚNICO): a peça é uma comunicação direta e autônoma — NÃO abre uma sequência. A sugestão pode ser uma afirmação, ou uma pergunta direta, comercial, situacional ou de reconhecimento (ex.: "Já trocou o pneu para o frio?", "Sábado tem horário especial?"), ou uma chamada — o que fizer mais sentido para o objetivo. EVITE formatos de dica educativa ou abertura de jornada (ex.: "como escolher...", "o que considerar antes de...", "passo a passo para..."): isso é formato de sequência do Método OP, não de post único.

${OBJETIVO_RULES[objetivo] || ""}

${lensBlockPU}

${criteriosQualidadeSugestao}

${verboBeneficioBlock}
Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 frase, entre 4 e 7 palavras (máximo absoluto 7), em português, sem hashtag, sem emoji, sem aspas, concreta e de fácil compreensão" }`;

  const userPrompt = mode === "metodo" ? metodoPrompt : postUnicoPrompt;
  const systemMsg =
    mode === "metodo"
      ? 'Você é estrategista de conteúdo para redes sociais. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO: repetir a mesma palavra ou derivação morfológica da mesma raiz no mesmo texto. PROIBIDO ABSOLUTO no texto final: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01" a "OP-06", "mood" — são termos reservados. Use sinônimos contextuais. Antes de retornar: (1) pessoa com ensino médio entende de primeira? (2) há termo técnico, palavra grande ou formal (ex.: "procedimentos", "organização", "eficiente", "compradores") que poderia virar uma palavra curta e popular? (3) a frase parte de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — e não de um conceito amplo que serviria para qualquer empresa do segmento? (4) a relação de causa→efeito da frase é literalmente verdadeira e um nativo a diria sem reler? Expressão idiomática só vale se o sentido literal também fizer sentido com o objeto citado — em dúvida, troque a expressão "vívida" por uma consequência simples e direta. Se sim para (2), troque por algo mais simples; se não para (3) e a atividade permitir, ajuste para algo concreto desse ramo antes de responder; se não para (4), reescreva a consequência de forma literal e direta antes de responder. Limite: entre 4 e 7 palavras por sugestão (máximo absoluto 7) — nunca ultrapasse 7. Frases com mais de 7 palavras devem ser cortadas antes de retornar.'
      : "Você é estrategista de conteúdo brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO repetir a mesma palavra ou qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue) no mesmo texto — use sinônimos ou reformule. Antes de retornar, prefira que a frase parta de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — em vez de um conceito amplo que serviria para qualquer empresa do segmento. Limite: entre 4 e 7 palavras por sugestão (máximo absoluto 7) — nunca ultrapasse 7. Frases com mais de 7 palavras devem ser cortadas antes de retornar.";

  // D1 (validateSugestao) + até 2 retries: se a sugestão sair vaga
  // (muito curta/longa, terminação pendurada, frase-clichê ou fecho
  // fraco — ver checkWeakEnding e o juiz estrutural abaixo), pede uma
  // nova versão reforçando o motivo. Nunca retorna erro ao usuário por
  // causa disso — devolve a melhor tentativa, sempre truncada a
  // SUGESTAO_MAX_WORDS (7 palavras, MOP e PU).
  // Subido de 2 para 3 tentativas (auditoria 2026-07-05, buraco 3a):
  // com só 2, casos de jargão/truncamento residual esgotavam antes de
  // corrigir — 1 tentativa extra reduz isso sem custo desproporcional
  // (a maioria das sugestões já acerta na 1ª tentativa; o custo extra
  // só incide no subconjunto que precisava de retry mesmo).
  const MAX_SUGGEST_ATTEMPTS = 3;
  const SUGESTAO_MAX_WORDS = 7;
  let sugestao = "";
  let motivos: string[] = [];
  // Melhor tentativa vista até agora (menos motivos de reprovação) — achado
  // 13/07/2026 (investigação Opus+Fable, project-juiz-llm-veto-descartado):
  // sem isso, a ÚLTIMA tentativa era devolvida mesmo reprovada, mesmo quando
  // uma tentativa anterior tinha menos problemas (o veto do juiz virava
  // decorativo na 3ª/última passada). Null até a 1ª passada preencher.
  let bestSugestao = "";
  let bestMotivos: string[] | null = null;
  // Cada chamada real ao juiz LLM vira 1 entrada aqui — devolvido ao chamador
  // (rota suggest-keyinfo.ts) pra persistir em log e medir taxa real de
  // aprovação/reprovação/fail-open em produção (motor continua puro, sem
  // I/O de banco — ver comentário de generateSugestao sobre testabilidade).
  const judgeVerdicts: Array<JudgeVerdict & { pass: number }> = [];

  // Reaplica as checagens determinísticas (sem chamar API) sobre um
  // texto candidato — usado tanto dentro do loop quanto no fallback
  // E2 (pruneWeakEnding) abaixo, pra confirmar que a poda de fato
  // resolveu o problema antes de substituir a sugestão.
  const runDeterministicChecks = (text: string): string[] => {
    let m = validateSugestao(text, SUGESTAO_MAX_WORDS);
    m = m.concat(
      checkInventedPromotion(text, allowedContext, {
        allowPromoLanguage: allowPromoLanguagePU,
      }),
    );
    if (mode === "postunico") m = m.concat(checkSupplierLanguage(text));
    m = m.concat(checkRepeatedOpening(text, previousSugs));
    m = m.concat(checkLensNameLeak(text, lens.nome));
    m = m.concat(checkWeakEnding(text, concreteItem));
    m = m.concat(checkAmputatedPredicate(text));
    m = m.concat(checkVagueAdjectiveMidSentence(text));
    m = m.concat(checkItemNameDrift(text, concreteItem));
    m = m.concat(checkInformalRegister(text));
    // Backstop determinístico do vocabulário PROIBIDO de audienceDirective
    // pra B2C (achado 14/07/2026, auditoria Fable+Opus): só roda em B2C —
    // em B2B esses termos (gestor, equipe...) são vocabulário legítimo.
    if (isB2C) m = m.concat(checkB2CAudienceVocabulary(text));
    return m;
  };

  for (let pass = 1; pass <= MAX_SUGGEST_ATTEMPTS; pass++) {
    const reinforcement =
      pass > 1 && motivos.length > 0
        ? `\n\nATENÇÃO: a tentativa anterior teve este problema: ${motivos.join("; ")}. Gere uma NOVA versão que corrija isso, mantendo o mesmo assunto e a mesma intenção.`
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

    if (!result.ok) {
      throw Object.assign(new Error(result.error), { status: result.status });
    }
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
    // truncateWords só remove conjunção/preposição do final — corta
    // no meio de substantivo/adjetivo sem avisar, e a frase cortada
    // passava pela validação como se estivesse completa (o corte
    // acontecia ANTES da checagem de tamanho). Sinaliza aqui, pelo
    // texto BRUTO (antes do corte), pra virar motivo de retry real
    // em vez de devolver a frase capenga sem o modelo saber.
    if (rawWordCount > SUGESTAO_MAX_WORDS) {
      motivos.push(
        `frase original tinha ${rawWordCount} palavras e foi cortada no meio — reescreva já dentro do limite de ${SUGESTAO_MAX_WORDS} palavras, sem depender de corte`,
      );
    }
    // Juiz estrutural único — backstop que generaliza onde regex não
    // alcança (fecho, núcleo, jargão, especificidade, economia). Só roda quando
    // TODAS as checagens determinísticas acima passaram (motivos
    // vazio). Fail-open só em falha TÉCNICA; dúvida real sobre o
    // conteúdo reprova (ver comentário na função). Se reprovar, vira
    // mais um motivo e o retry existente deste loop cuida do resto —
    // sem loop separado (na tentativa 2, se as determinísticas
    // passarem de novo, o juiz roda de novo).
    if (motivos.length === 0) {
      const veredito = await judgeSugestaoEstrutural(
        apiKey,
        sugestao,
        concreteItem,
        mainActivity,
        segment,
        audience,
      );
      judgeVerdicts.push({ ...veredito, pass });
      if (!veredito.ok) {
        motivos.push(
          `juiz estrutural: ${veredito.motivo ?? "frase reprovada — reescreva com mais concretude e sem jargão"}`,
        );
      }
    }

    if (bestMotivos === null || motivos.length < bestMotivos.length) {
      bestSugestao = sugestao;
      bestMotivos = motivos;
    }
    if (motivos.length === 0) break;
  }

  // Garante que a MELHOR tentativa (menos motivos de reprovação) prevalece,
  // não necessariamente a última — corrige o descarte do veto na 3ª/última
  // passada (ver comentário acima em bestSugestao/bestMotivos).
  sugestao = bestSugestao;
  motivos = bestMotivos ?? [];

  // E2 — poda determinística (sem custo de API), PRINCÍPIO DO FECHO DA
  // FRASE (doc mestre, 1.6): se as tentativas acima esgotaram e a
  // sugestão AINDA reprova, tenta cortar o fecho fraco (ocasião solta
  // ou qualificador vago — ver pruneWeakEnding) em vez de entregar a
  // frase que o próprio sistema sabe estar quebrada. Só troca se a
  // poda de fato reduzir o número de problemas (nunca piora); se não
  // houver poda segura (ex.: fecho no nome do próprio item, ou
  // problema de outra natureza como promoção inventada), mantém a
  // melhor tentativa como já fazia antes.
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

  return { sugestao, judgeVerdicts };
}
