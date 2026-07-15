// Utilitários de texto base — sem dependências internas (importados por captionValidation, morphValidation, titleValidation).
// Inclui as contrações de preposição+artigo ("em"+"a/o/as/os" = "na/no/nas/nos",
// "por"+"o/a/os/as" = "pelo/pela/pelos/pelas", "a"+"a/as" = "à/às") — sem elas,
// truncateWords cortava em 7 palavras e deixava a frase pendurada exatamente
// nessas formas contraídas, que checkDanglingEnding (mais abaixo, mesmo
// arquivo) já reconhece como corte, mas truncateWords não removia sozinho.
const TRUNCATE_TRAILING_WORDS =
  "e|ou|mas|que|se|nem|de|da|do|das|dos|para|com|em|na|no|nas|nos|num|numa|nuns|numas|a|o|as|os|ao|aos|à|às|por|pelo|pela|pelos|pelas|pois|até|ante|após|sob|sobre|entre|contra|desde|durante|sem|via|é|foi|era|será|está|estava|ficou|parece|fica|são|eram|serão|sendo|tendo";

// Tokeniza um título tratando "R$ 120,00" como 1 palavra só (não 2) — usado
// pelo modo de título ajustado (PU objetivo=promocao com oferta concreta,
// ver core/ofertaDetection.ts), onde o teto sobe de 6 para 9 palavras e um
// valor monetário não pode "custar" 2 palavras da contagem.
export function tituloWordTokens(titulo: string): string[] {
  const words = titulo.trim().split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (/^R\$$/i.test(words[i]) && i + 1 < words.length) {
      tokens.push(`${words[i]} ${words[i + 1]}`);
      i++;
      continue;
    }
    tokens.push(words[i]);
  }
  return tokens;
}

export function countTituloWords(titulo: string): number {
  return tituloWordTokens(titulo).length;
}

export function truncateWords(s: string, max: number): string {
  const text = String(s ?? "");
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return text.trim();

  const truncated = words
    .slice(0, max)
    .join(" ")
    .replace(/[,;:\-–—]+$/, "");

  // Prefere corte em limite de frase completa dentro do trecho
  const m = truncated.match(/^(.*[.!?])\s+\S/);
  if (m) return m[1].trim();

  // Fallback: remove conjunção, preposição ou verbo de ligação sobrando no final
  return truncated.replace(new RegExp(`\\s+(${TRUNCATE_TRAILING_WORDS})\\s*$`, "i"), "").trim();
}

// ─────────────────────────────────────────────────────────────────────────
// Correção ortográfica determinística — termos que a IA por vezes escreve na
// grafia em inglês/latim em vez do equivalente em português brasileiro (ex.:
// "lumbar" em vez de "lombar"). Substituição com preservação de caixa,
// aplicada a título/texto/legenda antes da validação D1.
// ─────────────────────────────────────────────────────────────────────────
const SPELLING_CORRECTIONS: Record<string, string> = {
  lumbar: "lombar",
};

function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] && original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function correctPortugueseSpelling(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [wrong, right] of Object.entries(SPELLING_CORRECTIONS)) {
    result = result.replace(new RegExp(`\\b${wrong}\\b`, "gi"), (m) => matchCase(m, right));
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// D1 — heurísticas determinísticas pós-geração
// ─────────────────────────────────────────────────────────────────────────

// Item 1: terminação "pendurada" — conjunto ampliado em relação ao usado por
// truncateWords. Além de conjunções/preposições/verbos de ligação, inclui
// artigos indefinidos, pronomes relativos/possessivos/demonstrativos,
// advérbios comparativos pendentes, verbos auxiliares sem complemento e
// conjunções subordinativas.
export const DANGLING_END_WORDS = new Set([
  "e",
  "ou",
  "mas",
  "que",
  "se",
  "nem",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "para",
  "com",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "num",
  "numa",
  "nuns",
  "numas",
  "a",
  "o",
  "as",
  "os",
  "ao",
  "aos",
  "à",
  "às",
  "por",
  "pelo",
  "pela",
  "pelos",
  "pelas",
  "pois",
  "até",
  "ante",
  "após",
  "sob",
  "sobre",
  "entre",
  "contra",
  "desde",
  "durante",
  "sem",
  "via",
  "é",
  "foi",
  "era",
  "será",
  "está",
  "estava",
  "ficou",
  "parece",
  "fica",
  "são",
  "eram",
  "serão",
  "sendo",
  "tendo",
  // artigos indefinidos
  "um",
  "uma",
  "uns",
  "umas",
  // pronomes relativos/possessivos/demonstrativos
  "qual",
  "quais",
  "cujo",
  "cuja",
  "cujos",
  "cujas",
  "meu",
  "minha",
  "meus",
  "minhas",
  "teu",
  "tua",
  "teus",
  "tuas",
  "seu",
  "sua",
  "seus",
  "suas",
  "nosso",
  "nossa",
  "nossos",
  "nossas",
  "este",
  "esta",
  "estes",
  "estas",
  "esse",
  "essa",
  "esses",
  "essas",
  "aquele",
  "aquela",
  "aqueles",
  "aquelas",
  "isto",
  "isso",
  "aquilo",
  // advérbios comparativos/intensificadores pendentes
  "mais",
  "tão",
  "menos",
  "muito",
  "muita",
  "muitos",
  "muitas",
  "pouco",
  "pouca",
  "tanto",
  "tanta",
  // verbos auxiliares/modais sem complemento
  "vai",
  "vou",
  "vamos",
  "vão",
  "vais",
  "pode",
  "podem",
  "posso",
  "podemos",
  "quer",
  "querem",
  "quero",
  "queremos",
  "deve",
  "devem",
  "devo",
  "devemos",
  "vem",
  "vêm",
  "têm",
  "tem",
  "consegue",
  "conseguem",
  "precisa",
  "precisam",
  // conjunções subordinativas
  "porque",
  "quando",
  "embora",
  "caso",
  "enquanto",
  "portanto",
  "então",
  "logo",
  "assim",
  "contudo",
  "todavia",
  "entretanto",
  "porém",
]);

// Consoantes finais raras em palavras nativas do português — sinal de
// truncamento no meio de um token (ex.: "result" em vez de "resultado").
const ATYPICAL_FINAL_CONSONANTS = /[bcdfghjkpqtvwy]$/i;

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function lastToken(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words[words.length - 1] || "";
}

// Item 1: detecta finalização "pendurada" — palavra que sugere corte
// (conjunção/preposição/pronome/auxiliar sem complemento) ou pontuação de
// transição (vírgula, dois-pontos, hífen, reticências).
export function checkDanglingEnding(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (/[,;:\-–—]$/.test(trimmed) || /\.\.\.$|…$/.test(trimmed)) {
    return "termina com pontuação de transição (vírgula/dois-pontos/hífen/reticências), sugerindo corte";
  }

  const last = lastToken(trimmed).replace(/[.!?,;:'"()«»“”]+$/g, "");
  if (!last) return null;

  const lastNorm = stripAccents(last.toLowerCase());
  if (DANGLING_END_WORDS.has(lastNorm)) {
    return `termina com a palavra "${last}", que sugere frase incompleta/cortada`;
  }

  if (last.length >= 3 && ATYPICAL_FINAL_CONSONANTS.test(last) && !/[.!?]$/.test(trimmed)) {
    return `última palavra "${last}" termina em consoante incomum no português, sugerindo corte no meio do token`;
  }

  return null;
}

export const QUESTION_STARTERS =
  /^(por que|por quê|como|quando|onde|qual|quais|quem|o que|que|será que|pra que|para que|quanto|quanta|quantos|quantas)\b/i;

// Itens 2/4: pontuação final esperada por tipo de campo + parênteses/aspas
// desbalanceados (sinal de frase quebrada).
export function checkPunctuation(
  text: string,
  kind: "titulo" | "texto" | "legenda",
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const opens = (trimmed.match(/\(/g) || []).length;
  const closes = (trimmed.match(/\)/g) || []).length;
  if (opens !== closes) return "parênteses desbalanceados";
  const quotes = (trimmed.match(/"/g) || []).length;
  if (quotes % 2 !== 0) return "aspas desbalanceadas";

  if (kind === "titulo") {
    const isPergunta = QUESTION_STARTERS.test(trimmed);
    if (isPergunta && !/\?$/.test(trimmed)) {
      return 'título é uma pergunta mas não termina com "?"';
    }
    if (!isPergunta && /[.!]$/.test(trimmed)) {
      return "título não-pergunta termina com ponto/exclamação (deveria não ter pontuação final)";
    }
    return null;
  }

  if (kind === "legenda") {
    // A legenda termina com o parágrafo de hashtags (sem pontuação final) —
    // a pontuação do parágrafo de CTA é validada por checkLegendaStructure.
    return null;
  }

  // texto
  if (!/[.!?]$/.test(trimmed)) {
    return `${kind} não termina com pontuação final (./!/?)`;
  }
  return null;
}
