import { createFileRoute } from '@tanstack/react-router';

type Kind = 'titulo' | 'texto' | 'legenda';

function getRule(kind: Kind, formato: string): { label: string; rule: string; max: number } {
  const f = (formato || '').toLowerCase();
  const isCarrossel = f.startsWith('carrossel');
  const isReels = f.startsWith('reels');

  if (kind === 'legenda') {
    return {
      label: 'legenda do post',
      rule: 'Até 40 palavras, voz humana brasileira, com 1 chamada ao final. Pode usar emojis com moderação. NÃO inclua hashtags.',
      max: 40,
    };
  }

  if (kind === 'titulo') {
    const max = 6; // máximo 6 palavras em todas as trilhas
    return {
      label: 'título',
      rule: `MÁXIMO ${max} palavras, cada palavra com NO MÁXIMO 3 sílabas (ex.: "negócio" ✓, "resultado" ✗ → use "ganho"; "prioridade" ✗ → use "foco"; "comunicação" ✗ → use "mensagem"). NUNCA exceda esses limites — conte as palavras e as sílabas antes de responder. Direto, com tensão ou benefício claro. Sem emoji, sem hashtag, sem aspas. Sem ponto final — EXCETO se o título for uma pergunta (direta ou retórica): nesse caso o "?" é OBRIGATÓRIO. Ex. corretos: "Por que isso acontece?" / "O que está faltando?" — Ex. errados: "Por que isso acontece" / "O que está faltando."`,
      max,
    };
  }

  // kind === 'texto'
  // Estático, Estático Final e Carrossel = 12 palavras (regra do método)
  // Reels (script) = 25 palavras
  // PostUnico = 14 palavras
  const isPostUnico = f.startsWith('postunico');
  const max = isReels ? 25 : isPostUnico ? 14 : 12;
  return {
    label: 'texto de apoio',
    rule: `MÁXIMO ${max} palavras. NUNCA exceda esse limite — conte mentalmente as palavras antes de responder. Frase curta que sustente o título. Sem emoji, sem hashtag, sem aspas.`,
    max,
  };
}

function truncateWords(s: string, max: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return s.trim();

  const truncated = words.slice(0, max).join(' ')
    .replace(/[,;:\-–—]+$/, '');

  // Prefere corte em limite de frase completa dentro do trecho
  const m = truncated.match(/^(.*[.!?])\s+\S/);
  if (m) return m[1].trim();

  // Fallback: remove conjunção, preposição ou verbo de ligação sobrando no final
  return truncated
    .replace(/\s+(e|ou|mas|que|se|nem|de|da|do|das|dos|para|com|em|a|o|as|os|ao|por|pois|até|ante|após|sob|sobre|entre|contra|desde|durante|sem|via|é|foi|era|será|está|estava|ficou|parece|fica|são|eram|serão|sendo|tendo)\s*$/i, '')
    .trim();
}

export const Route = createFileRoute('/api/regenerate-block')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const kind = String(body.kind || '') as Kind;
          if (kind !== 'titulo' && kind !== 'texto' && kind !== 'legenda') {
            return Response.json({ error: 'kind inválido' }, { status: 400 });
          }
          const companyName = String(body.companyName || '').slice(0, 200);
          const mainActivity = String(body.mainActivity || '').slice(0, 300);
          const keyInfo = String(body.keyInfo || '').slice(0, 1000);
          const tituloAtual = String(body.tituloAtual || '').slice(0, 300);
          const textoAtual = String(body.textoAtual || '').slice(0, 800);
          const legendaAtual = String(body.legendaAtual || '').slice(0, 1500);
          const formato = String(body.formato || '').slice(0, 60);

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json({ error: 'OPENAI_API_KEY_CONTENT não configurada' }, { status: 500 });
          }

          const rule = getRule(kind, formato);

          const userPrompt = `Reescreva APENAS o ${rule.label} de uma peça de Instagram em português brasileiro, mantendo a intenção original mas trazendo uma alternativa realmente diferente.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
FORMATO DA PEÇA: ${formato || 'feed'}
INFORMAÇÃO-CHAVE: ${keyInfo || '(não informada)'}

VERSÃO ATUAL:
- Título: ${tituloAtual || '(vazio)'}
- Texto: ${textoAtual || '(vazio)'}
- Legenda: ${legendaAtual || '(vazia)'}

REGRA DO ${rule.label.toUpperCase()}: ${rule.rule}

PROIBIDO ABSOLUTO usar as palavras: "clareza", "claro", "claras", "claros", "impacto", "impactos", "impactar", "impactante", "instante", "instantes", "instantâneo", "fragmento", "fragmentos", "fragmentado", "desvio", "desvios", "desviar", "silêncio", "silêncios", "silencioso", "silenciosa", "silenciar", "OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06", "mood". São códigos internos do sistema. Use sinônimos/perífrases.
PROIBIDO repetir a mesma palavra OU qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue — todas proibidas juntas no mesmo texto) em frases próximas ou consecutivas. Use sinônimos ou reformule completamente. Ex. a evitar: "O digital traz mais alcance. Quer mais? Venha saber mais." — correto: "O digital amplia seu alcance. Quer crescer? Conheça nossa solução."
REGRA DE LINGUAGEM: substitua tecnicismos, estrangeirismos e jargões por palavras populares e de fácil entendimento — ex.: "expertise" → "experiência", "briefing" → "orientação", "otimização" → "melhoria", "saúde laboral" → "saúde do trabalho", "engajamento" → "envolvimento", "performance" → "desempenho".

Retorne JSON EXATAMENTE assim:
{ "value": "novo ${rule.label} aqui, sem aspas externas" }`;

          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4.1',
              messages: [
                { role: 'system', content: 'Você é redator publicitário brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido.' },
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

          let parsed: { value?: string };
          try { parsed = JSON.parse(content); } catch { return Response.json({ error: 'JSON inválido' }, { status: 502 }); }

          let value = String(parsed.value || '').trim().replace(/^"|"$/g, '');
          if (!value) return Response.json({ error: 'Valor vazio' }, { status: 502 });

          // Enforcement: garante que nunca volta acima do limite do método.
          if (kind === 'titulo' || kind === 'texto') {
            value = truncateWords(value, rule.max);
          }

          return Response.json({ value });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
