import { createFileRoute } from '@tanstack/react-router';
import { checkBalance, debitUsage, getUserIdFromRequest } from '@/lib/usage.server';
import { getVoiceProfile } from '@/data/brandVoice';

const OBJETIVO_TOM: Record<string, string> = {
  promocao: 'comercial, desejo, chamada para ação clara',
  homenagem: 'afetivo, respeitoso, contemplativo',
  aviso: 'institucional, claro, objetivo',
  oportunidade: 'urgência elegante, momento decisivo',
  institucional: 'institucional de marca, posicionamento, propósito, sóbrio e confiante',
};

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

          // Gate: quando vem do clique inicial "Gerar Post Único" debita 1 geração.
          let userId: string | null = null;
          let isAdmin = false;
          if (debit) {
            userId = await getUserIdFromRequest(request);
            if (!userId) {
              return Response.json({ error: 'Não autenticado' }, { status: 401 });
            }
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
  "texto": "frase principal com no MÁXIMO 30 palavras, sem hashtags, sem emojis exagerados, no tom certo",
  "cta": "uma chamada curta para ação, no máximo 6 palavras, sem hashtag",
  "hashtags": ["tag1", "tag2", "tag3"]
}

Regras:
- "texto" no máximo 30 palavras
- "hashtags" sempre 3 itens, em MINÚSCULAS, SEM acento, SEM o caractere #, sem espaços, relevantes ao segmento e à informação-chave
- Português brasileiro
- Nada de inglês, nada de markdown
- PROIBIDO ABSOLUTO usar nos campos "texto", "cta" ou "hashtags" as palavras: "clareza", "claro", "claras", "claros", "impacto", "impactos", "impactar", "impactante", "instante", "instantes", "instantâneo", "fragmento", "fragmentos", "fragmentado", "desvio", "desvios", "desviar", "silêncio", "silêncios", "silencioso", "silenciosa", "silenciar", "OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06", "mood". São códigos internos. Use SEMPRE sinônimos ou perífrases (ex.: "clareza" → "direção definida", "leitura simples"; "impacto" → "efeito imediato"; "silêncio" → "pausa", "respiro"; "instante" → "momento"; "fragmento" → "recorte"; "desvio" → "outro caminho").
- PROIBIDO repetir a mesma palavra em frases próximas ou consecutivas. Use sinônimos ou reformule. Ex. a evitar: "O digital traz mais alcance. Quer mais? Venha saber mais." — correto: "O digital amplia seu alcance. Quer crescer? Conheça nossa solução."
- Substituir tecnicismos, estrangeirismos e jargões por palavras populares e de fácil entendimento — ex.: "expertise" → "experiência", "briefing" → "orientação", "otimização" → "melhoria", "engajamento" → "envolvimento", "performance" → "desempenho".
- "texto" e "cta" devem SEMPRE começar com LETRA MAIÚSCULA.
- Respeitar rigorosamente as normas gramaticais e ortográficas do português brasileiro: concordância nominal e verbal, pontuação correta, acentuação gráfica conforme o Acordo Ortográfico vigente. Nenhum erro de gramática, ortografia ou regência será tolerado.`;

          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: 'Você é redator publicitário brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido.' },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.9,
              response_format: { type: 'json_object' },
            }),
          });

          if (!res.ok) {
            const txt = await res.text();
            return Response.json({ error: `OpenAI: ${txt}` }, { status: 502 });
          }
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (!content) return Response.json({ error: 'Resposta vazia' }, { status: 502 });

          let parsed: { texto?: string; cta?: string; hashtags?: unknown };
          try { parsed = JSON.parse(content); } catch { return Response.json({ error: 'JSON inválido' }, { status: 502 }); }

          const sanitizeTag = (t: string) =>
            t
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]/g, '')
              .slice(0, 30);

          const hashtagsArr = Array.isArray(parsed.hashtags)
            ? parsed.hashtags.map((t) => sanitizeTag(String(t))).filter(Boolean).slice(0, 3)
            : [];

          if (debit && userId) {
            try {
              await debitUsage(userId, 0, 0, { evento: 'gerar_post_unico', modulo: 'pu', geracoes: 1, custoUsd: isAdmin ? 0 : undefined, preferredSlot });
            } catch (e) {
              console.warn('[generate-caption] debit failed', e);
            }
          }

          const cap = (s: string) => { const t = s.trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
          return Response.json({
            texto: cap(String(parsed.texto || '')),
            cta:   cap(String(parsed.cta   || '')),
            hashtags: hashtagsArr,
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
