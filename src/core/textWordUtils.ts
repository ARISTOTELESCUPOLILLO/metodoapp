// Utilitários de texto base — sem dependências internas (importados por captionValidation, morphValidation, titleValidation).
//
// 18/08 — truncateWords tinha uma lista PRÓPRIA e menor de palavras a tirar do
// fim (só conjunção, preposição, artigo e verbo de ligação), enquanto
// checkDanglingEnding, no mesmo arquivo, usava um conjunto bem maior. A
// divergência já tinha cobrado um remendo (as contrações "na/no/pelo/à", que
// o corte deixava penduradas e a detecção acusava) e cobrou de novo em
// produção: o apoio de uma peça saiu "…chegando nos seus canais digitais
// todos." — o texto tinha 15 palavras ("todos os dias"), o corte levou a 14 e
// a limpeza tirou só o "os", deixando o quantificador órfão. Duas causas: o
// quantificador não estava em lista nenhuma, e a limpeza removia UMA palavra
// só, quando tirar uma expõe a de trás. Agora existe um critério único —
// isDanglingToken, mais abaixo — usado pelo corte e pela detecção, e o corte
// repete até não sobrar palavra pendurada.

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

  const kept = words.slice(0, max);
  const truncated = kept.join(" ").replace(/[,;:\-–—]+$/, "");

  // Prefere corte em limite de frase completa dentro do trecho
  const m = truncated.match(/^(.*[.!?])\s+\S/);
  if (m) return m[1].trim();

  // Fallback: tira do fim as palavras que exigem complemento. REPETE porque
  // tirar uma expõe a de trás ("…digitais todos os" → sai o "os", sobra
  // "todos", que também pende). Teto de 4 pra não devorar o trecho em caso
  // anômalo, e nunca abaixo de 1 palavra — mesmo critério e mesmo teto da
  // poda da Sugestão (core/sugestaoValidation.ts).
  let cut = kept.length;
  let removidas = 0;
  while (cut > 1 && removidas < 4 && isDanglingToken(kept, cut - 1)) {
    cut -= 1;
    removidas += 1;
  }
  return kept
    .slice(0, cut)
    .join(" ")
    .replace(/[,;:\-–—]+$/, "")
    .trim();
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
const DANGLING_END_WORDS_SOURCE = [
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
];

// A lista é comparada SEMPRE contra a palavra sem acento — aqui, no corte
// acima e no consumidor de fora (core/sugestaoValidation.ts). Guardar a forma
// acentuada e não normalizá-la na construção deixava NOVE entradas mortas,
// que nunca batiam com nada: "até", "após", "são", "será", "serão", "tão",
// "vão", "então" e "porém". Normalizar aqui é o que faz a lista valer o que
// ela diz.
export const DANGLING_END_WORDS = new Set(DANGLING_END_WORDS_SOURCE.map(stripAccents));

// Quantificadores. Exigem complemento, mas nem sempre: "serve para todos" é
// frase inteira, "canais digitais todos" é corte. O que separa os dois é a
// preposição imediatamente antes — por isso ficam fora da lista de cima, que
// vale sem condição. Já "cada", "qualquer" e "quaisquer" pedem substantivo em
// qualquer posição ("para qualquer" também é corte) e não levam guarda.
const QUANTIFICADORES_SEMPRE_PENDENTES = new Set(["cada", "qualquer", "quaisquer"]);
const QUANTIFICADORES_QUE_PEDEM_SUBSTANTIVO = new Set([
  "todo",
  "toda",
  "todos",
  "todas",
  "ambos",
  "ambas",
]);
const PREPOSICAO_ANTES_DO_QUANTIFICADOR = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "para",
  "pra",
  "por",
  "pelo",
  "pela",
  "pelos",
  "pelas",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "entre",
  "sobre",
  "contra",
  "apos",
  "sem",
  "desde",
  "ate",
]);

// Determinantes que pendem pelo motivo INVERSO ao dos quantificadores acima: a
// preposição na frente é o que os deixa incompletos, não o que os salva.
// Achado real (teste ao vivo de 18/08, caso 3 do marcador temporal): o apoio
// "…e sempre cabe mais uma dúvida NO MESMO." tem exatamente 14 palavras, e
// reconstruir "…no mesmo encontro." cortado em 14 devolve essa frase letra por
// letra. O corte comeu o substantivo, "mesmo" não estava em nenhuma lista e a
// detecção também não acusou — publicado.
//
// A guarda é obrigatória porque "mesmo" tem uso ADVERBIAL que fecha frase muito
// bem: "Funciona mesmo.", "É bom mesmo.", "Ele faz o mesmo." — nesses a palavra
// anterior é verbo, adjetivo ou artigo, nunca preposição. Já "no mesmo", "ao
// mesmo", "da mesma" exigem substantivo sempre.
//
// FICAM DE FORA, e não por esquecimento: "outro/outra/outros/outras" cairia em
// falso positivo no idiomático "entre outros", que fecha frase; e
// "próprio/própria", que não tem falha medida. Mesmo critério de sempre neste
// projeto — não mexer sem falha medida, ainda mais quando o custo do engano é o
// corte comer mais uma palavra boa.
const DETERMINANTES_QUE_PENDEM_APOS_PREPOSICAO = new Set(["mesmo", "mesma", "mesmos", "mesmas"]);

function normalizeWord(w: string): string {
  return stripAccents(String(w || "").toLowerCase()).replace(/[^\p{L}\p{N}]/gu, "");
}

// Critério ÚNICO de "palavra que não pode fechar a frase", usado pelo corte
// (truncateWords) e pela detecção (checkDanglingEnding). Enquanto os dois
// tiveram listas separadas, o corte produzia exatamente aquilo que a detecção
// depois acusava — e, quando a palavra não estava em nenhuma das duas listas,
// saía publicado.
function isDanglingToken(tokens: string[], i: number): boolean {
  const palavra = normalizeWord(tokens[i] ?? "");
  if (!palavra) return false;
  if (DANGLING_END_WORDS.has(palavra)) return true;
  if (QUANTIFICADORES_SEMPRE_PENDENTES.has(palavra)) return true;
  if (QUANTIFICADORES_QUE_PEDEM_SUBSTANTIVO.has(palavra)) {
    return !PREPOSICAO_ANTES_DO_QUANTIFICADOR.has(normalizeWord(tokens[i - 1] ?? ""));
  }
  // Guarda INVERTIDA — ver a nota do conjunto: aqui a preposição condena.
  if (DETERMINANTES_QUE_PENDEM_APOS_PREPOSICAO.has(palavra)) {
    return PREPOSICAO_ANTES_DO_QUANTIFICADOR.has(normalizeWord(tokens[i - 1] ?? ""));
  }
  return false;
}

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

  // Passa a lista inteira de tokens: o quantificador só pende quando NÃO vem
  // depois de preposição, e isso exige olhar a palavra anterior.
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (isDanglingToken(tokens, tokens.length - 1)) {
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
