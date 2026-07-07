import { truncateWords } from "./textWordUtils";

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
export const LEGENDA_CORPO_MAX_WORDS = 30;
export const LEGENDA_CTA_MAX_WORDS = 5;
export const LEGENDA_HASHTAGS = 3;

// Regra de substituição de tecnicismos/estrangeirismos/jargão, antes
// duplicada (com pequenas variações) em organizaMethodEngine.ts,
// generate-pu-copy.ts, generate-caption.ts e regenerate-block.ts.
export const TECNICISMO_RULE =
  '- Substituir tecnicismos, estrangeirismos e jargões por palavras populares e de fácil entendimento, mantendo clareza, naturalidade e impacto. Ex.: "expertise" → "experiência", "briefing" → "orientação", "saúde laboral" → "saúde do trabalho", "otimização" → "melhoria", "engajamento" → "envolvimento", "performance" → "desempenho", "branding" → "identidade de marca", "networking" → "contatos", "feedback" → "retorno", "ROI" → "retorno do investimento".';

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
    return `hashtags fora do padrão — devem ser minúsculas, sem acento e sem caracteres especiais (${invalid.join(" ")})`;
  }

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length < 3) {
    return "legenda sem a estrutura de 3 parágrafos separados por linha em branco — corpo, CTA e hashtags (ver REGRA DE LEGENDA)";
  }

  const lastPara = paragraphs[paragraphs.length - 1];
  if (!/^#/.test(lastPara)) {
    return "parágrafo final da legenda não está isolado apenas com as hashtags (ver REGRA DE LEGENDA)";
  }

  const ctaPara = paragraphs[paragraphs.length - 2];
  if (!/[.!?]$/.test(ctaPara)) {
    return "parágrafo de CTA da legenda não termina com ponto final (ver REGRA DE LEGENDA)";
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
const CTA_IMPERATIVE_RE =
  /^(compartilhe|salve|comente|marque|acesse|confira|aproveite|garanta|conhe[cç]a|saiba|visite|clique|siga|envie|chame|fale|pe[cç]a|agende|baixe|curta|deixe|mande|venha|descubra|corra|reserve|adquira|solicite|celebre|participe|inscreva-se|cadastre-se|entre em contato|n[aã]o perca|responda|vote|avalie|experimente|escolha)\b/i;

// "Vem"/"venha" como abertura do CTA é um clichê publicitário genérico que o
// modelo usa com muita frequência, sem ligação nenhuma com o segmento ou a
// atividade específica — some usuários notam a repetição entre posts
// diferentes. Como o CTA do Post Único é gerado campo a campo (com retry),
// esta checagem entra no loop de tentativas em generate-caption.ts; a
// legenda do MOP (1x por sequência, sem retry dedicado) depende só da
// proibição equivalente no prompt (organizaMethodEngine.ts).
export function checkCtaOpeningVem(cta: string): boolean {
  const first = cta.trim().split(/\s+/)[0] || "";
  const norm = first
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return norm === "vem" || norm === "venha";
}

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
  return sentences
    .slice(0, -1)
    .map((s) => s.trim())
    .join(" ");
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

  let paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
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
    const lines = paragraphs[ctaIdx]
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      paragraphs[ctaIdx] = lines[0];
    } else {
      const sentences = splitSentences(paragraphs[ctaIdx]);
      if (sentences.length > 1) {
        paragraphs[ctaIdx] = sentences[0].trim();
      }
    }
  }

  return paragraphs.join("\n\n");
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

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length < 3) return trimmed;

  const lastIdx = paragraphs.length - 1;
  if (!/^#/.test(paragraphs[lastIdx])) return trimmed;

  paragraphs[0] = truncateWords(paragraphs[0], LEGENDA_CORPO_MAX_WORDS);
  if (paragraphs[0] && !/[.!?]$/.test(paragraphs[0])) paragraphs[0] += ".";

  const ctaIdx = lastIdx - 1;
  let cta = truncateWords(paragraphs[ctaIdx], LEGENDA_CTA_MAX_WORDS);
  if (cta && !/[.!?]$/.test(cta)) cta += ".";
  paragraphs[ctaIdx] = cta;

  const hashtags = paragraphs[lastIdx].match(/#[^\s#]+/g) || [];
  if (hashtags.length > LEGENDA_HASHTAGS) {
    paragraphs[lastIdx] = hashtags.slice(0, LEGENDA_HASHTAGS).join(" ");
  }

  return paragraphs.join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────
// Item 5 — repetição morfológica (stemming leve de sufixos PT comuns)