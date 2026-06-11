import { createFileRoute } from '@tanstack/react-router';
import { checkBalance, debitUsage, resolveEffectiveUser } from '@/lib/usage.server';
import { getVoiceProfile } from '@/data/brandVoice';
import { fetchOpenAIChat } from '@/lib/openaiClient.server';

const OBJETIVO_TOM: Record<string, string> = {
  promocao: 'comercial, desejo, chamada para ação clara',
  homenagem: 'afetivo, respeitoso, contemplativo',
  aviso: 'institucional, claro, objetivo',
  oportunidade: 'urgência elegante, momento decisivo',
  institucional: 'institucional de marca, posicionamento, propósito, sóbrio e confiante',
};

// E4 — fallback determinístico (sem chamada extra de API) quando o modelo,
// mesmo após 1 nova tentativa, não preenche "cta" e/ou "hashtags".
const OBJETIVO_CTA_FALLBACK: Record<string, string> = {
  promocao: 'Aproveite agora.',
  homenagem: 'Celebre com a gente.',
  aviso: 'Saiba mais.',
  oportunidade: 'Garanta a sua vaga.',
  institucional: 'Conheça nosso trabalho.',
};

const OBJETIVO_HASHTAG_FALLBACK: Record<string, string[]> = {
  promocao: ['promocao', 'oferta', 'novidade'],
  homenagem: ['gratidao', 'historia', 'conquista'],
  aviso: ['aviso', 'informacao', 'novidade'],
  oportunidade: ['oportunidade', 'novidade', 'momento'],
  institucional: ['marca', 'qualidade', 'confianca'],
};

const HASHTAG_FALLBACK_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em', 'no', 'na', 'nos', 'nas',
  'uma', 'uns', 'umas', 'que', 'por', 'sobre', 'entre', 'mais', 'menos',
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

export const Route = createFileRoute('/api/generate-caption')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const companyName = String(body.companyName || '').slice(0, 200);
          const mainActivity = String(body.mainActivity || '').slice(0, 300);
          const objetivo = String(body.objetivo || 'promocao');
          const keyInfo = String(body.keyInfo || '').slice(0, 1000);
          const brandVoice = String(body.brandVoice || '').slice(0, 80);
          const previousCaption = body.previousCaption ? String(body.previousCaption).slice(0, 400) : null;
          const debit = body.debit === true;
          const preferredSlot = ['plano1', 'plano2', 'bonus'].includes(body.preferredSlot) ? body.preferredSlot as 'plano1' | 'plano2' | 'bonus' : undefined;

          if (!keyInfo.trim()) {
            return Response.json({ error: 'keyInfo obrigatório' }, { status: 400 });
          }

          // Autenticação obrigatória em todos os casos.
          const effective = await resolveEffectiveUser(request);
          if (!effective) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
          }
          const userId = effective.userId;
          const impersonatedBy = effective.impersonatedBy;
          let isAdmin = false;

          // Débita geração apenas no clique inicial "Gerar Post Único".
          if (debit) {
            const bal = await checkBalance(userId, 0, 0, 1);
            if (!bal.ok) {
              return Response.json(
                { error: 'Limite de gerações do plano atingido — fale com o admin.' },
                { status: 402 },
              );
            }
            isAdmin = bal.isAdmin;
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json({ error: 'OPENAI_API_KEY_CONTENT não configurada' }, { status: 500 });
          }

          const tom = OBJETIVO_TOM[objetivo] || OBJETIVO_TOM.promocao;
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
            : '';

          const previousBlock = previousCaption
            ? `LEGENDA ANTERIOR GERADA (NÃO repita — use estrutura, abertura e palavras-chave completamente diferentes): "${previousCaption}"\n`
            : '';

          const userPrompt = `Gere a legenda de um post de Instagram em português brasileiro.

EMPRESA: ${companyName}
ATIVIDADE: ${mainActivity}
${voiceBlock}${previousBlock}OBJETIVO: ${objetivo} (tom: ${tom})
INFORMAÇÃO-CHAVE: "${keyInfo.trim()}"

Retorne JSON com EXATAMENTE este formato:
{
  "texto": "frase principal com no MÁXIMO 30 palavras, sem hashtags, sem emojis exagerados, no tom certo, terminando com ponto final",
  "cta": "uma chamada curta para ação, no máximo 6 palavras, terminando com ponto final, sem hashtag",
  "hashtags": ["tag1", "tag2", "tag3"]
}

Regras:
- "texto" no máximo 30 palavras, terminando SEMPRE com PONTO FINAL
- "cta" no máximo 6 palavras, terminando SEMPRE com PONTO FINAL
- "hashtags" sempre 3 itens, em MINÚSCULAS, SEM acento, SEM o caractere #, sem espaços, relevantes ao segmento e à informação-chave
- Português brasileiro
- Nada de inglês, nada de markdown
- PROIBIDO ABSOLUTO usar nos campos "texto", "cta" ou "hashtags" as palavras: "clareza", "claro", "claras", "claros", "impacto", "impactos", "impactar", "impactante", "instante", "instantes", "instantâneo", "fragmento", "fragmentos", "fragmentado", "desvio", "desvios", "desviar", "silêncio", "silêncios", "silencioso", "silenciosa", "silenciar", "OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06", "mood". São códigos internos. Use SEMPRE sinônimos ou perífrases (ex.: "clareza" → "direção definida", "leitura simples"; "impacto" → "efeito imediato"; "silêncio" → "pausa", "respiro"; "instante" → "momento"; "fragmento" → "recorte"; "desvio" → "outro caminho").
- PROIBIDO repetir a mesma palavra OU qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue — todas proibidas juntas no mesmo texto) em frases próximas ou consecutivas. Use sinônimos ou reformule completamente. Ex. a evitar: "O digital traz mais alcance. Quer mais? Venha saber mais." — correto: "O digital amplia seu alcance. Quer crescer? Conheça nossa solução."
- Substituir tecnicismos, estrangeirismos e jargões por palavras populares e de fácil entendimento — ex.: "expertise" → "experiência", "briefing" → "orientação", "otimização" → "melhoria", "engajamento" → "envolvimento", "performance" → "desempenho".
- "texto" e "cta" devem SEMPRE começar com LETRA MAIÚSCULA e terminar com PONTO FINAL.
- Respeitar rigorosamente as normas gramaticais e ortográficas do português brasileiro: concordância nominal e verbal, pontuação correta, acentuação gráfica conforme o Acordo Ortográfico vigente. Nenhum erro de gramática, ortografia ou regência será tolerado.
${objetivo === 'institucional' ? `- REGRA INSTITUCIONAL — ATEMPORALIDADE OBRIGATÓRIA: ignore datas e marcos temporais da informação-chave. Foque exclusivamente no SERVIÇO, na CAPACIDADE ou no POSICIONAMENTO da empresa. PROIBIDO no texto, CTA e hashtags: datas, urgência, "a partir de", "lançamento", "em breve". OBRIGATÓRIO: atemporalidade, posicionamento sóbrio, autoridade de marca.` : ''}
${objetivo === 'homenagem' ? `- REGRA HOMENAGEM — DATAS SÃO CONTEXTO, NÃO URGÊNCIA: datas na informação-chave situam a conquista ou o evento comemorado — NUNCA geram urgência. PROIBIDO no texto, CTA e hashtags: "não perca", "somente até", "a partir de", urgência qualquer. O copy celebra com emoção — não pressiona.` : ''}`;

          const sanitizeTag = (t: string) =>
            t
              .toLowerCase()
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .replace(/[^a-z0-9]/g, '')
              .slice(0, 30);

          // D1+E3 — valida "cta" (não vazio, terminando em ./!/?) e
          // "hashtags" (EXATAMENTE 3); se faltar algo, repete a chamada uma
          // vez com reforço explícito antes de cair no fallback determinístico (E4).
          const MAX_CAPTION_ATTEMPTS = 2;
          let textoValue = '';
          let ctaValue = '';
          let hashtagsArr: string[] = [];

          for (let attempt = 1; attempt <= MAX_CAPTION_ATTEMPTS; attempt++) {
            const result = await fetchOpenAIChat(apiKey, {
              model: 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: 'Você é redator publicitário brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido.' },
                {
                  role: 'user',
                  content: attempt === 1
                    ? userPrompt
                    : `${userPrompt}\n\nATENÇÃO: a resposta anterior não preencheu corretamente "cta" e/ou "hashtags". Garanta os TRÊS campos: "texto", "cta" (não vazio, terminando com PONTO FINAL) e "hashtags" (array com EXATAMENTE 3 itens válidos).`,
                },
              ],
              temperature: 0.9,
              response_format: { type: 'json_object' },
            });

            if (!result.ok) {
              return Response.json({ error: result.error }, { status: result.status });
            }
            const content = result.data.choices?.[0]?.message?.content;
            if (!content) return Response.json({ error: 'Resposta vazia' }, { status: 502 });

            let parsed: { texto?: string; cta?: string; hashtags?: unknown };
            try { parsed = JSON.parse(content); } catch { return Response.json({ error: 'JSON inválido' }, { status: 502 }); }

            textoValue = String(parsed.texto || '').trim();
            ctaValue = String(parsed.cta || '').trim();
            hashtagsArr = Array.isArray(parsed.hashtags)
              ? parsed.hashtags.map((t) => sanitizeTag(String(t))).filter(Boolean).slice(0, 3)
              : [];

            const ctaOk = ctaValue !== '' && /[.!?]$/.test(ctaValue);
            const hashtagsOk = hashtagsArr.length === 3;
            if (ctaOk && hashtagsOk) break;

            if (attempt === MAX_CAPTION_ATTEMPTS) {
              if (!ctaOk) ctaValue = OBJETIVO_CTA_FALLBACK[objetivo] || OBJETIVO_CTA_FALLBACK.promocao;
              if (!hashtagsOk) {
                const derived = deriveFallbackHashtags(mainActivity, companyName, keyInfo, sanitizeTag)
                  .filter((t) => !hashtagsArr.includes(t));
                const fallback = OBJETIVO_HASHTAG_FALLBACK[objetivo] || OBJETIVO_HASHTAG_FALLBACK.promocao;
                hashtagsArr = [...new Set([...hashtagsArr, ...derived, ...fallback])].slice(0, 3);
              }
            }
          }

          if (debit && userId) {
            try {
              await debitUsage(userId, 0, 0, { evento: 'gerar_post_unico', modulo: 'pu', geracoes: 1, custoUsd: isAdmin ? 0 : undefined, preferredSlot, impersonatedBy });
            } catch (e) {
              console.warn('[generate-caption] debit failed', e);
            }
          }

          const cap = (s: string) => { const t = s.trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
          return Response.json({
            texto: cap(textoValue),
            cta:   cap(ctaValue),
            hashtags: hashtagsArr,
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
