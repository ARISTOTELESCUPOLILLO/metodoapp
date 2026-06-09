import { createFileRoute } from '@tanstack/react-router';

function truncateWords(s: string, max: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return s.trim();
  return words.slice(0, max).join(' ')
    .replace(/[,;:\-–—]+$/, '')
    .replace(/\s+(e|ou|mas|que|se|nem|de|da|do|das|dos|para|com|em|a|o|as|os|ao|por|pois|até|ante|após|sob|sobre|entre|contra|desde|durante|sem|via)\s*$/i, '')
    .trim();
}
import { getVoiceProfile } from '@/data/brandVoice';
import { resolveEffectiveUser, checkBalance, debitUsage } from '@/lib/usage.server';
import { COST_USD } from '@/lib/costs';

const OBJETIVO_TOM: Record<string, string> = {
  promocao: 'comercial, desejo, chamada para ação clara',
  homenagem: 'afetivo, respeitoso, contemplativo',
  aviso: 'institucional, claro, objetivo',
  oportunidade: 'urgência elegante, momento decisivo',
  institucional: 'institucional de marca, posicionamento, propósito, sóbrio e confiante',
  fatos: 'documental, registro fiel, objetivo',
  nenhum: 'neutro, livre — foco no contexto real da empresa',
};

const OBJETIVO_INTENCAO: Record<string, string> = {
  institucional: 'Construa confiança, presença e identidade. Mostre como a empresa atua, cuida ou se posiciona. Evite promessa comercial, urgência e frase grandiosa.',
  promocao: 'Gere desejo e movimento comercial. Destaque produto, benefício ou condição de forma simples e atrativa. Sem inventar preço, desconto ou prazo não informado.',
  oportunidade: 'Mostre chance, momento favorável ou próximo passo concreto. Sem urgência falsa, clichê motivacional ou promessa de futuro garantido.',
  aviso: 'Informe com objetividade e leitura rápida. Sem dramatização, suspense ou excesso de gentileza que esconda a informação.',
  homenagem: 'Reconheça, valorize ou celebre com humanidade e simplicidade. Sem clichê sentimental, frase de calendário ou emoção forçada.',
  fatos: 'Registre o que aconteceu com fidelidade e objetividade. Sem dramatizar, inventar emoção ou transformar em campanha.',
  nenhum: 'Seja útil para comunicação de negócio, marca, produto ou serviço. Evite frase decorativa, motivacional genérica ou texto sem função mercadológica.',
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
          const segment = String(body.segment || '').slice(0, 30);
          const preferredSlot = ['plano1', 'plano2', 'bonus'].includes(body.preferredSlot) ? body.preferredSlot as 'plano1' | 'plano2' | 'bonus' : undefined;


          if (!keyInfo.trim()) {
            return Response.json({ error: 'keyInfo obrigatório' }, { status: 400 });
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json({ error: 'OPENAI_API_KEY_CONTENT não configurada' }, { status: 500 });
          }

          const effective = await resolveEffectiveUser(request);
          if (!effective) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
          }
          const userId = effective.userId;
          const impersonatedBy = effective.impersonatedBy;
          const bal = await checkBalance(userId, 0, 0, 1);
          if (!bal.ok) {
            return Response.json({ error: 'Limite de gerações atingido.' }, { status: 402 });
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

          const segmentLabel: Record<string, string> = {
            VAREJO: 'Varejo — comercialização de produtos ao consumidor final',
            MARCA: 'Marca — construção de identidade e posicionamento',
            'SERVIÇOS': 'Serviços — prestação de serviços especializados',
          };
          const segmentBlock = segment
            ? `SEGMENTO: ${segmentLabel[segment] || segment} — adapte vocabulário, estilo e apelo do texto ao perfil deste tipo de negócio.\n`
            : '';

          const userPrompt = `Você cria o título e o texto de apoio que aparecerão TIPOGRAFADOS dentro de uma peça publicitária para Instagram.

EMPRESA: ${companyName}
ATIVIDADE: ${mainActivity}
${segmentBlock}${voiceBlock}OBJETIVO: ${objetivo} (tom: ${tom})
${OBJETIVO_INTENCAO[objetivo] ? `INTENÇÃO: ${OBJETIVO_INTENCAO[objetivo]}\n` : ''}INFORMAÇÃO-CHAVE: "${keyInfo.trim()}"

Retorne JSON com EXATAMENTE este formato:
{
  "titulo": "título curto, no MÁXIMO 6 palavras, cada palavra com no máximo 3 sílabas, impactante, em português brasileiro",
  "texto": "texto de apoio curto, no MÁXIMO 14 palavras (CONTE antes de retornar), complementa o título sem repetir, em português brasileiro"
}

Regras:
- "titulo" no máximo 6 palavras, cada palavra com no máximo 3 sílabas (ex.: "negócio" 3 sílabas ✓, "resultado" 4 sílabas ✗ — use "ganho", "retorno"), sem ponto final, sem aspas, sem emoji, sem hashtag. EXCEÇÃO OBRIGATÓRIA: se o título for uma pergunta (direta ou retórica), terminar com "?" — NUNCA omitir. Ex.: "Por que é assim?" ✓, "O que está faltando?" ✓
- "texto" no máximo 14 palavras (CONTE antes de retornar — 15ª palavra em diante é cortada), frase completa terminando com PONTO FINAL obrigatório, sem hashtag, sem emoji
- Português brasileiro, sem inglês, sem markdown
- Substituir tecnicismos, estrangeirismos e jargões por palavras populares e de fácil entendimento — ex.: "expertise" → "experiência", "briefing" → "orientação", "otimização" → "melhoria", "engajamento" → "envolvimento", "performance" → "desempenho".
- Linguagem simples, natural e profissional. Ensino médio deve entender sem esforço. Evite "maximizar", "estratégias eficazes", "impacto real", "soluções digitais", "transformar seu negócio". Prefira: "melhorar", "vender", "organizar", "atender", "crescer", "mostrar".
- O título deve soar natural — evite sintaxe artificial, metáfora confusa ou promessa exagerada.
- ANCORAGEM CONCRETA — ANTI-SÍMBOLO: o título deve poder virar uma FOTO de pessoa(s) real(is) em ação observável (decidir, atender, revisar, fechar, apresentar, entregar). Teste antes de retornar: "dá para fotografar isso sem recorrer a objeto-metáfora?" Se a única imagem possível for engrenagem, peão de madeira, seta para cima, xadrez, escada, troféu ou aperto de mãos → título conceitual demais; reescreva com verbo de ação + agente. Prefira "Time alinhado fecha mais" a "Equipe forte traz bom ganho". PADRÕES PROIBIDOS: "[abstrato] traz [resultado]", "[abstrato] é [abstrato]", "[abstrato] gera [resultado]".
- Interprete a informação-chave com criatividade — NÃO copie literal
- PROIBIDO ABSOLUTO usar as palavras: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06", "mood". Use sinônimos.
- PROIBIDO repetir a mesma palavra OU qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue — todas proibidas juntas no mesmo texto) em frases próximas ou consecutivas. Use sinônimos ou reformule completamente. Ex. a evitar: "O digital traz mais alcance. Quer mais? Venha saber mais." — correto: "O digital amplia seu alcance. Quer crescer? Conheça nossa solução."
- Respeitar rigorosamente as normas gramaticais e ortográficas do português brasileiro: concordância nominal e verbal, pontuação correta, acentuação gráfica conforme o Acordo Ortográfico vigente. Nenhum erro de gramática, ortografia ou regência será tolerado.
${objetivo === 'institucional' ? `- REGRA INSTITUCIONAL — ATEMPORALIDADE OBRIGATÓRIA: a informação-chave pode conter datas ou marcos de lançamento ("a partir de", "disponível em", "começa em" etc.). IGNORE esses elementos completamente — NÃO os mencione no título nem no texto de apoio. Extraia apenas a ESSÊNCIA do serviço, da capacidade ou do posicionamento da empresa. PROIBIDO: datas, urgência, "a partir de", "em breve", "lançamento", "novo serviço". OBRIGATÓRIO: atemporalidade, autoridade de marca, posicionamento sóbrio.` : ''}
${objetivo === 'homenagem' ? `- REGRA HOMENAGEM — DATAS SÃO CONTEXTO, NÃO URGÊNCIA: se a informação-chave contiver datas, use-as apenas para situar a conquista ou o evento celebrado — NUNCA como gatilho de urgência, chamada para ação temporal ou linguagem de lançamento. PROIBIDO: "não perca", "somente até", "a partir de", "já disponível", urgência qualquer. O copy celebra com emoção e respeito — não pressiona.` : ''}`;

          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4.1',
              messages: [
                { role: 'system', content: 'Você é diretor de criação publicitário brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. Prefira sempre a palavra mais simples: "ganho" em vez de "resultado percebido", "melhorar" em vez de "otimizar", "vender" em vez de "converter". Antes de retornar: título soa natural? texto é claro para ensino médio? algum termo reservado (clareza/impacto/instante/fragmento/desvio/silêncio) apareceu? Se sim, reescreva.' },
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

          if (userId) {
            await debitUsage(userId, 0, 0, {
              evento: 'gerar_copia_pu',
              modulo: 'pu',
              payload: { objetivo },
              geracoes: 1,
              custoUsd: COST_USD.content,
              impersonatedBy,
              preferredSlot,
            });
          }

          let titulo = truncateWords(String(parsed.titulo || ''), 6);
          let texto = truncateWords(String(parsed.texto || ''), 14);

          if (!titulo) return Response.json({ error: 'Título vazio na resposta da IA' }, { status: 502 });
          if (!texto) return Response.json({ error: 'Texto vazio na resposta da IA' }, { status: 502 });

          // Garante ponto final no texto quando a IA esquece.
          if (!/[.!?]$/.test(texto)) texto = texto + '.';

          return Response.json({ titulo, texto });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
