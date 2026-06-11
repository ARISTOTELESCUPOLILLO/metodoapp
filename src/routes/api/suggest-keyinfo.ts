import { createFileRoute } from '@tanstack/react-router';
import { detectEditorialProfile } from '@/data/editorialProfiles';
import { getVoiceProfile } from '@/data/brandVoice';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { fetchOpenAIChat } from '@/lib/openaiClient.server';
import { truncateWords, validateSugestao } from '@/core/textValidation';

const OBJETIVO_TOM: Record<string, string> = {
  promocao: 'comercial, desejo, chamada para ação clara',
  homenagem: 'afetivo, respeitoso, contemplativo',
  aviso: 'institucional, claro, objetivo',
  oportunidade: 'urgência elegante, momento decisivo',
  institucional: 'institucional de marca, posicionamento, propósito, sóbrio e confiante',
  fatos: 'documental, registro fiel, objetivo',
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
          const topicoGuia: { categoria: string; item: string; subtitulo: string } | null =
            body.topicoGuia && body.topicoGuia.categoria && body.topicoGuia.item
              ? { categoria: String(body.topicoGuia.categoria), item: String(body.topicoGuia.item), subtitulo: String(body.topicoGuia.subtitulo || '') }
              : null;

          const previousSugs: string[] = Array.isArray(body.previousSuggestions)
            ? body.previousSuggestions.slice(0, 6).map(String).filter(Boolean)
            : [];

          const subMode = String(body.subMode || 'sugerir') as 'sugerir' | 'refinar';
          const isRefinar = subMode === 'refinar' && !!hint;

          const SEGMENTS = ['VAREJO', 'SERVIÇOS', 'MARCA'] as const;
          type Seg = typeof SEGMENTS[number];
          const segment: Seg = (SEGMENTS as readonly string[]).includes(body.segment) ? (body.segment as Seg) : 'SERVIÇOS';

          // Eixos de leitura por segmento (ver botão "Ideias" / ideiasAssuntos.ts)
          // — direcionam a sugestão sem virar biblioteca fixa de respostas.
          const SEGMENT_LENS: Record<Seg, string> = {
            VAREJO: 'compra, uso, desejo, escolha, comparação, ocasião, presente, estação, produto, rotina do cliente',
            'SERVIÇOS': 'problema, dúvida, decisão, risco, confiança, processo, manutenção, prevenção, atendimento, resultado percebido',
            MARCA: 'reconhecimento, identificação, percepção, vínculo, bastidor, diferenciação, valor percebido, história, relação com o público',
          };
          const segmentLensBlock = `LENTE DO SEGMENTO (${segment}): ancore a sugestão em um destes eixos — ${SEGMENT_LENS[segment]}.`;

          const AUDIENCES = ['B2C', 'B2B'] as const;
          type Aud = typeof AUDIENCES[number];
          const audience: Aud = (AUDIENCES as readonly string[]).includes(body.audience) ? (body.audience as Aud) : 'B2C';
          const isB2C = audience === 'B2C';

          const normalizeMomento = (s: string) =>
            s.toLowerCase()
              .replace(/[áàãâä]/g, 'a').replace(/[éèêë]/g, 'e')
              .replace(/[íìîï]/g, 'i').replace(/[óòõôö]/g, 'o')
              .replace(/[úùûü]/g, 'u').replace(/ç/g, 'c')
              .replace(/\s+/g, '');
          const momento = normalizeMomento(String(body.momento || ''));
          const MOMENTO_CONTEXT: Record<string, string> = {
            consolidacao: 'público já conhece e compra da marca — aprofundar relacionamento e fortalecer preferência.',
            lancamento: 'público está tendo o PRIMEIRO contato com a marca — o emissor se apresenta para quem ainda não o conhece. NÃO é o lançamento de um produto; é o momento em que a marca aparece pela primeira vez para esse público.',
            reativacao: 'público conhecia a marca mas parou de interagir — objetivo é reacender o interesse mostrando novidade ou evolução. NÃO é relançar um serviço; é reconectar com quem já esteve próximo.',
            sazonalidade: 'aproveitar um contexto externo de data, período, tendência ou evento — o tema é a oportunidade do momento, não a marca em si.',
            awareness: 'construir reconhecimento de marca em público que ainda não a conhece — sem pressão de conversão, sem CTA urgente.',
          };
          const momentoCtx = MOMENTO_CONTEXT[momento] || '';
          const momentoContextBlock = momentoCtx && mode === 'metodo'
            ? `CONTEXTO DO MOMENTO COMUNICATIVO: ${momentoCtx}\n`
            : '';

          const brandVoice = String(body.brandVoice || '').slice(0, 80);
          const voiceProfile = getVoiceProfile(brandVoice);
          const voiceBlock = voiceProfile
            ? `VOZ DA MARCA — "${voiceProfile.label}": ritmo: ${voiceProfile.ritmo}. Vocabulário: ${voiceProfile.vocabulario}. Registro: ${voiceProfile.registro}. Evitar: ${voiceProfile.evitar}.\n`
            : `LINGUAGEM: frases curtas, ordem direta, palavras do dia a dia. Profissional e mercadológico, sem jargão corporativo, sem termos técnicos. Uma ideia por frase.\n`;

          const preservaHint = hint
            ? `REGRA CRÍTICA DA PISTA: preserve o SENTIDO da pista do usuário (positivo, neutro ou crítico). Refine a FORMA, NUNCA inverta a intenção. Se a pista é positiva (ex.: "20 anos fazendo parte da vida da cidade"), NÃO transforme em dor/estagnação/crítica. Se é neutra, mantenha neutra. Se já carrega tensão, pode aprofundar.`
            : '';

          // Na MOP, objetivo de peça (ex.: 'promocao') pertence à PU e não deve
          // remover a proteção contra invenções — a sequência do Método OP nunca
          // inventa datas/descontos/promoções independente do objetivo enviado.
          const proibicoesInventar = (mode === 'metodo' || (objetivo !== 'promocao' && objetivo !== 'oportunidade'))
            ? `PROIBIDO inventar: datas • descontos • promoções • eventos • garantias • condições especiais • números • promessas absolutas que o usuário não forneceu.`
            : '';

          const criteriosRefinamentoOP = `CRITÉRIOS DE QUALIDADE — PROCESSO DE REFINAMENTO:

PASSO 1 — PRESERVE O ASSUNTO: mantenha o tema do usuário, mude apenas a forma e o ângulo.

PASSO 2 — VALIDE: se a categoria for "Novidade ou Oportunidade" e o texto for crença ou tese genérica, NÃO invente promoção, data ou desconto — transforme em observação de comportamento ou tendência real.

PASSO 3 — REENQUADRE SEM TRAIR A IDEIA: ajuste o ângulo mantendo o sentido central. Se positivo, mantenha positivo.

PASSO 4 — ESCREVA COM CLAREZA: 1 frase direta e simples, entre 5 e 10 palavras (máximo absoluto 12). Sintaxe: qualquer palavra substantivada pode ser sujeito — substantivo, adjetivo, verbo no infinitivo ou locução; não restrinja a papéis pessoais. Evite encadear mais de uma cláusula relativa.

${proibicoesInventar}
LINGUAGEM: uma ideia principal, ordem direta, palavras curtas e do dia a dia — priorize termos de até 3 sílabas sempre que houver opção mais simples (ex.: "jeito" em vez de "organização", "bom"/"rápido" em vez de "eficiente", "passos" em vez de "procedimentos", "clientes" em vez de "compradores", "perdem"/"deixam passar" em vez de "ignoram"). Uma pessoa com ensino médio deve entender de primeira, sem reler. PROIBIDO: "decisores", "receita previsível", "riscos operacionais", "maximizar resultados", "estruturar processos", "estratégias digitais eficazes", "impacto real", "organização", "eficiente", "procedimentos", "compradores", termos técnicos de consultoria e qualquer palavra formal/comprida quando existir alternativa popular mais curta. Prefira: "vendas" a "receita", "empresas" a "decisores", "melhorar" a "otimizar", "clientes" a "compradores", "jeito" a "organização", "bom" a "eficiente". Se precisar trocar uma palavra grande por palavras mais curtas e isso aproximar a frase do limite de 12, prefira isso a manter um termo difícil — mas nunca ultrapasse 12 palavras.`;

          const criteriosSugestaoOP = `CRITÉRIOS DE QUALIDADE OP:
Construa 1 frase direta e específica: assunto + situação concreta + tensão ou desejo. Entre 5 e 10 palavras (máximo absoluto 12).
SINTAXE: qualquer palavra substantivada pode ser sujeito — substantivo, adjetivo, verbo no infinitivo ou locução; não restrinja a papéis pessoais. Evite cláusulas relativas encadeadas ("que X que Y que Z").
Se a categoria for "Novidade ou Oportunidade", use tendências e comportamentos emergentes — não invente datas ou promoções inexistentes.
${proibicoesInventar}
LINGUAGEM: uma ideia principal, ordem direta, palavras curtas e do dia a dia — priorize termos de até 3 sílabas sempre que houver opção mais simples (ex.: "jeito" em vez de "organização", "bom"/"rápido" em vez de "eficiente", "passos" em vez de "procedimentos", "clientes" em vez de "compradores", "perdem"/"deixam passar" em vez de "ignoram"). Uma pessoa com ensino médio deve entender de primeira, sem reler. PROIBIDO: "decisores", "receita previsível", "riscos operacionais", "maximizar resultados", "estruturar processos", "estratégias digitais eficazes", "impacto real", "organização", "eficiente", "procedimentos", "compradores", termos técnicos de consultoria e qualquer palavra formal/comprida quando existir alternativa popular mais curta. Prefira: "vendas" a "receita", "empresas" a "decisores", "melhorar" a "otimizar", "clientes" a "compradores", "jeito" a "organização", "bom" a "eficiente". Se precisar trocar uma palavra grande por palavras mais curtas e isso aproximar a frase do limite de 12, prefira isso a manter um termo difícil — mas nunca ultrapasse 12 palavras.`;

          // ── Abertura de sequência (MOP) ───────────────────────────────────
          // A Informação-chave do Método OP nasce como ponto de partida de uma
          // sequência (Conhecer → Sentir → Agir), não como tema solto. As
          // referências de formato abaixo são exemplos de INTENÇÃO de
          // condução — não um molde fixo. Variar a estrutura entre tentativas
          // evita que toda sugestão saia com a mesma fórmula.
          const aberturaSequenciaGuide = `INTENÇÃO DE ABERTURA DE SEQUÊNCIA:
A Informação-chave é o ponto de partida de uma sequência do Método OP (Conhecer → Sentir → Agir) — não um tema isolado. Ela deve carregar uma intenção de CONDUÇÃO: orientar, informar, esclarecer, explicar, alertar, demonstrar, comparar ou preparar o público para agir.
Referências de formato (use como inspiração, NÃO como molde obrigatório — varie a estrutura entre as tentativas, não repita sempre a mesma forma): "como escolher...", "erro comum ao...", "o que observar antes de...", "antes de decidir...", "quando vale a pena...", "por que isso acontece...", "sinal de que é hora de...", "diferença entre... e...", "o que muda quando...", "o que considerar ao...". Nem toda sugestão precisa se encaixar nessas formas — o essencial é a intenção de condução, não a fórmula de superfície.`;

          // ── Público-alvo — regra crítica para B2C vs B2B ──────────────────
          const audienceDirective = isB2C
            ? `PÚBLICO-ALVO: CONSUMIDOR FINAL (B2C).
A Informação-chave deve falar com a PESSOA, não com o empresário.
PROIBIDO no texto gerado: "empreendedor", "empresário", "empresária", "gestor", "gestora", "decisor", "liderança", "equipe", "time", "empresa cliente", "negócio" como sujeito.
Escreva como se estivesse falando com alguém que usa o produto/serviço na própria vida.`
            : `PÚBLICO-ALVO: EMPRESARIAL (B2B).
A Informação-chave deve falar com o dono, sócio, gestor ou responsável pelo negócio.
Foque em situações reais de trabalho: atendimento, resultado, organização, vendas, prazo, confiança ou crescimento.
Evite linguagem de grande consultoria e termos frios como "decisores", "receita previsível", "riscos operacionais".
SUJEITO DA FRASE (B2B): qualquer palavra da língua portuguesa pode ser sujeito quando substantivada — substantivo concreto ou abstrato, adjetivo, verbo no infinitivo, locução. Não restrinja a papéis pessoais ("gestores", "equipes", "donos"). Exemplos válidos: "A organização que falta custa caro", "Não responder a tempo afasta cliente", "Confiar custa caro quando a marca falha", "O detalhe que o cliente percebe define a escolha", "Crescer exige comunicação alinhada". NUNCA use "clientes", "consumidores" ou "compradores" como sujeito principal — esses termos fazem a frase soar como crítica ao cliente da empresa, não como espelho da realidade do receptor.`;

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
Categoria: ${topicoGuia.categoria}${topicoGuia.subtitulo ? ` (${topicoGuia.subtitulo})` : ''}
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

${momentoContextBlock}${progressaoMetodo}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

${criteriosSugestaoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: TENSÃO PSICOLÓGICA (dor / conflito / consequência).
REGRA OP — escreva em 1 LINHA CURTA contendo 4 camadas implícitas:
ASSUNTO + CONTEXTO + DOR/DESEJO + DIREÇÃO.
Deve ATIVAR pelo menos um destes gatilhos: movimento, conflito, mudança, comparação, consequência.

EVITE termos genéricos isolados (ex.: "marketing digital", "consultoria", "organização", "tráfego pago").
PREFIRA versões com tensão psicológica e direção da sequência.

Exemplos do método (não copie, use como referência de FORMATO):
- "anúncios pagos não trazem vendas para a loja local"
- "a empresa publica todo dia e continua invisível no Instagram"
- "comunicação desorganizada transmite insegurança ao cliente sem perceber"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, carregada de intenção" }`;

          const metodoMotivacao = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO sobre o ASSUNTO OBRIGATÓRIO abaixo): "${hint}"` : 'Campo vazio — crie sobre o assunto obrigatório abaixo.'}

${audienceDirective}

${momentoContextBlock}${progressaoMetodo}

${editorialBlock}

${topicoGuiaBlock}

${previousBlock}

${criteriosSugestaoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: MOTIVAÇÃO POSITIVA (desejo / aspiração / conquista / oportunidade).
IMPORTANTE: NÃO "implique" com o público. Não aponte erro, falha ou falta. Fale do que ele QUER alcançar, do próximo nível, da transformação positiva — como quem reconhece o esforço e mostra o caminho.

REGRA OP — escreva em 1 LINHA CURTA contendo 4 camadas implícitas:
ASSUNTO + CONTEXTO + DESEJO/CONQUISTA/ASPIRAÇÃO + DIREÇÃO.
Gatilhos válidos: movimento, transformação positiva, oportunidade, orgulho, evolução, próximo nível.

EVITE termos genéricos isolados (ex.: "marketing digital", "consultoria", "tráfego pago").
EVITE qualquer formulação que soe como crítica ao público ("não conseguem", "não sabem", "fazem errado", "estão perdidos").

Exemplos do método (não copie, use como referência de FORMATO e TOM):
- "a loja de bairro vende todo dia pelo Instagram"
- "o negócio local ganha autoridade com presença digital consistente"
- "a marca cresce com consistência nas redes sociais"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, carregada de aspiração positiva" }`;

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

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: IDENTIDADE / POSICIONAMENTO.
A Informação-chave deve revelar QUEM a marca é, o que ela representa, como quer ser percebida no território/categoria. Sem dor do cliente, sem promessa comercial, sem CTA, sem urgência, sem gatilho de venda.

REGRA OP — 1 LINHA CURTA com 4 camadas implícitas:
ASSUNTO + CONTEXTO + IDENTIDADE/PROPÓSITO + DIREÇÃO.

PROIBIDO: linguagem de venda ("compre", "garanta", "oferta", "promoção"), dor do cliente ("não conseguem", "estão perdidos", "estagnação", "invisíveis"), urgência ("últimas vagas", "agora"), reinterpretação negativa de qualquer pista positiva do usuário.

Exemplos do método (não copie, use como referência de TOM e FORMATO institucional):
- "a loja de bairro pertence à história da cidade"
- "a marca local reafirma o jeito próprio de trabalhar"
- "o negócio tem um propósito claro além da venda"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, tom institucional de marca" }`;

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

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: TRAJETÓRIA / LEGADO / VÍNCULO COM A COMUNIDADE.
Foco em história, repertório, tempo de mercado, vínculo afetivo com clientes, evolução da marca, presença no território. Tom de orgulho calmo, sem auto-elogio comercial.

REGRA OP — 1 LINHA CURTA com 4 camadas implícitas:
ASSUNTO + CONTEXTO + LEGADO/PERCEPÇÃO + DIREÇÃO.

PROIBIDO: dor do cliente, crítica ao público, linguagem comercial agressiva, urgência, qualquer inversão negativa de uma pista positiva (ex.: transformar "20 anos de tradição" em "estagnação há 20 anos" é proibido).

Exemplos do método (não copie, use como referência de TOM e FORMATO):
- "a marca constrói vínculo com a comunidade há duas décadas"
- "pequenos detalhes definem como as pessoas lembram da marca"
- "a marca atravessou gerações e ainda é referência no bairro"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, tom de legado e pertencimento" }`;

          // ── Prompts de REFINAMENTO (campo com texto) ──────────────────────

          const metodoRefinarTensao = `Refine a Informação-chave do usuário para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}TEXTO DO USUÁRIO (mantenha este assunto — refine a forma, NÃO invente outro): "${hint}"

${audienceDirective}

${momentoContextBlock}${progressaoMetodo}

${editorialBlock}

INSTRUÇÃO DE REFINAMENTO:
1. Preserve o ASSUNTO do usuário — mude apenas a forma.
2. Reescreva em 1 frase curta e direta: quem + o quê + tensão ou dor. Entre 5 e 10 palavras (máximo absoluto 12).
3. SINTAXE: qualquer palavra substantivada pode ser sujeito — não restrinja a papéis pessoais. Evite cláusulas relativas encadeadas ("que X que Y que Z").
4. Se o texto estiver vago, traga para uma situação concreta do dia a dia da empresa.
5. PROIBIDO: inventar assunto diferente, usar "que" mais de 1 vez na frase.

${criteriosRefinamentoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: TENSÃO PSICOLÓGICA (dor / conflito / consequência).
Deve ATIVAR pelo menos um gatilho: movimento, conflito, mudança, comparação, consequência.

EVITE termos genéricos isolados ("marketing digital", "consultoria", "organização", "tráfego pago").

Exemplos de refinamento com tensão (não copie — referência de FORMATO):
- "anúncios pagos não trazem vendas para a loja local"
- "a empresa publica todo dia e continua invisível no Instagram"
- "comunicação desorganizada transmite insegurança ao cliente sem perceber"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, carregada de intenção" }`;

          const metodoRefinarMotivacao = `Refine a Informação-chave do usuário para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}TEXTO DO USUÁRIO (mantenha este assunto — refine a forma, NÃO invente outro): "${hint}"

${audienceDirective}

${momentoContextBlock}${progressaoMetodo}

${editorialBlock}

INSTRUÇÃO DE REFINAMENTO:
1. Preserve o ASSUNTO do usuário — mude apenas a forma.
2. Reescreva em 1 frase curta e direta: quem + o quê + desejo ou conquista. Entre 5 e 10 palavras (máximo absoluto 12).
3. SINTAXE: qualquer palavra substantivada pode ser sujeito — não restrinja a papéis pessoais. Evite cláusulas relativas encadeadas ("que X que Y que Z").
4. Se o texto estiver vago, traga para uma situação concreta do dia a dia da empresa.
5. PROIBIDO: inventar assunto diferente, usar "que" mais de 1 vez na frase.

${criteriosRefinamentoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: MOTIVAÇÃO POSITIVA (desejo / aspiração / conquista / oportunidade).
NÃO aponte erro ou falta. Fale do que o público QUER alcançar, do próximo nível, da transformação positiva.
EVITE qualquer formulação crítica ao público ("não conseguem", "não sabem", "fazem errado").

Exemplos de refinamento com motivação (não copie — referência de FORMATO e TOM):
- "a loja de bairro vende todo dia pelo Instagram"
- "o negócio local ganha autoridade com presença digital consistente"
- "a marca cresce com consistência nas redes sociais"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, carregada de aspiração positiva" }`;

          const marcaRefinarIdentidade = `Refine a Informação-chave do usuário para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}SEGMENTO: MARCA (conteúdo institucional, identidade, posicionamento, percepção, propósito — NÃO é venda).
TEXTO DO USUÁRIO (mantenha este assunto — refine a forma, NÃO invente outro): "${hint}"

${preservaHint}

${editorialBlock}

INSTRUÇÃO DE REFINAMENTO:
1. Preserve o ASSUNTO do usuário — mude apenas a forma.
2. Reescreva em 1 frase curta e direta: marca + identidade ou propósito. Entre 5 e 10 palavras (máximo absoluto 12).
3. SINTAXE: qualquer palavra substantivada pode ser sujeito — não restrinja a papéis pessoais. Evite cláusulas relativas encadeadas ("que X que Y que Z").
4. Se o texto estiver vago, traga para uma situação concreta da marca.
5. PROIBIDO: inventar assunto diferente, usar "que" mais de 1 vez na frase, linguagem de venda, urgência.

${criteriosRefinamentoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: IDENTIDADE / POSICIONAMENTO.
Revele QUEM a marca é, o que representa, como quer ser percebida. Sem promessa comercial, sem CTA.

Exemplos de refinamento institucional (não copie — referência de TOM e FORMATO):
- "a loja de bairro pertence à história da cidade"
- "a marca local reafirma o jeito próprio de trabalhar"
- "o negócio tem um propósito claro além da venda"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, tom institucional de marca" }`;

          const marcaRefinarLegado = `Refine a Informação-chave do usuário para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}SEGMENTO: MARCA (conteúdo institucional — NÃO é venda).
TEXTO DO USUÁRIO (mantenha este assunto — refine a forma, NÃO invente outro): "${hint}"

${preservaHint}

${editorialBlock}

INSTRUÇÃO DE REFINAMENTO:
1. Preserve o ASSUNTO do usuário — mude apenas a forma.
2. Reescreva em 1 frase curta e direta: marca + trajetória ou vínculo. Entre 5 e 10 palavras (máximo absoluto 12).
3. SINTAXE: qualquer palavra substantivada pode ser sujeito — não restrinja a papéis pessoais. Evite cláusulas relativas encadeadas ("que X que Y que Z").
4. Se o texto estiver vago, traga para um fato concreto da trajetória da marca.
5. PROIBIDO: inventar assunto diferente, usar "que" mais de 1 vez na frase, linguagem comercial, dor do cliente, inversão negativa.

${criteriosRefinamentoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: TRAJETÓRIA / LEGADO / VÍNCULO COM A COMUNIDADE.
Foco em história, tempo de mercado, vínculo afetivo, evolução da marca. Tom de orgulho calmo.

Exemplos de refinamento de legado (não copie — referência de TOM e FORMATO):
- "a marca constrói vínculo com a comunidade há duas décadas"
- "pequenos detalhes definem como as pessoas lembram da marca"
- "a marca atravessou gerações e ainda é referência no bairro"

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, tom de legado e pertencimento" }`;

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

${dateLine}EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}${segmentLensBlock}
OBJETIVO: ${objetivo} (tom: ${tom})
${hint ? `PISTA DO USUÁRIO (refine/melhore a partir disso): "${hint}"` : 'O usuário não deu pista — invente algo plausível e útil para a atividade.'}
${topicoGuiaBlock ? `\n${topicoGuiaBlock}\n` : ''}${previousBlock ? `\n${previousBlock}\n` : ''}
A Informação-chave é o FATO central que a peça vai comunicar (uma promoção concreta, um aviso, uma homenagem, uma oportunidade). Deve ser específica com nome ou fato real quando fizer sentido. NÃO é a legenda nem o título — é a matéria-prima do post.

ESTILO DA SUGESTÃO (POST ÚNICO): a peça é uma comunicação direta e autônoma — NÃO abre uma sequência. A sugestão pode ser uma afirmação, ou uma pergunta direta, comercial, situacional ou de reconhecimento (ex.: "Já trocou o pneu para o frio?", "Sábado tem horário especial?"), ou uma chamada — o que fizer mais sentido para o objetivo. EVITE formatos de dica educativa ou abertura de jornada (ex.: "como escolher...", "o que considerar antes de...", "passo a passo para..."): isso é formato de sequência do Método OP, não de post único.

${OBJETIVO_RULES[objetivo] || ''}

${criteriosSugestaoOP}

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 frase, entre 5 e 10 palavras (máximo absoluto 12), em português, sem hashtag, sem emoji, sem aspas, concreta e de fácil compreensão" }`;

          const userPrompt = mode === 'metodo' ? metodoPrompt : postUnicoPrompt;
          const systemMsg = mode === 'metodo'
            ? 'Você é estrategista do Método OP. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO: repetir a mesma palavra ou derivação morfológica da mesma raiz no mesmo texto. PROIBIDO ABSOLUTO no texto final: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01" a "OP-06", "mood" — são termos reservados. Use sinônimos contextuais. Antes de retornar: (1) pessoa com ensino médio entende de primeira? (2) há termo técnico, palavra grande ou formal (ex.: "procedimentos", "organização", "eficiente", "compradores") que poderia virar uma palavra curta e popular? (3) segmento e atividade estão refletidos? Se sim para (2), troque por algo mais simples antes de responder. Limite: entre 5 e 10 palavras por sugestão (máximo absoluto 12) — só passe de 10 quando isso permitir trocar uma palavra grande por palavras mais curtas e simples, e nunca ultrapasse 12. Frases com mais de 12 palavras devem ser cortadas antes de retornar.'
            : 'Você é estrategista de conteúdo brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO repetir a mesma palavra ou qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue) no mesmo texto — use sinônimos ou reformule.';

          // D1 (validateSugestao) + 1 retry no máximo: se a sugestão sair vaga
          // (muito curta/longa, terminação pendurada ou frase-clichê), pede uma
          // nova versão reforçando o motivo. Nunca retorna erro ao usuário por
          // causa disso — devolve a melhor tentativa, sempre truncada a 12
          // palavras (ver REGRA DE LIMITE).
          const MAX_SUGGEST_ATTEMPTS = 2;
          let sugestao = '';
          let motivos: string[] = [];

          for (let pass = 1; pass <= MAX_SUGGEST_ATTEMPTS; pass++) {
            const reinforcement = pass > 1 && motivos.length > 0
              ? `\n\nATENÇÃO: a tentativa anterior teve este problema: ${motivos.join('; ')}. Gere uma NOVA versão que corrija isso, mantendo o mesmo assunto e a mesma intenção.`
              : '';

            const result = await fetchOpenAIChat(apiKey, {
              model: 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: systemMsg },
                { role: 'user', content: `${userPrompt}${reinforcement}` },
              ],
              temperature: 0.95,
              response_format: { type: 'json_object' },
            });

            if (!result.ok) {
              return Response.json({ error: result.error }, { status: result.status });
            }
            const content = result.data.choices?.[0]?.message?.content;
            if (!content) return Response.json({ error: 'Resposta vazia' }, { status: 502 });

            let parsed: { sugestao?: string };
            try { parsed = JSON.parse(content); } catch { return Response.json({ error: 'JSON inválido' }, { status: 502 }); }

            sugestao = truncateWords(String(parsed.sugestao || '').trim().replace(/^"|"$/g, ''), 12);
            if (!sugestao) return Response.json({ error: 'Sugestão vazia' }, { status: 502 });

            motivos = validateSugestao(sugestao);
            if (motivos.length === 0) break;
          }

          return Response.json({ sugestao });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
