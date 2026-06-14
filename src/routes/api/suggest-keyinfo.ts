import { createFileRoute } from '@tanstack/react-router';
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

// Escolhe o item da lista de produtos/serviços marcados que vira a semente
// concreta desta sugestão — rotação determinística por "attempt", evitando
// (quando possível) repetir um item cujo assunto já apareceu nas sugestões
// anteriores desta sessão.
function pickConcreteItem(items: string[], attempt: number, previousSuggestions: string[]): string | null {
  if (!items.length) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[áàãâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòõôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c');
  const usedNorms = previousSuggestions.map(norm);
  const startIdx = ((attempt % items.length) + items.length) % items.length;
  for (let i = 0; i < items.length; i++) {
    const idx = (startIdx + i) % items.length;
    const n = norm(items[idx]);
    if (!usedNorms.some((p) => p.includes(n) || n.includes(p))) return items[idx];
  }
  return items[startIdx];
}

// Gera um número estável a partir de uma string (empresa + atividade), usado
// para variar a lente de abertura entre empresas sem depender de estado
// externo.
function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Lentes de abertura — 15 formas internas de encontrar o ASSUNTO da
// Informação-chave (Sugestão MOP e PU) a partir do elemento concreto e da
// atividade. São orientação de geração apenas: nunca aparecem no JSON de
// saída nem na UI, e não criam tensão, promessa emocional, progressão ou
// linguagem de campanha — apenas variam o ângulo de observação de um fato
// concreto.
const OPENING_LENSES: { nome: string; guia: string }[] = [
  { nome: 'Situação real', guia: 'Parta de uma situação real e cotidiana ligada ao elemento concreto — algo que de fato acontece nesse ramo, descrito sem dramatizar.' },
  { nome: 'Dúvida comum', guia: 'Parta de uma dúvida comum que clientes têm sobre o elemento concreto antes de usar, contratar ou comprar.' },
  { nome: 'Oportunidade', guia: 'Parta de um contexto, uso ou momento em que o elemento concreto se encaixa bem — uma oportunidade objetiva, sem tom de campanha.' },
  { nome: 'Processo', guia: 'Parta de uma etapa do processo do dia a dia que envolve o elemento concreto — como ele é feito, escolhido ou mantido.' },
  { nome: 'Resultado observável', guia: 'Parta de um resultado concreto e observável que o elemento entrega ou permite — algo que se nota no dia a dia.' },
  { nome: 'Uso no dia a dia', guia: 'Parta de como o elemento concreto aparece no dia a dia de quem usa, compra ou contrata.' },
  { nome: 'Escolha antes da compra', guia: 'Parta de um critério ou detalhe que faz diferença na hora de escolher o elemento concreto.' },
  { nome: 'Comparação prática', guia: 'Parta de uma comparação prática entre opções, tipos ou versões do elemento concreto.' },
  { nome: 'Problema recorrente', guia: 'Parta de um problema recorrente e concreto ligado ao elemento — descrito como fato do dia a dia, sem dramatizar.' },
  { nome: 'Necessidade percebida', guia: 'Parta de uma necessidade real e concreta que o elemento atende.' },
  { nome: 'Benefício concreto', guia: 'Parta de um benefício direto e concreto do elemento — o que ele resolve ou facilita na prática.' },
  { nome: 'Sinal de atenção', guia: 'Parta de um sinal ou detalhe perceptível que indica quando algo relacionado ao elemento concreto precisa de atenção.' },
  { nome: 'Decisão comum do cliente', guia: 'Parta de uma decisão comum que o cliente toma envolvendo o elemento concreto.' },
  { nome: 'Contexto de uso', guia: 'Parta do ambiente, local ou contexto em que o elemento concreto costuma ser usado.' },
  { nome: 'Erro evitável', guia: 'Parta de um erro comum e evitável relacionado ao elemento concreto — descrito como fato, sem culpar o cliente.' },
];

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

          const previousSugs: string[] = Array.isArray(body.previousSuggestions)
            ? body.previousSuggestions.slice(0, 6).map(String).filter(Boolean)
            : [];

          const selectedProducts: string[] = Array.isArray(body.selectedProducts)
            ? body.selectedProducts.slice(0, 10).map((s: unknown) => String(s).slice(0, 80)).filter(Boolean)
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
          // identificação. Reúne 2 regras: (1) atividade como fonte
          // principal de entendimento do negócio, e (2) cena concreta — a
          // sugestão nasce de uma situação real e reconhecível do ramo, não
          // de um conceito amplo que serviria para qualquer empresa do
          // segmento. A escolha do assunto concreto em si vem de
          // elementoConcretoBlock (lista de produtos/serviços do Kit).
          const ancoragemAtividade = mainActivity.trim()
            ? `FONTE PRINCIPAL DO ASSUNTO — ATIVIDADE DA EMPRESA:
A ATIVIDADE descrita acima ("${mainActivity}") é a PRINCIPAL fonte para entender o que essa empresa faz, vende, resolve ou oferece — é dali que a sugestão deve nascer. O NOME DA EMPRESA serve apenas para IDENTIFICAÇÃO: não use o nome como pista de assunto, a menos que o que ele sugere também esteja descrito na ATIVIDADE.

CENA CONCRETA: a sugestão deve partir de uma situação real e reconhecível desse ramo — um produto, peça, ferramenta, canal, procedimento ou momento específico do dia a dia — e NÃO de um conceito amplo que serviria para qualquer empresa do segmento ${segment} (ex.: "atendimento gera confiança", "escolha certa evita problemas", "empresa próxima vira referência").
Contraste esperado — exemplos de FORMATO de OUTROS RAMOS (não copie o vocabulário ou os produtos destes exemplos; servem só para mostrar o tipo de especificidade esperado — a sua sugestão deve usar vocabulário de "${mainActivity}", não destes exemplos): em vez de conceitos amplos como esses, prefira algo do tipo: "Instagram sem gerar oportunidades" ou "WhatsApp sem resposta reduz conversões" (exemplo do ramo consultoria de marketing); "filtro correto protege o equipamento" ou "mangueira inadequada gera vazamentos" (exemplo do ramo peças e lubrificantes); "correia desgastada pode parar a operação" ou "ferramenta certa evita retrabalho" (exemplo do ramo ferramentas e máquinas).
TESTE: se a frase serviria igual para qualquer outra empresa do segmento ${segment}, reescreva ancorando em algo reconhecível do ramo "${mainActivity}". Para atividades mais abstratas (sem produto físico), a cena concreta pode ser um canal, um momento de decisão ou uma interação típica desse ramo — não force um elemento artificial.`
            : '';
          const ancoragemAtividadeMarca = mainActivity.trim()
            ? `FONTE PRINCIPAL DO ASSUNTO — ATIVIDADE DA MARCA:
A ATIVIDADE descrita acima ("${mainActivity}") é a PRINCIPAL fonte para entender o que essa marca faz, oferece ou representa — é dali que a sugestão deve nascer. O NOME DA MARCA serve apenas para IDENTIFICAÇÃO: não use o nome como pista de assunto, a menos que o que ele sugere também esteja descrito na ATIVIDADE.

CENA CONCRETA: a sugestão deve partir de um elemento real e reconhecível dessa marca — um ingrediente, material, processo, ritual, território, gesto ou característica específica${mode === 'metodo' ? ' (sem dor do cliente, sem linguagem de venda)' : ''} — e NÃO de um conceito amplo que serviria para qualquer marca do segmento (ex.: "reconhecimento", "identificação", "vínculo", "valor percebido").
TESTE: se a frase serviria igual para qualquer outra marca do segmento, reescreva ancorando em algo reconhecível da marca "${mainActivity}". Para atividades mais abstratas, não force um elemento artificial.`
            : '';
          const ancoragemBlock = segment === 'MARCA' ? ancoragemAtividadeMarca : ancoragemAtividade;

          // Elemento concreto — semente determinística escolhida a partir da
          // lista de produtos/serviços marcados pelo usuário no Kit de Marca.
          // Substitui a antiga "COBERTURA DA ATIVIDADE" (rodízio mental por
          // grupos da atividade) por um dado real e explícito.
          const concreteItem = pickConcreteItem(selectedProducts, attempt, previousSugs);
          const elementoConcretoBlock = concreteItem
            ? `ELEMENTO CONCRETO DESTA SUGESTÃO: "${concreteItem}"
Este é um produto, serviço, categoria ou especialidade real ${segment === 'MARCA' ? 'da marca' : 'da empresa'} — ele deve estar no CENTRO da sugestão: construa a cena, situação, dúvida, escolha, característica ou momento em torno dele.${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — serve só para identificação.` : ''}`
            : '';

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
          // descrita sem a promessa comercial.
          const proibicoesInventarMop = mode === 'metodo'
            ? ' A Informação-chave é apenas o ASSUNTO desta peça — não é uma peça de promoção: ela NÃO promete oferta, desconto ou condição diretamente. SE a pista do usuário trouxer promoção/oferta com dados específicos (percentual, valor, brinde, prazo, data, "até X", "hoje", condição de compra), NÃO repita esses dados nem mantenha a promessa direta — extraia o ASSUNTO por trás da promoção (o produto/serviço/categoria em destaque) e descreva-o de forma objetiva, sem a promessa comercial. Exemplo: pista "30% off até domingo" → "como escolher peças certas para o carro". O assunto da pista NÃO deve ser descartado — apenas descrito sem a promessa.'
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

          const criteriosQualidadeSugestao = `CRITÉRIOS DE QUALIDADE:
${mode === 'metodo'
  ? 'Construa 1 frase direta, objetiva e concreta: assunto + situação real e específica da atividade — sem tensão emocional, sem promessa e sem linguagem de campanha.'
  : 'Construa 1 frase direta, objetiva e concreta: assunto + situação real e específica da atividade.'} Entre 4 e 10 palavras (máximo absoluto 10).
SINTAXE: qualquer palavra substantivada pode ser sujeito — substantivo, adjetivo, verbo no infinitivo ou locução; não restrinja a papéis pessoais. Evite cláusulas relativas encadeadas ("que X que Y que Z").
${mode === 'postunico' ? 'Se a categoria for "Novidade ou Oportunidade", use tendências e comportamentos emergentes — não invente datas ou promoções inexistentes.\n' : ''}${proibicoesInventar}
LINGUAGEM: uma ideia principal, ordem direta, palavras curtas e do dia a dia — priorize termos de até 3 sílabas sempre que houver opção mais simples (ex.: "jeito" em vez de "organização", "bom"/"rápido" em vez de "eficiente", "passos" em vez de "procedimentos", "clientes" em vez de "compradores", "perdem"/"deixam passar" em vez de "ignoram"). Uma pessoa com ensino médio deve entender de primeira, sem reler. PROIBIDO: "decisores", "receita previsível", "riscos operacionais", "maximizar resultados", "estruturar processos", "estratégias digitais eficazes", "impacto real", "organização", "eficiente", "procedimentos", "compradores", termos técnicos de consultoria e qualquer palavra formal/comprida quando existir alternativa popular mais curta. Prefira: "vendas" a "receita", "empresas" a "decisores", "melhorar" a "otimizar", "clientes" a "compradores", "jeito" a "organização", "bom" a "eficiente". Se precisar trocar uma palavra grande por palavras mais curtas e isso aproximar a frase do limite de 10, prefira isso a manter um termo difícil — mas nunca ultrapasse 10 palavras. EXCEÇÃO: se houver um elemento concreto central (produto, peça, serviço, objeto, procedimento) vindo do texto do usuário ou da atividade, esse termo pode ter mais de 3 sílabas (ex.: "equipamento", "manutenção", "lubrificante", "orçamento", "diagnóstico", "estratégia") — não o troque por palavra genérica só para simplificar.`;

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

          const previousBlock = previousSugs.length
            ? `SUGESTÕES ANTERIORES NESTA SESSÃO (NÃO repita estes assuntos — gere algo completamente diferente, sobre outro produto, serviço ou situação):\n${previousSugs.map(s => `- "${s}"`).join('\n')}`
            : '';

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json({ error: 'OPENAI_API_KEY_CONTENT não configurada' }, { status: 500 });
          }

          const tom = OBJETIVO_TOM[objetivo] || OBJETIVO_TOM.promocao;

          // ── Lente de abertura (Sugestão MOP e PU) ─────────────────────────
          // Varia a FORMA de encontrar o assunto entre as tentativas — nunca
          // aparece no JSON de saída nem na UI, e não carrega tensão,
          // promessa, progressão ou linguagem de campanha.
          const lensIndex = (attempt + seedFromString(companyName + mainActivity)) % OPENING_LENSES.length;
          const lens = OPENING_LENSES[lensIndex];
          const lensBlock = `LENTE INTERNA DE GERAÇÃO (uso interno apenas — NÃO cite o nome da lente nem deixe rastro dela na frase final): ${lens.guia}`;
          // Na PU, a lente serve só para variar o ASSUNTO do post único — não
          // altera o formato definido em ESTILO DA SUGESTÃO (POST ÚNICO) e não
          // introduz tensão, motivação ou progressão de sequência.
          const lensBlockPU = `${lensBlock} Use esta lente apenas para variar o ASSUNTO do post único — mantenha o formato definido em ESTILO DA SUGESTÃO e não introduza tensão, motivação ou progressão de sequência.`;

          const sementeLembrete = segment === 'MARCA' ? sementeLembreteMarca : sementeLembreteAtividade;

          // ── Prompt do Método (Sugestão = seleção de assunto) ──────────────
          // A Sugestão MOP é só a escolha do ASSUNTO desta peça — tensão,
          // motivação, momento do negócio, progressão e estágios pertencem à
          // etapa do Método OP que vem DEPOIS, com a Informação-chave já
          // escolhida pelo usuário.
          const metodoPrompt = `Defina o ASSUNTO de uma Informação-chave para um conjunto de posts de Instagram em português brasileiro.

EMPRESA: ${companyName || '(não informada)'}
ATIVIDADE: ${mainActivity || '(não informada)'}
${voiceBlock}${hint
  ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO com base na ATIVIDADE da empresa e nas regras de ancoragem abaixo): "${hint}"\n${preservaHint}`
  : 'Campo vazio — crie a partir da ATIVIDADE da empresa, do elemento concreto e da lente interna abaixo.'}

${audienceDirective}

${elementoConcretoBlock}

${ancoragemBlock}

${previousBlock}

${lensBlock}

${criteriosQualidadeSugestao}

A Informação-chave é APENAS o ASSUNTO escolhido para esta peça — um produto, serviço, situação, dúvida, processo, escolha, comparação ou característica real e concreta dessa atividade. Ela NÃO precisa (e NÃO deve) carregar tensão, conflito, promessa emocional, urgência, comparação com concorrentes, nem qualquer ideia de progressão, estágio ou momento de relacionamento com o público — isso é decidido em outra etapa, depois que o assunto for escolhido.

PROIBIDO: linguagem de campanha ("não perca", "aproveite agora", "garanta já"), promessa emocional ("transforme", "mude sua vida", "realize seu sonho"), crítica ou cobrança ao cliente ("não sabem", "estão perdendo"), urgência, datas ou prazos não informados.
${sementeLembrete}
Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 linha, entre 4 e 10 palavras (máximo absoluto 10), sem hashtag, sem emoji, sem aspas, concreta, objetiva e específica, ligada à atividade" }`;

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
${elementoConcretoBlock ? `\n${elementoConcretoBlock}\n` : ''}${ancoragemBlock ? `\n${ancoragemBlock}\n` : ''}${previousBlock ? `\n${previousBlock}\n` : ''}
A Informação-chave é o FATO central que a peça vai comunicar (uma promoção concreta, um aviso, uma homenagem, uma oportunidade). Deve ser específica com nome ou fato real quando fizer sentido. NÃO é a legenda nem o título — é a matéria-prima do post.

ESTILO DA SUGESTÃO (POST ÚNICO): a peça é uma comunicação direta e autônoma — NÃO abre uma sequência. A sugestão pode ser uma afirmação, ou uma pergunta direta, comercial, situacional ou de reconhecimento (ex.: "Já trocou o pneu para o frio?", "Sábado tem horário especial?"), ou uma chamada — o que fizer mais sentido para o objetivo. EVITE formatos de dica educativa ou abertura de jornada (ex.: "como escolher...", "o que considerar antes de...", "passo a passo para..."): isso é formato de sequência do Método OP, não de post único.

${OBJETIVO_RULES[objetivo] || ''}

${lensBlockPU}

${criteriosQualidadeSugestao}

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 frase, entre 4 e 10 palavras (máximo absoluto 10), em português, sem hashtag, sem emoji, sem aspas, concreta e de fácil compreensão" }`;

          const userPrompt = mode === 'metodo' ? metodoPrompt : postUnicoPrompt;
          const systemMsg = mode === 'metodo'
            ? 'Você é estrategista de conteúdo para redes sociais. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO: repetir a mesma palavra ou derivação morfológica da mesma raiz no mesmo texto. PROIBIDO ABSOLUTO no texto final: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01" a "OP-06", "mood" — são termos reservados. Use sinônimos contextuais. Antes de retornar: (1) pessoa com ensino médio entende de primeira? (2) há termo técnico, palavra grande ou formal (ex.: "procedimentos", "organização", "eficiente", "compradores") que poderia virar uma palavra curta e popular? (3) a frase parte de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — e não de um conceito amplo que serviria para qualquer empresa do segmento? (4) a relação de causa→efeito da frase é literalmente verdadeira e um nativo a diria sem reler? Expressão idiomática só vale se o sentido literal também fizer sentido com o objeto citado — em dúvida, troque a expressão "vívida" por uma consequência simples e direta. Se sim para (2), troque por algo mais simples; se não para (3) e a atividade permitir, ajuste para algo concreto desse ramo antes de responder; se não para (4), reescreva a consequência de forma literal e direta antes de responder. Limite: entre 4 e 10 palavras por sugestão (máximo absoluto 10) — nunca ultrapasse 10. Frases com mais de 10 palavras devem ser cortadas antes de retornar.'
            : 'Você é estrategista de conteúdo brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO repetir a mesma palavra ou qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue) no mesmo texto — use sinônimos ou reformule. Antes de retornar, prefira que a frase parta de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — em vez de um conceito amplo que serviria para qualquer empresa do segmento. Limite: entre 4 e 10 palavras por sugestão (máximo absoluto 10) — nunca ultrapasse 10. Frases com mais de 10 palavras devem ser cortadas antes de retornar.';

          // D1 (validateSugestao) + 1 retry no máximo: se a sugestão sair vaga
          // (muito curta/longa, terminação pendurada ou frase-clichê), pede uma
          // nova versão reforçando o motivo. Nunca retorna erro ao usuário por
          // causa disso — devolve a melhor tentativa, sempre truncada ao máximo
          // do modo (10 palavras no MOP, 12 na PU — ver REGRA DE LIMITE).
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

            const sugestaoMaxWords = 10;
            sugestao = truncateWords(String(parsed.sugestao || '').trim().replace(/^"|"$/g, ''), sugestaoMaxWords);
            if (!sugestao) return Response.json({ error: 'Sugestão vazia' }, { status: 502 });

            motivos = validateSugestao(sugestao, sugestaoMaxWords);
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
