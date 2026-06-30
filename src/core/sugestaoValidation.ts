import { normalizeForCompare } from "./morphValidation";

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