import { createFileRoute } from '@tanstack/react-router';
import { getVoiceProfile } from '@/data/brandVoice';

const OBJETIVO_TOM: Record<string, string> = {
  promocao: 'comercial, desejo, chamada para ação clara',
  homenagem: 'afetivo, respeitoso, contemplativo',
  aviso: 'institucional, claro, objetivo',
  oportunidade: 'urgência elegante, momento decisivo',
  institucional: 'institucional de marca, posicionamento, propósito, sóbrio e confiante',
};

export const Route = createFileRoute('/api/generate-pu-copy')({
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


          if (!keyInfo.trim()) {
            return Response.json({ error: 'keyInfo obrigatório' }, { status: 400 });
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

          const userPrompt = `Você cria o título e o texto de apoio que aparecerão TIPOGRAFADOS dentro de uma peça publicitária para Instagram.

EMPRESA: ${companyName}
ATIVIDADE: ${mainActivity}
${voiceBlock}OBJETIVO: ${objetivo} (tom: ${tom})
INFORMAÇÃO-CHAVE: "${keyInfo.trim()}"

Retorne JSON com EXATAMENTE este formato:
{
  "titulo": "título curto, no MÁXIMO 6 palavras, impactante, em português brasileiro",
  "texto": "texto de apoio curto, no MÁXIMO 14 palavras, complementa o título sem repetir, em português brasileiro"
}

Regras:
- "titulo" no máximo 6 palavras, sem ponto final, sem aspas, sem emoji, sem hashtag
- "texto" no máximo 14 palavras, frase completa, sem hashtag, sem emoji
- Português brasileiro, sem inglês, sem markdown
- Interprete a informação-chave com criatividade — NÃO copie literal
- PROIBIDO ABSOLUTO usar as palavras: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06", "mood". Use sinônimos.`;

          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: 'Você é diretor de criação publicitário brasileiro. Responda SEMPRE com JSON válido em português.' },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.95,
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

          let parsed: { titulo?: string; texto?: string };
          try { parsed = JSON.parse(content); } catch { return Response.json({ error: 'JSON inválido' }, { status: 502 }); }

          return Response.json({
            titulo: String(parsed.titulo || '').trim(),
            texto: String(parsed.texto || '').trim(),
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
