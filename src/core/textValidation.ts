// Validação heurística pós-geração (determinística, sem custo de API) +
// truncamento por limite de palavras — único local, usado por
// normalizeMethodResult, regenerate-block, generate-pu-copy e PostUnicoForm
// (substitui as cópias antes duplicadas em cada um desses arquivos).

import type { ValidationFlag } from '../types';

export type { ValidationFlag };

const TRUNCATE_TRAILING_WORDS = 'e|ou|mas|que|se|nem|de|da|do|das|dos|para|com|em|a|o|as|os|ao|por|pois|até|ante|após|sob|sobre|entre|contra|desde|durante|sem|via|é|foi|era|será|está|estava|ficou|parece|fica|são|eram|serão|sendo|tendo';

export function truncateWords(s: string, max: number): string {
  const text = String(s ?? '');
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return text.trim();

  const truncated = words.slice(0, max).join(' ')
    .replace(/[,;:\-–—]+$/, '');

  // Prefere corte em limite de frase completa dentro do trecho
  const m = truncated.match(/^(.*[.!?])\s+\S/);
  if (m) return m[1].trim();

  // Fallback: remove conjunção, preposição ou verbo de ligação sobrando no final
  return truncated
    .replace(new RegExp(`\\s+(${TRUNCATE_TRAILING_WORDS})\\s*$`, 'i'), '')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────
// Correção ortográfica determinística — termos que a IA por vezes escreve na
// grafia em inglês/latim em vez do equivalente em português brasileiro (ex.:
// "lumbar" em vez de "lombar"). Substituição com preservação de caixa,
// aplicada a título/texto/legenda antes da validação D1.
// ─────────────────────────────────────────────────────────────────────────
const SPELLING_CORRECTIONS: Record<string, string> = {
  lumbar: 'lombar',
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
    result = result.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), (m) => matchCase(m, right));
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
const DANGLING_END_WORDS = new Set([
  'e', 'ou', 'mas', 'que', 'se', 'nem', 'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em',
  'a', 'o', 'as', 'os', 'ao', 'aos', 'à', 'às', 'por', 'pois', 'até', 'ante', 'após', 'sob',
  'sobre', 'entre', 'contra', 'desde', 'durante', 'sem', 'via',
  'é', 'foi', 'era', 'será', 'está', 'estava', 'ficou', 'parece', 'fica', 'são', 'eram',
  'serão', 'sendo', 'tendo',
  // artigos indefinidos
  'um', 'uma', 'uns', 'umas',
  // pronomes relativos/possessivos/demonstrativos
  'qual', 'quais', 'cujo', 'cuja', 'cujos', 'cujas',
  'meu', 'minha', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas',
  'seu', 'sua', 'seus', 'suas', 'nosso', 'nossa', 'nossos', 'nossas',
  'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
  'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'isso', 'aquilo',
  // advérbios comparativos/intensificadores pendentes
  'mais', 'tão', 'menos', 'muito', 'muita', 'muitos', 'muitas', 'pouco', 'pouca', 'tanto', 'tanta',
  // verbos auxiliares/modais sem complemento
  'vai', 'vou', 'vamos', 'vão', 'vais', 'pode', 'podem', 'posso', 'podemos',
  'quer', 'querem', 'quero', 'queremos', 'deve', 'devem', 'devo', 'devemos',
  'vem', 'vêm', 'têm', 'tem', 'consegue', 'conseguem', 'precisa', 'precisam',
  // conjunções subordinativas
  'porque', 'quando', 'embora', 'caso', 'enquanto', 'portanto', 'então', 'logo', 'assim',
  'contudo', 'todavia', 'entretanto', 'porém',
]);

// Consoantes finais raras em palavras nativas do português — sinal de
// truncamento no meio de um token (ex.: "result" em vez de "resultado").
const ATYPICAL_FINAL_CONSONANTS = /[bcdfghjkpqtvwy]$/i;

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function lastToken(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words[words.length - 1] || '';
}

// Item 1: detecta finalização "pendurada" — palavra que sugere corte
// (conjunção/preposição/pronome/auxiliar sem complemento) ou pontuação de
// transição (vírgula, dois-pontos, hífen, reticências).
export function checkDanglingEnding(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (/[,;:\-–—]$/.test(trimmed) || /\.\.\.$|…$/.test(trimmed)) {
    return 'termina com pontuação de transição (vírgula/dois-pontos/hífen/reticências), sugerindo corte';
  }

  const last = lastToken(trimmed).replace(/[.!?,;:'"()«»“”]+$/g, '');
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

const QUESTION_STARTERS = /^(por que|por quê|como|quando|onde|qual|quais|quem|o que|que|será que|pra que|para que|quanto|quanta|quantos|quantas)\b/i;

// Itens 2/4: pontuação final esperada por tipo de campo + parênteses/aspas
// desbalanceados (sinal de frase quebrada).
export function checkPunctuation(text: string, kind: 'titulo' | 'texto' | 'legenda'): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const opens = (trimmed.match(/\(/g) || []).length;
  const closes = (trimmed.match(/\)/g) || []).length;
  if (opens !== closes) return 'parênteses desbalanceados';
  const quotes = (trimmed.match(/"/g) || []).length;
  if (quotes % 2 !== 0) return 'aspas desbalanceadas';

  if (kind === 'titulo') {
    const isPergunta = QUESTION_STARTERS.test(trimmed);
    if (isPergunta && !/\?$/.test(trimmed)) {
      return 'título é uma pergunta mas não termina com "?"';
    }
    if (!isPergunta && /[.!]$/.test(trimmed)) {
      return 'título não-pergunta termina com ponto/exclamação (deveria não ter pontuação final)';
    }
    return null;
  }

  if (kind === 'legenda') {
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

const HASHTAG_RE = /^#[a-z0-9]+$/;

// REGRA DE LEGENDA (organizaMethodEngine.ts, generate-caption.ts) — vale para
// feed estático, carrossel, reels, estático final e Post Único: 3 parágrafos
// separados por linha em branco — corpo (até LEGENDA_CORPO_MAX_WORDS palavras,
// termina em ./!/?), CTA (até LEGENDA_CTA_MAX_WORDS palavras, termina em
// ./!/?) e, por último, EXATAMENTE LEGENDA_HASHTAGS hashtags minúsculas, sem
// acento e sem caracteres especiais. Eventual parágrafo de assinatura entre o
// CTA e as hashtags não conta nos limites. Reprova quando essa estrutura não
// é respeitada, para que a regeneração (E3) recupere CTA + hashtags ausentes
// ou corte o que excede o limite de palavras.
export const LEGENDA_CORPO_MAX_WORDS = 35;
export const LEGENDA_CTA_MAX_WORDS = 5;
export const LEGENDA_HASHTAGS = 3;

export function checkLegendaStructure(legenda: string): string | null {
  const trimmed = legenda.trim();
  if (!trimmed) return null;

  const hashtags = trimmed.match(/#[^\s#]+/g) || [];

  if (hashtags.length === 0) {
    return `legenda sem o parágrafo final de hashtags — faltam EXATAMENTE ${LEGENDA_HASHTAGS} (ver REGRA DE LEGENDA)`;
  }
  if (hashtags.length !== LEGENDA_HASHTAGS) {
    return `legenda com ${hashtags.length} hashtag(s) em vez de EXATAMENTE ${LEGENDA_HASHTAGS} (ver REGRA DE LEGENDA)`;
  }
  const invalid = hashtags.filter((h) => !HASHTAG_RE.test(h));
  if (invalid.length > 0) {
    return `hashtags fora do padrão — devem ser minúsculas, sem acento e sem caracteres especiais (${invalid.join(' ')})`;
  }

  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length < 3) {
    return 'legenda sem a estrutura de 3 parágrafos separados por linha em branco — corpo, CTA e hashtags (ver REGRA DE LEGENDA)';
  }

  const lastPara = paragraphs[paragraphs.length - 1];
  if (!/^#/.test(lastPara)) {
    return 'parágrafo final da legenda não está isolado apenas com as hashtags (ver REGRA DE LEGENDA)';
  }

  const ctaPara = paragraphs[paragraphs.length - 2];
  if (!/[.!?]$/.test(ctaPara)) {
    return 'parágrafo de CTA da legenda não termina com ponto final (ver REGRA DE LEGENDA)';
  }

  if (paragraphs.length !== 3) {
    return `legenda com ${paragraphs.length} parágrafos em vez de EXATAMENTE 3 — corpo, CTA e hashtags (ver REGRA DE LEGENDA)`;
  }

  const corpoWords = paragraphs[0].split(/\s+/).filter(Boolean).length;
  if (corpoWords > LEGENDA_CORPO_MAX_WORDS) {
    return `corpo da legenda com ${corpoWords} palavras — acima do máximo de ${LEGENDA_CORPO_MAX_WORDS} (ver REGRA DE LEGENDA)`;
  }

  const ctaWords = ctaPara.split(/\s+/).filter(Boolean).length;
  if (ctaWords > LEGENDA_CTA_MAX_WORDS) {
    return `CTA da legenda com ${ctaWords} palavras — acima do máximo de ${LEGENDA_CTA_MAX_WORDS} (ver REGRA DE LEGENDA)`;
  }

  return null;
}

// Verbos no imperativo dirigido ao leitor — marcam uma frase como CTA
// ("chamada para ação"). Usado para detectar quando o corpo da legenda (ou o
// "texto" do Post Único) termina com uma frase que duplica o parágrafo/campo
// de CTA dedicado.
const CTA_IMPERATIVE_RE = /^(compartilhe|salve|comente|marque|acesse|confira|aproveite|garanta|conhe[cç]a|saiba|visite|clique|siga|envie|chame|fale|pe[cç]a|agende|baixe|curta|deixe|mande|venha|descubra|corra|reserve|adquira|solicite|celebre|participe|inscreva-se|cadastre-se|entre em contato|n[aã]o perca|responda|vote|avalie|experimente|escolha)\b/i;

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g) || [];
}

// Remove a última frase de um texto quando ela é uma chamada para ação no
// imperativo (ex.: "Confira mais.") E existe pelo menos outra frase antes —
// evita esvaziar o texto e só age quando a frase de CTA é redundante.
export function stripTrailingCtaSentence(text: string): string {
  const trimmed = text.trim();
  const sentences = splitSentences(trimmed);
  if (sentences.length < 2) return trimmed;
  const last = sentences[sentences.length - 1].trim();
  if (!CTA_IMPERATIVE_RE.test(last)) return trimmed;
  return sentences.slice(0, -1).map((s) => s.trim()).join(' ');
}

// Normaliza a legenda (corpo + CTA + hashtags, ver REGRA DE LEGENDA) para
// corrigir dois defeitos recorrentes do modelo:
// 1) o corpo termina com uma frase de CTA própria, duplicando o parágrafo 2;
// 2) o parágrafo de CTA traz uma 2ª frase/linha de "CTA indireto" (ex.:
//    "Acesse a bio... ou site...") ou parágrafos extras antes das hashtags.
// Roda ANTES da validação D1, para reduzir regenerações (E3) desnecessárias.
export function normalizeLegenda(legenda: string): string {
  const trimmed = legenda.trim();
  if (!trimmed) return trimmed;

  let paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length < 2) return trimmed;

  const lastIdx = paragraphs.length - 1;
  const isHashtagsLast = /^#/.test(paragraphs[lastIdx]);

  // Garante exatamente 3 parágrafos quando há hashtags isoladas no fim:
  // corpo, CTA e hashtags — descarta parágrafos extras de CTA indireto.
  if (isHashtagsLast && paragraphs.length > 3) {
    paragraphs = [paragraphs[0], paragraphs[1], paragraphs[lastIdx]];
  }

  paragraphs[0] = stripTrailingCtaSentence(paragraphs[0]);

  // Parágrafo de CTA: mantém só a primeira linha/frase — descarta CTA
  // indireto (bio/site) colado junto do CTA direto.
  const ctaIdx = paragraphs.length - 2;
  if (ctaIdx > 0) {
    const lines = paragraphs[ctaIdx].split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      paragraphs[ctaIdx] = lines[0];
    } else {
      const sentences = splitSentences(paragraphs[ctaIdx]);
      if (sentences.length > 1) {
        paragraphs[ctaIdx] = sentences[0].trim();
      }
    }
  }

  return paragraphs.join('\n\n');
}

// Aplica a REGRA DE LEGENDA cortando mecanicamente o que excede o limite:
// corpo até LEGENDA_CORPO_MAX_WORDS palavras, CTA até LEGENDA_CTA_MAX_WORDS
// palavras, e no máximo LEGENDA_HASHTAGS hashtags. Espera a estrutura já
// normalizada por normalizeLegenda (corpo, CTA, [assinatura,] hashtags) — um
// eventual parágrafo de assinatura entre o CTA e as hashtags é preservado
// sem entrar na contagem. Se a estrutura não tiver hashtags ao final, devolve
// o texto como veio (cabe ao D1/E3 corrigir a estrutura antes do corte).
export function enforceLegendaLimits(legenda: string): string {
  const trimmed = legenda.trim();
  if (!trimmed) return trimmed;

  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length < 3) return trimmed;

  const lastIdx = paragraphs.length - 1;
  if (!/^#/.test(paragraphs[lastIdx])) return trimmed;

  paragraphs[0] = truncateWords(paragraphs[0], LEGENDA_CORPO_MAX_WORDS);
  if (paragraphs[0] && !/[.!?]$/.test(paragraphs[0])) paragraphs[0] += '.';

  const ctaIdx = lastIdx - 1;
  let cta = truncateWords(paragraphs[ctaIdx], LEGENDA_CTA_MAX_WORDS);
  if (cta && !/[.!?]$/.test(cta)) cta += '.';
  paragraphs[ctaIdx] = cta;

  const hashtags = paragraphs[lastIdx].match(/#[^\s#]+/g) || [];
  if (hashtags.length > LEGENDA_HASHTAGS) {
    paragraphs[lastIdx] = hashtags.slice(0, LEGENDA_HASHTAGS).join(' ');
  }

  return paragraphs.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────
// Item 5 — repetição morfológica (stemming leve de sufixos PT comuns)
// ─────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'e', 'ou', 'mas', 'que', 'se', 'nem', 'para', 'com', 'por', 'ao', 'aos', 'à', 'às',
  'é', 'são', 'foi', 'era', 'será', 'está', 'estava', 'ser', 'ter', 'tem', 'têm',
  'seu', 'sua', 'seus', 'suas', 'este', 'esta', 'esse', 'essa', 'isso', 'isto',
  'mais', 'menos', 'muito', 'muita', 'pouco', 'pouca', 'já', 'não', 'sem', 'sobre', 'entre', 'até',
  'como', 'quando', 'onde', 'qual', 'quem', 'você', 'nosso', 'nossa', 'pelo', 'pela', 'pelos', 'pelas',
]);

const STEM_SUFFIXES = [
  'acoes', 'acao', 'agens', 'agem', 'mente', 'ando', 'endo', 'indo',
  'ados', 'adas', 'idos', 'idas', 'ado', 'ada', 'ido', 'ida',
  'avel', 'aveis', 'oso', 'osa', 'osos', 'osas',
  'al', 'ais', 'ar', 'er', 'ir', 'es', 'os', 'as', 'a', 'o', 'e', 's',
];

function stem(word: string): string {
  let w = stripAccents(word.toLowerCase()).replace(/[^a-z]/g, '');
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

const HARD_OFFER_TERMS = ['grátis', 'gratuito', 'gratuita', 'garantido', 'garantida', 'garantia', 'frete grátis', 'sem juros', 'cashback'];

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
  const keyNorm = normalizeForCompare(keyInfo || '');
  if (!keyNorm) return flags;

  for (const pattern of NUMERIC_CLAIM_PATTERNS) {
    const matches = text.match(pattern) || [];
    for (const raw of matches) {
      const token = raw.trim();
      const digits = token.replace(/[^\d]/g, '');
      if (!digits) continue;
      if (!keyNorm.includes(digits)) {
        flags.push(`menciona "${token}" sem respaldo na informação-chave`);
      }
    }
  }

  const textNorm = normalizeForCompare(text);
  for (const term of HARD_OFFER_TERMS) {
    const termNorm = normalizeForCompare(term);
    const firstWord = termNorm.split(' ')[0];
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
// ("Fila cresce"); acima de 6, não cabe na régua tipográfica do método.
const TITULO_MIN_WORDS = 4;
const TITULO_MAX_WORDS = 6;

// ANCORAGEM CONCRETA — ANTI-SÍMBOLO (organizaMethodEngine.ts,
// generate-pu-copy.ts): "[abstrato] faz/traz/gera/vira/se torna/transforma
// [outro abstrato]" — sujeito e predicado abstratos, sem cena fotografável
// (ex.: "Responder faz diferença de verdade"). Reforça no D1 a regra do
// prompt para o caso em que o modelo ainda assim a produzir.
const ABSTRACT_PREDICATE_RE = /\b(faz|fazem|traz|trazem|gera|geram|vira|viram|transforma|transformam|se\s+torna|se\s+tornam)\s+(a\s+|o\s+|uma?\s+|um\s+)?(diferen[çc]as?|resultados?|mudan[çc]as?|sucesso|crescimento|solu[çc][õo]es?|valor|oportunidades?)\b/i;

export function checkAbstractPredicate(titulo: string): string | null {
  const m = titulo.match(ABSTRACT_PREDICATE_RE);
  if (m) return `título usa padrão "${m[0]}" — predicado abstrato sem cena fotografável (ANTI-SÍMBOLO)`;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Medida C (sequência MOP) — "rótulo do leitor" como sujeito do título
// substitui a FORMA do estágio que o título deveria entregar (ver item 11 /
// FUNÇÕES COMUNICATIVAS POR PEÇA em organizaMethodEngine.ts): em vez de
// observação, critério, prova, posicionamento ou convite, o título descreve
// quem decide/usa/cuida de fora. Chamadas só por normalizeMethodResult
// (sequência MOP) — não entra em validateTitulo/validatePieceFields, então
// não afeta o Post Único.
// ─────────────────────────────────────────────────────────────────────────

const OBSERVER_NOUNS = '(?:gestor(?:es)?|decisor(?:es)?|equipes?|times?|administrador(?:es)?|respons[áa]ve(?:l|is)|profissionais)';
// Verbos de estado/percepção/decisão que, após "quem", descrevem o leitor de
// fora (ex.: "Quem usa decide", "Quem cuida pensa") — diferente de um título
// tipo "Quem registra vendas controla estoque", que é uma observação sobre um
// PROCESSO (ação → consequência), não um rótulo do leitor.
const OBSERVER_QUEM_VERBS = '(?:cuida|cuidam|usa|usam|decide|decidem|escolhe|escolhem|administra|administram|gerencia|gerenciam|pensa|pensam|sabe|sabem|entende|entendem|percebe|percebem|prefere|preferem|confia|confiam|busca|buscam|precisa|precisam|quer|querem|vive|vivem|resolve|resolvem)';
const OBSERVER_SUBJECT_RE = new RegExp(`^(?:quem\\s+${OBSERVER_QUEM_VERBS}|(?:a|as|o|os)\\s+${OBSERVER_NOUNS}|${OBSERVER_NOUNS})\\b`, 'i');
const OBSERVER_LABEL_RE = new RegExp(`\\b${OBSERVER_NOUNS}\\b`, 'i');

export function checkObserverSubject(titulo: string): string | null {
  const m = titulo.trim().match(OBSERVER_SUBJECT_RE);
  if (!m) return null;
  return `título abre nomeando o leitor de fora ("${m[0]}") — entregue a FORMA do estágio (observação, critério, prova, posicionamento ou convite, ver item 11) em vez de descrever quem decide/usa/cuida`;
}

function canonicalObserverLabel(word: string): string {
  const w = stripAccents(word.toLowerCase());
  if (w.startsWith('gestor')) return 'gestor';
  if (w.startsWith('decisor')) return 'decisor';
  if (w.startsWith('equipe')) return 'equipe';
  if (w.startsWith('time')) return 'time';
  if (w.startsWith('administrador')) return 'administrador';
  if (w.startsWith('responsave')) return 'responsavel';
  if (w.startsWith('profissio')) return 'profissional';
  return w;
}

// Flaga quando o mesmo rótulo do leitor (gestor/decisor/equipe/time...)
// aparece nos títulos de mais de uma peça da sequência — sinal de que o
// rótulo está substituindo a FORMA específica de cada estágio.
export function checkCrossPieceLabelRepeat(pieces: { campo: string; titulo: string }[]): ValidationFlag[] {
  const flags: ValidationFlag[] = [];
  const seen = new Map<string, string>();
  for (const { campo, titulo } of pieces) {
    const m = titulo.match(OBSERVER_LABEL_RE);
    if (!m) continue;
    const label = canonicalObserverLabel(m[0]);
    const prevCampo = seen.get(label);
    if (prevCampo) {
      flags.push({ campo: `${campo}.titulo`, motivo: `título repete o rótulo do leitor ("${m[0]}"), já usado em ${prevCampo} — varie o sujeito ou entregue a FORMA do estágio sem rotular o leitor` });
    } else {
      seen.set(label, campo);
    }
  }
  return flags;
}

export function validateTitulo(titulo: string): string[] {
  const motivos: string[] = [];
  const words = titulo.trim().split(/\s+/).filter(Boolean).length;
  if (words < TITULO_MIN_WORDS) motivos.push(`título com ${words} palavra(s) — abaixo do mínimo de ${TITULO_MIN_WORDS}`);
  if (words > TITULO_MAX_WORDS) motivos.push(`título com ${words} palavras — acima do máximo de ${TITULO_MAX_WORDS}`);
  const dangling = checkDanglingEnding(titulo);
  if (dangling) motivos.push(dangling);
  const punct = checkPunctuation(titulo, 'titulo');
  if (punct) motivos.push(punct);
  const abstractPredicate = checkAbstractPredicate(titulo);
  if (abstractPredicate) motivos.push(abstractPredicate);
  return motivos;
}

export function validateTexto(texto: string): string[] {
  const motivos: string[] = [];
  const dangling = checkDanglingEnding(texto);
  if (dangling) motivos.push(dangling);
  const punct = checkPunctuation(texto, 'texto');
  if (punct) motivos.push(punct);
  return motivos;
}

export function validateLegenda(legenda: string): string[] {
  const motivos: string[] = [];
  const punct = checkPunctuation(legenda, 'legenda');
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
];

// Validação leve da sugestão/keyInfo gerada pelo botão "Sugestão": comprimento
// (ideal 5-10, máx. 12), terminação pendurada e frases-clichê genéricas. Não
// inclui checagem de ancoragem com mainActivity de propósito — uma sugestão
// concreta pode não repetir nenhuma palavra literal da atividade, e isso não
// deve reprová-la (decisão de produto).
export function validateSugestao(sugestao: string, maxWords = 12): string[] {
  const trimmed = sugestao.trim();
  const motivos: string[] = [];
  if (!trimmed) return ['sugestão vazia'];

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (words < 4) motivos.push(`sugestão muito curta (${words} palavra(s)) — abaixo do mínimo de 4`);
  if (words > maxWords) motivos.push(`sugestão com ${words} palavras — acima do máximo de ${maxWords}`);

  const dangling = checkDanglingEnding(trimmed);
  if (dangling) motivos.push(dangling);

  if (SUGESTAO_GENERIC_PATTERNS.some((re) => re.test(trimmed))) {
    motivos.push('sugestão usa frase genérica/clichê — falta concretude');
  }

  return motivos;
}

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
  { label: 'promoção/promocional', re: /\bpromoc/ },
  { label: 'desconto', re: /\bdesconto/ },
  { label: 'oferta', re: /\boferta/ },
  { label: 'lançamento', re: /\blancamento/ },
  { label: 'liquidação/saldão', re: /\bliquidac|\bsaldao/ },
  { label: 'agenda/vagas aberta(s)', re: /\b(agenda|vagas?)\s+abert/ },
];

const INVENTED_PROMO_SPECIFIC_GROUPS: { label: string; re: RegExp }[] = [
  { label: 'percentual (%) / "off"', re: /\d+\s*%|\boff\b/ },
  { label: 'valor em reais (R$)', re: /r\$\s*[\d.,]+/ },
  { label: 'brinde/grátis/cortesia', re: /\bbrinde|\bgratis|\bgratuit|\bcortesia/ },
  { label: 'condição de compra (acima de, a partir de, sem juros...)', re: /\b(acima de|a partir de|na compra de|compre\s+e\s+ganhe|sem juros)\b/ },
  {
    label: 'prazo/data/urgência (hoje, até X, esta semana, última chance...)',
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
export function checkInventedPromotion(sugestao: string, allowedContext: string, opts?: { allowPromoLanguage?: boolean }): string[] {
  const motivos: string[] = [];
  const sugNorm = normalizeForCompare(sugestao);
  const ctxNorm = normalizeForCompare(allowedContext);

  const groups = opts?.allowPromoLanguage ? INVENTED_PROMO_SPECIFIC_GROUPS : INVENTED_PROMO_GROUPS;
  for (const { label, re } of groups) {
    if (re.test(sugNorm) && !re.test(ctxNorm)) {
      motivos.push(`sugestão inventa "${label}" sem isso constar na informação/contexto do usuário`);
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
    if (m) return [`sugestão usa fala de fornecedor/catálogo ("${m[0]}") em vez de algo que o cliente diria, perguntaria, sentiria ou viveria`];
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// E4 — limpeza determinística (fallback final, sem chamada de API)
// ─────────────────────────────────────────────────────────────────────────

// Aplicada quando a regeneração via regenerate-block (E3) esgota as
// tentativas e o campo ainda reprova D1. Corta para a última frase completa
// (se houver), remove palavra(s) final(is) que sugerem corte e repontua —
// um título de 4 palavras limpo é melhor que um de 6 quebrado.
export function applyDeterministicFallback(value: string, kind: 'titulo' | 'texto' | 'legenda'): string {
  let text = value.trim();
  if (!text) return text;

  if (kind === 'legenda') {
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
  if (kind === 'titulo') {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > TITULO_MAX_WORDS) {
      text = words.slice(0, TITULO_MAX_WORDS).join(' ').replace(/[,;:\-–—]+$/, '').trim();
    }
  }

  for (let i = 0; i < 3; i++) {
    if (!checkDanglingEnding(text)) break;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) break;
    words.pop();
    text = words.join(' ').replace(/[,;:\-–—]+$/, '').trim();
  }

  if (kind === 'texto') {
    if (!/[.!?]$/.test(text)) text += '.';
  } else {
    const isPergunta = QUESTION_STARTERS.test(text);
    text = text.replace(/[.!]+$/, '');
    if (isPergunta) {
      if (!/\?$/.test(text)) text += '?';
    } else {
      text = text.replace(/\?+$/, '');
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
  keyInfo?: string
): ValidationFlag[] {
  const flags: ValidationFlag[] = [];

  if (fields.titulo) {
    for (const motivo of validateTitulo(fields.titulo)) flags.push({ campo: `${prefix}.titulo`, motivo });
  }
  if (fields.texto) {
    for (const motivo of validateTexto(fields.texto)) flags.push({ campo: `${prefix}.texto`, motivo });
  }
  if (fields.legenda) {
    for (const motivo of validateLegenda(fields.legenda)) flags.push({ campo: `${prefix}.legenda`, motivo });
  }

  const morphTexts = [fields.titulo, fields.texto].filter((t): t is string => !!t);
  if (morphTexts.length > 1) {
    const morph = checkMorphRepetition(morphTexts);
    if (morph) flags.push({ campo: prefix, motivo: morph });
  }

  if (keyInfo) {
    const combined = [fields.titulo, fields.texto, fields.legenda].filter(Boolean).join(' ');
    for (const motivo of checkNumericClaims(combined, keyInfo)) {
      flags.push({ campo: prefix, motivo });
    }
  }

  return flags;
}
