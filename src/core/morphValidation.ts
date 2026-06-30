import { stripAccents } from "./textWordUtils";

const STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "e",
  "ou",
  "mas",
  "que",
  "se",
  "nem",
  "para",
  "com",
  "por",
  "ao",
  "aos",
  "à",
  "às",
  "é",
  "são",
  "foi",
  "era",
  "será",
  "está",
  "estava",
  "ser",
  "ter",
  "tem",
  "têm",
  "seu",
  "sua",
  "seus",
  "suas",
  "este",
  "esta",
  "esse",
  "essa",
  "isso",
  "isto",
  "mais",
  "menos",
  "muito",
  "muita",
  "pouco",
  "pouca",
  "já",
  "não",
  "sem",
  "sobre",
  "entre",
  "até",
  "como",
  "quando",
  "onde",
  "qual",
  "quem",
  "você",
  "nosso",
  "nossa",
  "pelo",
  "pela",
  "pelos",
  "pelas",
]);

const STEM_SUFFIXES = [
  "acoes",
  "acao",
  "agens",
  "agem",
  "mente",
  "ando",
  "endo",
  "indo",
  "ados",
  "adas",
  "idos",
  "idas",
  "ado",
  "ada",
  "ido",
  "ida",
  "avel",
  "aveis",
  "oso",
  "osa",
  "osos",
  "osas",
  "al",
  "ais",
  "ar",
  "er",
  "ir",
  "es",
  "os",
  "as",
  "a",
  "o",
  "e",
  "s",
];

function stem(word: string): string {
  let w = stripAccents(word.toLowerCase()).replace(/[^a-z]/g, "");
  for (const suf of STEM_SUFFIXES) {
    if (w.length - suf.length >= 3 && w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  return w.slice(0, 5);
}

// Item 5: compara raízes (stemming leve) entre palavras de conteúdo dos
// textos informados (ex.: título + texto do mesmo item) — reprova se a mesma
// raiz aparece em palavras de superfície diferentes.
export function checkMorphRepetition(texts: string[]): string | null {
  const seen = new Map<string, string>();
  for (const text of texts) {
    const words = text.split(/[^\p{L}]+/u).filter(Boolean);
    for (const word of words) {
      if (word.length < 4) continue;
      const norm = stripAccents(word.toLowerCase());
      if (STOPWORDS.has(norm)) continue;
      const root = stem(word);
      if (root.length < 3) continue;
      const prev = seen.get(root);
      if (prev && prev !== norm) {
        return `repetição morfológica: "${prev}" e "${norm}" compartilham a raiz "${root}"`;
      }
      if (!prev) seen.set(root, norm);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Item 7 (subcaso numérico) — promessa numérica/oferta dura sem respaldo na keyInfo
// ─────────────────────────────────────────────────────────────────────────

const HARD_OFFER_TERMS = [
  "grátis",
  "gratuito",
  "gratuita",
  "garantido",
  "garantida",
  "garantia",
  "frete grátis",
  "sem juros",
  "cashback",
];

const NUMERIC_CLAIM_PATTERNS: RegExp[] = [
  /\d+([.,]\d+)?\s*%/g,
  /R\$\s*[\d.,]+/gi,
  /\d+\s*(dias?|semanas?|mes(es)?|anos?|horas?|minutos?|min)\b/gi,
  /\b\d+\s*x\b/gi,
];

export function normalizeForCompare(s: string): string {
  return stripAccents(s.toLowerCase());
}

// Item 7 (subcaso numérico): extrai %, R$, prazos, parcelamento e ofertas
// duras de título/texto/legenda; reprova o que não tem respaldo (literal,
// sem acento) na informação-chave. Sem keyInfo, não há base de comparação —
// não reprova nada.
export function checkNumericClaims(text: string, keyInfo: string): string[] {
  const flags: string[] = [];
  const keyNorm = normalizeForCompare(keyInfo || "");
  if (!keyNorm) return flags;

  for (const pattern of NUMERIC_CLAIM_PATTERNS) {
    const matches = text.match(pattern) || [];
    for (const raw of matches) {
      const token = raw.trim();
      const digits = token.replace(/[^\d]/g, "");
      if (!digits) continue;
      if (!keyNorm.includes(digits)) {
        flags.push(`menciona "${token}" sem respaldo na informação-chave`);
      }
    }
  }

  const textNorm = normalizeForCompare(text);
  for (const term of HARD_OFFER_TERMS) {
    const termNorm = normalizeForCompare(term);
    const firstWord = termNorm.split(" ")[0];
    if (textNorm.includes(termNorm) && !keyNorm.includes(firstWord)) {
      flags.push(`promete "${term}" sem respaldo na informação-chave`);
    }
  }

  return flags;
}

// ─────────────────────────────────────────────────────────────────────────
// Combinadores por tipo de campo
// ─────────────────────────────────────────────────────────────────────────

// Faixa de palavras do título (mesma usada no prompt e em
// applyDeterministicFallback): abaixo de 4, o título vira fragmento solto
// ("Fila cresce"); acima de 6, viola o "NO MÁXIMO 6 palavras" que o prompt já
// exige para Estático, Estático Final, Card e hook do Reels
// (organizaMethodEngine.ts) — manter sincronizado com esses limites para que
// uma violação do próprio prompt não passe sem flag. Subido de 5→6 em
// 2026-06-21: o teto de 5 palavras + 3 sílabas forçava a IA a espremer a
// ideia até quebrar a gramática (ex.: "Rotina de ajustes prévios conta").