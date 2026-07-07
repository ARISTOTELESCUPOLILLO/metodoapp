// Validação heurística pós-geração (determinística, sem custo de API) +
// truncamento por limite de palavras — único local, usado por
// normalizeMethodResult, regenerate-block, generate-pu-copy e PostUnicoForm.
// Arquivo mantém as funções-fachada (validateTitulo/Texto/Legenda etc.) e
// re-exporta tudo das sub-fachadas para que os importadores existentes não precisem mudar.

import type { ValidationFlag } from "../types";
export type { ValidationFlag };

// ── Utilitários base ──────────────────────────────────────────────────────────
import { checkDanglingEnding, checkPunctuation, QUESTION_STARTERS } from "./textWordUtils";
export {
  truncateWords,
  correctPortugueseSpelling,
  checkDanglingEnding,
  checkPunctuation,
} from "./textWordUtils";

// ── Legenda ───────────────────────────────────────────────────────────────────
import { checkLegendaStructure } from "./captionValidation";
export {
  LEGENDA_CORPO_MAX_WORDS,
  LEGENDA_CTA_MAX_WORDS,
  LEGENDA_HASHTAGS,
  TECNICISMO_RULE,
  checkLegendaStructure,
  stripTrailingCtaSentence,
  normalizeLegenda,
  enforceLegendaLimits,
  checkCtaOpeningVem,
} from "./captionValidation";

// ── Morfologia e numérico ──────────────────────────────────────────────────────
import { checkMorphRepetition, checkNumericClaims } from "./morphValidation";
export { checkMorphRepetition, normalizeForCompare, checkNumericClaims } from "./morphValidation";

// ── Título ────────────────────────────────────────────────────────────────────
import {
  checkAbstractPredicate,
  checkAbstractClosing,
  checkTituloUrgency,
} from "./titleValidation";
export {
  checkAbstractPredicate,
  checkAbstractClosing,
  checkTituloUrgency,
  checkObserverSubject,
  checkCrossPieceLabelRepeat,
  checkCrossPieceTitleRepeat,
} from "./titleValidation";

// ── Sugestão ──────────────────────────────────────────────────────────────────
export {
  checkInventedPromotion,
  checkSupplierLanguage,
  checkRepeatedOpening,
  checkLensNameLeak,
  checkWeakEnding,
  checkItemNameDrift,
  pruneWeakEnding,
} from "./sugestaoValidation";

// Faixa de palavras do título (mesma usada no prompt e em
// applyDeterministicFallback): abaixo de 4, o título vira fragmento solto
// ("Fila cresce"); acima de 6, viola o "NO MÁXIMO 6 palavras" que o prompt já
// exige para Estático, Estático Final, Card e hook do Reels
// (organizaMethodEngine.ts) — manter sincronizado com esses limites para que
// uma violação do próprio prompt não passe sem flag. Subido de 5→6 em
// 2026-06-21: o teto de 5 palavras + 3 sílabas forçava a IA a espremer a
// ideia até quebrar a gramática (ex.: "Rotina de ajustes prévios conta").
export const TITULO_MIN_WORDS = 4;
export const TITULO_MAX_WORDS = 6;

export function validateTitulo(titulo: string): string[] {
  const motivos: string[] = [];
  const words = titulo.trim().split(/\s+/).filter(Boolean).length;
  if (words < TITULO_MIN_WORDS)
    motivos.push(`título com ${words} palavra(s) — abaixo do mínimo de ${TITULO_MIN_WORDS}`);
  if (words > TITULO_MAX_WORDS)
    motivos.push(`título com ${words} palavras — acima do máximo de ${TITULO_MAX_WORDS}`);
  const dangling = checkDanglingEnding(titulo);
  if (dangling) motivos.push(dangling);
  const punct = checkPunctuation(titulo, "titulo");
  if (punct) motivos.push(punct);
  const abstractPredicate = checkAbstractPredicate(titulo);
  if (abstractPredicate) motivos.push(abstractPredicate);
  const abstractClosing = checkAbstractClosing(titulo);
  if (abstractClosing) motivos.push(abstractClosing);
  const urgency = checkTituloUrgency(titulo);
  if (urgency) motivos.push(urgency);
  return motivos;
}

export function validateTexto(texto: string): string[] {
  const motivos: string[] = [];
  const dangling = checkDanglingEnding(texto);
  if (dangling) motivos.push(dangling);
  const punct = checkPunctuation(texto, "texto");
  if (punct) motivos.push(punct);
  return motivos;
}

export function validateLegenda(legenda: string): string[] {
  const motivos: string[] = [];
  const punct = checkPunctuation(legenda, "legenda");
  if (punct) motivos.push(punct);
  const structure = checkLegendaStructure(legenda);
  if (structure) motivos.push(structure);
  return motivos;
}

// ─────────────────────────────────────────────────────────────────────────
// Validação da sugestão (botão "Sugestão" / keyInfo) — anti-vagueza
// ─────────────────────────────────────────────────────────────────────────

const SUGESTAO_GENERIC_PATTERNS: RegExp[] = [
  /produtos?\s+de\s+qualidade/i,
  /qualidade\s+e\s+confian[çc]a/i,
  /solu[çc][õo]es?\s+completas?/i,
  /atendimento\s+diferenciado/i,
  /fazer\s+a\s+diferen[çc]a/i,
  /muito\s+mais/i,
  /venha\s+conferir/i,
  /o\s+melhor\s+para\s+voc[êe]/i,
  /alta\s+qualidade/i,
  /excel[êe]ncia/i,
  /sempre$/i,
  /recaídas?\s+comuns/i,
  /problemas?\s+comuns/i,
  /evita\s+problemas/i,
  /com\s+seguran[çc]a$/i,
  /do\s+jeito\s+certo$/i,
  /na\s+medida\s+certa$/i,
];

// Validação leve da sugestão/keyInfo gerada pelo botão "Sugestão": comprimento
// (ideal 4-7, chamado sempre com maxWords=7), terminação pendurada e
// frases-clichê genéricas. Não inclui checagem de ancoragem com mainActivity
// de propósito — uma sugestão concreta pode não repetir nenhuma palavra
// literal da atividade, e isso não deve reprová-la (decisão de produto).
export function validateSugestao(sugestao: string, maxWords = 7): string[] {
  const trimmed = sugestao.trim();
  const motivos: string[] = [];
  if (!trimmed) return ["sugestão vazia"];

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (words < 4) motivos.push(`sugestão muito curta (${words} palavra(s)) — abaixo do mínimo de 4`);
  if (words > maxWords)
    motivos.push(`sugestão com ${words} palavras — acima do máximo de ${maxWords}`);

  const dangling = checkDanglingEnding(trimmed);
  if (dangling) motivos.push(dangling);

  if (SUGESTAO_GENERIC_PATTERNS.some((re) => re.test(trimmed))) {
    motivos.push("sugestão usa frase genérica/clichê — falta concretude");
  }

  return motivos;
}

// ─────────────────────────────────────────────────────────────────────────
// E4 — limpeza determinística (fallback final, sem chamada de API)
// ─────────────────────────────────────────────────────────────────────────

// Aplicada quando a regeneração via regenerate-block (E3) esgota as
// tentativas e o campo ainda reprova D1. Corta para a última frase completa
// (se houver), remove palavra(s) final(is) que sugerem corte e repontua —
// um título de 4 palavras limpo é melhor que um de 6 quebrado.
export function applyDeterministicFallback(
  value: string,
  kind: "titulo" | "texto" | "legenda",
): string {
  let text = value.trim();
  if (!text) return text;

  if (kind === "legenda") {
    // Estrutura multi-parágrafo (corpo + CTA + hashtags) — a limpeza de
    // frase única abaixo cortaria a legenda no fim do 1º parágrafo,
    // destruindo CTA e hashtags. Mantém o texto como veio da última
    // tentativa de regeneração (E3), que já reaplica checkLegendaStructure.
    return text;
  }

  const sentenceMatch = text.match(/^(.*[.!?])\s+\S/);
  if (sentenceMatch) text = sentenceMatch[1].trim();

  // Título não é cortado no fluxo normal (normalizeMethodResult/
  // regenerate-block já não truncam) — aqui, no último recurso (E4), se ainda
  // sobrar acima do máximo após as tentativas de regeneração, corta em
  // fronteira de palavra completa antes da limpeza de terminação pendurada.
  if (kind === "titulo") {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > TITULO_MAX_WORDS) {
      text = words
        .slice(0, TITULO_MAX_WORDS)
        .join(" ")
        .replace(/[,;:\-–—]+$/, "")
        .trim();
    }
    // Se mesmo após 2 tentativas (E3) o modelo insistir em terminar com
    // urgência-clichê (o padrão exato do bug original, ex.: "...sua ideia já"),
    // remove só a palavra final em vez de devolver o título flagado como está.
    text = text.replace(/\s+(hoje|agora|j[áa])\s*[!?.]?$/i, "").trim();
  }

  for (let i = 0; i < 3; i++) {
    if (!checkDanglingEnding(text)) break;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) break;
    words.pop();
    text = words
      .join(" ")
      .replace(/[,;:\-–—]+$/, "")
      .trim();
  }

  if (kind === "texto") {
    if (!/[.!?]$/.test(text)) text += ".";
  } else {
    const isPergunta = QUESTION_STARTERS.test(text);
    text = text.replace(/[.!]+$/, "");
    if (isPergunta) {
      if (!/\?$/.test(text)) text += "?";
    } else {
      text = text.replace(/\?+$/, "");
    }
  }

  return text;
}

// Roda todas as heurísticas D1 sobre os campos de uma peça (estático, card de
// carrossel ou reels — "hook"/"script" entram como titulo/texto) e devolve as
// reprovações já endereçadas a `${prefix}.<campo>`. Não bloqueia a entrega —
// apenas sinaliza para regeneração pontual (E3).
export function validatePieceFields(
  prefix: string,
  fields: { titulo?: string; texto?: string; legenda?: string },
  keyInfo?: string,
): ValidationFlag[] {
  const flags: ValidationFlag[] = [];

  if (fields.titulo) {
    for (const motivo of validateTitulo(fields.titulo))
      flags.push({ campo: `${prefix}.titulo`, motivo });
  }
  if (fields.texto) {
    for (const motivo of validateTexto(fields.texto))
      flags.push({ campo: `${prefix}.texto`, motivo });
  }
  if (fields.legenda) {
    for (const motivo of validateLegenda(fields.legenda))
      flags.push({ campo: `${prefix}.legenda`, motivo });
  }

  const morphTexts = [fields.titulo, fields.texto].filter((t): t is string => !!t);
  if (morphTexts.length > 1) {
    const morph = checkMorphRepetition(morphTexts);
    if (morph) flags.push({ campo: prefix, motivo: morph });
  }

  if (keyInfo) {
    const combined = [fields.titulo, fields.texto, fields.legenda].filter(Boolean).join(" ");
    for (const motivo of checkNumericClaims(combined, keyInfo)) {
      flags.push({ campo: prefix, motivo });
    }
  }

  return flags;
}
