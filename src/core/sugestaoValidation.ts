import { normalizeForCompare } from "./morphValidation";
import { DANGLING_END_WORDS } from "./textWordUtils";

// ─────────────────────────────────────────────────────────────────────────
// Sugestão — bloqueio de promoção/urgência/data inventada
// ─────────────────────────────────────────────────────────────────────────

// Os grupos se dividem em duas categorias. GENÉRICOS: linguagem promocional
// sem dado específico ("promoção", "desconto" solto, "oferta") — bloqueada por
// padrão, mas liberada quando o objetivo da peça pede tom promocional (PU
// promoção/oportunidade, ver `allowPromoLanguage`). ESPECÍFICOS: dados
// comerciais concretos (%, R$, brinde, prazo/data, condição de compra) que
// NUNCA podem ser inventados em nenhum modo/objetivo — só passam se já
// constarem no `allowedContext`. Padrões aplicados sobre texto normalizado
// (minúsculo, sem acento).
const INVENTED_PROMO_GENERIC_GROUPS: { label: string; re: RegExp }[] = [
  { label: "promoção/promocional", re: /\bpromoc/ },
  { label: "desconto", re: /\bdesconto/ },
  { label: "oferta", re: /\boferta/ },
  { label: "lançamento", re: /\blancamento/ },
  { label: "liquidação/saldão", re: /\bliquidac|\bsaldao/ },
  { label: "agenda/vagas aberta(s)", re: /\b(agenda|vagas?)\s+abert/ },
];

const INVENTED_PROMO_SPECIFIC_GROUPS: { label: string; re: RegExp }[] = [
  { label: 'percentual (%) / "off"', re: /\d+\s*%|\boff\b/ },
  { label: "valor em reais (R$)", re: /r\$\s*[\d.,]+/ },
  { label: "brinde/grátis/cortesia", re: /\bbrinde|\bgratis|\bgratuit|\bcortesia/ },
  {
    label: "condição de compra (acima de, a partir de, sem juros...)",
    re: /\b(acima de|a partir de|na compra de|compre\s+e\s+ganhe|sem juros)\b/,
  },
  {
    label: "prazo/data/urgência (hoje, até X, esta semana, última chance...)",
    re: /\b(hoje|amanha|esta semana|essa semana|este fim de semana|por tempo limitado|ultimas? (vagas?|unidades?|chances?|dias?)|nao perca|so hoje|ate (domingo|segunda|terca|quarta|quinta|sexta|sabado))\b/,
  },
];

const INVENTED_PROMO_GROUPS: { label: string; re: RegExp }[] = [
  ...INVENTED_PROMO_GENERIC_GROUPS,
  ...INVENTED_PROMO_SPECIFIC_GROUPS,
];

// Reprova quando a sugestão (botão "Sugestão"/keyInfo) inventa promoção,
// desconto, percentual, prazo, data, urgência ou oferta que o usuário não
// forneceu. `allowedContext` reúne pista do usuário + assunto do botão Ideias
// + atividade/empresa — termos só são permitidos se já constarem ali.
// Com `opts.allowPromoLanguage` (PU promoção/oportunidade), a linguagem
// promocional genérica é liberada e só os dados ESPECÍFICOS são bloqueados.
export function checkInventedPromotion(
  sugestao: string,
  allowedContext: string,
  opts?: { allowPromoLanguage?: boolean },
): string[] {
  const motivos: string[] = [];
  const sugNorm = normalizeForCompare(sugestao);
  const ctxNorm = normalizeForCompare(allowedContext);

  const groups = opts?.allowPromoLanguage ? INVENTED_PROMO_SPECIFIC_GROUPS : INVENTED_PROMO_GROUPS;
  for (const { label, re } of groups) {
    if (re.test(sugNorm) && !re.test(ctxNorm)) {
      motivos.push(
        `sugestão inventa "${label}" sem isso constar na informação/contexto do usuário`,
      );
    }
  }

  return motivos;
}

// ─────────────────────────────────────────────────────────────────────────
// Sugestão (PU) — linguagem de fornecedor/catálogo (auditoria 2026-06-14):
// termos que descrevem a frase do ponto de vista da empresa/fornecedor
// (atributo de produto, metodologia, posicionamento) em vez de uma situação,
// dúvida ou ganho que o CLIENTE final diria, perguntaria, sentiria ou viveria.
// ─────────────────────────────────────────────────────────────────────────

const SUPPLIER_LANGUAGE_PATTERNS: RegExp[] = [
  /indicad[ao]\s+(pel|por)/i,
  /ajustad[ao]\s+conforme/i,
  /alinhad[ao]\s+com\s+an[áa]lise/i,
  /humanizad[ao]/i,
  /pront[ao]s?\s+para/i,
  /em\s+tempo\s+real/i,
  /bem\s+vedad[ao]s?/i,
];

export function checkSupplierLanguage(sugestao: string): string[] {
  const trimmed = sugestao.trim();
  for (const re of SUPPLIER_LANGUAGE_PATTERNS) {
    const m = trimmed.match(re);
    if (m)
      return [
        `sugestão usa fala de fornecedor/catálogo ("${m[0]}") em vez de algo que o cliente diria, perguntaria, sentiria ou viveria`,
      ];
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// Sugestão (PU/MOP) — registro informal de 2ª pessoa (achado 13/07/2026,
// ver project-juiz-llm-gap-gramatica-alucinacao-2026-07-13): "tu/te/ti/teu/
// tua/contigo" são uso regional/informal, fora da norma culta que o projeto
// exige em todo texto gerado (feedback-normas-portugues). Caso real que
// motivou a checagem: FERRIMAQ "mudando teu expediente agora" — passou pelo
// juiz estrutural porque ele avalia estrutura da frase (fecho/núcleo/jargão/
// especificidade/economia/contexto), não registro nem gramática. Checagem
// determinística, sem exceção de contexto: o projeto sempre usa "você" na
// 2ª pessoa, não existe caso legítimo de "tu/teu" em copy comercial B2B/B2C.
// ─────────────────────────────────────────────────────────────────────────

const INFORMAL_SECOND_PERSON_RE = /\b(tu|te|ti|teu|tua|teus|tuas|contigo)\b/;

export function checkInformalRegister(sugestao: string): string[] {
  const norm = normalizeForCompare(sugestao);
  const m = norm.match(INFORMAL_SECOND_PERSON_RE);
  if (m) {
    return [
      `sugestão usa pronome de 2ª pessoa informal/regional ("${m[0]}"), fora da norma culta — reescreva usando "você"/"seu"/"sua" ou reformule sem pronome de 2ª pessoa`,
    ];
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// Sugestão (PU/MOP) — abertura repetida entre cliques da MESMA sessão
// (auditoria 2026-06-22): mesmo quando o "elemento concreto" sorteado é
// outro item da lista, se 2+ produtos/serviços cadastrados pelo usuário
// compartilham um prefixo de nome longo (ex.: "Consultoria presencial e
// online — ..."), a IA tende a preservar esse prefixo literal como núcleo
// da frase (ver elementoConcretoBlock em suggest-keyinfo.ts) — gerando
// sugestões que soam repetidas na abertura mesmo sendo "assuntos diferentes"
// pro restante das regras (que só comparam o assunto, não a estrutura
// inicial da frase). Compara as N primeiras palavras normalizadas.
const REPEATED_OPENING_WORD_COUNT = 3;

export function checkRepeatedOpening(sugestao: string, previousSuggestions: string[]): string[] {
  if (!previousSuggestions.length) return [];
  const opening = (s: string) =>
    normalizeForCompare(s)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, REPEATED_OPENING_WORD_COUNT)
      .join(" ");
  const novaAbertura = opening(sugestao);
  if (!novaAbertura) return [];
  for (const anterior of previousSuggestions) {
    if (opening(anterior) === novaAbertura) {
      return [
        `a frase começa igual a uma sugestão anterior desta sessão ("${novaAbertura}..."): comece com uma estrutura e palavras de abertura visivelmente diferentes, mesmo que o produto/serviço de origem seja parecido`,
      ];
    }
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// Sugestão (PU/MOP) — vazamento do NOME da lente interna de geração.
// A "lente de abertura" (OPENING_LENSES em suggest-keyinfo.ts) é um mecanismo
// INTERNO: só orienta o ângulo da frase, nunca deve aparecer na saída. O
// prompt instrui isso (lensBlock), mas sem checagem determinística era só
// confiança na LLM. Aqui confirmamos que o nome literal da lente escolhida
// (ex.: "Dúvida comum", "Processo") não aparece na frase final — comparação
// case/acento-insensível, com boundary de palavra para evitar falso positivo
// em substring solta (ex.: "Processo" dentro de "processamento").
// ─────────────────────────────────────────────────────────────────────────

export function checkLensNameLeak(sugestao: string, lensNome: string): string[] {
  const nome = lensNome.trim();
  if (!nome) return [];
  const normalizedSugestao = normalizeForCompare(sugestao);
  const escaped = normalizeForCompare(nome).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "iu");
  if (re.test(normalizedSugestao)) {
    return [
      `sugestão expõe o nome da lente interna ("${lensNome}") na frase final — a lente deve ser invisível, descreva a situação sem citar o nome do mecanismo interno`,
    ];
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// Sugestão (PU/MOP) — fecho fraco da frase (PRINCÍPIO DO FECHO DA FRASE,
// principios-comunicacao-metodo-op-2026-06-21.txt, topo + entrada 1.6):
// as últimas palavras precisam nomear um resultado, necessidade ou benefício
// CONCRETO do item — não deixar o pensamento em aberto. Espelho determinístico
// do critério "FECHO DA FRASE" que já existe no prompt (suggest-keyinfo.ts):
// sem esta checagem, as violações passavam sem retry (caso real de 04/07/2026,
// MOP, empresa "Oficina de Propaganda", produto "Aplicativo Método OP").
// Três famílias de fecho fraco, cada uma com motivo próprio e específico —
// a mensagem alimenta o `reinforcement` do retry em suggest-keyinfo.ts, então
// precisa dizer ao modelo exatamente O QUE corrigir:
//   (a) ocasião de calendário/tempo solta no fim ("Uso do Método OP no carnaval");
//   (b) o nome do próprio elemento concreto como últimas palavras
//       ("Dicas práticas no Aplicativo Método OP");
//   (c) qualificador adjetival vago como última palavra
//       ("...para montar anúncios certos").
// ─────────────────────────────────────────────────────────────────────────

// Palavras-chave de ocasião/tempo de calendário (já normalizadas: minúsculas,
// sem acento). Multi-palavra é permitido — a regex casa a expressão inteira.
const OCCASION_KEYWORDS = [
  "carnaval",
  "natal",
  "ano novo",
  "reveillon",
  "pascoa",
  "black friday",
  "festa junina",
  "festas juninas",
  "dia das maes",
  "dia dos pais",
  "dia das criancas",
  "dia dos namorados",
  "verao",
  "inverno",
  "outono",
  "primavera",
  "fim de semana",
  "final de semana",
  "feriado",
  "feriados",
  "temporada",
  "evento",
  "eventos",
  // meses
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
  // dias da semana
  "segunda-feira",
  "terca-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "sabados",
  "domingo",
  "domingos",
];

// Ocasião como ÚLTIMAS palavras da frase — por SUFIXO, não mais por
// adjacência de preposição (auditoria 2026-07-05): a versão anterior exigia
// a palavra de calendário colada à preposição ("no verão"), e "no FIM DO
// verão"/"no COMEÇO DO inverno" furavam porque havia um conector no meio
// ("fim do", "começo do") entre a preposição e a ocasião — mesmo com a
// palavra já estando em OCCASION_KEYWORDS. Enumerar todo conector possível
// ("fim de", "começo de", "auge de", "meio de"...) é o mesmo jogo de gato e
// rato das listas fixas; o que importa não é o que vem ANTES da ocasião, é
// que a frase TERMINA nela — nenhum benefício concreto real termina bruto
// numa estação/data/feriado, não importa o que a precede. Ordenado do mais
// longo pro mais curto pra bater expressões de 2+ palavras ("ano novo",
// "dia das maes") antes de um token isolado.
const OCCASION_KEYWORDS_BY_LENGTH = [...OCCASION_KEYWORDS].sort(
  (a, b) => b.split(/\s+/).length - a.split(/\s+/).length,
);

function matchOccasionEnding(normalizedText: string): string | null {
  const tokens = normalizedText.split(/\s+/).filter(Boolean);
  for (const kw of OCCASION_KEYWORDS_BY_LENGTH) {
    const kwTokens = kw.split(/\s+/);
    if (tokens.length < kwTokens.length) continue;
    if (tokens.slice(-kwTokens.length).join(" ") === kw) return kw;
  }
  return null;
}

// Qualificadores adjetivais vagos de aprovação/adequação — quando são a
// ÚLTIMA palavra, a frase fecha num juízo genérico que colaria em qualquer
// produto/serviço ("anúncios certos", "escolha ideal", "tamanho perfeito").
const VAGUE_CLOSING_ADJECTIVE_RE =
  /^(certos?|certas?|ideal|ideais|perfeitos?|perfeitas?|adequados?|adequadas?|corretos?|corretas?|apropriados?|apropriadas?)$/;

// Palavras funcionais ignoradas ao extrair o "núcleo" do nome do elemento
// concreto (família b, e checkItemNameDrift abaixo) — sobre texto já
// normalizado (sem acento).
export const ITEM_NAME_STOPWORDS = new Set([
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "ou",
  "para",
  "pra",
  "com",
  "sem",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "ao",
  "aos",
]);

export function checkWeakEnding(sugestao: string, concreteItem?: string | null): string[] {
  const motivos: string[] = [];
  // Normaliza e remove pontuação final — o fecho é avaliado pelas PALAVRAS.
  const norm = normalizeForCompare(sugestao)
    .replace(/[.!?…]+\s*$/g, "")
    .trim();
  if (!norm) return motivos;

  // (a) Ocasião/tempo solto no fim — "…no carnaval", "…durante o verão",
  // "…no fim do verão" (ver matchOccasionEnding: por sufixo, não por
  // adjacência de preposição).
  const occMatch = matchOccasionEnding(norm);
  if (occMatch) {
    motivos.push(
      `fecho fraco (ocasião solta no fim): a frase termina em "${occMatch}" — uma referência de calendário/tempo sem resultado. A ocasião pode aparecer no MEIO da frase como contexto; as ÚLTIMAS palavras devem nomear o resultado, necessidade ou benefício concreto que o item entrega`,
    );
  }

  const sugTokens = norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const lastToken = sugTokens[sugTokens.length - 1] || "";

  // (b) Fecho no nome do próprio elemento concreto — "…no Aplicativo Método OP".
  // Só reprova quando o núcleo final do nome do item aparece LITERALMENTE como
  // última palavra da sugestão (e, em nomes multi-palavra, com a penúltima
  // palavra também pertencendo ao nome) — sem nenhum resultado/complemento
  // depois dele. Item no meio da frase seguido de resultado é legítimo.
  if (concreteItem) {
    const itemTokens = normalizeForCompare(concreteItem)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t && !ITEM_NAME_STOPWORDS.has(t));
    const lastCore = itemTokens[itemTokens.length - 1];
    if (lastCore && lastToken === lastCore) {
      const penult = sugTokens[sugTokens.length - 2];
      const endsOnItemName =
        itemTokens.length === 1 || (penult !== undefined && itemTokens.includes(penult));
      if (endsOnItemName) {
        motivos.push(
          `fecho fraco (nome do próprio item no fim): a frase termina no nome do próprio elemento concreto ("${concreteItem}") sem nomear resultado nenhum — as ÚLTIMAS palavras devem dizer o que o cliente ganha, resolve ou evita com ele, não repetir o nome do item`,
        );
      }
    }
  }

  // (c) Qualificador adjetival vago como última palavra — "…anúncios certos".
  if (lastToken && VAGUE_CLOSING_ADJECTIVE_RE.test(lastToken)) {
    motivos.push(
      `fecho fraco (qualificador vago no fim): a frase termina em "${lastToken}", adjetivo genérico de aprovação que serviria para qualquer produto/serviço — troque o fecho por um resultado, necessidade ou benefício concreto e específico deste item`,
    );
  }

  return motivos;
}

// ─────────────────────────────────────────────────────────────────────────
// Sugestão (PU/MOP) — adjetivo de recheio FORA do fecho (achado 14/07/2026,
// auditoria B2C/B2B: "Óleos lubrificantes diferentes para máquinas
// pesadas"). VAGUE_CLOSING_ADJECTIVE_RE e o economiaOk do juiz só cobrem a
// ÚLTIMA palavra da frase — um adjetivo vazio colado ao NÚCLEO (no meio da
// frase) passava batido por todas as camadas. Mesma lista de
// VAGUE_CLOSING_ADJECTIVE_RE (adjetivo cujo oposto seria absurdo de
// anunciar) mais a família "diferente/diferenciado/diverso/variado" que
// motivou o achado — vago porque não diz DE QUE FORMA o item é diferente.
// Ignora a última palavra da frase de propósito: essa posição já é coberta
// por checkWeakEnding, checar aqui também só duplicaria o motivo.
// ─────────────────────────────────────────────────────────────────────────

const VAGUE_ADJECTIVE_ANYWHERE_RE =
  /^(certos?|certas?|ideal|ideais|perfeitos?|perfeitas?|adequados?|adequadas?|corretos?|corretas?|apropriados?|apropriadas?|diferentes?|diferenciad[ao]s?|divers[ao]s?|variad[ao]s?)$/;

export function checkVagueAdjectiveMidSentence(sugestao: string): string[] {
  const norm = normalizeForCompare(sugestao)
    .replace(/[.!?…]+\s*$/g, "")
    .trim();
  if (!norm) return [];
  const tokens = norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (let i = 0; i < tokens.length - 1; i++) {
    if (VAGUE_ADJECTIVE_ANYWHERE_RE.test(tokens[i])) {
      return [
        `sugestão usa adjetivo de recheio ("${tokens[i]}") no meio da frase — não especifica nada real deste item (o oposto seria absurdo de anunciar, ou não diz de que forma ele é diferente/variado); troque por uma característica concreta e específica, ou remova o adjetivo`,
      ];
    }
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// Sugestão (PU/MOP) — deriva do próprio elemento concreto e reescreve o nome
// do produto/serviço (auditoria 2026-07-05): "Aplicativo Método OP" virando
// "Ferramenta Método OP", "Método OP digital", "Uso do Método OP" entre
// gerações da MESMA sessão. O núcleo da frase (ver SINTAXE — NÚCLEO DA FRASE
// em suggest-keyinfo.ts) deve nomear o elemento concreto — não uma paráfrase
// dele. Determinístico: exige que todas as palavras significativas do nome
// cadastrado apareçam literalmente na sugestão. Só roda para nomes curtos
// (até 5 palavras significativas) — nomes cadastrados mais longos já ocupam
// sozinhos boa parte do limite de 7 palavras da frase, e exigir literalidade
// total nesses casos sobraria pouco ou nenhum espaço pro complemento.
// ─────────────────────────────────────────────────────────────────────────

const ITEM_NAME_DRIFT_MAX_CORE_TOKENS = 5;

export function checkItemNameDrift(sugestao: string, concreteItem?: string | null): string[] {
  if (!concreteItem) return [];
  const itemTokens = normalizeForCompare(concreteItem)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t && !ITEM_NAME_STOPWORDS.has(t));
  if (!itemTokens.length || itemTokens.length > ITEM_NAME_DRIFT_MAX_CORE_TOKENS) return [];

  const sugTokens = new Set(
    normalizeForCompare(sugestao)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
  const missing = itemTokens.filter((t) => !sugTokens.has(t));
  if (!missing.length) return [];

  return [
    `nome do elemento concreto reescrito: a sugestão deveria nomear "${concreteItem}" mas não usa a(s) palavra(s) "${missing.join(", ")}" — use o nome exato do item, sem parafrasear ou trocar por sinônimo`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// Sugestão (PU/MOP) — poda determinística do fecho fraco (E2, sem custo de
// API — auditoria 2026-07-05, PRINCÍPIO DO FECHO DA FRASE, doc mestre 1.6):
// quando as tentativas de regeneração se esgotam e a sugestão AINDA reprova
// por fecho fraco, corta o trecho já sabidamente errado em vez de entregar
// a frase reprovada como está. Cobre as famílias (a) ocasião solta e (c)
// qualificador vago de checkWeakEnding, mais o conector/preposição solto no
// fim (checkDanglingEnding, ex.: "...a confiança na") — todas são "lixo
// pendurado no fim" que dá pra remover sem inventar conteúdo. A família (b)
// (nome do próprio item como fecho) NÃO é tratada aqui: removê-la apagaria o
// próprio núcleo da frase (o item concreto), piorando o resultado em vez de
// consertar — esse caso fica sem poda determinística possível, cabe à
// regeneração via LLM (loop de tentativas) ou é entregue como está no pior
// caso.
// Retorna null quando não há nada seguro para podar, ou quando a poda
// deixaria a frase abaixo do piso de 4 palavras (nenhuma poda é melhor que
// uma frase mutilada).
// ─────────────────────────────────────────────────────────────────────────

// Palavras funcionais de "entulho temporal" (preposição + conector) que
// costumam anteceder a ocasião de calendário no fecho fraco família (a) —
// usado só pela PODA (matchOccasionEnding, a detecção, não precisa disso:
// já basta a frase terminar na ocasião). Conjunto pequeno e fechado de
// palavras GRAMATICAIS (não de conteúdo, como nomes de feriados), por isso
// não sofre do mesmo problema de lista infinita das palavras de conteúdo.
const OCCASION_SCAFFOLD_WORDS = new Set([
  "no",
  "na",
  "nos",
  "nas",
  "em",
  "durante",
  "do",
  "da",
  "dos",
  "das",
  "de",
  "o",
  "a",
  "os",
  "as",
  "fim",
  "final",
  "comeco",
  "inicio",
  "meio",
  "auge",
  "metade",
]);

export function pruneWeakEnding(sugestao: string): string | null {
  const trailingPunct = sugestao.match(/[.!?…]+\s*$/)?.[0] ?? "";
  const core = trailingPunct ? sugestao.slice(0, -trailingPunct.length) : sugestao;
  const normCore = normalizeForCompare(core);

  let pruned: string | null = null;

  const occMatch = matchOccasionEnding(normCore);
  if (occMatch) {
    const occWordCount = occMatch.split(/\s+/).filter(Boolean).length;
    const words = core.trim().split(/\s+/).filter(Boolean);
    let cut = words.length - occWordCount;
    // Continua cortando pra trás enquanto houver entulho temporal ("no fim
    // do", "no começo do") — teto de segurança pra não devorar a frase
    // inteira em casos anômalos.
    let extra = 0;
    while (cut > 0 && extra < 4) {
      const prevNorm = normalizeForCompare(words[cut - 1] || "").replace(/[^\p{L}]/gu, "");
      if (!OCCASION_SCAFFOLD_WORDS.has(prevNorm)) break;
      cut -= 1;
      extra += 1;
    }
    pruned = words.slice(0, Math.max(0, cut)).join(" ");
  } else {
    const tokens = core.trim().split(/\s+/).filter(Boolean);
    const lastNorm = normalizeForCompare(tokens[tokens.length - 1] || "").replace(
      /[^\p{L}\p{N}]/gu,
      "",
    );
    if (VAGUE_CLOSING_ADJECTIVE_RE.test(lastNorm)) {
      pruned = tokens.slice(0, -1).join(" ");
    } else if (DANGLING_END_WORDS.has(lastNorm)) {
      // Corta o(s) conector(es)/preposição(ões)/auxiliar(es) soltos no fim
      // (ex.: "...a confiança na") — remover um pode expor outro dangling
      // logo atrás (ex.: "...resultado que vem na" → corta "na", expõe
      // "vem", também dangling), por isso repete a checagem; teto de
      // segurança pra não devorar a frase inteira em casos anômalos.
      let cut = tokens.length;
      let extra = 0;
      while (cut > 0 && extra < 4) {
        const norm = normalizeForCompare(tokens[cut - 1] || "").replace(/[^\p{L}\p{N}]/gu, "");
        if (!DANGLING_END_WORDS.has(norm)) break;
        cut -= 1;
        extra += 1;
      }
      pruned = tokens.slice(0, cut).join(" ");
    }
  }

  if (pruned === null) return null;
  pruned = pruned.replace(/[,;:\-–—]+$/, "").trim();
  const wordCount = pruned.split(/\s+/).filter(Boolean).length;
  if (!pruned || wordCount < 4) return null;
  return pruned;
}
