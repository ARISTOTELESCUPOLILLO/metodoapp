import { createFileRoute } from '@tanstack/react-router';
import { detectEditorialProfile } from '@/data/editorialProfiles';
import { getVoiceProfile } from '@/data/brandVoice';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { fetchOpenAIChat } from '@/lib/openaiClient.server';
import { truncateWords, validateSugestao, checkInventedPromotion } from '@/core/textValidation';

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

          const previousSugs: string[] = Array.isArray(body.previousSuggestions)
            ? body.previousSuggestions.slice(0, 6).map(String).filter(Boolean)
            : [];

          const SEGMENTS = ['VAREJO', 'SERVIÇOS', 'MARCA'] as const;
          type Seg = typeof SEGMENTS[number];
          const segment: Seg = (SEGMENTS as readonly string[]).includes(body.segment) ? (body.segment as Seg) : 'SERVIÇOS';

          // Eixos de leitura por segmento — direcionam a sugestão sem virar
          // biblioteca fixa de respostas.
          const SEGMENT_LENS: Record<Seg, string> = {
            VAREJO: 'compra, uso, desejo, escolha, comparação, ocasião, presente, estação, produto, rotina do cliente',
            'SERVIÇOS': 'problema, dúvida, decisão, risco, confiança, processo, manutenção, prevenção, atendimento, resultado percebido',
            MARCA: 'reconhecimento, identificação, percepção, vínculo, bastidor, diferenciação, valor percebido, história, relação com o público',
          };

          // Ancoragem na atividade — a ATIVIDADE é a fonte PRINCIPAL do
          // assunto da sugestão; o nome da empresa serve só para
          // identificação. Reúne 3 regras: (1) atividade como fonte
          // principal de entendimento do negócio, (2) cena concreta — a
          // sugestão nasce de uma situação real e reconhecível do ramo, não
          // de um conceito amplo que serviria para qualquer empresa do
          // segmento, e (3) cobertura — quando a atividade reúne vários
          // grupos de produtos/serviços, variar entre eles ao longo das
          // tentativas usando previousSuggestions, sem rodízio fixo nem
          // biblioteca de respostas.
          const ancoragemAtividade = mainActivity.trim()
            ? `FONTE PRINCIPAL DO ASSUNTO — ATIVIDADE DA EMPRESA:
A ATIVIDADE descrita acima ("${mainActivity}") é a PRINCIPAL fonte para entender o que essa empresa faz, vende, resolve ou oferece — é dali que a sugestão deve nascer. O NOME DA EMPRESA serve apenas para IDENTIFICAÇÃO: não use o nome como pista de assunto, a menos que o que ele sugere também esteja descrito na ATIVIDADE.

CENA CONCRETA: a sugestão deve partir de uma situação real e reconhecível desse ramo — um produto, peça, ferramenta, canal, procedimento ou momento específico do dia a dia — e NÃO de um conceito amplo que serviria para qualquer empresa do segmento ${segment} (ex.: "atendimento gera confiança", "escolha certa evita problemas", "empresa próxima vira referência").
Contraste esperado — exemplos de FORMATO de OUTROS RAMOS (não copie o vocabulário ou os produtos destes exemplos; servem só para mostrar o tipo de especificidade esperado — a sua sugestão deve usar vocabulário de "${mainActivity}", não destes exemplos): em vez de conceitos amplos como esses, prefira algo do tipo: "Instagram sem gerar oportunidades" ou "WhatsApp sem resposta reduz conversões" (exemplo do ramo consultoria de marketing); "filtro correto protege o equipamento" ou "mangueira inadequada gera vazamentos" (exemplo do ramo peças e lubrificantes); "correia desgastada pode parar a operação" ou "ferramenta certa evita retrabalho" (exemplo do ramo ferramentas e máquinas).
TESTE: se a frase serviria igual para qualquer outra empresa do segmento ${segment}, reescreva ancorando em algo reconhecível do ramo "${mainActivity}". Para atividades mais abstratas (sem produto físico), a cena concreta pode ser um canal, um momento de decisão ou uma interação típica desse ramo — não force um elemento artificial.

COBERTURA DA ATIVIDADE: se "${mainActivity}" reúne vários grupos de produtos, serviços ou soluções, ANTES de escrever liste mentalmente os grupos distintos que aparecem em "${mainActivity}" (cada item ou expressão separada por vírgula tende a indicar um grupo). Veja as SUGESTÕES ANTERIORES desta sessão (se houver), identifique a qual grupo cada uma pertence, e escolha para esta sugestão um grupo AINDA NÃO usado nas tentativas anteriores — desde que a atividade ofereça essa alternativa. Não crie rodízio fixo nem force todos os grupos a aparecer ao longo da sessão — apenas evite repetir o grupo da tentativa anterior quando houver alternativa real.`
            : '';
          const ancoragemAtividadeMarca = mainActivity.trim()
            ? `FONTE PRINCIPAL DO ASSUNTO — ATIVIDADE DA MARCA:
A ATIVIDADE descrita acima ("${mainActivity}") é a PRINCIPAL fonte para entender o que essa marca faz, oferece ou representa — é dali que a sugestão deve nascer. O NOME DA MARCA serve apenas para IDENTIFICAÇÃO: não use o nome como pista de assunto, a menos que o que ele sugere também esteja descrito na ATIVIDADE.

CENA CONCRETA: a sugestão deve partir de um elemento real e reconhecível dessa marca — um ingrediente, material, processo, ritual, território, gesto ou característica específica${mode === 'metodo' ? ' (sem dor do cliente, sem linguagem de venda)' : ''} — e NÃO de um conceito amplo que serviria para qualquer marca do segmento (ex.: "reconhecimento", "identificação", "vínculo", "valor percebido").
TESTE: se a frase serviria igual para qualquer outra marca do segmento, reescreva ancorando em algo reconhecível da marca "${mainActivity}". Para atividades mais abstratas, não force um elemento artificial.

COBERTURA DA ATIVIDADE: se "${mainActivity}" reúne vários elementos, produtos ou frentes da marca, ANTES de escrever liste mentalmente os elementos/frentes distintos que aparecem em "${mainActivity}". Veja as SUGESTÕES ANTERIORES desta sessão (se houver), identifique a qual frente cada uma pertence, e escolha para esta sugestão uma frente AINDA NÃO usada nas tentativas anteriores — desde que a marca ofereça essa alternativa. Não crie rodízio fixo nem force todos os elementos a aparecer ao longo da sessão — apenas evite repetir a frente da tentativa anterior quando houver alternativa real.`
            : '';
          const ancoragemBlock = segment === 'MARCA' ? ancoragemAtividadeMarca : ancoragemAtividade;

          // Reforço final (recência) — repete, já perto do JSON de saída, que o
          // assunto vem da ATIVIDADE e que o nome da empresa/marca não é pista.
          const sementeLembreteAtividade = mainActivity.trim()
            ? `\nLEMBRETE FINAL: a semente concreta deve nomear algo presente em "${mainActivity}".${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — se o que ele sugere não estiver na ATIVIDADE, ignore essa pista.` : ''}\n`
            : '';
          const sementeLembreteMarca = mainActivity.trim()
            ? `\nLEMBRETE FINAL: a semente concreta deve nomear um elemento real de "${mainActivity}".${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — se o que ele sugere não estiver na ATIVIDADE, ignore essa pista.` : ''}\n`
            : '';

          const segmentLensBlock = `LENTE DO SEGMENTO (${segment}): estes eixos indicam o TIPO de situação — o ÂNGULO, não o vocabulário — ${SEGMENT_LENS[segment]}. Evite usar essas palavras literalmente na frase; expresse o eixo escolhido com elementos concretos da atividade da empresa.`;

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
          // remover a proteção contra invenções — vale independente do objetivo
          // enviado, e a checkInventedPromotion continua rodando para o MOP sem
          // allowPromoLanguage: dados específicos (%, R$, brinde, prazo/data,
          // condição de compra) seguem bloqueados pelo D1 se o modelo não
          // seguir a instrução. Pista promocional não é descartada — é
          // reenquadrada como abertura de sequência.
          const proibicoesInventarMop = mode === 'metodo'
            ? ' No Método OP a Informação-chave abre uma SEQUÊNCIA — não é uma peça de promoção: ela NÃO promete oferta, desconto ou condição diretamente. SE a pista do usuário trouxer promoção/oferta com dados específicos (percentual, valor, brinde, prazo, data, "até X", "hoje", condição de compra), NÃO repita esses dados nem mantenha a promessa direta — extraia o ASSUNTO por trás da promoção (o produto/serviço/categoria em destaque) e reenquadre como abertura de sequência: preparação ou orientação para o momento ANTES dessa oferta. Exemplo: pista "30% off até domingo" → "como escolher peças certas antes da promoção". O assunto da pista NÃO deve ser descartado — apenas reenquadrado.'
            : '';
          const proibicoesInventar = (mode === 'metodo' || (objetivo !== 'promocao' && objetivo !== 'oportunidade'))
            ? `PROIBIDO inventar promoção, desconto, percentual, prazo, data, urgência ou oferta que o usuário não tenha fornecido — isso inclui termos como "promoção", "desconto", "off", "grátis", "oferta especial", "lançamento", "agenda aberta", "hoje", "até domingo" (ou qualquer outro dia/data/prazo) e chamadas de urgência ("não perca", "última chance", "por tempo limitado"). Esses termos só podem aparecer se já estiverem na pista do usuário ou na atividade da empresa informada acima.${proibicoesInventarMop} PROIBIDO também inventar: eventos • garantias • condições especiais • números • promessas absolutas que o usuário não forneceu.`
            : '';

          // allowedContext: termos de promoção/desconto/prazo/urgência só passam
          // pela checkInventedPromotion (D1) se já estiverem aqui — pista do
          // usuário ou atividade/empresa.
          const allowedContext = [
            hint,
            mainActivity,
            companyName,
          ].filter(Boolean).join(' ');
          // PU com objetivo 'promocao'/'oportunidade': o próprio objetivo da peça
          // pede tom promocional — a linguagem genérica ("promoção", "oferta",
          // "desconto" solto) é liberada, mas dados ESPECÍFICOS inventados
          // (%, R$, brinde, prazo/data, condição de compra) continuam bloqueados
          // pela checkInventedPromotion, que agora roda SEMPRE.
          const allowPromoLanguagePU = mode === 'postunico' && (objetivo === 'promocao' || objetivo === 'oportunidade');

          const criteriosSugestaoOP = `CRITÉRIOS DE QUALIDADE OP:
Construa 1 frase direta e específica: assunto + situação concreta + tensão ou desejo. Entre 5 e 10 palavras (máximo absoluto 12).
SINTAXE: qualquer palavra substantivada pode ser sujeito — substantivo, adjetivo, verbo no infinitivo ou locução; não restrinja a papéis pessoais. Evite cláusulas relativas encadeadas ("que X que Y que Z").
Se a categoria for "Novidade ou Oportunidade", use tendências e comportamentos emergentes — não invente datas ou promoções inexistentes.
${proibicoesInventar}
LINGUAGEM: uma ideia principal, ordem direta, palavras curtas e do dia a dia — priorize termos de até 3 sílabas sempre que houver opção mais simples (ex.: "jeito" em vez de "organização", "bom"/"rápido" em vez de "eficiente", "passos" em vez de "procedimentos", "clientes" em vez de "compradores", "perdem"/"deixam passar" em vez de "ignoram"). Uma pessoa com ensino médio deve entender de primeira, sem reler. PROIBIDO: "decisores", "receita previsível", "riscos operacionais", "maximizar resultados", "estruturar processos", "estratégias digitais eficazes", "impacto real", "organização", "eficiente", "procedimentos", "compradores", termos técnicos de consultoria e qualquer palavra formal/comprida quando existir alternativa popular mais curta. Prefira: "vendas" a "receita", "empresas" a "decisores", "melhorar" a "otimizar", "clientes" a "compradores", "jeito" a "organização", "bom" a "eficiente". Se precisar trocar uma palavra grande por palavras mais curtas e isso aproximar a frase do limite de 12, prefira isso a manter um termo difícil — mas nunca ultrapasse 12 palavras. EXCEÇÃO: se houver um elemento concreto central (produto, peça, serviço, objeto, procedimento) vindo do texto do usuário ou da atividade, esse termo pode ter mais de 3 sílabas (ex.: "equipamento", "manutenção", "lubrificante", "orçamento", "diagnóstico", "estratégia") — não o troque por palavra genérica só para simplificar.`;

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
NOTA DO MÉTODO: ${editorialProfile.notaMetodo}
TERRITÓRIO e ÂNGULOS acima são direções de leitura do perfil, não frases prontas. Se a ATIVIDADE da empresa (informada no início) apontar para um contexto mais específico e reconhecível do que esses ângulos genéricos, a ATIVIDADE PREVALECE — priorize a situação real da empresa sobre o ângulo do perfil.`
            // Sem perfil cadastrado para esta atividade (negócio novo/nicho não
            // previsto): em vez de ficar sem direção (string vazia), pede para o
            // próprio modelo ler a ATIVIDADE e construir a leitura de território
            // e ângulo a partir dela — sem tomar de empréstimo território,
            // ângulos ou vocabulário de outro segmento de negócio.
            : (mode === 'metodo' && mainActivity.trim()
              ? `PERFIL EDITORIAL: nenhum perfil específico cadastrado para esta atividade — não empreste território, ângulos ou vocabulário de outro tipo de negócio.
TERRITÓRIO: leia "${mainActivity}" e identifique que tipo real de ${isB2C ? 'momento, necessidade, decisão ou desconforto da vida do cliente' : 'situação, risco ou decisão do dia a dia do negócio'} essa atividade toca — esse é o território desta sugestão.
ÂNGULO: a partir desse território, o ângulo pedido mais abaixo (tensão, oportunidade, identidade ou legado) deve nascer de algo REAL e ESPECÍFICO de "${mainActivity}" — nunca de uma ideia genérica que serviria para qualquer negócio do segmento ${segment} (ex.: "falta de organização", "pouca visibilidade online", "crescer", "se destacar").
VOCABULÁRIO: use o vocabulário natural de quem trabalha ou é atendido em "${mainActivity}" — evite termos típicos de outros setores.`
              : '');

          const previousBlock = previousSugs.length
            ? `SUGESTÕES ANTERIORES NESTA SESSÃO (NÃO repita estes assuntos nem ângulos — gere algo completamente diferente; se a atividade reúne vários grupos de produtos/serviços, dê preferência a um grupo ainda não tocado por estas sugestões):\n${previousSugs.map(s => `- "${s}"`).join('\n')}`
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
${voiceBlock}${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO com base na ATIVIDADE da empresa e nas regras de ancoragem abaixo): "${hint}"` : 'Campo vazio — crie a partir da ATIVIDADE da empresa e das regras de ancoragem abaixo.'}

${audienceDirective}

${momentoContextBlock}

${editorialBlock}

${ancoragemBlock}

${previousBlock}

${criteriosSugestaoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: TENSÃO (problema, dúvida, erro comum ou escolha difícil real da atividade).
A Informação-chave é uma SEMENTE CONCRETA — um produto, serviço, situação, dúvida, erro, escolha ou necessidade real do dia a dia dessa atividade. NÃO é preciso embutir a progressão psicológica completa (dor → desejo → confiança → ação): o Método OP constrói essa progressão DEPOIS, na sequência de posts.

EVITE termos genéricos isolados (ex.: "marketing digital", "consultoria", "organização", "tráfego pago").
PREFIRA um fato, produto, situação ou decisão concreta e reconhecível dessa atividade.

Exemplos do método (não copie, use como referência de FORMATO):
- "anúncios pagos não trazem vendas para a loja local"
- "a empresa publica todo dia e continua invisível no Instagram"
- "comunicação desorganizada transmite insegurança ao cliente sem perceber"
${sementeLembreteAtividade}
Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, concreta e específica, ligada à atividade" }`;

          const metodoMotivacao = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO com base na ATIVIDADE da empresa e nas regras de ancoragem abaixo): "${hint}"` : 'Campo vazio — crie a partir da ATIVIDADE da empresa e das regras de ancoragem abaixo.'}

${audienceDirective}

${momentoContextBlock}

${editorialBlock}

${ancoragemBlock}

${previousBlock}

${criteriosSugestaoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: OPORTUNIDADE (situação positiva, necessidade real ou oportunidade concreta da atividade).
IMPORTANTE: NÃO "implique" com o público. Não aponte erro, falha ou falta.

A Informação-chave é uma SEMENTE CONCRETA — um produto, serviço, situação, necessidade ou oportunidade real do dia a dia dessa atividade. NÃO é preciso embutir a progressão psicológica completa (desejo → confiança → ação): o Método OP constrói essa progressão DEPOIS, na sequência de posts.

EVITE termos genéricos isolados (ex.: "marketing digital", "consultoria", "tráfego pago").
EVITE qualquer formulação que soe como crítica ao público ("não conseguem", "não sabem", "fazem errado", "estão perdidos").

Exemplos do método (não copie, use como referência de FORMATO e TOM):
- "a loja de bairro vende todo dia pelo Instagram"
- "o negócio local ganha autoridade com presença digital consistente"
- "a marca cresce com consistência nas redes sociais"
${sementeLembreteAtividade}
Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, concreta e específica, ligada a uma oportunidade real" }`;

          const marcaIdentidade = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}SEGMENTO: MARCA (conteúdo institucional, identidade, posicionamento, percepção, propósito — NÃO é venda).
${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO repita; gere algo NOVO com base na ATIVIDADE da marca e nas regras de ancoragem abaixo, preservando o sentido positivo da marca): "${hint}"` : 'Campo vazio — crie a partir da ATIVIDADE da marca e das regras de ancoragem abaixo.'}

${preservaHint}

${editorialBlock}

${ancoragemBlock}

${previousBlock}

${criteriosSugestaoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: IDENTIDADE / POSICIONAMENTO.
A Informação-chave é uma SEMENTE CONCRETA — um elemento real da marca (produto, ingrediente, material, processo, ritual, território ou característica) que revele QUEM a marca é ou o que representa. Sem dor do cliente, sem promessa comercial, sem CTA, sem urgência, sem gatilho de venda. NÃO é preciso embutir a progressão completa de posicionamento — o Método OP constrói isso DEPOIS, na sequência de posts.

PROIBIDO: linguagem de venda ("compre", "garanta", "oferta", "promoção"), dor do cliente ("não conseguem", "estão perdidos", "estagnação", "invisíveis"), urgência ("últimas vagas", "agora"), reinterpretação negativa de qualquer pista positiva do usuário.

Exemplos do método (não copie, use como referência de TOM e FORMATO institucional):
- "a loja de bairro pertence à história da cidade"
- "a marca local reafirma o jeito próprio de trabalhar"
- "o negócio tem um propósito claro além da venda"
${sementeLembreteMarca}
Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, concreta, ligada a um elemento real da marca, tom institucional" }`;

          const marcaLegado = `Construa UMA Informação-chave para uma SEQUÊNCIA do Método OP no Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}SEGMENTO: MARCA (conteúdo institucional — NÃO é venda).
${hint ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO repita; gere algo NOVO com base na ATIVIDADE da marca e nas regras de ancoragem abaixo, preservando o sentido positivo da marca): "${hint}"` : 'Campo vazio — crie a partir da ATIVIDADE da marca e das regras de ancoragem abaixo.'}

${preservaHint}

${editorialBlock}

${ancoragemBlock}

${previousBlock}

${criteriosSugestaoOP}

${aberturaSequenciaGuide}

${segmentLensBlock}

ÂNGULO: TRAJETÓRIA / LEGADO / VÍNCULO COM A COMUNIDADE.
A Informação-chave é uma SEMENTE CONCRETA — um fato, elemento ou marco real da trajetória da marca (história, repertório, tempo de mercado, vínculo com clientes, presença no território). Tom de orgulho calmo, sem auto-elogio comercial. NÃO é preciso embutir a progressão completa de legado/percepção — o Método OP constrói isso DEPOIS, na sequência de posts.

PROIBIDO: dor do cliente, crítica ao público, linguagem comercial agressiva, urgência, qualquer inversão negativa de uma pista positiva (ex.: transformar "20 anos de tradição" em "estagnação há 20 anos" é proibido).

Exemplos do método (não copie, use como referência de TOM e FORMATO):
- "a marca constrói vínculo com a comunidade há duas décadas"
- "pequenos detalhes definem como as pessoas lembram da marca"
- "a marca atravessou gerações e ainda é referência no bairro"
${sementeLembreteMarca}
Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 5 e 10 palavras (máximo absoluto 12), sem hashtag, sem emoji, sem aspas, concreta, ligada a um fato real da trajetória, tom de legado e pertencimento" }`;

          let metodoPrompt: string;
          if (segment === 'MARCA') {
            metodoPrompt = attempt % 2 === 0 ? marcaIdentidade : marcaLegado;
          } else {
            metodoPrompt = angulo === 'tensao' ? metodoTensao : metodoMotivacao;
          }

          const OBJETIVO_RULES: Record<string, string> = {
            promocao: 'REGRAS PARA PROMOÇÃO: use tom comercial/promocional — esse é o tom esperado para o objetivo (palavras como "promoção", "oferta", "aproveite", "garanta o seu" são bem-vindas). PROIBIDO inventar percentual de desconto, valor em reais, brinde/cortesia, prazo, data/dia da semana, "última chance" ou condição de compra (acima de/a partir de/sem juros/parcelamento) que o usuário não tenha informado. Esses dados só podem aparecer se já estiverem na pista do usuário ou na atividade/empresa. Se nada disso foi informado, descreva a oportunidade comercial de forma genérica — sem números, datas ou condições inventadas.',
            oportunidade: 'REGRAS PARA OPORTUNIDADE: represente a oportunidade por escassez, momento único ou contexto sazonal — sem especificar quando. PROIBIDO citar datas, prazos, dias ou períodos específicos, e PROIBIDO inventar percentual de desconto, valor em reais, brinde/cortesia ou condição de compra (acima de/a partir de/sem juros/parcelamento) que o usuário não tenha informado. Esses dados só podem aparecer se já estiverem na pista do usuário ou na atividade/empresa.',
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
${ancoragemBlock ? `\n${ancoragemBlock}\n` : ''}${previousBlock ? `\n${previousBlock}\n` : ''}
A Informação-chave é o FATO central que a peça vai comunicar (uma promoção concreta, um aviso, uma homenagem, uma oportunidade). Deve ser específica com nome ou fato real quando fizer sentido. NÃO é a legenda nem o título — é a matéria-prima do post.

ESTILO DA SUGESTÃO (POST ÚNICO): a peça é uma comunicação direta e autônoma — NÃO abre uma sequência. A sugestão pode ser uma afirmação, ou uma pergunta direta, comercial, situacional ou de reconhecimento (ex.: "Já trocou o pneu para o frio?", "Sábado tem horário especial?"), ou uma chamada — o que fizer mais sentido para o objetivo. EVITE formatos de dica educativa ou abertura de jornada (ex.: "como escolher...", "o que considerar antes de...", "passo a passo para..."): isso é formato de sequência do Método OP, não de post único.

${OBJETIVO_RULES[objetivo] || ''}

${criteriosSugestaoOP}

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 frase, entre 5 e 10 palavras (máximo absoluto 12), em português, sem hashtag, sem emoji, sem aspas, concreta e de fácil compreensão" }`;

          const userPrompt = mode === 'metodo' ? metodoPrompt : postUnicoPrompt;
          const systemMsg = mode === 'metodo'
            ? 'Você é estrategista do Método OP. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO: repetir a mesma palavra ou derivação morfológica da mesma raiz no mesmo texto. PROIBIDO ABSOLUTO no texto final: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01" a "OP-06", "mood" — são termos reservados. Use sinônimos contextuais. Antes de retornar: (1) pessoa com ensino médio entende de primeira? (2) há termo técnico, palavra grande ou formal (ex.: "procedimentos", "organização", "eficiente", "compradores") que poderia virar uma palavra curta e popular? (3) a frase parte de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — e não de um conceito amplo que serviria para qualquer empresa do segmento? Se sim para (2), troque por algo mais simples; se não para (3) e a atividade permitir, ajuste para algo concreto desse ramo antes de responder. Limite: entre 5 e 10 palavras por sugestão (máximo absoluto 12) — só passe de 10 quando isso permitir trocar uma palavra grande por palavras mais curtas e simples, e nunca ultrapasse 12. Frases com mais de 12 palavras devem ser cortadas antes de retornar.'
            : 'Você é estrategista de conteúdo brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO repetir a mesma palavra ou qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue) no mesmo texto — use sinônimos ou reformule. Antes de retornar, prefira que a frase parta de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — em vez de um conceito amplo que serviria para qualquer empresa do segmento.';

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
              model: 'gpt-4.1',
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
            motivos = motivos.concat(checkInventedPromotion(sugestao, allowedContext, { allowPromoLanguage: allowPromoLanguagePU }));
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
