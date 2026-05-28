import { createFileRoute } from '@tanstack/react-router';
import { detectEditorialProfile } from '@/data/editorialProfiles';

const OBJETIVO_TOM: Record<string, string> = {
  promocao: 'comercial, desejo, chamada para ação clara',
  homenagem: 'afetivo, respeitoso, contemplativo',
  aviso: 'institucional, claro, objetivo',
  oportunidade: 'urgência elegante, momento decisivo',
  institucional: 'institucional de marca, posicionamento, propósito, sóbrio e confiante',
};

export const Route = createFileRoute('/api/suggest-keyinfo')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const companyName = String(body.companyName || '').slice(0, 200);
          const mainActivity = String(body.mainActivity || '').slice(0, 300);
          const objetivo = String(body.objetivo || 'promocao');
          const hint = String(body.hint || '').slice(0, 1000).trim();
          const mode = String(body.mode || 'postunico') as 'postunico' | 'metodo';
          const attempt = Number(body.attempt || 0);
          const angulo: 'tensao' | 'motivacao' = attempt % 2 === 0 ? 'tensao' : 'motivacao';
          const topicoGuia: { categoria: string; item: string } | null =
            body.topicoGuia && body.topicoGuia.categoria && body.topicoGuia.item
              ? { categoria: String(body.topicoGuia.categoria), item: String(body.topicoGuia.item) }
              : null;

          const previousSugs: string[] = Array.isArray(body.previousSuggestions)
            ? body.previousSuggestions.slice(0, 6).map(String).filter(Boolean)
            : [];

          const SEGMENTS = ['VAREJO', 'SERVIÇOS', 'MARCA'] as const;
          type Seg = typeof SEGMENTS[number];
          const segment: Seg = (SEGMENTS as readonly string[]).includes(body.segment) ? (body.segment as Seg) : 'SERVIÇOS';

          const AUDIENCES = ['B2C', 'B2B'] as const;
          type Aud = typeof AUDIENCES[number];
          const audience: Aud = (AUDIENCES as readonly string[]).includes(body.audience) ? (body.audience as Aud) : 'B2C';
          const isB2C = audience === 'B2C';

          const preservaHint = hint
            ? `REGRA CRÍTICA DA PISTA: preserve o SENTIDO da pista do usuário (positivo, neutro ou crítico). Refine a FORMA, NUNCA inverta a intenção. Se a pista é positiva (ex.: "20 anos fazendo parte da vida da cidade"), NÃO transforme em dor/estagnação/crítica. Se é neutra, mantenha neutra. Se já carrega tensão, pode aprofundar.`
            : '';

          // ── Público-alvo — regra crítica para B2C vs B2B ──────────────────
          const audienceDirective = isB2C
            ? `PÚBLICO-ALVO: CONSUMIDOR FINAL (B2C).
A Informação-chave deve falar com a PESSOA, não com o empresário.
PROIBIDO no texto gerado: "empreendedor", "empresário", "empresária", "gestor", "gestora", "decisor", "liderança", "equipe", "time", "empresa cliente", "negócio" como sujeito.
Escreva como se estivesse falando com alguém que usa o produto/serviço na própria vida.`
            : `PÚBLICO-ALVO: DECISOR EMPRESARIAL (B2B).
A Informação-chave deve falar com o gestor, diretor ou responsável pela área.
Foque em eficiência, previsibilidade, risco operacional e resultado para o negócio.`;

          // ── Progressão do Método OP ────────────────────────────────────────
          const progressaoMetodo = isB2C
            ? `PROGRESSÃO DO MÉTODO (B2C): ENTENDIMENTO → SEGURANÇA → CONFIANÇA → AUTORIDADE → AGIR.
A Informação-chave é a SEMENTE da sequência. Ela deve carregar uma tensão ou aspiração que NATURALMENTE alimenta essa progressão: o público primeiro se entende no post (entendimento), depois vê que outros passaram pelo mesmo (segurança), depois confia no profissional/marca (confiança), depois reconhece autoridade (autoridade), e no último post toma ação (agir).`
            : `PROGRESSÃO DO MÉTODO (B2B): ENTENDIMENTO → CONFIANÇA → SEGURANÇA → AUTORIDADE → AGIR.
A Informação-chave deve revelar um risco, ineficiência ou oportunidade estratégica que o decisor reconhece como real. A progressão constrói credibilidade antes de segurança — o empresário precisa confiar que você entende o cenário dele antes de sentir que pode confiar na solução.`;

          // ── Perfil Editorial ──────────────────────────────────────────────
          const editorialProfile = mode === 'metodo'
            ? detectEditorialProfile(mainActivity, segment, audience)
            : null;

          const editorialBlock = editorialProfile
            ? `PERFIL EDITORIAL DETECTADO: ${editorialProfile.nome}
TERRITÓRIO: ${editorialProfile.territorio}
${angulo === 'tensao'
  ? `ÂNGULOS DE TENSÃO para este perfil: ${editorialProfile.angulosTensao.join(' / ')}`
  : `ÂNGULOS DE MOTIVAÇÃO para este perfil: ${editorialProfile.angulosMotivacao.join(' / ')}`}
VOCABULÁRIO PROIBIDO adicional: ${editorialProfile.vocabularioProibido.join(', ')}
EXEMPLO de boa Informação-chave (${angulo === 'tensao' ? 'tensão' : 'motivação'}) para este perfil: "${angulo === 'tensao' ? editorialProfile.exemploTensao : editorialProfile.exemploMotivacao}"
NOTA DO MÉTODO: ${editorialProfile.notaMetodo}`
            : '';

          const topicoGuiaBlock = topicoGuia
            ? `ASSUNTO OBRIGATÓRIO desta sugestão (siga sempre, mesmo que haja texto anterior no campo):
Categoria: ${topicoGuia.categoria}
Perspectiva: "${topicoGuia.item}"
Gere a sugestão SOBRE este assunto específico. Não substitua este assunto pelo texto anterior do usuário.`
            : '';

          const previousBlock = previousSugs.length
            ? `SUGESTÕES ANTERIORES NESTA SESSÃO (NÃO repita estes assuntos nem ângulos — gere algo completamente diferente):\n${previousSugs.map(s => `- "${s}"`).join('\n')}`
            : '';

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json({ error: 'OPENAI_API_KEY_CONTENT não configurada' }, { status: 500 });
          }

          const tom = OBJETIVO_TOM[objetivo] || OBJETIVO_TOM.promocao;

          // ── Prompts do Método ─────────────────────────────────────────────

          const metodoTensao = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO sobre o ASSUNTO OBRIGATÓRIO abaixo): "${hint}"` : 'Campo vazio — crie sobre o assunto obrigatório abaixo.'}

${audienceDirective}

${progressaoMetodo}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

ÂNGULO: TENSÃO PSICOLÓGICA (dor / conflito / consequência).
REGRA OP — escreva em 1 LINHA CURTA contendo 4 camadas implícitas:
ASSUNTO + CONTEXTO + DOR/DESEJO + DIREÇÃO.
Deve ATIVAR pelo menos um destes gatilhos: movimento, conflito, mudança, comparação, consequência.

EVITE termos genéricos isolados (ex.: "marketing digital", "consultoria", "organização", "tráfego pago").
PREFIRA versões com tensão psicológica e direção da sequência.

Exemplos do método (não copie, use como referência de FORMATO):
- "tráfego pago para empresas do interior que dependem apenas de impulsionamento e precisam transformar anúncios em previsibilidade de vendas"
- "empresas que postam todo dia mas continuam invisíveis no Instagram"
- "negócios com comunicação desorganizada que passam insegurança sem perceber"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, no máximo 30 palavras, sem hashtag, sem emoji, sem aspas, carregada de intenção" }`;

          const metodoMotivacao = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO sobre o ASSUNTO OBRIGATÓRIO abaixo): "${hint}"` : 'Campo vazio — crie sobre o assunto obrigatório abaixo.'}

${audienceDirective}

${progressaoMetodo}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

ÂNGULO: MOTIVAÇÃO POSITIVA (desejo / aspiração / conquista / oportunidade).
IMPORTANTE: NÃO "implique" com o público. Não aponte erro, falha ou falta. Fale do que ele QUER alcançar, do próximo nível, da transformação positiva — como quem reconhece o esforço e mostra o caminho.

REGRA OP — escreva em 1 LINHA CURTA contendo 4 camadas implícitas:
ASSUNTO + CONTEXTO + DESEJO/CONQUISTA/ASPIRAÇÃO + DIREÇÃO.
Gatilhos válidos: movimento, transformação positiva, oportunidade, orgulho, evolução, próximo nível.

EVITE termos genéricos isolados (ex.: "marketing digital", "consultoria", "tráfego pago").
EVITE qualquer formulação que soe como crítica ao público ("não conseguem", "não sabem", "fazem errado", "estão perdidos").

Exemplos do método (não copie, use como referência de FORMATO e TOM):
- "lojistas locais prontos para transformar o Instagram em vitrine que vende todo dia"
- "negócios consolidados que querem dar o próximo passo e ganhar autoridade no bairro"
- "marcas construindo presença digital com consistência e prontas para escalar resultados"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, no máximo 30 palavras, sem hashtag, sem emoji, sem aspas, carregada de aspiração positiva" }`;

          const marcaIdentidade = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
SEGMENTO: MARCA (conteúdo institucional, identidade, posicionamento, percepção, propósito — NÃO é venda).
${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO repita; gere algo NOVO sobre o ASSUNTO OBRIGATÓRIO abaixo, preservando o sentido positivo da marca): "${hint}"` : 'Campo vazio — crie sobre o assunto obrigatório abaixo.'}

${preservaHint}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

ÂNGULO: IDENTIDADE / POSICIONAMENTO.
A Informação-chave deve revelar QUEM a marca é, o que ela representa, como quer ser percebida no território/categoria. Sem dor do cliente, sem promessa comercial, sem CTA, sem urgência, sem gatilho de venda.

REGRA OP — 1 LINHA CURTA com 4 camadas implícitas:
ASSUNTO + CONTEXTO + IDENTIDADE/PROPÓSITO + DIREÇÃO.

PROIBIDO: linguagem de venda ("compre", "garanta", "oferta", "promoção"), dor do cliente ("não conseguem", "estão perdidos", "estagnação", "invisíveis"), urgência ("últimas vagas", "agora"), reinterpretação negativa de qualquer pista positiva do usuário.

Exemplos do método (não copie, use como referência de TOM e FORMATO institucional):
- "loja de bairro que virou parte da vida de duas gerações e segue construindo presença na cidade"
- "marca local com identidade própria reafirmando o jeito de fazer que a diferencia há anos"
- "negócio que carrega um propósito claro e quer ser reconhecido pelo que representa, não só pelo que vende"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, no máximo 30 palavras, sem hashtag, sem emoji, sem aspas, tom institucional de marca" }`;

          const marcaLegado = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
SEGMENTO: MARCA (conteúdo institucional — NÃO é venda).
${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO repita; gere algo NOVO sobre o ASSUNTO OBRIGATÓRIO abaixo, preservando o sentido positivo da marca): "${hint}"` : 'Campo vazio — crie sobre o assunto obrigatório abaixo.'}

${preservaHint}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

ÂNGULO: TRAJETÓRIA / LEGADO / VÍNCULO COM A COMUNIDADE.
Foco em história, repertório, tempo de mercado, vínculo afetivo com clientes, evolução da marca, presença no território. Tom de orgulho calmo, sem auto-elogio comercial.

REGRA OP — 1 LINHA CURTA com 4 camadas implícitas:
ASSUNTO + CONTEXTO + LEGADO/PERCEPÇÃO + DIREÇÃO.

PROIBIDO: dor do cliente, crítica ao público, linguagem comercial agressiva, urgência, qualquer inversão negativa de uma pista positiva (ex.: transformar "20 anos de tradição" em "estagnação há 20 anos" é proibido).

Exemplos do método (não copie, use como referência de TOM e FORMATO):
- "duas décadas atendendo famílias da mesma cidade e construindo uma marca que pertence ao lugar"
- "trajetória feita de detalhes que viraram a forma como a marca é reconhecida hoje"
- "presença local que atravessou gerações e segue ditando o tom da categoria no bairro"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, no máximo 30 palavras, sem hashtag, sem emoji, sem aspas, tom de legado e pertencimento" }`;

          let metodoPrompt: string;
          if (segment === 'MARCA') {
            metodoPrompt = attempt >= 1 ? marcaLegado : marcaIdentidade;
          } else {
            const base = angulo === 'motivacao' ? metodoMotivacao : metodoTensao;
            metodoPrompt = preservaHint ? `${base}\n\n${preservaHint}` : base;
          }

          const postUnicoPrompt = `Sugira UMA Informação-chave para um post único de Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
OBJETIVO: ${objetivo} (tom: ${tom})
${hint ? `PISTA DO USUÁRIO (refine/melhore a partir disso): "${hint}"` : 'O usuário não deu pista — invente algo plausível e útil para a atividade.'}

A Informação-chave é o FATO central que a peça vai comunicar (uma promoção concreta, um aviso, uma homenagem, uma oportunidade). Deve ser específica, com número/prazo/nome quando fizer sentido. NÃO é a legenda nem o título — é a matéria-prima do post.

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 a 2 frases, no máximo 35 palavras, em português, sem hashtag, sem emoji, sem aspas, concreta e acionável" }`;

          const userPrompt = mode === 'metodo' ? metodoPrompt : postUnicoPrompt;
          const systemMsg = mode === 'metodo'
            ? 'Você é estrategista do Método OP. Responda SEMPRE com JSON válido em português brasileiro.'
            : 'Você é estrategista de conteúdo brasileiro. Responda SEMPRE com JSON válido em português.';

          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: systemMsg },
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

          let parsed: { sugestao?: string };
          try { parsed = JSON.parse(content); } catch { return Response.json({ error: 'JSON inválido' }, { status: 502 }); }

          const sugestao = String(parsed.sugestao || '').trim().replace(/^"|"$/g, '');
          if (!sugestao) return Response.json({ error: 'Sugestão vazia' }, { status: 502 });

          return Response.json({ sugestao });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
