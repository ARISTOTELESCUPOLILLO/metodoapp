import { createFileRoute } from "@tanstack/react-router";
import {
  checkBalance,
  debitUsage,
  resolveEffectiveUser,
  balanceFailMessage,
} from "@/lib/usage.server";
import { COST_USD } from "@/lib/costs";
import { getVoiceProfile } from "@/data/brandVoice";
import {
  stripTrailingCtaSentence,
  truncateWords,
  normalizeForCompare,
  LEGENDA_CORPO_MAX_WORDS,
  LEGENDA_CTA_MAX_WORDS,
  TECNICISMO_RULE,
} from "@/core/textValidation";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import {
  OBJETIVO_TOM,
  OBJETIVO_CTA_FALLBACK,
  OBJETIVO_HASHTAG_FALLBACK,
} from "@/domain/objetivo.config";

const HASHTAG_FALLBACK_STOPWORDS = new Set([
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
  "nos",
  "nas",
  "uma",
  "uns",
  "umas",
  "que",
  "por",
  "sobre",
  "entre",
  "mais",
  "menos",
]);

// Deriva até 3 hashtags a partir de palavras significativas do negócio
// (atividade, nome da empresa, informação-chave) — usado só quando o modelo
// não retornou as 3 hashtags esperadas mesmo após retry.
function deriveFallbackHashtags(
  mainActivity: string,
  companyName: string,
  keyInfo: string,
  sanitizeTag: (t: string) => string,
): string[] {
  const words = `${mainActivity} ${companyName} ${keyInfo}`.split(/[^\p{L}0-9]+/u).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if (w.length < 4 || HASHTAG_FALLBACK_STOPWORDS.has(w.toLowerCase())) continue;
    const tag = sanitizeTag(w);
    if (!tag || tag.length < 4 || out.includes(tag)) continue;
    out.push(tag);
    if (out.length >= 3) break;
  }
  return out;
}

// Compara a abertura (6 primeiras palavras, normalizadas) do novo "texto" com
// a legenda anterior — usado para forçar uma nova tentativa quando a
// regeneração da PU volta com abertura igual à anterior.
function openingWords(text: string, n: number): string {
  return normalizeForCompare(text)
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, n)
    .join(" ");
}

function isCaptionTooSimilar(novoTexto: string, anterior: string): boolean {
  if (!novoTexto || !anterior) return false;
  const a = openingWords(novoTexto, 6);
  const b = openingWords(anterior, 6);
  return !!a && a === b;
}

// PROIBIDO ABSOLUTO (D1/E4) — formas substantivas (singular/plural) dos termos
// que são nomes/códigos internos do sistema (ângulos "OP-0X"). Substitui por
// sinônimos seguros e remove os códigos "OP-01".."OP-06" e "mood". Variantes
// morfológicas (adjetivos/verbos como "claro", "impactante", "desviar") são
// palavras de uso comum demais para trocar sem risco de soar estranho — ficam
// de fora: na dúvida, a palavra permanece.
const FORBIDDEN_NOUNS: { re: RegExp; singular: string; plural: string }[] = [
  { re: /\bclareza(s)?\b/gi, singular: "direção definida", plural: "direções definidas" },
  { re: /\bimpacto(s)?\b/gi, singular: "efeito imediato", plural: "efeitos imediatos" },
  { re: /\bsilêncio(s)?\b/gi, singular: "respiro", plural: "respiros" },
  { re: /\binstante(s)?\b/gi, singular: "momento", plural: "momentos" },
  { re: /\bfragmento(s)?\b/gi, singular: "recorte", plural: "recortes" },
  { re: /\bdesvio(s)?\b/gi, singular: "outro caminho", plural: "outros caminhos" },
];

// Substitui os termos de FORBIDDEN_NOUNS e remove códigos internos ("OP-01"
// a "OP-06", "mood"), limpando espaços/pontuação deixados pela remoção.
function sanitizeForbiddenTerms(text: string): string {
  let out = text;
  for (const { re, singular, plural } of FORBIDDEN_NOUNS) {
    out = out.replace(re, (_m, suffix) => (suffix ? plural : singular));
  }
  out = out.replace(/\bOP-0[1-6]\b/gi, "").replace(/\bmood\b/gi, "");
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

// PROIBIDO ABSOLUTO em hashtags — aqui o filtro pode ser mais agressivo que em
// FORBIDDEN_NOUNS: descartar uma hashtag não corrompe frase nenhuma, a
// derivação/fallback preenche a vaga. Inclui também as variantes
// adjetivas/verbais (claro, impactante, desviar...), já sem acento, pois
// sanitizeTag normaliza antes da comparação.
const FORBIDDEN_HASHTAG_STEMS = new Set([
  "clareza",
  "clarezas",
  "claro",
  "clara",
  "claros",
  "claras",
  "impacto",
  "impactos",
  "impactar",
  "impactante",
  "instante",
  "instantes",
  "instantaneo",
  "instantanea",
  "fragmento",
  "fragmentos",
  "fragmentado",
  "fragmentada",
  "desvio",
  "desvios",
  "desviar",
  "silencio",
  "silencios",
  "silencioso",
  "silenciosa",
  "silenciar",
  "op01",
  "op02",
  "op03",
  "op04",
  "op05",
  "op06",
  "mood",
]);

export const Route = createFileRoute("/api/generate-caption")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const companyName = String(body.companyName || "").slice(0, 200);
          const mainActivity = String(body.mainActivity || "").slice(0, 300);
          const objetivo = String(body.objetivo || "promocao");
          const keyInfo = String(body.keyInfo || "").slice(0, 1000);
          const brandVoice = String(body.brandVoice || "").slice(0, 80);
          const previousCaption = body.previousCaption
            ? String(body.previousCaption).slice(0, 400)
            : null;
          const debit = body.debit === true;
          const preferredSlot = ["plano1", "plano2", "bonus"].includes(body.preferredSlot)
            ? (body.preferredSlot as "plano1" | "plano2" | "bonus")
            : undefined;

          if (!keyInfo.trim()) {
            return Response.json({ error: "keyInfo obrigatório" }, { status: 400 });
          }

          // Autenticação obrigatória em todos os casos.
          const effective = await resolveEffectiveUser(request);
          if (!effective) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          const userId = effective.userId;
          const impersonatedBy = effective.impersonatedBy;
          let isAdmin = false;

          // Débita geração apenas no clique inicial "Gerar Post Único".
          // preferredSlot é passado aqui (mesmo slot usado no debitUsage abaixo)
          // para o saldo verificado ser o mesmo slot efetivamente debitado —
          // sem isso, esta checagem caía no fallback "qualquer slot serve" e
          // podia liberar a geração mesmo quando o slot preferido não tinha saldo.
          if (debit) {
            const bal = await checkBalance(userId, 0, 0, 1, preferredSlot);
            if (!bal.ok) {
              return Response.json({ error: balanceFailMessage(bal.reason) }, { status: 402 });
            }
            isAdmin = bal.isAdmin;
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json(
              { error: "OPENAI_API_KEY_CONTENT não configurada" },
              { status: 500 },
            );
          }

          const tom = OBJETIVO_TOM[objetivo as keyof typeof OBJETIVO_TOM] ?? OBJETIVO_TOM.promocao;
          const voiceProfile = getVoiceProfile(brandVoice);
          const voiceBlock = voiceProfile
            ? `DIREÇÃO DE VOZ — "${voiceProfile.label}":
- Ritmo: ${voiceProfile.ritmo}
- Vocabulário: ${voiceProfile.vocabulario}
- Registro: ${voiceProfile.registro}
- Evitar: ${voiceProfile.evitar}
- Calibração de abertura (referência interna, NÃO copiar literalmente): "${voiceProfile.exemploAbertura}"
Quando houver conflito entre tom do objetivo e direção de voz, PREVALECE a voz; o objetivo modula apenas a intenção comercial.
Proibido mencionar literalmente o nome da voz no texto final.
`
            : "";

          const previousBlock = previousCaption
            ? `LEGENDA ANTERIOR GERADA (a nova versão precisa ser REALMENTE DIFERENTE): "${previousCaption}"\nNA NOVA VERSÃO: comece com uma frase de abertura diferente, use um novo CTA (diferente do anterior) e, quando possível, novas hashtags — não repita a estrutura, a frase inicial nem as palavras-chave principais da legenda anterior.\n`
            : "";

          const userPrompt = `Gere a legenda de um post de Instagram em português brasileiro.

EMPRESA: ${companyName}
ATIVIDADE: ${mainActivity}
${voiceBlock}${previousBlock}OBJETIVO: ${objetivo} (tom: ${tom})
INFORMAÇÃO-CHAVE: "${keyInfo.trim()}"

Retorne JSON com EXATAMENTE este formato:
{
  "texto": "frase principal da legenda, até ${LEGENDA_CORPO_MAX_WORDS} palavras, no tom certo, sem hashtags e sem emojis exagerados, sem repetir o título/informação-chave inteira nem abrir assunto novo",
  "cta": "uma chamada para ação que complementa o texto principal, até ${LEGENDA_CTA_MAX_WORDS} palavras, sem hashtag",
  "hashtags": ["tag1", "tag2", "tag3"]
}

Regras:
- Português brasileiro, sem inglês, sem markdown.
- "hashtags" relevantes ao segmento e à informação-chave.
- PROIBIDO repetir a mesma palavra OU qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue — todas proibidas juntas no mesmo texto) em frases próximas ou consecutivas. Use sinônimos ou reformule completamente. Ex. a evitar: "O digital traz mais alcance. Quer mais? Venha saber mais." — correto: "O digital amplia seu alcance. Quer crescer? Conheça nossa solução."
${TECNICISMO_RULE}
- Respeitar rigorosamente as normas gramaticais e ortográficas do português brasileiro: concordância nominal e verbal, pontuação correta, acentuação gráfica conforme o Acordo Ortográfico vigente. Nenhum erro de gramática, ortografia ou regência será tolerado.
${objetivo === "institucional" ? `- REGRA INSTITUCIONAL — ATEMPORALIDADE OBRIGATÓRIA: ignore datas e marcos temporais da informação-chave. Foque exclusivamente no SERVIÇO, na CAPACIDADE ou no POSICIONAMENTO da empresa. PROIBIDO no texto, CTA e hashtags: datas, urgência, "a partir de", "lançamento", "em breve". OBRIGATÓRIO: atemporalidade, posicionamento sóbrio, autoridade de marca.` : ""}
${objetivo === "homenagem" ? `- REGRA HOMENAGEM — DATAS SÃO CONTEXTO, NÃO URGÊNCIA: datas na informação-chave situam a conquista ou o evento comemorado — NUNCA geram urgência. PROIBIDO no texto, CTA e hashtags: "não perca", "somente até", "a partir de", urgência qualquer. O copy celebra com emoção — não pressiona.` : ""}`;

          const sanitizeTag = (t: string) =>
            t
              .toLowerCase()
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .replace(/[^a-z0-9]/g, "")
              .slice(0, 30);

          // Se o modelo não retornar nada para "cta" e/ou "hashtags", repete a
          // chamada uma vez antes de seguir para o ajuste determinístico (D1/E4)
          // abaixo, que cuida de tamanho, CTA embutido no texto, hashtags e
          // palavras proibidas — o modelo só escreve, o código ajusta as regras.
          const MAX_CAPTION_ATTEMPTS = 2;
          let rawTexto = "";
          let rawCta = "";
          let rawHashtags: string[] = [];

          let retryInstruction = "";
          for (let attempt = 1; attempt <= MAX_CAPTION_ATTEMPTS; attempt++) {
            const result = await fetchOpenAIChat(apiKey, {
              model: "gpt-4.1-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "Você é redator publicitário brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido.",
                },
                {
                  role: "user",
                  content: attempt === 1 ? userPrompt : `${userPrompt}\n\n${retryInstruction}`,
                },
              ],
              temperature: 0.9,
              response_format: { type: "json_object" },
            });

            if (!result.ok) {
              return Response.json({ error: result.error }, { status: result.status });
            }
            const content = result.data.choices?.[0]?.message?.content;
            if (!content) return Response.json({ error: "Resposta vazia" }, { status: 502 });

            let parsed: { texto?: string; cta?: string; hashtags?: unknown };
            try {
              parsed = JSON.parse(content);
            } catch {
              return Response.json({ error: "JSON inválido" }, { status: 502 });
            }

            rawTexto = String(parsed.texto || "").trim();
            rawCta = String(parsed.cta || "").trim();
            rawHashtags = Array.isArray(parsed.hashtags)
              ? parsed.hashtags.map((t) => sanitizeTag(String(t))).filter(Boolean)
              : [];

            const fieldsOk = rawCta !== "" && rawHashtags.length > 0;
            if (!fieldsOk) {
              retryInstruction = `ATENÇÃO: a resposta anterior não preencheu "cta" e/ou "hashtags". Garanta que os três campos do JSON — "texto", "cta" e "hashtags" — estejam preenchidos.`;
              continue;
            }

            if (previousCaption && isCaptionTooSimilar(rawTexto, previousCaption)) {
              retryInstruction = `ATENÇÃO: a resposta anterior começou com a mesma abertura da legenda anterior. Reescreva com uma frase de abertura DIFERENTE, novo CTA e, se possível, novas hashtags.`;
              continue;
            }

            break;
          }

          // D1/E4 — ajuste determinístico do que antes era pedido ao modelo:
          // remove CTA embutido no fim do "texto", troca/remove palavras
          // proibidas, acerta tamanho e pontuação de "texto"/"cta", e garante
          // exatamente 3 hashtags válidas.
          let textoValue = stripTrailingCtaSentence(rawTexto);
          textoValue = sanitizeForbiddenTerms(textoValue);
          textoValue = truncateWords(textoValue, LEGENDA_CORPO_MAX_WORDS);
          if (textoValue && !/[.!?]$/.test(textoValue)) textoValue += ".";

          let ctaValue = sanitizeForbiddenTerms(rawCta);
          if (!ctaValue)
            ctaValue = OBJETIVO_CTA_FALLBACK[objetivo as keyof typeof OBJETIVO_CTA_FALLBACK] ?? OBJETIVO_CTA_FALLBACK.promocao;
          ctaValue = truncateWords(ctaValue, LEGENDA_CTA_MAX_WORDS);
          if (!/[.!?]$/.test(ctaValue)) ctaValue += ".";

          let hashtagsArr = rawHashtags.filter((t) => !FORBIDDEN_HASHTAG_STEMS.has(t)).slice(0, 3);
          if (hashtagsArr.length < 3) {
            const derived = deriveFallbackHashtags(
              mainActivity,
              companyName,
              keyInfo,
              sanitizeTag,
            ).filter((t) => !hashtagsArr.includes(t) && !FORBIDDEN_HASHTAG_STEMS.has(t));
            const fallback =
              OBJETIVO_HASHTAG_FALLBACK[objetivo as keyof typeof OBJETIVO_HASHTAG_FALLBACK] ?? OBJETIVO_HASHTAG_FALLBACK.promocao;
            hashtagsArr = [...new Set([...hashtagsArr, ...derived, ...fallback])].slice(0, 3);
          }

          if (debit && userId) {
            try {
              await debitUsage(userId, 0, 0, {
                evento: "gerar_post_unico",
                modulo: "pu",
                geracoes: 1,
                custoUsd: isAdmin ? 0 : COST_USD.content_pu,
                preferredSlot,
                impersonatedBy,
              });
            } catch (e) {
              console.warn("[generate-caption] debit failed", e);
            }
          }

          const cap = (s: string) => {
            const t = s.trim();
            return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
          };
          return Response.json({
            texto: cap(textoValue),
            cta: cap(ctaValue),
            hashtags: hashtagsArr,
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
