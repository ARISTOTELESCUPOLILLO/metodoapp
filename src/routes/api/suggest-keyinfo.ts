import { createFileRoute } from "@tanstack/react-router";
import { getVoiceProfile } from "@/data/brandVoice";
import { getUserIdFromRequest, checkBalance, balanceFailMessage } from "@/lib/usage.server";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import {
  truncateWords,
  validateSugestao,
  checkInventedPromotion,
  checkSupplierLanguage,
  checkRepeatedOpening,
  checkLensNameLeak,
} from "@/core/textValidation";
import { OBJETIVO_TOM } from "@/domain/objetivo.config";

// Escolhe o item da lista de produtos/serviços marcados que vira a semente
// concreta desta sugestão — rotação determinística por "attempt", evitando
// (quando possível) repetir um item cujo assunto já apareceu nas sugestões
// anteriores desta sessão. Quando o pool de itens marcados é menor que o
// número de tentativas (ex.: 1-2 itens para 3 cliques em "Sugestão"), repetir
// o mesmo item é matematicamente inevitável — `repeated` sinaliza esse caso
// para o chamador reforçar no prompt que o ÂNGULO precisa variar bastante
// (ver elementoConcretoBlock), já que a lente sozinha não basta quando o
// núcleo da frase é forçosamente o mesmo (ver SINTAXE — NÚCLEO DA FRASE).
function pickConcreteItem(
  items: string[],
  attempt: number,
  previousSuggestions: string[],
  sessionSeed: number = 0,
): { item: string | null; repeated: boolean } {
  if (!items.length) return { item: null, repeated: false };
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[áàãâä]/g, "a")
      .replace(/[éèêë]/g, "e")
      .replace(/[íìîï]/g, "i")
      .replace(/[óòõôö]/g, "o")
      .replace(/[úùûü]/g, "u")
      .replace(/ç/g, "c");
  // Word-boundary em vez de substring puro: evita falso positivo de um item
  // curto (ex.: "TEF") "casar" por coincidência dentro de outra palavra de
  // uma sugestão anterior não relacionada.
  const isUsed = (itemNorm: string) =>
    previousSuggestions.some((sugg) => {
      const s = norm(sugg);
      return new RegExp(`\\b${itemNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(s);
    });
  // sessionSeed garante ponto de entrada diferente a cada sessão (evita que
  // toda sessão nova comece sempre pelo produto 0 da lista cadastrada).
  const startIdx = (((attempt + sessionSeed) % items.length) + items.length) % items.length;
  for (let i = 0; i < items.length; i++) {
    const idx = (startIdx + i) % items.length;
    const n = norm(items[idx]);
    if (!isUsed(n)) return { item: items[idx], repeated: false };
  }
  return { item: items[startIdx], repeated: previousSuggestions.length > 0 };
}

// Classifica o ELEMENTO CONCRETO desta sugestão como produto físico (VAREJO)
// ou serviço/procedimento (SERVIÇOS) — independente do segmento cadastrado
// da empresa. Usado na PU para escolher a LENTE DO SEGMENTO certa quando a
// empresa registra itens dos dois tipos (ex.: empresa de SERVIÇOS que também
// vende produtos de VAREJO no Kit de Marca).
function classifyItemType(item: string): "VAREJO" | "SERVIÇOS" | null {
  const norm = item.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const SERVICO_KEYWORDS = [
    "consulta",
    "atendimento",
    "sessao",
    "sessoes",
    "exame",
    "avaliacao",
    "diagnostico",
    "tratamento",
    "procedimento",
    "terapia",
    "manutencao",
    "instalacao",
    "conserto",
    "reparo",
    "revisao",
    "montagem",
    "limpeza",
    "banho e tosa",
    "tosa",
    "aula",
    "curso",
    "treinamento",
    "consultoria",
    "assessoria",
    "acompanhamento",
    "suporte",
    "plano",
    "pacote",
    "servico",
    "entrega",
    "aplicacao",
    "vacina",
    "cirurgia",
    "castracao",
    "adestramento",
    "massagem",
  ];

  const PRODUTO_KEYWORDS = [
    "racao",
    "racoes",
    "acessorio",
    "produto",
    "equipamento",
    "peca",
    "kit",
    "roupa",
    "calcado",
    "bolsa",
    "brinquedo",
    "alimento",
    "bebida",
    "movel",
    "moveis",
    "decoracao",
    "cosmetico",
    "suplemento",
    "ferramenta",
    "material",
    "coleira",
    "caminha",
    "aquario",
    "gaiola",
  ];

  const hasService = SERVICO_KEYWORDS.some((kw) => norm.includes(kw));
  const hasProduct = PRODUTO_KEYWORDS.some((kw) => norm.includes(kw));

  if (hasService && !hasProduct) return "SERVIÇOS";
  if (hasProduct && !hasService) return "VAREJO";
  return null;
}

// Lentes de abertura — 11 formas internas de variar o ÂNGULO da
// Informação-chave (Sugestão MOP e PU) sobre o CONTEXTO REAL DE USO já
// identificado a partir do elemento concreto e da atividade. São orientação
// de geração apenas: nunca aparecem no JSON de saída nem na UI, não criam
// uma situação nova (o contexto real de uso já foi definido antes) e não
// introduzem tensão, promessa emocional, progressão ou linguagem de
// campanha — apenas escolhem um recorte dentro do contexto já identificado.
const OPENING_LENSES: { nome: string; guia: string }[] = [
  {
    nome: "Situação real",
    guia: "Dentro do contexto real de uso já identificado, escolha um momento específico e cotidiano em que ele acontece — descrito sem dramatizar.",
  },
  {
    nome: "Dúvida comum",
    guia: "Dentro do contexto real de uso já identificado, escolha uma dúvida comum que clientes têm antes de usar, contratar ou comprar nesse contexto.",
  },
  {
    nome: "Oportunidade",
    guia: 'Dentro do contexto real de uso já identificado, escolha um momento ou ocasião ESPECÍFICA (estação, fase, evento, situação concreta do calendário ou da rotina do cliente) em que o elemento se encaixa bem — descrito com um detalhe real e datável, nunca uma afirmação vaga de que "serve bem" ou "é uma boa opção".',
  },
  {
    nome: "Processo",
    guia: "Dentro do contexto real de uso já identificado, escolha uma etapa do processo que envolve o elemento nesse contexto — como ele é feito, escolhido ou mantido.",
  },
  {
    nome: "Resultado observável",
    guia: "Dentro do contexto real de uso já identificado, escolha um resultado MEDÍVEL OU VISÍVEL (tempo ganho/perdido, problema resolvido, estado antes/depois, frequência, quantidade) que o elemento entrega ou permite nesse contexto — nunca uma sensação vaga de melhoria genérica.",
  },
  {
    nome: "Escolha antes da compra",
    guia: "Dentro do contexto real de uso já identificado, escolha um critério ou detalhe que faz diferença na hora de escolher o elemento para esse uso.",
  },
  {
    nome: "Necessidade percebida",
    guia: 'Dentro do contexto real de uso já identificado, escolha uma necessidade CONCRETA e específica (nunca abstrata como "praticidade", "organização" ou "qualidade de vida") que o elemento atende — ancorada numa situação real e nomeável em que essa necessidade aparece.',
  },
  {
    nome: "Erro evitável",
    guia: "Dentro do contexto real de uso já identificado, escolha um erro comum e evitável relacionado a esse uso — descrito como fato, sem culpar o cliente.",
  },
  {
    nome: "Comparação concreta",
    guia: 'Dentro do contexto real de uso já identificado, compare duas opções, modelos, tamanhos, versões ou jeitos reais de usar/escolher o elemento — apontando uma diferença prática e específica entre eles, nunca uma comparação genérica tipo "X é melhor que Y".',
  },
  {
    nome: "Sinal de hora de agir",
    guia: "Dentro do contexto real de uso já identificado, escolha um sinal concreto e perceptível (desgaste, comportamento, data, sintoma, mudança visível) que indica a hora de trocar, revisar, repor, renovar ou cuidar do elemento.",
  },
  {
    nome: "Detalhe que passa despercebido",
    guia: 'Dentro do contexto real de uso já identificado, escolha um detalhe específico do elemento que o cliente costuma não notar ou só percebe tarde demais — um aspecto concreto, nunca uma qualidade abstrata como "atenção aos detalhes".',
  },
];

export const Route = createFileRoute("/api/suggest-keyinfo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          // Exigia login mas não checava plano — usuário autenticado sem
          // nenhum plano atribuído (ex.: comprador aguardando consultoria)
          // conseguia gerar Sugestões via gpt-4.1 à vontade. Não debita (a
          // Sugestão nunca contou como geração), só exige plano atribuído.
          const balance = await checkBalance(userId, 0, 0, 0);
          if (!balance.ok) {
            return Response.json({ error: balanceFailMessage(balance.reason) }, { status: 402 });
          }

          const body = await request.json();
          const today = new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          const companyName = String(body.companyName || "").slice(0, 200);
          const mainActivity = String(body.mainActivity || "").slice(0, 300);
          const objetivo = String(body.objetivo || "promocao");
          const hint = String(body.hint || "")
            .slice(0, 1000)
            .trim();
          const mode = String(body.mode || "postunico") as "postunico" | "metodo";
          const attempt = Number(body.attempt || 0);
          // Semente fixada pelo CLIENTE no início da sessão de sugestões (ver
          // sessionSeedRef em ContentForm.tsx/PostUnicoForm.tsx) — sem ela, cada
          // clique em "Sugestão" é um request HTTP independente e um Math.random()
          // aqui seria re-sorteado a cada chamada, perdendo a garantia de que as
          // tentativas 0/1/2 da MESMA sessão caiam em lentes diferentes (ver uso
          // em lensIndex abaixo). Fallback aleatório só para chamadas antigas sem o campo.
          const sessionSeedRaw = Number(body.sessionSeed);
          const sessionSeed =
            Number.isFinite(sessionSeedRaw) && body.sessionSeed !== undefined
              ? sessionSeedRaw
              : Math.floor(Math.random() * 1e9);

          const previousSugs: string[] = Array.isArray(body.previousSuggestions)
            ? body.previousSuggestions.slice(0, 6).map(String).filter(Boolean)
            : [];

          const selectedProducts: string[] = Array.isArray(body.selectedProducts)
            ? body.selectedProducts
                .slice(0, 10)
                .map((s: unknown) => String(s).slice(0, 80))
                .filter(Boolean)
            : [];

          // Elemento concreto — semente determinística escolhida a partir da
          // lista de produtos/serviços marcados pelo usuário no Kit de Marca.
          // Calculado antes da ancoragem na atividade porque define quem é o
          // dono do CONTEXTO REAL DE USO (ver ancoragemAtividade abaixo): com
          // elemento concreto, é o elementoConcretoBlock; sem ele, é a
          // ancoragem na atividade (fallback).
          const { item: concreteItem, repeated: concreteItemRepeated } = pickConcreteItem(
            selectedProducts,
            attempt,
            previousSugs,
            sessionSeed,
          );

          const SEGMENTS = ["VAREJO", "SERVIÇOS", "MARCA"] as const;
          type Seg = (typeof SEGMENTS)[number];
          const segment: Seg = (SEGMENTS as readonly string[]).includes(body.segment)
            ? (body.segment as Seg)
            : "SERVIÇOS";
          const isPersonalBrand = segment === "MARCA" && body.isPersonalBrand === true;

          // Eixos de leitura por segmento — direcionam a sugestão sem virar
          // biblioteca fixa de respostas.
          const SEGMENT_LENS: Record<Seg, string> = {
            VAREJO:
              "o momento em que o cliente usa o produto no dia a dia e sente a diferença — conforto, espaço, facilidade, agilidade, resultado — não um atributo do produto isolado (embalagem, especificação técnica, disponibilidade em estoque)",
            SERVIÇOS:
              "o que muda na rotina do cliente antes ou depois do serviço — uma dúvida, decisão, dificuldade ou alívio que ele mesmo vive — não o processo ou método de quem presta o serviço",
            MARCA:
              "o momento em que o público se reconhece, se identifica ou desenvolve confiança ao se conectar com a identidade da marca — os valores, a cultura ou o propósito vividos por ele através dela — não um atributo isolado da própria empresa (bastidor, história institucional, conquista interna) sem ligação com quem está vendo",
          };
          // Marca pessoal (documento de princípios, Parte 2.1): o dono/profissional
          // É a marca — o eixo de leitura passa a ser a trajetória, o jeito de
          // trabalhar ou a experiência da PESSOA, não valores/cultura de uma
          // empresa abstrata por trás dela.
          const MARCA_LENS_PESSOAL =
            "o momento em que o público se reconhece, se identifica ou desenvolve confiança ao acompanhar a trajetória, o jeito de trabalhar ou a experiência real do profissional por trás da marca — não um atributo isolado de uma empresa abstrata (bastidor institucional, história corporativa) sem ligação direta com a pessoa";

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
TESTE: se a frase serviria igual para qualquer outra empresa do segmento ${segment}, reescreva ancorando em algo reconhecível do ramo "${mainActivity}". Para atividades mais abstratas (sem produto físico), a cena concreta pode ser um canal, um momento de decisão ou uma interação típica desse ramo — não force um elemento artificial.${concreteItem ? "" : " Essa cena é o CONTEXTO REAL DE USO da sugestão — a lente interna de geração (mais abaixo) escolhe apenas o ÂNGULO dentro dela, sem criar uma situação nova."}`
            : "";
          const ancoragemAtividadeMarca = mainActivity.trim()
            ? `FONTE PRINCIPAL DO ASSUNTO — ATIVIDADE DA MARCA:
A ATIVIDADE descrita acima ("${mainActivity}") é a PRINCIPAL fonte para entender o que essa marca faz, oferece ou representa — é dali que a sugestão deve nascer. O NOME DA MARCA serve apenas para IDENTIFICAÇÃO: não use o nome como pista de assunto, a menos que o que ele sugere também esteja descrito na ATIVIDADE.

CENA CONCRETA: a sugestão deve partir de um elemento real e reconhecível dessa marca — um ingrediente, material, processo, ritual, território, gesto ou característica específica${mode === "metodo" ? " (sem dor do cliente, sem linguagem de venda)" : ""} — e NÃO de um conceito amplo que serviria para qualquer marca do segmento (ex.: "reconhecimento", "identificação", "vínculo", "valor percebido").
TESTE: se a frase serviria igual para qualquer outra marca do segmento, reescreva ancorando em algo reconhecível da marca "${mainActivity}". Para atividades mais abstratas, não force um elemento artificial.${concreteItem ? "" : " Esse elemento é o CONTEXTO REAL DE USO da sugestão — a lente interna de geração (mais abaixo) escolhe apenas o ÂNGULO dentro dele, sem criar uma situação nova."}`
            : "";
          const ancoragemBlock = segment === "MARCA" ? ancoragemAtividadeMarca : ancoragemAtividade;

          // Elemento concreto — substitui a antiga "COBERTURA DA ATIVIDADE"
          // (rodízio mental por grupos da atividade) por um dado real e
          // explícito (concreteItem definido acima, antes da ancoragem).
          const elementoConcretoBlock = concreteItem
            ? `ELEMENTO CONCRETO DESTA SUGESTÃO: "${concreteItem}"
Este é um produto, serviço, categoria ou especialidade real ${segment === "MARCA" ? "da marca" : "da empresa"} — ele é o NÚCLEO da sugestão (ver SINTAXE — NÚCLEO DA FRASE): a frase nomeia ou se refere diretamente a ele, e a cena, situação, dúvida, escolha, característica ou momento se constroem em torno dele.${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — serve só para identificação.` : ""}${
                concreteItemRepeated
                  ? `
⚠ ESTE ELEMENTO JÁ FOI USADO EM UMA SUGESTÃO ANTERIOR DESTA SESSÃO (não há outro item marcado disponível): a frase final DEVE ter estrutura sintática, verbo e situação completamente diferentes da(s) anterior(es) sobre este mesmo elemento — não troque apenas 1-2 palavras (ex.: trocar só o verbo final como "resolver" → "tirar" não é variação suficiente). Mude o ÂNGULO de verdade: se a anterior falou de uma dúvida do cliente, esta pode falar de um momento de uso, um resultado observável ou um critério de escolha — sempre seguindo a LENTE sorteada abaixo, mas com vocabulário e construção visivelmente distintos.`
                  : ""
              }

CONTEXTO REAL DE USO: antes de aplicar a lente abaixo, identifique para que "${concreteItem}" é usado, em que situação aparece, que problema resolve ou que rotina envolve dentro de "${mainActivity}" especificamente — e não em outro contexto onde o mesmo tipo de item também existiria (uso doméstico, social, outro ramo). A frase nasce desse contexto real; a lente só escolhe o ÂNGULO dentro dele, sem criar uma situação nova.
O CONTEXTO REAL DE USO não precisa ser um cenário, local ou momento (ex.: "durante a consulta", "na sala de espera", "na reunião") — PREFIRA SEMPRE o RESULTADO ou EFEITO direto que "${concreteItem}" entrega, no formato "[item] para [resultado/efeito]"; esse formato já é o COMPLEMENTO ÚNICO da frase (ver CRITÉRIOS DE QUALIDADE) e não deve ganhar cenário extra. Cenário/local é EXCEÇÃO, não padrão: só use quando o resultado direto sozinho não for suficiente para a frase fazer sentido.
DIREÇÃO DE ENTREGA: se a frase envolver entrega, envio ou deslocamento de "${concreteItem}" até alguém (ex.: "entregue", "leva até", "chega em"), o DESTINO é o CLIENTE/USO FINAL (a casa dele, o local onde ele vai usar) — NÃO o endereço da própria empresa/loja/clínica, salvo se "${mainActivity}" disser explicitamente que a entrega é feita até o estabelecimento. Se o destino exato não estiver claro em "${mainActivity}", não mencione local nenhum — descreva pelo RESULTADO/EFEITO direto ("[item] para [resultado]").`
            : "";

          // Reforço final (recência) — repete, já perto do JSON de saída, que o
          // assunto vem da ATIVIDADE e que o nome da empresa/marca não é pista.
          const sementeLembreteAtividade = mainActivity.trim()
            ? `\nLEMBRETE FINAL: a semente concreta deve nomear algo presente em "${mainActivity}".${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — se o que ele sugere não estiver na ATIVIDADE, ignore essa pista.` : ""}\n`
            : "";
          const sementeLembreteMarca = mainActivity.trim()
            ? `\nLEMBRETE FINAL: a semente concreta deve nomear um elemento real de "${mainActivity}".${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — se o que ele sugere não estiver na ATIVIDADE, ignore essa pista.` : ""}\n`
            : "";

          // PU: a LENTE DO SEGMENTO segue o TIPO do elemento concreto desta
          // sugestão (produto físico vs serviço/procedimento) quando ele
          // difere do segmento cadastrado da empresa — ex.: empresa de
          // SERVIÇOS (Pronto Vet) sugerindo a partir de "Rações e acessórios
          // para pet" usa a lente de VAREJO nesta sugestão, não a de
          // SERVIÇOS. MARCA não entra nessa troca: seu eixo (reconhecimento,
          // vínculo, percepção) não é substituído por um eixo de
          // compra/atendimento.
          // segmentLensBlock só é usado no postUnicoPrompt — no MOP (mode
          // "metodo") esse cálculo nunca é lido, então é pulado por completo.
          const segmentLensBlock = (() => {
            if (mode !== "postunico") return "";
            const itemType = concreteItem ? classifyItemType(concreteItem) : null;
            const segmentForLens: Seg =
              itemType && itemType !== segment && segment !== "MARCA" ? itemType : segment;
            const lensTextForSegment =
              segmentForLens === "MARCA" && isPersonalBrand
                ? MARCA_LENS_PESSOAL
                : SEGMENT_LENS[segmentForLens];
            return `LENTE DO SEGMENTO (${segmentForLens}): estes eixos indicam o TIPO de situação — o ÂNGULO, não o vocabulário — ${lensTextForSegment}. Evite usar essas palavras literalmente na frase; expresse o eixo escolhido com elementos concretos da atividade da empresa.
TESTE DE IDENTIFICAÇÃO DO CLIENTE: a frase final precisa ser algo que o CLIENTE (quem vê o post) diria, perguntaria, sentiria ou viveria. Se a frase descrever um atributo, processo ou metodologia do ponto de vista da empresa/fornecedor — e não uma situação, ganho ou rotina do cliente —, reescreva pelo que o cliente ganha ou pela situação que ele reconhece.
PROIBIDO (ou variações próximas): "indicada por"/"indicado por", "ajustado conforme", "alinhada com análise", "humanizado"/"humanizada", "pronta(s)/pronto(s) para", "em tempo real", "bem vedada(s)" — são marcas de fala de catálogo ou de metodologia interna do fornecedor, não algo que o cliente diria.`;
          })();

          const AUDIENCES = ["B2C", "B2B"] as const;
          type Aud = (typeof AUDIENCES)[number];
          const audience: Aud = (AUDIENCES as readonly string[]).includes(body.audience)
            ? (body.audience as Aud)
            : "B2C";
          const isB2C = audience === "B2C";

          const brandVoice = String(body.brandVoice || "").slice(0, 80);
          const voiceProfile = getVoiceProfile(brandVoice);
          const voiceBlock = voiceProfile
            ? `VOZ DA MARCA — "${voiceProfile.label}": ritmo: ${voiceProfile.ritmo}. Vocabulário: ${voiceProfile.vocabulario}. Registro: ${voiceProfile.registro}. Evitar: ${voiceProfile.evitar}.\n`
            : `LINGUAGEM: frases curtas, ordem direta, palavras do dia a dia. Profissional e mercadológico, sem jargão corporativo, sem termos técnicos. Uma ideia por frase.\n`;

          const preservaHint = hint
            ? `REGRA CRÍTICA DA PISTA: preserve o SENTIDO da pista do usuário (positivo, neutro ou crítico). Refine a FORMA, NUNCA inverta a intenção. Se a pista é positiva (ex.: "20 anos fazendo parte da vida da cidade"), NÃO transforme em dor/estagnação/crítica. Se é neutra, mantenha neutra. Se já carrega tensão, pode aprofundar.`
            : "";

          // Na MOP, objetivo de peça (ex.: 'promocao') pertence à PU e não deve
          // remover a proteção contra invenções — vale independente do objetivo
          // enviado, e a checkInventedPromotion continua rodando para o MOP sem
          // allowPromoLanguage: dados específicos (%, R$, brinde, prazo/data,
          // condição de compra) seguem bloqueados pelo D1 se o modelo não
          // seguir a instrução. Pista promocional não é descartada — é
          // descrita sem a promessa comercial.
          const proibicoesInventarMop =
            mode === "metodo"
              ? ' A Informação-chave é apenas o ASSUNTO desta peça — não é uma peça de promoção: ela NÃO promete oferta, desconto ou condição diretamente. SE a pista do usuário trouxer promoção/oferta com dados específicos (percentual, valor, brinde, prazo, data, "até X", "hoje", condição de compra), NÃO repita esses dados nem mantenha a promessa direta — extraia o ASSUNTO por trás da promoção (o produto/serviço/categoria em destaque) e descreva-o de forma objetiva, sem a promessa comercial. Exemplo: pista "30% off até domingo" → "como escolher peças certas para o carro". O assunto da pista NÃO deve ser descartado — apenas descrito sem a promessa.'
              : "";
          const proibicoesInventar =
            mode === "metodo" || (objetivo !== "promocao" && objetivo !== "oportunidade")
              ? `PROIBIDO inventar promoção, desconto, percentual, prazo, data, urgência ou oferta que o usuário não tenha fornecido — isso inclui termos como "promoção", "desconto", "off", "grátis", "oferta especial", "lançamento", "agenda aberta", "hoje", "até domingo" (ou qualquer outro dia/data/prazo) e chamadas de urgência ("não perca", "última chance", "por tempo limitado"). Esses termos só podem aparecer se já estiverem na pista do usuário ou na atividade da empresa informada acima.${proibicoesInventarMop} PROIBIDO também inventar: eventos • garantias • condições especiais • números • promessas absolutas que o usuário não forneceu.`
              : "";

          // allowedContext: termos de promoção/desconto/prazo/urgência só passam
          // pela checkInventedPromotion (D1) se já estiverem aqui — pista do
          // usuário ou atividade/empresa.
          const allowedContext = [hint, mainActivity, companyName].filter(Boolean).join(" ");
          // PU com objetivo 'promocao'/'oportunidade': o próprio objetivo da peça
          // pede tom promocional — a linguagem genérica ("promoção", "oferta",
          // "desconto" solto) é liberada, mas dados ESPECÍFICOS inventados
          // (%, R$, brinde, prazo/data, condição de compra) continuam bloqueados
          // pela checkInventedPromotion, que agora roda SEMPRE.
          const allowPromoLanguagePU =
            mode === "postunico" && (objetivo === "promocao" || objetivo === "oportunidade");

          const criteriosQualidadeSugestao = `CRITÉRIOS DE QUALIDADE:
${
  mode === "metodo"
    ? "Construa 1 frase direta, objetiva e concreta: assunto + situação real e específica da atividade — sem tensão emocional, sem promessa e sem linguagem de campanha."
    : "Construa 1 frase direta, objetiva e concreta: assunto + situação real e específica da atividade."
} Entre 4 e 7 palavras (máximo absoluto 7).
SINTAXE — NÚCLEO DA FRASE: o núcleo (sujeito da frase ou centro da locução) segue esta ordem de prioridade: (1) o ELEMENTO CONCRETO desta sugestão (produto/serviço ou variação direta dele), quando houver; (2) categoria, procedimento, ferramenta, equipamento, recurso ou solução real da atividade; (3) a própria ATIVIDADE da empresa, quando não houver elemento concreto. A frase pode ser uma locução sem verbo (ex.: "[item] para [situação/uso]") ou uma frase com sujeito e predicado — ambas válidas, desde que o núcleo siga essa ordem. NÃO use como núcleo principal: termos abstratos ("confiança", "qualidade", "segurança", "clareza", "crescimento", "inovação", "autoridade", "relacionamento", "resultado", "presença", "organização"), verbos no infinitivo nominalizados ("crescer", "confiar", "melhorar", "transformar", "organizar") ou locuções genéricas ("o cuidado", "o diferencial", "a escolha certa") — esses termos só valem como consequência, predicado ou qualificador, nunca como núcleo.
COMPLEMENTO ÚNICO: depois do núcleo, a frase carrega só UM traço — um resultado, uma situação ou uma característica. PROIBIDO empilhar mais de um traço (núcleo + traço + outro traço/qualificação/cenário) e PROIBIDO mais de uma oração subordinada ("que"); havendo uma relativa, ela é a única adição depois do núcleo e fecha a frase ali — sem encadear mais nada.
VEROSSIMILHANÇA: a frase precisa ser algo que poderia acontecer de verdade com este produto, serviço ou atividade — sem função, causa-efeito, condição, benefício técnico ou comportamento não informado e implausível para o segmento ${segment}. Teste: "isso poderia acontecer de verdade com esse produto/serviço/atividade?" — se não, reescreva.
TESTE DO CONTEXTO REAL DE USO (já identificado acima): a situação descrita combina com o contexto já estabelecido dentro de "${mainActivity}" — não é um cenário genérico que serviria igual para o mesmo item ou atividade em outro contexto (uso doméstico, social, outro ramo, outro tipo de cliente). Teste: "essa situação só faz sentido porque está em '${mainActivity}', ou serviria igual em qualquer outro lugar?" — se servir igual em qualquer lugar, reescreva ancorando no contexto real desse ramo.
NATURALIDADE: a frase deve parecer uma pauta de conteúdo real, do jeito que alguém do ramo falaria — não um slogan, conceito institucional ou frase tecnicamente correta porém artificial. Locuções sem verbo são bem-vindas quando soarem mais naturais que uma frase completa. Se a frase parecer academicamente correta mas estranha ao jeito comum de falar do segmento ${segment}, reescreva de forma mais direta e reconhecível.
${mode === "postunico" ? 'Se a categoria for "Novidade ou Oportunidade", use tendências e comportamentos emergentes — não invente datas ou promoções inexistentes.\n' : ""}${proibicoesInventar}
LINGUAGEM: uma ideia principal, ordem direta, palavras curtas e do dia a dia — priorize termos de até 3 sílabas sempre que houver opção mais simples (ex.: "jeito" em vez de "organização", "bom"/"rápido" em vez de "eficiente", "passos" em vez de "procedimentos", "clientes" em vez de "compradores", "perdem"/"deixam passar" em vez de "ignoram"). Uma pessoa com ensino médio deve entender de primeira, sem reler. PROIBIDO: "decisores", "receita previsível", "riscos operacionais", "maximizar resultados", "estruturar processos", "estratégias digitais eficazes", "impacto real", "organização", "eficiente", "procedimentos", "compradores", termos técnicos de consultoria e qualquer palavra formal/comprida quando existir alternativa popular mais curta. Prefira: "vendas" a "receita", "empresas" a "decisores", "melhorar" a "otimizar", "clientes" a "compradores", "jeito" a "organização", "bom" a "eficiente". Se precisar trocar uma palavra grande por palavras mais curtas e isso aproximar a frase do limite de 7, prefira isso a manter um termo difícil — mas nunca ultrapasse 7 palavras. EXCEÇÃO: se houver um elemento concreto central (produto, peça, serviço, objeto, procedimento) vindo do texto do usuário ou da atividade, esse termo pode ter mais de 3 sílabas (ex.: "equipamento", "manutenção", "lubrificante", "orçamento", "diagnóstico", "estratégia") — não o troque por palavra genérica só para simplificar.`;

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
NÚCLEO DA FRASE (B2B): siga a hierarquia de SINTAXE — NÚCLEO DA FRASE abaixo — produto/serviço/categoria/atividade no núcleo, nunca um papel pessoal ("gestores", "equipes", "donos") nem um conceito abstrato de gestão. Exemplos de FORMATO de referência (não copie o vocabulário, mostram apenas a estrutura): "mesa de reunião para equipes maiores", "módulo financeiro para contas a pagar", "correia industrial para manutenção preventiva". NUNCA use "clientes", "consumidores" ou "compradores" como núcleo principal — esses termos fazem a frase soar como crítica ao cliente da empresa, não como espelho da realidade do receptor.`;

          const previousBlock = previousSugs.length
            ? `SUGESTÕES ANTERIORES NESTA SESSÃO (NÃO repita estes assuntos — gere algo completamente diferente, sobre outro produto, serviço ou situação):\n${previousSugs.map((s) => `- "${s}"`).join("\n")}\n⚠ ABERTURA TAMBÉM PRECISA SER DIFERENTE: mesmo se o produto/serviço de origem desta sugestão tiver nome parecido com algum item acima (ex.: dois serviços cadastrados começando com as mesmas palavras), a FRASE FINAL não pode começar com as mesmas palavras de nenhuma sugestão acima — não preserve o nome literal do item como abertura fixa; extraia o conceito e construa uma frase nova, com estrutura e primeiras palavras visivelmente diferentes.`
            : "";

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json(
              { error: "OPENAI_API_KEY_CONTENT não configurada" },
              { status: 500 },
            );
          }

          const tom = OBJETIVO_TOM[objetivo as keyof typeof OBJETIVO_TOM] ?? OBJETIVO_TOM.promocao;

          // ── Lente de abertura (Sugestão MOP e PU) ─────────────────────────
          // Varia a FORMA de encontrar o assunto entre as tentativas — nunca
          // aparece no JSON de saída nem na UI, e não carrega tensão,
          // promessa, progressão ou linguagem de campanha.
          // O ponto de partida é o `sessionSeed` fixado pelo CLIENTE no início
          // da sessão (não mais um seed determinístico de companyName, que
          // fazia toda sessão nova da mesma empresa começar sempre na mesma
          // lente). `attempt` é somado sobre essa base FIXA dentro da sessão —
          // por isso as tentativas 0/1/2 caem em lentes consecutivas e
          // distintas (sem repetir até esgotar o conjunto); usar Math.random()
          // aqui de novo quebraria essa garantia, porque o servidor reavalia a
          // cada request HTTP independente, perdendo a relação entre tentativas.
          // Lentes seguras pro formato positivo "[item] para [resultado]"
          // exigido no MOP (linha ~318 abaixo, elementoConcretoBlock) —
          // comparação/dúvida/erro/sinal/detalhe tendem a produzir
          // condicional, defeito ou pergunta, o que colide com a proibição
          // de crítica ao cliente do metodoPrompt ("PROIBIDO... crítica ou
          // cobrança ao cliente", mais abaixo). Ficam disponíveis só no PU,
          // onde esse formato é legítimo (ver ESTILO DA SUGESTÃO (POST
          // ÚNICO) mais abaixo).
          const MOP_SAFE_LENS_NAMES = new Set([
            "Resultado observável",
            "Necessidade percebida",
            "Escolha antes da compra",
            "Processo",
            "Oportunidade",
          ]);
          // No PU, "Sinal de hora de agir" e "Erro evitável" pressupõem um
          // ciclo de desgaste/troca ou um erro de uso físico — non-sequitur
          // quando o elemento concreto desta sugestão é um serviço/
          // procedimento (sem esse ciclo). Exclui as duas só nesse caso;
          // produto físico (VAREJO) ou item não classificado mantém o pool
          // cheio, já que ali a premissa das duas lentes faz sentido.
          const itemType = concreteItem ? classifyItemType(concreteItem) : null;
          const SERVICE_RISKY_LENS_NAMES = new Set(["Sinal de hora de agir", "Erro evitável"]);
          const lensPool =
            mode === "metodo"
              ? OPENING_LENSES.filter((l) => MOP_SAFE_LENS_NAMES.has(l.nome))
              : itemType === "SERVIÇOS"
                ? OPENING_LENSES.filter((l) => !SERVICE_RISKY_LENS_NAMES.has(l.nome))
                : OPENING_LENSES;
          const lensIndex = (attempt + sessionSeed) % lensPool.length;
          const lens = lensPool[lensIndex];
          const lensGuardrail = ` Esta lente define apenas o ÂNGULO da frase dentro do CONTEXTO REAL DE USO já identificado — não cria uma situação nova, não substitui o núcleo definido em SINTAXE — NÚCLEO DA FRASE, e não deve transformar conceito abstrato em núcleo principal. A lente é um mecanismo interno: a frase final não deve deixar reconhecível qual lente foi usada — só devem aparecer produto/serviço, contexto real de uso e situação plausível em linguagem natural.${segment !== "MARCA" ? ` PROIBIDO usar tom de vínculo/comunidade com o público — "nosso(s)", "nossa(s)", "juntos", "nossa comunidade", "cuidar juntos", "fazemos parte da sua vida" — esse registro pertence ao segmento MARCA; em ${segment}, descreva produto/serviço e situação na 3ª pessoa, sem incluir o público como coautor ou parceiro emocional.` : ""}`;
          const lensBlock = `LENTE INTERNA DE GERAÇÃO (uso interno apenas — NÃO cite o nome da lente nem deixe rastro dela na frase final): ${lens.guia}${lensGuardrail}`;
          // Na PU, a lente serve só para variar o ASSUNTO do post único — não
          // altera o formato definido em ESTILO DA SUGESTÃO (POST ÚNICO) e não
          // introduz tensão, motivação ou progressão de sequência.
          const lensBlockPU = `${lensBlock} Use esta lente apenas para variar o ASSUNTO do post único — mantenha o formato definido em ESTILO DA SUGESTÃO e não introduza tensão, motivação ou progressão de sequência.`;

          const sementeLembrete =
            segment === "MARCA" ? sementeLembreteMarca : sementeLembreteAtividade;

          // ── Prompt do Método (Sugestão = seleção de assunto) ──────────────
          // A Sugestão MOP é só a escolha do ASSUNTO desta peça — tensão,
          // motivação, momento do negócio, progressão e estágios pertencem à
          // etapa do Método OP que vem DEPOIS, com a Informação-chave já
          // escolhida pelo usuário.
          const metodoPrompt = `Defina o ASSUNTO de uma Informação-chave para um conjunto de posts de Instagram em português brasileiro.

EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
${voiceBlock}${
            hint
              ? `TEXTO ATUAL DO USUÁRIO (contexto — NÃO copie nem refine; gere algo NOVO com base na ATIVIDADE da empresa e nas regras de ancoragem abaixo): "${hint}"\n${preservaHint}`
              : "Campo vazio — crie a partir da ATIVIDADE da empresa, do elemento concreto e da lente interna abaixo."
          }

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
{ "sugestao": "1 linha, entre 4 e 7 palavras (máximo absoluto 7), sem hashtag, sem emoji, sem aspas, concreta, objetiva e específica, ligada à atividade" }`;

          const OBJETIVO_RULES: Record<string, string> = {
            promocao:
              'REGRAS PARA PROMOÇÃO: use tom comercial/promocional — esse é o tom esperado para o objetivo (palavras como "promoção", "oferta", "aproveite", "garanta o seu" são bem-vindas). PROIBIDO inventar percentual de desconto, valor em reais, brinde/cortesia, prazo, data/dia da semana, "última chance" ou condição de compra (acima de/a partir de/sem juros/parcelamento) que o usuário não tenha informado. Esses dados só podem aparecer se já estiverem na pista do usuário ou na atividade/empresa. Se nada disso foi informado, descreva a oportunidade comercial de forma genérica — sem números, datas ou condições inventadas.',
            oportunidade:
              "REGRAS PARA OPORTUNIDADE: represente a oportunidade por escassez, momento único ou contexto sazonal — sem especificar quando. PROIBIDO citar datas, prazos, dias ou períodos específicos, e PROIBIDO inventar percentual de desconto, valor em reais, brinde/cortesia ou condição de compra (acima de/a partir de/sem juros/parcelamento) que o usuário não tenha informado. Esses dados só podem aparecer se já estiverem na pista do usuário ou na atividade/empresa.",
            homenagem: `REGRAS PARA HOMENAGEM: datas comemorativas de referência (use APENAS se forem FUTURAS à DATA DE HOJE):
- Dia das Mães: 2º domingo de maio
- Dia dos Pais: 2º domingo de agosto
- Dia do Cliente: 15 de setembro
- Dia do Marketing: 27 de setembro
- Dia das Crianças: 12 de outubro
- Natal: 25 de dezembro
Para qualquer outra data comemorativa, use apenas se tiver certeza absoluta da data e ela for futura. Em caso de dúvida, homenageie uma pessoa, conquista ou marco da própria empresa.`,
            aviso:
              'REGRAS PARA AVISO: o comunicado deve ser concreto e acionável — mudança de horário, nova política, prazo de cadastro, atualização de serviço. Evite avisos vagos como "novidades em breve".',
            institucional:
              "REGRAS PARA INSTITUCIONAL: foque em um valor, propósito ou diferencial específico da empresa — não genérico. Prefira fatos concretos (anos de mercado, número de clientes, certificação, metodologia própria) a afirmações abstratas.",
          };

          const dateLine = objetivo === "homenagem" ? `DATA DE HOJE: ${today}\n` : "";

          const postUnicoPrompt = `Sugira UMA Informação-chave para um post único de Instagram em português brasileiro.

${dateLine}EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
${voiceBlock}${segmentLensBlock}
OBJETIVO: ${objetivo} (tom: ${tom})
${hint ? `PISTA DO USUÁRIO (refine/melhore a partir disso): "${hint}"` : "O usuário não deu pista — invente algo plausível e útil para a atividade."}
${elementoConcretoBlock ? `\n${elementoConcretoBlock}\n` : ""}${ancoragemBlock ? `\n${ancoragemBlock}\n` : ""}${previousBlock ? `\n${previousBlock}\n` : ""}
A Informação-chave é o FATO central que a peça vai comunicar (uma promoção concreta, um aviso, uma homenagem, uma oportunidade). Deve ser específica com nome ou fato real quando fizer sentido. NÃO é a legenda nem o título — é a matéria-prima do post.

ESTILO DA SUGESTÃO (POST ÚNICO): a peça é uma comunicação direta e autônoma — NÃO abre uma sequência. A sugestão pode ser uma afirmação, ou uma pergunta direta, comercial, situacional ou de reconhecimento (ex.: "Já trocou o pneu para o frio?", "Sábado tem horário especial?"), ou uma chamada — o que fizer mais sentido para o objetivo. EVITE formatos de dica educativa ou abertura de jornada (ex.: "como escolher...", "o que considerar antes de...", "passo a passo para..."): isso é formato de sequência do Método OP, não de post único.

${OBJETIVO_RULES[objetivo] || ""}

${lensBlockPU}

${criteriosQualidadeSugestao}

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 frase, entre 4 e 7 palavras (máximo absoluto 7), em português, sem hashtag, sem emoji, sem aspas, concreta e de fácil compreensão" }`;

          const userPrompt = mode === "metodo" ? metodoPrompt : postUnicoPrompt;
          const systemMsg =
            mode === "metodo"
              ? 'Você é estrategista de conteúdo para redes sociais. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO: repetir a mesma palavra ou derivação morfológica da mesma raiz no mesmo texto. PROIBIDO ABSOLUTO no texto final: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01" a "OP-06", "mood" — são termos reservados. Use sinônimos contextuais. Antes de retornar: (1) pessoa com ensino médio entende de primeira? (2) há termo técnico, palavra grande ou formal (ex.: "procedimentos", "organização", "eficiente", "compradores") que poderia virar uma palavra curta e popular? (3) a frase parte de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — e não de um conceito amplo que serviria para qualquer empresa do segmento? (4) a relação de causa→efeito da frase é literalmente verdadeira e um nativo a diria sem reler? Expressão idiomática só vale se o sentido literal também fizer sentido com o objeto citado — em dúvida, troque a expressão "vívida" por uma consequência simples e direta. Se sim para (2), troque por algo mais simples; se não para (3) e a atividade permitir, ajuste para algo concreto desse ramo antes de responder; se não para (4), reescreva a consequência de forma literal e direta antes de responder. Limite: entre 4 e 7 palavras por sugestão (máximo absoluto 7) — nunca ultrapasse 7. Frases com mais de 7 palavras devem ser cortadas antes de retornar.'
              : "Você é estrategista de conteúdo brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO repetir a mesma palavra ou qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue) no mesmo texto — use sinônimos ou reformule. Antes de retornar, prefira que a frase parta de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — em vez de um conceito amplo que serviria para qualquer empresa do segmento. Limite: entre 4 e 7 palavras por sugestão (máximo absoluto 7) — nunca ultrapasse 7. Frases com mais de 7 palavras devem ser cortadas antes de retornar.";

          // D1 (validateSugestao) + 1 retry no máximo: se a sugestão sair vaga
          // (muito curta/longa, terminação pendurada ou frase-clichê), pede uma
          // nova versão reforçando o motivo. Nunca retorna erro ao usuário por
          // causa disso — devolve a melhor tentativa, sempre truncada a
          // sugestaoMaxWords (7 palavras, MOP e PU).
          const MAX_SUGGEST_ATTEMPTS = 2;
          let sugestao = "";
          let motivos: string[] = [];

          for (let pass = 1; pass <= MAX_SUGGEST_ATTEMPTS; pass++) {
            const reinforcement =
              pass > 1 && motivos.length > 0
                ? `\n\nATENÇÃO: a tentativa anterior teve este problema: ${motivos.join("; ")}. Gere uma NOVA versão que corrija isso, mantendo o mesmo assunto e a mesma intenção.`
                : "";

            const result = await fetchOpenAIChat(apiKey, {
              model: "gpt-4.1",
              messages: [
                { role: "system", content: systemMsg },
                { role: "user", content: `${userPrompt}${reinforcement}` },
              ],
              temperature: 0.95,
              response_format: { type: "json_object" },
            });

            if (!result.ok) {
              return Response.json({ error: result.error }, { status: result.status });
            }
            const content = result.data.choices?.[0]?.message?.content;
            if (!content) return Response.json({ error: "Resposta vazia" }, { status: 502 });

            let parsed: { sugestao?: string };
            try {
              parsed = JSON.parse(content);
            } catch {
              return Response.json({ error: "JSON inválido" }, { status: 502 });
            }

            const sugestaoMaxWords = 7;
            const rawSugestao = String(parsed.sugestao || "")
              .trim()
              .replace(/^"|"$/g, "");
            const rawWordCount = rawSugestao.split(/\s+/).filter(Boolean).length;
            sugestao = truncateWords(rawSugestao, sugestaoMaxWords);
            if (!sugestao) return Response.json({ error: "Sugestão vazia" }, { status: 502 });

            motivos = validateSugestao(sugestao, sugestaoMaxWords);
            // truncateWords só remove conjunção/preposição do final — corta
            // no meio de substantivo/adjetivo sem avisar, e a frase cortada
            // passava pela validação como se estivesse completa (o corte
            // acontecia ANTES da checagem de tamanho). Sinaliza aqui, pelo
            // texto BRUTO (antes do corte), pra virar motivo de retry real
            // em vez de devolver a frase capenga sem o modelo saber.
            if (rawWordCount > sugestaoMaxWords) {
              motivos.push(
                `frase original tinha ${rawWordCount} palavras e foi cortada no meio — reescreva já dentro do limite de ${sugestaoMaxWords} palavras, sem depender de corte`,
              );
            }
            motivos = motivos.concat(
              checkInventedPromotion(sugestao, allowedContext, {
                allowPromoLanguage: allowPromoLanguagePU,
              }),
            );
            if (mode === "postunico") motivos = motivos.concat(checkSupplierLanguage(sugestao));
            motivos = motivos.concat(checkRepeatedOpening(sugestao, previousSugs));
            // Vazamento do nome da lente interna — vale para AMBOS os modos
            // (lens/lensBlock existem em MOP e PU).
            motivos = motivos.concat(checkLensNameLeak(sugestao, lens.nome));
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
