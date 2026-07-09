import { getVoiceProfile } from "@/data/brandVoice";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import {
  truncateWords,
  validateSugestao,
  checkInventedPromotion,
  checkSupplierLanguage,
  checkRepeatedOpening,
  checkLensNameLeak,
  checkWeakEnding,
  checkItemNameDrift,
  pruneWeakEnding,
} from "@/core/textValidation";
import { OBJETIVO_TOM } from "@/domain/objetivo.config";
import {
  pickConcreteItem,
  classifyItemType,
  decomposeAtividadeEmItens,
  judgeSugestaoEstrutural,
  type SugestaoEngineInput,
  type SugestaoSegment,
} from "@/core/sugestaoEngine";

// ─────────────────────────────────────────────────────────────────────────
// VARIANTE "VALÊNCIA + COMPLEMENTO" — teste A/B direcionado (09/07/2026).
//
// Este arquivo é uma CÓPIA LITERAL de generateSugestao (src/core/
// sugestaoEngine.ts) com APENAS 2 mudanças cirúrgicas — todo o resto
// (seleção do elemento concreto, checagens determinísticas, juiz
// estrutural, loop de retry, poda E2) é idêntico ao original, importado de
// produção quando exportado e duplicado verbatim quando não. Isso garante
// que qualquer diferença observada nos pares baseline/patch venha SÓ das
// 2 mudanças abaixo:
//
//   PATCH 1 (VALÊNCIA DOS EXEMPLOS) — o bloco "Contraste esperado" de
//   ancoragemAtividade trazia 6 exemplos fixos, todos enquadrados como
//   DEFESA (ameaça evitada: "sem gerar oportunidades", "gera vazamentos",
//   "pode parar a operação"...). Como o modelo imita fortemente o padrão
//   dos exemplos (few-shot bias), isso é a causa provável do viés
//   "negativo" relatado por cliente real (preferiu "óleo lubrificante para
//   o motor durar mais" a "...para o motor não parar"). Aqui os mesmos 3
//   ramos ganham 1 exemplo de ATAQUE (ganho a mais) + 1 de DEFESA cada,
//   calibrados pelo par do óleo do Aristóteles — mesmo espírito didático
//   ("mostra o tipo de especificidade esperado, não o vocabulário").
//
//   PATCH 2 (COERÊNCIA DO COMPLEMENTO) — evidência real encontrada nos
//   resultados gravados em output/ (ex.: "Ração para consultas sem pausas
//   no dia", "Marketing digital para acerto no contato", "Ração para cães
//   e gatos no carinho", "Café coado na hora no começo"): quando o item
//   não tem um resultado concreto óbvio à mão, o modelo força uma
//   abstração para cumprir o FECHO DA FRASE. A frase de guarda adicionada
//   ao fim de FECHO DA FRASE autoriza explicitamente um fecho mais simples
//   e genuíno (uso comum, característica real) em vez do benefício colado.
//
// NÃO é importado por nenhuma rota de produção — existe só para o harness
// scripts/ab-sugestao/run.valenciacomplemento.harness.ts.
// ─────────────────────────────────────────────────────────────────────────

// Cópia verbatim de OPENING_LENSES (src/core/sugestaoEngine.ts) — o const
// não é exportado pelo motor, então é duplicado aqui SEM nenhuma mudança.
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
    guia: "Dentro do contexto real de uso já identificado, escolha uma etapa do processo que o PRÓPRIO CLIENTE vive ao usar, escolher, ajustar ou manter o elemento (ex.: como ele decide, guarda, renova ou prepara isso na vida/rotina dele) — NUNCA uma etapa de bastidor de quem vende ou produz (estoque, fabricação, preparo interno, organização de fornecedores).",
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

// Cópia de generateSugestao com os PATCHES 1 e 2 (marcados inline com
// "PATCH 1" / "PATCH 2") — fora esses dois pontos, o texto é idêntico ao
// original de src/core/sugestaoEngine.ts.
export async function generateSugestaoValenciaComplemento(
  apiKey: string,
  input: SugestaoEngineInput,
): Promise<{ sugestao: string }> {
  const {
    companyName,
    mainActivity,
    objetivo,
    hint,
    mode,
    attempt,
    sessionSeed,
    previousSuggestions: previousSugs,
    segment,
    isPersonalBrand,
    selectedProducts,
    audience,
    brandVoice,
  } = input;

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const inferredProducts = selectedProducts.length
    ? []
    : await decomposeAtividadeEmItens(apiKey, mainActivity, segment);
  const productsPool = selectedProducts.length ? selectedProducts : inferredProducts;

  const { item: concreteItem, repeated: concreteItemRepeated } = pickConcreteItem(
    productsPool,
    attempt,
    previousSugs,
    sessionSeed,
  );

  const SEGMENT_LENS: Record<SugestaoSegment, string> = {
    VAREJO:
      "o momento em que o cliente usa o produto no dia a dia e sente a diferença — conforto, espaço, facilidade, agilidade, resultado — não um atributo do produto isolado (embalagem, especificação técnica, disponibilidade em estoque)",
    SERVIÇOS:
      "o que muda na rotina do cliente antes ou depois do serviço — uma dúvida, decisão, dificuldade ou alívio que ele mesmo vive — não o processo ou método de quem presta o serviço",
    MARCA:
      "o momento em que o público se reconhece, se identifica ou desenvolve confiança ao se conectar com a identidade da marca — os valores, a cultura ou o propósito vividos por ele através dela — não um atributo isolado da própria empresa (bastidor, história institucional, conquista interna) sem ligação com quem está vendo",
  };
  const MARCA_LENS_PESSOAL =
    "o momento em que o público se reconhece, se identifica ou desenvolve confiança ao acompanhar a trajetória, o jeito de trabalhar ou a experiência real do profissional por trás da marca — não um atributo isolado de uma empresa abstrata (bastidor institucional, história corporativa) sem ligação direta com a pessoa";

  // PATCH 1 (VALÊNCIA DOS EXEMPLOS): os 6 exemplos do "Contraste esperado"
  // eram 100% DEFESA no original; aqui cada ramo traz 1 ATAQUE (ganho a
  // mais, calibrado pelo par do óleo do Aristóteles: "durar mais" em vez de
  // "não parar") + 1 DEFESA (mantido do original). Todo o texto ao redor é
  // idêntico ao de produção.
  const ancoragemAtividade = mainActivity.trim()
    ? `FONTE PRINCIPAL DO ASSUNTO — ATIVIDADE DA EMPRESA:
A ATIVIDADE descrita acima ("${mainActivity}") é a PRINCIPAL fonte para entender o que essa empresa faz, vende, resolve ou oferece — é dali que a sugestão deve nascer. O NOME DA EMPRESA serve apenas para IDENTIFICAÇÃO: não use o nome como pista de assunto, a menos que o que ele sugere também esteja descrito na ATIVIDADE.

CENA CONCRETA: a sugestão deve partir de uma situação real e reconhecível desse ramo — um produto, peça, ferramenta, canal, procedimento ou momento específico do dia a dia — e NÃO de um conceito amplo que serviria para qualquer empresa do segmento ${segment} (ex.: "atendimento gera confiança", "escolha certa evita problemas", "empresa próxima vira referência").
Contraste esperado — exemplos de FORMATO de OUTROS RAMOS (não copie o vocabulário ou os produtos destes exemplos; servem só para mostrar o tipo de especificidade esperado — a sua sugestão deve usar vocabulário de "${mainActivity}", não destes exemplos): em vez de conceitos amplos como esses, prefira algo do tipo: "Instagram que atrai clientes novos" ou "WhatsApp sem resposta reduz conversões" (exemplo do ramo consultoria de marketing); "óleo lubrificante para o motor durar mais" ou "mangueira inadequada gera vazamentos" (exemplo do ramo peças e lubrificantes); "máquina regulada produz mais por turno" ou "correia desgastada pode parar a operação" (exemplo do ramo ferramentas e máquinas).
TESTE: se a frase serviria igual para qualquer outra empresa do segmento ${segment}, reescreva ancorando em algo reconhecível do ramo "${mainActivity}". Para atividades mais abstratas (sem produto físico), a cena concreta pode ser um canal, um momento de decisão ou uma interação típica desse ramo — não force um elemento artificial.${concreteItem ? "" : " Essa cena é o CONTEXTO REAL DE USO da sugestão — a lente interna de geração (mais abaixo) escolhe apenas o ÂNGULO dentro dela, sem criar uma situação nova."}`
    : "";
  const ancoragemAtividadeMarca = mainActivity.trim()
    ? `FONTE PRINCIPAL DO ASSUNTO — ATIVIDADE DA MARCA:
A ATIVIDADE descrita acima ("${mainActivity}") é a PRINCIPAL fonte para entender o que essa marca faz, oferece ou representa — é dali que a sugestão deve nascer. O NOME DA MARCA serve apenas para IDENTIFICAÇÃO: não use o nome como pista de assunto, a menos que o que ele sugere também esteja descrito na ATIVIDADE.

CENA CONCRETA: a sugestão deve partir de um elemento real e reconhecível dessa marca — um ingrediente, material, processo, ritual, território, gesto ou característica específica${mode === "metodo" ? " (sem dor do cliente, sem linguagem de venda)" : ""} — e NÃO de um conceito amplo que serviria para qualquer marca do segmento (ex.: "reconhecimento", "identificação", "vínculo", "valor percebido").
TESTE: se a frase serviria igual para qualquer outra marca do segmento, reescreva ancorando em algo reconhecível da marca "${mainActivity}". Para atividades mais abstratas, não force um elemento artificial.${concreteItem ? "" : " Esse elemento é o CONTEXTO REAL DE USO da sugestão — a lente interna de geração (mais abaixo) escolhe apenas o ÂNGULO dentro dele, sem criar uma situação nova."}`
    : "";
  const ancoragemBlock = segment === "MARCA" ? ancoragemAtividadeMarca : ancoragemAtividade;

  const contextoFormaBlock = `O CONTEXTO REAL DE USO pode ser um resultado/efeito, um momento/ocasião, uma finalidade ou uma característica — NENHUMA forma é preferida sobre outra. O único requisito é QUEM VIVE essa situação: precisa ser o CLIENTE/COMPRADOR/USUÁRIO de "${concreteItem}" (ele se imagina usando, recebendo, escolhendo, precisando) — nunca uma etapa de bastidor de quem VENDE (estoque, armazenamento, preparo, organização interna, escolha de insumos), exceto quando essa etapa É a própria rotina de trabalho do cliente comprador (ex.: em B2B, "o fechamento dos pedidos" é rotina de quem compra o ERP, não bastidor de quem vende). Os conectores (e, com, em, no/na, para, à) não escolhem o assunto — eles só aproximam o produto de uma situação real vivida pelo cliente. TESTE: o cliente consegue imaginar essa situação acontecendo de verdade com ele? Bons exemplos: "Café em manhãs frias", "Vacinas para filhotes", "ERP no fechamento dos pedidos". Maus exemplos (bastidor de quem vende, não do cliente): "Café na escolha dos grãos", "Vacinas no armazenamento", "ERP na organização interna". VARIE A CONSTRUÇÃO: alterne entre essas formas e entre locução sem verbo ou frase com sujeito e predicado (ver SINTAXE — NÚCLEO DA FRASE), conforme o que soar mais natural para este item; repetir sempre a mesma estrutura entre sugestões é o que faz a Sugestão soar montada por fórmula. PROIBIDO colar um adjetivo ou particípio de recheio na última palavra só para o fecho "parecer" mais específico (ex.: "negociações digitais", "contatos ativos", "demandas híbridas", "sustos inesperados", "internações longas") quando essa palavra não muda nem especifica o efeito central — TESTE: apague a última palavra; se a frase continua dizendo exatamente a mesma coisa, ela é recheio e deve ser cortada ou trocada por um efeito que dependa dela para fazer sentido.`;

  const elementoConcretoBlock = concreteItem
    ? `ELEMENTO CONCRETO DESTA SUGESTÃO: "${concreteItem}"
Este é um produto, serviço, categoria ou especialidade real ${segment === "MARCA" ? "da marca" : "da empresa"} — ele é o NÚCLEO da sugestão (ver SINTAXE — NÚCLEO DA FRASE): a frase nomeia ou se refere diretamente a ele, e a cena, situação, dúvida, escolha, característica ou momento se constroem em torno dele.${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — serve só para identificação.` : ""}${
        concreteItemRepeated
          ? `
⚠ ESTE ELEMENTO JÁ FOI USADO EM UMA SUGESTÃO ANTERIOR DESTA SESSÃO (não há outro item marcado disponível): a frase final DEVE ter estrutura sintática, verbo e situação completamente diferentes da(s) anterior(es) sobre este mesmo elemento — não troque apenas 1-2 palavras (ex.: trocar só o verbo final como "resolver" → "tirar" não é variação suficiente). Mude o ÂNGULO de verdade: se a anterior falou de uma dúvida do cliente, esta pode falar de um momento de uso, um resultado observável ou um critério de escolha — sempre seguindo a LENTE sorteada abaixo, mas com vocabulário e construção visivelmente distintos.`
          : ""
      }

CONTEXTO REAL DE USO: antes de aplicar a lente abaixo, identifique para que "${concreteItem}" é usado, em que situação aparece, que problema resolve ou que rotina envolve dentro de "${mainActivity}" especificamente — e não em outro contexto onde o mesmo tipo de item também existiria (uso doméstico, social, outro ramo). A frase nasce desse contexto real; a lente só escolhe o ÂNGULO dentro dele, sem criar uma situação nova.
${contextoFormaBlock}
DIREÇÃO DE ENTREGA: se a frase envolver entrega, envio ou deslocamento de "${concreteItem}" até alguém (ex.: "entregue", "leva até", "chega em"), o DESTINO é o CLIENTE/USO FINAL (a casa dele, o local onde ele vai usar) — NÃO o endereço da própria empresa/loja/clínica, salvo se "${mainActivity}" disser explicitamente que a entrega é feita até o estabelecimento. Se o destino exato não estiver claro em "${mainActivity}", não mencione local nenhum — descreva pelo RESULTADO/EFEITO direto ("[item] para [resultado]").`
    : "";

  const sementeLembreteAtividade = mainActivity.trim()
    ? `\nLEMBRETE FINAL: a semente concreta deve nomear algo presente em "${mainActivity}".${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — se o que ele sugere não estiver na ATIVIDADE, ignore essa pista.` : ""}\n`
    : "";
  const sementeLembreteMarca = mainActivity.trim()
    ? `\nLEMBRETE FINAL: a semente concreta deve nomear um elemento real de "${mainActivity}".${companyName.trim() ? ` O nome "${companyName}" NÃO é fonte de assunto — se o que ele sugere não estiver na ATIVIDADE, ignore essa pista.` : ""}\n`
    : "";

  const segmentLensBlock = (() => {
    if (mode !== "postunico") return "";
    const itemType = concreteItem ? classifyItemType(concreteItem) : null;
    const segmentForLens: SugestaoSegment =
      itemType && itemType !== segment && segment !== "MARCA" ? itemType : segment;
    const lensTextForSegment =
      segmentForLens === "MARCA" && isPersonalBrand
        ? MARCA_LENS_PESSOAL
        : SEGMENT_LENS[segmentForLens];
    return `LENTE DO SEGMENTO (${segmentForLens}): estes eixos indicam o TIPO de situação — o ÂNGULO, não o vocabulário — ${lensTextForSegment}. Evite usar essas palavras literalmente na frase; expresse o eixo escolhido com elementos concretos da atividade da empresa.
TESTE DE IDENTIFICAÇÃO DO CLIENTE: a frase final precisa ser algo que o CLIENTE (quem vê o post) diria, perguntaria, sentiria ou viveria. Se a frase descrever um atributo, processo ou metodologia do ponto de vista da empresa/fornecedor — e não uma situação, ganho ou rotina do cliente —, reescreva pelo que o cliente ganha ou pela situação que ele reconhece.
PROIBIDO (ou variações próximas): "indicada por"/"indicado por", "ajustado conforme", "alinhada com análise", "humanizado"/"humanizada", "pronta(s)/pronto(s) para", "em tempo real", "bem vedada(s)" — são marcas de fala de catálogo ou de metodologia interna do fornecedor, não algo que o cliente diria.`;
  })();

  const isB2C = audience === "B2C";

  const voiceProfile = getVoiceProfile(brandVoice);
  const voiceBlock = voiceProfile
    ? `VOZ DA MARCA — "${voiceProfile.label}": ritmo: ${voiceProfile.ritmo}. Vocabulário: ${voiceProfile.vocabulario}. Registro: ${voiceProfile.registro}. Evitar: ${voiceProfile.evitar}.\n`
    : `LINGUAGEM: frases curtas, ordem direta, palavras do dia a dia. Profissional e mercadológico, sem jargão corporativo, sem termos técnicos. Uma ideia por frase.\n`;

  const preservaHint = hint
    ? `REGRA CRÍTICA DA PISTA: preserve o SENTIDO da pista do usuário (positivo, neutro ou crítico). Refine a FORMA, NUNCA inverta a intenção. Se a pista é positiva (ex.: "20 anos fazendo parte da vida da cidade"), NÃO transforme em dor/estagnação/crítica. Se é neutra, mantenha neutra. Se já carrega tensão, pode aprofundar.`
    : "";

  const proibicoesInventarMop =
    mode === "metodo"
      ? ' A Informação-chave é apenas o ASSUNTO desta peça — não é uma peça de promoção: ela NÃO promete oferta, desconto ou condição diretamente. SE a pista do usuário trouxer promoção/oferta com dados específicos (percentual, valor, brinde, prazo, data, "até X", "hoje", condição de compra), NÃO repita esses dados nem mantenha a promessa direta — extraia o ASSUNTO por trás da promoção (o produto/serviço/categoria em destaque) e descreva-o de forma objetiva, sem a promessa comercial. Exemplo: pista "30% off até domingo" → "como escolher peças certas para o carro". O assunto da pista NÃO deve ser descartado — apenas descrito sem a promessa.'
      : "";
  const proibicoesInventar =
    mode === "metodo" || (objetivo !== "promocao" && objetivo !== "oportunidade")
      ? `PROIBIDO inventar promoção, desconto, percentual, prazo, data, urgência ou oferta que o usuário não tenha fornecido — isso inclui termos como "promoção", "desconto", "off", "grátis", "oferta especial", "lançamento", "agenda aberta", "hoje", "até domingo" (ou qualquer outro dia/data/prazo) e chamadas de urgência ("não perca", "última chance", "por tempo limitado"). Esses termos só podem aparecer se já estiverem na pista do usuário ou na atividade da empresa informada acima.${proibicoesInventarMop} PROIBIDO também inventar: eventos • garantias • condições especiais • números • promessas absolutas que o usuário não forneceu.`
      : "";

  const allowedContext = [hint, mainActivity, companyName].filter(Boolean).join(" ");
  const allowPromoLanguagePU =
    mode === "postunico" && (objetivo === "promocao" || objetivo === "oportunidade");

  const verboBeneficioBlock = `VERBO DE BENEFÍCIO: quando a frase usar um verbo de ação sobre o produto/serviço, prefira um verbo que descreva um BENEFÍCIO VERIFICÁVEL e concreto (ex.: "organiza", "protege", "facilita", "controla", "economiza", "renova", "resolve") em vez de um verbo de PROMESSA INFLADA que soa exagerado e vazio (ex.: "transforma", "revoluciona", "muda sua vida", "valoriza"). TESTE: o verbo descreve algo que o produto/serviço realmente FAZ, ou é um exagero de propaganda que qualquer produto poderia prometer? Se for exagero, troque por um verbo mais concreto e crível.\n`;

  // PATCH 2 (COERÊNCIA DO COMPLEMENTO): frase de guarda adicionada ao FIM
  // do parágrafo FECHO DA FRASE ("COERÊNCIA DO COMPLEMENTO: ..."). Todo o
  // resto do bloco de critérios é idêntico ao original.
  const criteriosQualidadeSugestao = `CRITÉRIOS DE QUALIDADE:
${
  mode === "metodo"
    ? "Construa 1 frase direta, objetiva e concreta: assunto + situação real e específica da atividade — sem tensão emocional, sem promessa e sem linguagem de campanha."
    : "Construa 1 frase direta, objetiva e concreta: assunto + situação real e específica da atividade."
} Entre 4 e 7 palavras (máximo absoluto 7).
SINTAXE — NÚCLEO DA FRASE: o núcleo (sujeito da frase ou centro da locução) segue esta ordem de prioridade: (1) o ELEMENTO CONCRETO desta sugestão (produto/serviço ou variação direta dele), quando houver; (2) categoria, procedimento, ferramenta, equipamento, recurso ou solução real da atividade; (3) a própria ATIVIDADE da empresa, quando não houver elemento concreto. A frase pode ser uma locução sem verbo (ex.: "[item] para [situação/uso]") ou uma frase com sujeito e predicado — ambas válidas, desde que o núcleo siga essa ordem. NÃO use como núcleo principal: termos abstratos ("confiança", "qualidade", "segurança", "clareza", "crescimento", "inovação", "autoridade", "relacionamento", "resultado", "presença", "organização"), verbos no infinitivo nominalizados ("crescer", "confiar", "melhorar", "transformar", "organizar") ou locuções genéricas ("o cuidado", "o diferencial", "a escolha certa") — esses termos só valem como consequência, predicado ou qualificador, nunca como núcleo.
COMPLEMENTO ÚNICO: depois do núcleo, a frase carrega só UM traço — um resultado, uma situação ou uma característica. PROIBIDO empilhar mais de um traço (núcleo + traço + outro traço/qualificação/cenário) e PROIBIDO mais de uma oração subordinada ("que"); havendo uma relativa, ela é a única adição depois do núcleo e fecha a frase ali — sem encadear mais nada. Isso vale também DENTRO do traço único: um adjetivo ou particípio colado ao substantivo do complemento (ex.: "negociações digitais", "contatos ativos") conta como um SEGUNDO traço enfeitando o primeiro, não como parte do mesmo traço — só mantenha esse adjetivo se ele for a própria característica que define o resultado (sem ele a frase perde informação real).
FECHO DA FRASE: as últimas 2-3 palavras precisam nomear um resultado, necessidade ou benefício CONCRETO e reconhecível pelo cliente final — algo específico que ele ganha, resolve ou evita com este item. PROIBIDO fechar com generalidade de bula/institucional: "sempre", "de qualidade", "com segurança", "do jeito certo", "na medida certa", "evita problemas comuns", "recaídas comuns", ou qualquer qualificador vazio que serviria igual para outro produto/serviço. PROIBIDO TAMBÉM fechar com um qualificador redundante ou de recheio — que repete uma ideia já implícita ("susto inesperado": susto já é inesperado) ou que só finge especificidade sem mudar o resultado ("digital", "ativo", "híbrido", "longo/a", "especial", "feito" coladas a um substantivo que já fazia sentido sozinho). TESTE: lendo só o fecho (as últimas palavras), ele descreve um efeito específico deste item, ou colaria em qualquer produto/serviço do mercado? E, tirando a última palavra, a frase perde algum sentido real, ou fica exatamente igual (só mais curta)? Se colar em qualquer coisa, OU se a frase ficar igual sem a última palavra, reescreva o fecho com o efeito concreto deste item, sem o enfeite. COERÊNCIA DO COMPLEMENTO: quando o item não tiver um resultado ou benefício concreto e prontamente verificável nesse contexto, NÃO force uma abstração nem invente um benefício pouco plausível só para cumprir esta regra — prefira um traço mais simples e genuíno do próprio item (um uso comum, uma característica real, um momento verdadeiro em que ele aparece na vida do cliente), desde que específico deste item. Um fecho modesto e verdadeiro vale mais que um benefício colado que não combina com o item.
VEROSSIMILHANÇA: a frase precisa ser algo que poderia acontecer de verdade com este produto, serviço ou atividade — sem função, causa-efeito, condição, benefício técnico ou comportamento não informado e implausível para o segmento ${segment}. Teste: "isso poderia acontecer de verdade com esse produto/serviço/atividade?" — se não, reescreva. O efeito citado precisa estar na escala do que o item FAZ diretamente (ex.: "ERP organiza pedidos"), não um resultado comercial dois passos depois que o item não controla sozinho (ex.: NÃO "ERP para vendas sem atraso" — um sistema não garante venda).
TESTE DO CONTEXTO REAL DE USO (já identificado acima): a situação descrita combina com o contexto já estabelecido dentro de "${mainActivity}" — não é um cenário genérico que serviria igual para o mesmo item ou atividade em outro contexto (uso doméstico, social, outro ramo, outro tipo de cliente). Teste: "essa situação só faz sentido porque está em '${mainActivity}', ou serviria igual em qualquer outro lugar?" — se servir igual em qualquer lugar, reescreva ancorando no contexto real desse ramo.
NATURALIDADE: a frase deve parecer uma pauta de conteúdo real, do jeito que alguém do ramo falaria — não um slogan, conceito institucional ou frase tecnicamente correta porém artificial. Locuções sem verbo são bem-vindas quando soarem mais naturais que uma frase completa. Se a frase parecer academicamente correta mas estranha ao jeito comum de falar do segmento ${segment}, reescreva de forma mais direta e reconhecível.
${mode === "postunico" ? 'Se a categoria for "Novidade ou Oportunidade", use tendências e comportamentos emergentes — não invente datas ou promoções inexistentes.\n' : ""}${proibicoesInventar}
LINGUAGEM: uma ideia principal, ordem direta, palavras curtas e do dia a dia — priorize termos de até 3 sílabas sempre que houver opção mais simples (ex.: "jeito" em vez de "organização", "bom"/"rápido" em vez de "eficiente", "passos" em vez de "procedimentos", "clientes" em vez de "compradores", "perdem"/"deixam passar" em vez de "ignoram"). Uma pessoa com ensino médio deve entender de primeira, sem reler. PROIBIDO: "decisores", "receita previsível", "riscos operacionais", "maximizar resultados", "estruturar processos", "estratégias digitais eficazes", "impacto real", "organização", "eficiente", "procedimentos", "compradores", termos técnicos de consultoria e qualquer palavra formal/comprida quando existir alternativa popular mais curta. Prefira: "vendas" a "receita", "empresas" a "decisores", "melhorar" a "otimizar", "clientes" a "compradores", "jeito" a "organização", "bom" a "eficiente". Se precisar trocar uma palavra grande por palavras mais curtas e isso aproximar a frase do limite de 7, prefira isso a manter um termo difícil — mas nunca ultrapasse 7 palavras. EXCEÇÃO: se houver um elemento concreto central (produto, peça, serviço, objeto, procedimento) vindo do texto do usuário ou da atividade, esse termo pode ter mais de 3 sílabas (ex.: "equipamento", "manutenção", "lubrificante", "orçamento", "diagnóstico", "estratégia") — não o troque por palavra genérica só para simplificar.`;

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

  const CONECTOR_PATTERNS: { nome: string; re: RegExp }[] = [
    { nome: "para", re: /\bpara\b/ },
    { nome: "com", re: /\bcom\b/ },
    { nome: "em", re: /\bem\b/ },
    { nome: "no", re: /\bno\b/ },
    { nome: "na", re: /\bna\b/ },
    { nome: "nos", re: /\bnos\b/ },
    { nome: "nas", re: /\bnas\b/ },
    { nome: "à", re: /\bà\b/ },
    { nome: "e", re: /\be\b/ },
  ];
  const detectConector = (sugestao: string): string | null => {
    const s = sugestao.toLowerCase();
    return CONECTOR_PATTERNS.find(({ re }) => re.test(s))?.nome ?? null;
  };
  const conectoresUsados = Array.from(
    new Set(previousSugs.map(detectConector).filter((c): c is string => !!c)),
  );
  const conectorWarning = conectoresUsados.length
    ? ` CONECTOR/VERBO JÁ USADO NESTE LOTE: as sugestões acima já usaram o conector ${conectoresUsados.map((c) => `"${c}"`).join(", ")}. Se o mesmo conector também for o mais natural pra este item, prefira variar (outro conector, ou uma construção com verbo de ação direto) — só repita se nenhuma alternativa soar natural. O VERBO DE AÇÃO principal desta frase (se houver) também precisa ser diferente do das sugestões acima (ex.: não use "agiliza"/"agilizam" de novo se já apareceu).`
    : "";

  const previousBlock = previousSugs.length
    ? `SUGESTÕES ANTERIORES NESTA SESSÃO (NÃO repita estes assuntos — gere algo completamente diferente, sobre outro produto, serviço ou situação):\n${previousSugs.map((s) => `- "${s}"`).join("\n")}\n⚠ ABERTURA TAMBÉM PRECISA SER DIFERENTE: mesmo se o produto/serviço de origem desta sugestão tiver nome parecido com algum item acima (ex.: dois serviços cadastrados começando com as mesmas palavras), a FRASE FINAL não pode começar com as mesmas palavras de nenhuma sugestão acima — não preserve o nome literal do item como abertura fixa; extraia o conceito e construa uma frase nova, com estrutura e primeiras palavras visivelmente diferentes.${conectorWarning}`
    : "";

  const tom = OBJETIVO_TOM[objetivo as keyof typeof OBJETIVO_TOM] ?? OBJETIVO_TOM.promocao;

  const MOP_SAFE_LENS_NAMES = new Set([
    "Resultado observável",
    "Necessidade percebida",
    "Escolha antes da compra",
    "Processo",
    "Oportunidade",
  ]);
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
  const lensGuardrail = ` Esta lente define apenas o ÂNGULO da frase dentro do CONTEXTO REAL DE USO já identificado — não cria uma situação nova, não substitui o núcleo definido em SINTAXE — NÚCLEO DA FRASE, e não deve transformar conceito abstrato em núcleo principal. A lente é um mecanismo interno: a frase final não deve deixar reconhecível qual lente foi usada — só devem aparecer produto/serviço, contexto real de uso e situação plausível em linguagem natural.${segment !== "MARCA" ? ` PROIBIDO usar tom de vínculo/comunidade com o público — "nosso(s)", "nossa(s)", "juntos", "nossa comunidade", "cuidar juntos", "fazemos parte da sua vida" — esse registro pertence ao segmento MARCA; em ${segment}, descreva produto/serviço e situação na 3ª pessoa, sem incluir o público como coautor ou parceiro emocional.` : ""}${lens.nome === "Oportunidade" ? ` POSIÇÃO DA OCASIÃO (regra desta lente): a ocasião/momento de calendário ou rotina escolhido entra como CONTEXTO no MEIO da frase — NUNCA como as últimas palavras. O FECHO da frase (ver FECHO DA FRASE nos critérios de qualidade) continua sendo o resultado, necessidade ou benefício concreto que o elemento entrega: a ocasião situa, o fecho resolve. A ocasião é um momento reconhecível (estação, época, situação da rotina do cliente), não uma data ou prazo específico não informado.` : ""}`;
  const lensBlock = `LENTE INTERNA DE GERAÇÃO (uso interno apenas — NÃO cite o nome da lente nem deixe rastro dela na frase final): ${lens.guia}${lensGuardrail}`;
  const lensBlockPU = `${lensBlock} Use esta lente apenas para variar o ASSUNTO do post único — mantenha o formato definido em ESTILO DA SUGESTÃO e não introduza tensão, motivação ou progressão de sequência.`;

  const sementeLembrete = segment === "MARCA" ? sementeLembreteMarca : sementeLembreteAtividade;

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
${verboBeneficioBlock}
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

${verboBeneficioBlock}
Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 frase, entre 4 e 7 palavras (máximo absoluto 7), em português, sem hashtag, sem emoji, sem aspas, concreta e de fácil compreensão" }`;

  const userPrompt = mode === "metodo" ? metodoPrompt : postUnicoPrompt;
  const systemMsg =
    mode === "metodo"
      ? 'Você é estrategista de conteúdo para redes sociais. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO: repetir a mesma palavra ou derivação morfológica da mesma raiz no mesmo texto. PROIBIDO ABSOLUTO no texto final: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01" a "OP-06", "mood" — são termos reservados. Use sinônimos contextuais. Antes de retornar: (1) pessoa com ensino médio entende de primeira? (2) há termo técnico, palavra grande ou formal (ex.: "procedimentos", "organização", "eficiente", "compradores") que poderia virar uma palavra curta e popular? (3) a frase parte de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — e não de um conceito amplo que serviria para qualquer empresa do segmento? (4) a relação de causa→efeito da frase é literalmente verdadeira e um nativo a diria sem reler? Expressão idiomática só vale se o sentido literal também fizer sentido com o objeto citado — em dúvida, troque a expressão "vívida" por uma consequência simples e direta. Se sim para (2), troque por algo mais simples; se não para (3) e a atividade permitir, ajuste para algo concreto desse ramo antes de responder; se não para (4), reescreva a consequência de forma literal e direta antes de responder. Limite: entre 4 e 7 palavras por sugestão (máximo absoluto 7) — nunca ultrapasse 7. Frases com mais de 7 palavras devem ser cortadas antes de retornar.'
      : "Você é estrategista de conteúdo brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. PROIBIDO repetir a mesma palavra ou qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue) no mesmo texto — use sinônimos ou reformule. Antes de retornar, prefira que a frase parta de uma situação concreta e reconhecível da ATIVIDADE informada — produto, ferramenta, canal, procedimento ou momento do dia a dia desse ramo — em vez de um conceito amplo que serviria para qualquer empresa do segmento. Limite: entre 4 e 7 palavras por sugestão (máximo absoluto 7) — nunca ultrapasse 7. Frases com mais de 7 palavras devem ser cortadas antes de retornar.";

  const MAX_SUGGEST_ATTEMPTS = 3;
  const SUGESTAO_MAX_WORDS = 7;
  let sugestao = "";
  let motivos: string[] = [];

  const runDeterministicChecks = (text: string): string[] => {
    let m = validateSugestao(text, SUGESTAO_MAX_WORDS);
    m = m.concat(
      checkInventedPromotion(text, allowedContext, {
        allowPromoLanguage: allowPromoLanguagePU,
      }),
    );
    if (mode === "postunico") m = m.concat(checkSupplierLanguage(text));
    m = m.concat(checkRepeatedOpening(text, previousSugs));
    m = m.concat(checkLensNameLeak(text, lens.nome));
    m = m.concat(checkWeakEnding(text, concreteItem));
    m = m.concat(checkItemNameDrift(text, concreteItem));
    return m;
  };

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
      throw Object.assign(new Error(result.error), { status: result.status });
    }
    const content = result.data.choices?.[0]?.message?.content;
    if (!content) throw Object.assign(new Error("Resposta vazia"), { status: 502 });

    let parsed: { sugestao?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw Object.assign(new Error("JSON inválido"), { status: 502 });
    }

    const rawSugestao = String(parsed.sugestao || "")
      .trim()
      .replace(/^"|"$/g, "");
    const rawWordCount = rawSugestao.split(/\s+/).filter(Boolean).length;
    sugestao = truncateWords(rawSugestao, SUGESTAO_MAX_WORDS);
    if (!sugestao) throw Object.assign(new Error("Sugestão vazia"), { status: 502 });

    motivos = runDeterministicChecks(sugestao);
    if (rawWordCount > SUGESTAO_MAX_WORDS) {
      motivos.push(
        `frase original tinha ${rawWordCount} palavras e foi cortada no meio — reescreva já dentro do limite de ${SUGESTAO_MAX_WORDS} palavras, sem depender de corte`,
      );
    }
    if (motivos.length === 0) {
      const veredito = await judgeSugestaoEstrutural(
        apiKey,
        sugestao,
        concreteItem,
        mainActivity,
        segment,
        audience,
      );
      if (!veredito.ok) {
        motivos.push(
          `juiz estrutural: ${veredito.motivo ?? "frase reprovada — reescreva com mais concretude e sem jargão"}`,
        );
      }
    }
    if (motivos.length === 0) break;
  }

  if (motivos.length > 0) {
    const pruned = pruneWeakEnding(sugestao);
    if (pruned) {
      const prunedMotivos = runDeterministicChecks(pruned);
      if (prunedMotivos.length < motivos.length) {
        sugestao = pruned;
        motivos = prunedMotivos;
      }
    }
  }

  return { sugestao };
}
