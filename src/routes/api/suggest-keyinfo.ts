import { createFileRoute } from '@tanstack/react-router';
import { detectEditorialProfile } from '@/data/editorialProfiles';
import { getVoiceProfile } from '@/data/brandVoice';
import { getUserIdFromRequest } from '@/lib/usage.server';

const OBJETIVO_TOM: Record<string, string> = {
  promocao: 'comercial, desejo, chamada para ação clara',
  homenagem: 'afetivo, respeitoso, contemplativo',
  aviso: 'institucional, claro, objetivo',
  oportunidade: 'urgência elegante, momento decisivo',
  institucional: 'institucional de marca, posicionamento, propósito, sóbrio e confiante',
  nenhum: 'neutro, livre — foco no fato concreto da empresa',
};

export const Route = createFileRoute('/api/suggest-keyinfo')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json({ error: 'Não autenticado' }, { status: 401 });
          }

          const body = await request.json();
          const today = new Date().toLocaleDateString('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          });
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

          const subMode = String(body.subMode || 'sugerir') as 'sugerir' | 'refinar';
          const isRefinar = subMode === 'refinar' && !!hint;

          const SEGMENTS = ['VAREJO', 'SERVIÇOS', 'MARCA'] as const;
          type Seg = typeof SEGMENTS[number];
          const segment: Seg = (SEGMENTS as readonly string[]).includes(body.segment) ? (body.segment as Seg) : 'SERVIÇOS';

          const AUDIENCES = ['B2C', 'B2B'] as const;
          type Aud = typeof AUDIENCES[number];
          const audience: Aud = (AUDIENCES as readonly string[]).includes(body.audience) ? (body.audience as Aud) : 'B2C';
          const isB2C = audience === 'B2C';

          const brandVoice = String(body.brandVoice || '').slice(0, 80);
          const voiceProfile = getVoiceProfile(brandVoice);
          const voiceBlock = voiceProfile
            ? `VOZ DA MARCA — "${voiceProfile.label}": ritmo: ${voiceProfile.ritmo}. Vocabulário: ${voiceProfile.vocabulario}. Registro: ${voiceProfile.registro}. Evitar: ${voiceProfile.evitar}.\n`
            : `LINGUAGEM: frases curtas, ordem direta, palavras do dia a dia. Profissional e mercadológico, sem jargão corporativo, sem termos técnicos. Uma ideia por frase.\n`;

          const preservaHint = hint
            ? `REGRA CRÍTICA DA PISTA: preserve o SENTIDO da pista do usuário (positivo, neutro ou crítico). Refine a FORMA, NUNCA inverta a intenção. Se a pista é positiva (ex.: "20 anos fazendo parte da vida da cidade"), NÃO transforme em dor/estagnação/crítica. Se é neutra, mantenha neutra. Se já carrega tensão, pode aprofundar.`
            : '';

          const proibicoesInventar = (objetivo !== 'promocao' && objetivo !== 'oportunidade')
            ? `PROIBIDO inventar: datas • descontos • promoções • eventos • garantias • condições especiais • números • promessas absolutas que o usuário não forneceu.`
            : '';

          const criteriosRefinamentoOP = `CRITÉRIOS DE QUALIDADE — PROCESSO DE REFINAMENTO:

PASSO 1 — CLASSIFICAR: identifique o que o texto representa de fato: crença / problema / desejo / oferta / benefício / tendência / novidade / evento / oportunidade real / frase genérica.

PASSO 2 — VALIDAR COMPATIBILIDADE: se a categoria trabalhada for "Novidade ou Oportunidade" e a frase for crença ou tese genérica, NÃO invente promoção, prazo, desconto, data ou condição comercial — transforme em observação de tendência ou comportamento emergente (ex.: "Pequenos negócios estão descobrindo que marketing deixou de ser privilégio das grandes empresas.").

PASSO 3 — REENQUADRAR SEM TRAIR A IDEIA ORIGINAL: ajuste para o ângulo correto mantendo o sentido central.

PASSO 4 — ENRIQUECER COM 4 CAMADAS: [ASSUNTO] + [CONTEXTO] + [TENSÃO, DOR OU OPORTUNIDADE] + [DIREÇÃO DESEJADA].

${proibicoesInventar}
LINGUAGEM: uma ideia principal, ordem direta, palavras comuns. Uma pessoa com ensino médio deve entender sem esforço. PROIBIDO: "decisores", "receita previsível", "riscos operacionais", "maximizar resultados", "estruturar processos", "estratégias digitais eficazes", "impacto real", termos técnicos de consultoria. Prefira: "vendas" a "receita", "empresas" a "decisores", "melhorar" a "otimizar", "responder rápido" a "reduzir tempo de resposta".`;

          const criteriosSugestaoOP = `CRITÉRIOS DE QUALIDADE OP:
Construa com 4 camadas obrigatórias: [ASSUNTO] + [CONTEXTO] + [TENSÃO, DOR OU OPORTUNIDADE] + [DIREÇÃO DESEJADA].
Se a categoria for "Novidade ou Oportunidade", use tendências e comportamentos emergentes — não invente datas ou promoções inexistentes.
${proibicoesInventar}
LINGUAGEM: uma ideia principal, ordem direta, palavras comuns. Uma pessoa com ensino médio deve entender sem esforço. PROIBIDO: "decisores", "receita previsível", "riscos operacionais", "maximizar resultados", "estruturar processos", "estratégias digitais eficazes", "impacto real", termos técnicos de consultoria. Prefira: "vendas" a "receita", "empresas" a "decisores", "melhorar" a "otimizar", "responder rápido" a "reduzir tempo de resposta".`;

          // ── Público-alvo — regra crítica para B2C vs B2B ──────────────────
          const audienceDirective = isB2C
            ? `PÚBLICO-ALVO: CONSUMIDOR FINAL (B2C).
A Informação-chave deve falar com a PESSOA, não com o empresário.
PROIBIDO no texto gerado: "empreendedor", "empresário", "empresária", "gestor", "gestora", "decisor", "liderança", "equipe", "time", "empresa cliente", "negócio" como sujeito.
Escreva como se estivesse falando com alguém que usa o produto/serviço na própria vida.`
            : `PÚBLICO-ALVO: EMPRESARIAL (B2B).
A Informação-chave deve falar com o dono, sócio, gestor ou responsável pelo negócio.
Foque em situações reais de trabalho: atendimento, resultado, organização, vendas, prazo, confiança ou crescimento.
Evite linguagem de grande consultoria e termos frios como "decisores", "receita previsível", "riscos operacionais".`;

          // ── Progressão do Método OP ────────────────────────────────────────
          const progressaoB2C = segment === 'VAREJO'
            ? 'IDENTIFICAÇÃO → DESEJO → SEGURANÇA → CONFIANÇA → AGIR'
            : segment === 'MARCA'
              ? 'RECONHECIMENTO → IDENTIFICAÇÃO → SEGURANÇA → CONFIANÇA → AGIR'
              : 'ENTENDIMENTO → SEGURANÇA → CONFIANÇA → AUTORIDADE → AGIR';

          const progressaoMetodo = isB2C
            ? `PROGRESSÃO DO MÉTODO (B2C): ${progressaoB2C}.
A Informação-chave é a SEMENTE da sequência. Ela deve carregar uma tensão ou aspiração que NATURALMENTE alimenta essa progressão — a peça inicial ativa o ponto de entrada do segmento, e os posts seguintes conduzem o público até a ação.`
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
NOTA DO MÉTODO: ${editorialProfile.notaMetodo}`
            : '';

          const topicoGuiaBlock = topicoGuia
            ? `ASSUNTO OBRIGATÓRIO desta sugestão (siga sempre, mesmo que haja texto anterior no campo):
Categoria: ${topicoGuia.categoria}
Perspectiva: "${topicoGuia.item}"
Interprete este assunto dentro da atividade real da empresa acima. Mostre uma situação prática do dia a dia — não um conceito genérico. A atividade da empresa dá o contexto concreto.
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
${voiceBlock}${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO sobre o ASSUNTO OBRIGATÓRIO abaixo): "${hint}"` : 'Campo vazio — crie sobre o assunto obrigatório abaixo.'}

${audienceDirective}

${progressaoMetodo}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

${criteriosSugestaoOP}

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
{ "sugestao": "1 linha, no máximo 15 palavras, sem hashtag, sem emoji, sem aspas, carregada de intenção" }`;

          const metodoMotivacao = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO sobre o ASSUNTO OBRIGATÓRIO abaixo): "${hint}"` : 'Campo vazio — crie sobre o assunto obrigatório abaixo.'}

${audienceDirective}

${progressaoMetodo}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

${criteriosSugestaoOP}

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
{ "sugestao": "1 linha, no máximo 15 palavras, sem hashtag, sem emoji, sem aspas, carregada de aspiração positiva" }`;

          const marcaIdentidade = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}SEGMENTO: MARCA (conteúdo institucional, identidade, posicionamento, percepção, propósito — NÃO é venda).
${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO repita; gere algo NOVO sobre o ASSUNTO OBRIGATÓRIO abaixo, preservando o sentido positivo da marca): "${hint}"` : 'Campo vazio — crie sobre o assunto obrigatório abaixo.'}

${preservaHint}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

${criteriosSugestaoOP}

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
{ "sugestao": "1 linha, no máximo 15 palavras, sem hashtag, sem emoji, sem aspas, tom institucional de marca" }`;

          const marcaLegado = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}SEGMENTO: MARCA (conteúdo institucional — NÃO é venda).
${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO repita; gere algo NOVO sobre o ASSUNTO OBRIGATÓRIO abaixo, preservando o sentido positivo da marca): "${hint}"` : 'Campo vazio — crie sobre o assunto obrigatório abaixo.'}

${preservaHint}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

${criteriosSugestaoOP}

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
{ "sugestao": "1 linha, no máximo 15 palavras, sem hashtag, sem emoji, sem aspas, tom de legado e pertencimento" }`;

          // ── Prompts de REFINAMENTO (campo com texto) ──────────────────────

          const metodoRefinarTensao = `Refine a Informação-chave do usuário para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}TEXTO DO USUÁRIO (mantenha este assunto — refine a forma, NÃO invente outro): "${hint}"

${audienceDirective}

${progressaoMetodo}

${editorialBlock}

INSTRUÇÃO DE REFINAMENTO:
1. Identifique a qual categoria editorial o texto pertence: Cliente / Produto ou Serviço / Problema / Solução / Novidade ou Oportunidade
2. Reescreva no formato Método OP: 1 linha curta com 4 camadas implícitas (ASSUNTO + CONTEXTO + DOR/CONFLITO + DIREÇÃO)
3. Refine a forma e o ângulo a partir do texto do usuário, sem inventar assunto diferente
4. Se o texto estiver genérico ou abstrato, traga-o para uma situação prática ligada à atividade real da empresa e ao dia a dia do público — sem mudar o assunto original.
5. PROIBIDO: inventar assunto diferente do texto original

${criteriosRefinamentoOP}

ÂNGULO: TENSÃO PSICOLÓGICA (dor / conflito / consequência).
Deve ATIVAR pelo menos um gatilho: movimento, conflito, mudança, comparação, consequência.

EVITE termos genéricos isolados ("marketing digital", "consultoria", "organização", "tráfego pago").

Exemplos de refinamento com tensão (não copie — referência de FORMATO):
- "tráfego pago para empresas do interior que dependem apenas de impulsionamento e precisam transformar anúncios em previsibilidade de vendas"
- "empresas que postam todo dia mas continuam invisíveis no Instagram"
- "negócios com comunicação desorganizada que passam insegurança sem perceber"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, no máximo 15 palavras, sem hashtag, sem emoji, sem aspas, carregada de intenção" }`;

          const metodoRefinarMotivacao = `Refine a Informação-chave do usuário para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}TEXTO DO USUÁRIO (mantenha este assunto — refine a forma, NÃO invente outro): "${hint}"

${audienceDirective}

${progressaoMetodo}

${editorialBlock}

INSTRUÇÃO DE REFINAMENTO:
1. Identifique a qual categoria editorial o texto pertence: Cliente / Produto ou Serviço / Problema / Solução / Novidade ou Oportunidade
2. Reescreva no formato Método OP: 1 linha curta com 4 camadas implícitas (ASSUNTO + CONTEXTO + DESEJO/CONQUISTA + DIREÇÃO)
3. Refine a forma e o ângulo a partir do texto do usuário, sem inventar assunto diferente
4. Se o texto estiver genérico ou abstrato, traga-o para uma situação prática ligada à atividade real da empresa e ao dia a dia do público — sem mudar o assunto original.
5. PROIBIDO: inventar assunto diferente do texto original

${criteriosRefinamentoOP}

ÂNGULO: MOTIVAÇÃO POSITIVA (desejo / aspiração / conquista / oportunidade).
NÃO aponte erro ou falta. Fale do que o público QUER alcançar, do próximo nível, da transformação positiva.
EVITE qualquer formulação crítica ao público ("não conseguem", "não sabem", "fazem errado").

Exemplos de refinamento com motivação (não copie — referência de FORMATO e TOM):
- "lojistas locais prontos para transformar o Instagram em vitrine que vende todo dia"
- "negócios consolidados que querem dar o próximo passo e ganhar autoridade no bairro"
- "marcas construindo presença digital com consistência e prontas para escalar resultados"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, no máximo 15 palavras, sem hashtag, sem emoji, sem aspas, carregada de aspiração positiva" }`;

          const marcaRefinarIdentidade = `Refine a Informação-chave do usuário para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}SEGMENTO: MARCA (conteúdo institucional, identidade, posicionamento, percepção, propósito — NÃO é venda).
TEXTO DO USUÁRIO (mantenha este assunto — refine a forma, NÃO invente outro): "${hint}"

${preservaHint}

${editorialBlock}

INSTRUÇÃO DE REFINAMENTO:
1. Identifique a qual categoria editorial o texto pertence: Cliente / Produto ou Serviço / Problema / Solução / Novidade ou Oportunidade
2. Reescreva no formato Método OP: 1 linha curta com 4 camadas implícitas (ASSUNTO + CONTEXTO + IDENTIDADE/PROPÓSITO + DIREÇÃO)
3. Refine a partir do texto do usuário mantendo o tom institucional, sem trocar o assunto
4. Se o texto estiver genérico ou abstrato, traga-o para uma situação prática ligada à atividade real da empresa — sem mudar o assunto original.
5. PROIBIDO: inventar assunto diferente do texto original, linguagem de venda, urgência, dor do cliente

${criteriosRefinamentoOP}

ÂNGULO: IDENTIDADE / POSICIONAMENTO.
Revele QUEM a marca é, o que representa, como quer ser percebida. Sem promessa comercial, sem CTA.

Exemplos de refinamento institucional (não copie — referência de TOM e FORMATO):
- "loja de bairro que virou parte da vida de duas gerações e segue construindo presença na cidade"
- "marca local com identidade própria reafirmando o jeito de fazer que a diferencia há anos"
- "negócio que carrega um propósito claro e quer ser reconhecido pelo que representa, não só pelo que vende"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, no máximo 15 palavras, sem hashtag, sem emoji, sem aspas, tom institucional de marca" }`;

          const marcaRefinarLegado = `Refine a Informação-chave do usuário para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}SEGMENTO: MARCA (conteúdo institucional — NÃO é venda).
TEXTO DO USUÁRIO (mantenha este assunto — refine a forma, NÃO invente outro): "${hint}"

${preservaHint}

${editorialBlock}

INSTRUÇÃO DE REFINAMENTO:
1. Identifique a qual categoria editorial o texto pertence: Cliente / Produto ou Serviço / Problema / Solução / Novidade ou Oportunidade
2. Reescreva no formato Método OP: 1 linha curta com 4 camadas implícitas (ASSUNTO + CONTEXTO + LEGADO/PERCEPÇÃO + DIREÇÃO)
3. Refine a partir do texto do usuário mantendo o tom institucional, sem trocar o assunto
4. Se o texto estiver genérico ou abstrato, traga-o para uma situação prática ligada à atividade real da empresa — sem mudar o assunto original.
5. PROIBIDO: inventar assunto diferente do texto original, linguagem comercial, dor do cliente, inversão negativa de pista positiva

${criteriosRefinamentoOP}

ÂNGULO: TRAJETÓRIA / LEGADO / VÍNCULO COM A COMUNIDADE.
Foco em história, tempo de mercado, vínculo afetivo, evolução da marca. Tom de orgulho calmo.

Exemplos de refinamento de legado (não copie — referência de TOM e FORMATO):
- "duas décadas atendendo famílias da mesma cidade e construindo uma marca que pertence ao lugar"
- "trajetória feita de detalhes que viraram a forma como a marca é reconhecida hoje"
- "presença local que atravessou gerações e segue ditando o tom da categoria no bairro"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, no máximo 15 palavras, sem hashtag, sem emoji, sem aspas, tom de legado e pertencimento" }`;

          let metodoPrompt: string;
          if (isRefinar) {
            if (segment === 'MARCA') {
              metodoPrompt = attempt % 2 === 0 ? marcaRefinarIdentidade : marcaRefinarLegado;
            } else {
              metodoPrompt = angulo === 'tensao' ? metodoRefinarTensao : metodoRefinarMotivacao;
            }
          } else if (segment === 'MARCA') {
            metodoPrompt = attempt % 2 === 0 ? marcaIdentidade : marcaLegado;
          } else {
            metodoPrompt = angulo === 'tensao' ? metodoTensao : metodoMotivacao;
          }

          const OBJETIVO_RULES: Record<string, string> = {
            promocao: 'REGRAS PARA PROMOÇÃO: sugira um desconto, oferta ou condição específica diferente das sugestões anteriores. PROIBIDO repetir o mesmo percentual de desconto ou a mesma data de encerramento já usados — varie o tipo de oferta (desconto, brinde, parcela, frete, kit), o produto/serviço em destaque e o prazo.',
            oportunidade: 'REGRAS PARA OPORTUNIDADE: PROIBIDO citar datas, prazos, dias ou períodos específicos. Represente a oportunidade por escassez, momento único ou contexto sazonal — sem especificar quando.',
            homenagem: `REGRAS PARA HOMENAGEM: datas comemorativas de referência (use APENAS se forem FUTURAS à DATA DE HOJE):
- Dia das Mães: 2º domingo de maio
- Dia dos Pais: 2º domingo de agosto
- Dia do Cliente: 15 de setembro
- Dia do Marketing: 27 de setembro
- Dia das Crianças: 12 de outubro
- Natal: 25 de dezembro
Para qualquer outra data comemorativa, use apenas se tiver certeza absoluta da data e ela for futura. Em caso de dúvida, homenageie uma pessoa, conquista ou marco da própria empresa.`,
            aviso: 'REGRAS PARA AVISO: o comunicado deve ser concreto e acionável — mudança de horário, nova política, prazo de cadastro, atualização de serviço. Evite avisos vagos como "novidades em breve".',
            institucional: 'REGRAS PARA INSTITUCIONAL: foque em um valor, propósito ou diferencial específico da empresa — não genérico. Prefira fatos concretos (anos de mercado, número de clientes, certificação, metodologia própria) a afirmações abstratas.',
          };

          const dateLine = objetivo === 'homenagem' ? `DATA DE HOJE: ${today}\n` : '';

          const postUnicoPrompt = `Sugira UMA Informação-chave para um post único de Instagram em português brasileiro.

${dateLine}${!isRefinar ? `EMPRESA: ${companyName || '(não informada)'}\nATIVIDADE: ${mainActivity || '(não informada)'}\n` : ''}OBJETIVO: ${objetivo} (tom: ${tom})
${hint ? `PISTA DO USUÁRIO (refine/melhore a partir disso): "${hint}"` : 'O usuário não deu pista — invente algo plausível e útil para a atividade.'}
${topicoGuiaBlock ? `\n${topicoGuiaBlock}\n` : ''}${previousBlock ? `\n${previousBlock}\n` : ''}
A Informação-chave é o FATO central que a peça vai comunicar (uma promoção concreta, um aviso, uma homenagem, uma oportunidade). Deve ser específica com nome ou fato real quando fizer sentido. NÃO é a legenda nem o título — é a matéria-prima do post.

${OBJETIVO_RULES[objetivo] || ''}

${criteriosSugestaoOP}

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 frase, no máximo 15 palavras, em português, sem hashtag, sem emoji, sem aspas, concreta e de fácil compreensão" }`;

          const userPrompt = mode === 'metodo' ? metodoPrompt : postUnicoPrompt;
          const systemMsg = mode === 'metodo'
            ? 'Você é estrategista do Método OP. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO: repetir a mesma palavra ou derivação morfológica da mesma raiz no mesmo texto. PROIBIDO ABSOLUTO no texto final: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01" a "OP-06", "mood" — são termos reservados. Use sinônimos contextuais. Antes de retornar: (1) pessoa com ensino médio entende de primeira? (2) há termo técnico desnecessário? (3) segmento e atividade estão refletidos? Se não, reescreva.'
            : 'Você é estrategista de conteúdo brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO repetir a mesma palavra ou qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue) no mesmo texto — use sinônimos ou reformule.';

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
