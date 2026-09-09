// Motor de GERAÇÃO da Informação-chave Editorial (piloto, atrás de
// profiles.beta_editorial). Server-only: importa fetchOpenAIChat.
// As regras puras (faixa de palavras, validação, classificação de fala e o
// bloco de regra para PU/MOP) ficam em core/linhaEditorialRules.ts, que roda
// também no navegador — ver o cabeçalho de lá para o porquê da divisão.
//
// RELAÇÃO COM O LEGACY: este módulo NÃO altera core/sugestaoEngine.ts. O
// caminho Legacy (assunto curto de 4-9 palavras) continua existindo byte a
// byte; quem decide qual dos dois roda é a rota suggest-keyinfo.ts, e ela só
// entra aqui quando o usuário está no beta E pediu o modo editorial. Com o
// beta desligado, nada deste arquivo é executado.
//
// O QUE MUDA EM RELAÇÃO AO LEGACY:
//   - a saída é uma PROPOSIÇÃO (~14-22 palavras), não um assunto;
//   - a proposição nasce de uma LINHA EDITORIAL declarada (a direção) e de uma
//     LENTE (a variação) — as mesmas lentes do motor atual, reaproveitadas;
//   - o objeto (produto/serviço/tema) tem MODO DE USO declarado, em vez de ser
//     sempre a semente concreta obrigatória da frase.
//
// O QUE NÃO MUDA: uma sugestão por chamada; cota, rate limit e débito
// continuam na rota; o motor é puro (sem HTTP próprio, sem Supabase, sem
// localStorage) e lança em falha da OpenAI, como generateSugestao.

import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import { getVoiceProfile } from "@/data/brandVoice";
import {
  OPENING_LENSES,
  classifyItemType,
  deriveRelacaoRealComTesteDeTroca,
  type SugestaoAudience,
  type SugestaoSegment,
} from "@/core/sugestaoEngine";
import { OBJETIVO_TOM } from "@/domain/objetivo.config";
import {
  EDITORIAL_MAX_WORDS,
  EDITORIAL_MIN_WORDS,
  validarProposicaoEditorial,
} from "@/core/linhaEditorialRules";
import {
  LINHA_EDITORIAL_SPEC,
  resolverLinhaAuto,
  type LinhaEditorial,
  type LinhaEditorialEscolha,
  type UsoDoObjeto,
} from "@/domain/linhaEditorial.config";

const MAX_EDITORIAL_ATTEMPTS = 3;

// ─────────────────────────────────────────────────────────────────────────
// Bloco de USO DO OBJETO no prompt da sugestão
// ─────────────────────────────────────────────────────────────────────────

function blocoUsoObjeto(objeto: string, uso: UsoDoObjeto, segment: SugestaoSegment): string {
  const alvo = objeto.trim();
  if (!alvo) {
    // Item 47 do pedido: sem objeto, não inventar produto.
    return `PRODUTO / SERVIÇO / TEMA: nenhum selecionado.
PROIBIDO inventar produto, serviço, linha, modelo ou obra que a empresa não tenha. A proposição nasce da ATIVIDADE, do segmento e da pista do usuário — pode falar da situação, do mercado ou do próprio jeito de trabalhar, sem nomear item nenhum.`;
  }

  const cabecalho = `PRODUTO / SERVIÇO / TEMA desta rodada: "${alvo}"`;
  const naoInventar = `PROIBIDO atribuir a ele característica, resultado, condição comercial, medida, material ou benefício técnico que não esteja no nome cadastrado nem na ATIVIDADE acima.`;

  switch (uso) {
    case "nome":
      return `${cabecalho}
MODO DE USO — MOSTRAR NOME: a proposição precisa NOMEAR este item. Use o nome cadastrado ou o NÚCLEO COMERCIAL RECONHECÍVEL dele — não é obrigatório repetir o cadastro inteiro (ex.: "Terno Masculino Slim Corte Italiano Microfibra Preto Ref. 4758" pode virar "Terno Slim Preto"). PROIBIDO trocar por outro item da mesma categoria: encurtar o nome é permitido, mudar o produto não é. ${naoInventar}`;
    case "sem_nome":
      return `${cabecalho}
MODO DE USO — REFERIR SEM NOME: o item é o CONTEXTO da proposição, mas seu nome cadastrado NÃO pode aparecer escrito. Descreva-o pelo que ele é ou pelo uso que tem (ex.: para "Terno Slim Preto" → "um terno preto de corte slim", "uma peça social versátil para trabalho e eventos"). O leitor precisa reconhecer do que se trata sem ler a etiqueta. ${naoInventar}`;
    case "nao_usar":
      return `PRODUTO / SERVIÇO / TEMA: existe um item selecionado, mas ele NÃO participa desta comunicação.
MODO DE USO — NÃO USAR: PROIBIDO nomear, descrever ou tomar este item como âncora da frase. A proposição fala da atividade, do segmento, da comunicação da empresa ou da situação do público — não deste item. Se a frase só faz sentido por causa dele, reescreva.`;
    default:
      return `${cabecalho}
MODO DE USO — AUTOMÁTICO: VOCÊ decide, e a decisão é parte do trabalho. Escolha UMA das três:
  (a) NOMEAR o item (use o núcleo comercial reconhecível do nome cadastrado);
  (b) REFERIR sem escrever o nome (descrevendo o que ele é ou para que serve);
  (c) NÃO usar o item (a proposição fala da atividade ou da situação do público).
CRITÉRIO: nomeie quando o item for o assunto e o leitor precisar saber qual é; refira sem nome quando o assunto for a situação e o item for só o contexto; não use quando a ideia relevante for sobre comunicação, mercado ou comportamento e o item só atrapalharia. Considere o segmento ${segment}, a linha editorial pedida abaixo e a pista do usuário. ${naoInventar}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Geração
// ─────────────────────────────────────────────────────────────────────────

export interface EditorialEngineInput {
  companyName: string;
  mainActivity: string;
  segment: SugestaoSegment;
  audience: SugestaoAudience;
  brandVoice: string;
  isPersonalBrand: boolean;
  mode: "postunico" | "metodo";
  /** Só no PU — no MOP vem string vazia e é ignorado. */
  objetivo: string;
  linhaEscolhida: LinhaEditorialEscolha;
  /** Linhas já entregues NESTA rodada — alimenta o "auto" (motor puro). */
  linhasUsadas: LinhaEditorial[];
  usoObjeto: UsoDoObjeto;
  /** Produto/Serviço/Tema escolhido. "" quando não há. */
  objeto: string;
  hint: string;
  /** 0, 1 ou 2 — posição da sugestão dentro da rodada. */
  attempt: number;
  sessionSeed: number;
  previousSuggestions: string[];
}

export interface EditorialEngineResult {
  sugestao: string;
  linhaEditorial: LinhaEditorial;
  /**
   * Um item por chamada REAL ao juiz — devolvido para a rota persistir e
   * permitir medir a taxa de aprovação/reprovação/fail-open em produção.
   * Mesmo contrato de `judgeVerdicts` em generateSugestao: o motor é puro e
   * não escreve em banco.
   */
  veredictos: Array<JuizEditorialVeredito & { pass: number }>;
}

export function buildEditorialPrompt(
  input: EditorialEngineInput,
  linha: LinhaEditorial,
  lente: { nome: string; guia: string },
  /**
   * O que o serviço realmente é, DERIVADO do nome + atividade — nunca informado
   * pelo usuário. Ver a nota em generateSugestaoEditorial sobre por que existe.
   */
  relacaoReal?: string | null,
): string {
  const {
    companyName,
    mainActivity,
    segment,
    audience,
    brandVoice,
    isPersonalBrand,
    mode,
    objetivo,
    usoObjeto,
    objeto,
    hint,
    previousSuggestions,
  } = input;

  const spec = LINHA_EDITORIAL_SPEC[linha];
  const isB2C = audience === "B2C";
  const voice = getVoiceProfile(brandVoice);

  const voiceBlock = voice
    ? `DIREÇÃO DE VOZ — "${voice.label}": ritmo ${voice.ritmo} Vocabulário: ${voice.vocabulario} Evitar: ${voice.evitar}\nProibido mencionar literalmente o nome da voz no texto.\n`
    : "";

  const audienceBlock = isB2C
    ? `PÚBLICO-ALVO: CONSUMIDOR FINAL (B2C). Fale com a PESSOA que usa o produto/serviço na própria vida. PROIBIDO usar "empresário", "gestor", "decisor", "equipe" ou "negócio" como interlocutor.`
    : `PÚBLICO-ALVO: EMPRESARIAL (B2B). Fale com o dono, sócio ou responsável pelo negócio, sobre trabalho concreto (atendimento, prazo, equipe, custo, vendas, resultado). PROIBIDO linguagem de grande consultoria: "decisores", "receita previsível", "riscos operacionais", "maximizar", "escalar".`;

  const objetivoBlock =
    mode === "postunico"
      ? `OBJETIVO DA PEÇA: ${objetivo} (tom: ${OBJETIVO_TOM[objetivo as keyof typeof OBJETIVO_TOM] ?? "neutro"})
O objetivo diz O QUE a peça precisa cumprir; a linha editorial diz POR QUAL PERSPECTIVA. São dimensões diferentes e valem ao mesmo tempo — a proposição não pode contrariar o objetivo.`
      : `DESTINO: sequência do Método OP. Esta proposição será o EIXO de uma sequência inteira, não de uma peça só — precisa ter matéria suficiente para ser desenvolvida em vários ângulos, sem já entregar a conclusão.`;

  const marcaBlock =
    segment === "MARCA"
      ? `\nSEGMENTO MARCA: o "objeto" aqui pode ser uma obra, um livro, uma pintura, um conceito, um método ou um projeto — não só mercadoria. Trate-o com a natureza que ele tem${isPersonalBrand ? ", e lembre que esta é uma MARCA PESSOAL: o eixo é a trajetória e o jeito de trabalhar da pessoa, não a cultura de uma empresa abstrata" : ""}.`
      : "";

  const hintBlock = hint.trim()
    ? `PISTA DO USUÁRIO (é o assunto que ele quer tratar — respeite-a; não copie literalmente, desenvolva): "${hint.trim()}"
Se a pista citar preço, prazo, condição ou número, PROIBIDO inventar o valor: trate o tema sem cravar o dado que não foi informado.`
    : `O usuário não deu pista — construa a partir da ATIVIDADE, do objeto e da lente abaixo.`;

  const previousBlock = previousSuggestions.length
    ? `PROPOSIÇÕES JÁ ENTREGUES (NÃO repita assunto, abertura nem estrutura destas):\n${previousSuggestions.map((s) => `- "${s}"`).join("\n")}\n⚠ A nova proposição precisa tratar de outra situação ou outro recorte — não vale reescrever as acima com sinônimos, nem começar com as mesmas palavras.`
    : "";

  return `Escreva UMA Informação-chave Editorial em português brasileiro.

EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
SEGMENTO: ${segment}${marcaBlock}
${voiceBlock}${audienceBlock}

${objetivoBlock}

LINHA EDITORIAL DESTA PROPOSIÇÃO — ${spec.label.toUpperCase()}
Pergunta que ela responde: "${spec.pergunta}"
${spec.guia}
${spec.evitar}
Exemplo de CALIBRAÇÃO (referência interna — NÃO copie o assunto nem as palavras): "${spec.exemplo}"

${blocoUsoObjeto(objeto, usoObjeto, segment)}
${
  relacaoReal
    ? `RELAÇÃO REAL JÁ IDENTIFICADA (uso interno — embasa a frase, não precisa ser citada literalmente): "${relacaoReal}".
Ancore a proposição NESTA relação em vez de inventar o que o serviço faz. Ela é a única base concreta que você tem sobre este item: tudo que você afirmar além dela é chute.
`
    : ""
}

LENTE (mecanismo interno de variação — NÃO deve ser reconhecível na frase, e a palavra "${lente.nome}" não pode aparecer): ${lente.guia}
A LINHA EDITORIAL é a direção; a LENTE é só de onde se olha. Quando as duas parecerem brigar, a LINHA EDITORIAL vence.

${hintBlock}

${previousBlock}

O QUE É UMA INFORMAÇÃO-CHAVE EDITORIAL:
Uma PROPOSIÇÃO completa — uma frase que já afirma alguma coisa — e não um assunto nem um título. Ela carrega, quando pertinente:
  1. um assunto concreto (o que está em jogo);
  2. uma situação reconhecível pelo público (onde isso acontece na vida dele);
  3. uma ideia relevante (o que essa situação revela);
  4. a intenção editorial da linha acima.
TAMANHO: entre ${EDITORIAL_MIN_WORDS} e ${EDITORIAL_MAX_WORDS} palavras. A faixa é a desejada, não um corte: se a frase precisar de uma ou duas palavras a mais para ficar inteira e verdadeira, prefira isso a amputá-la. Abaixo de ${EDITORIAL_MIN_WORDS} palavras você provavelmente escreveu um assunto, não uma proposição — releia e complete.
FRASE INTEIRA: todo verbo com seu complemento, toda preposição no lugar, ponto final no fim. Nunca entregue frase terminada em vírgula, "e", "que" ou preposição solta.

PROIBIDO:
- linguagem de campanha ("não perca", "aproveite agora", "garanta já") e promessa emocional ("transforme sua vida", "revolucione");
- inventar preço, desconto, percentual, prazo, data, estoque, brinde, parcelamento, condição de pagamento, certificação, número de clientes ou qualquer especificação não informada;
- crítica ou cobrança ao leitor ("você não sabe", "você está perdendo dinheiro");
- as palavras reservadas do sistema: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "mood";
- jargão de agência e estrangeirismo: "engajamento", "performance", "branding", "leads", "funil", "ROI", "briefing". Use palavras que uma pessoa com ensino médio entende de primeira.

Retorne JSON EXATAMENTE assim:
{ "sugestao": "1 proposição, ${EDITORIAL_MIN_WORDS} a ${EDITORIAL_MAX_WORDS} palavras, sem aspas, sem hashtag, sem emoji, terminando com ponto final" }`;
}

// ─────────────────────────────────────────────────────────────────────────
// Juiz da proposição editorial
// ─────────────────────────────────────────────────────────────────────────
//
// POR QUE UM JUIZ PRÓPRIO, e não o do Legacy (judgeSugestaoEstrutural):
// aquele foi calibrado para a frase CURTA de 4-9 palavras e reprovaria
// proposições corretas. A pergunta 2 dele (`nucleoOk`) exige que o elemento
// concreto seja o SUJEITO GRAMATICAL e reprova "a escolha DE [item]" — mas
// "Ao escolher o Diagnóstico Digital, A DECISÃO passa por..." é exatamente a
// forma certa de uma proposição de DECISÃO. Ligá-lo como está quebraria o modo.
//
// A pergunta 7 do Legacy (dado inventado) é a única que veio quase literal —
// é a que responde ao pedido de "informação-chave mais verdadeira" (09/09/2026).
//
// CONTRATO igual ao do Legacy: fail-OPEN em erro técnico (rede, JSON inválido —
// ninguém fica sem sugestão porque o juiz caiu) e fail-CLOSED em dúvida de
// conteúdo (qualquer valor que não seja exatamente `true` reprova).

export interface JuizEditorialVeredito {
  ok: boolean;
  motivo?: string;
  failReason?: "falha_tecnica";
}

const JUIZ_EDITORIAL_TIMEOUT_MS = 8_000;

export async function judgeProposicaoEditorial(
  apiKey: string,
  params: {
    proposicao: string;
    linha: LinhaEditorial;
    companyName: string;
    mainActivity: string;
    objeto: string;
    hint: string;
    relacaoReal?: string | null;
  },
): Promise<JuizEditorialVeredito> {
  const { proposicao, linha, companyName, mainActivity, objeto, hint, relacaoReal } = params;
  const spec = LINHA_EDITORIAL_SPEC[linha];
  try {
    const criterioDecisao =
      linha === "decisao"
        ? `
4. criterioOk — a frase diz O QUE MUDA entre as duas alternativas, ou só as NOMEIA? Reprove quando ela contrapõe CANAIS/FORMATOS sem dizer o que cada um entrega ou custa (ex.: "análise por e-mail × entrevista presencial", "atendimento online × na loja", "plano mensal × anual" — são nomes de formato, não critérios; o leitor fica sem base para decidir). Aprove quando o critério, o dado ou a consequência que separa as opções estiver dito (ex.: "se basta o que o cliente escreve ou se é preciso ver como ele trabalha").`
        : `
4. relevanciaOk — a frase entrega uma IDEIA, ou só descreve/nomeia uma situação sem dizer o que ela revela? Reprove quando, lida inteira, não sobrar nada que o leitor não soubesse antes.`;

    // A TRANSFORMAÇÃO COLIDE COM O fatoOk POR NATUREZA. A linha PEDE que a frase
    // afirme uma mudança no mundo ("está deixando de X e começando a Y") — e uma
    // mudança em curso nunca é confirmável pela Atividade nem pelo nome do item.
    // Sem esta ressalva o juiz reprovava a frase JUSTAMENTE por cumprir a linha
    // pedida, e a Transformação virava a única linha que nunca aprovava nada.
    // A fronteira não é "pode afirmar mudança ou não": é ONDE a mudança está
    // situada. Tendência ampla de mercado passa; mecanismo, gatilho, ocasião ou
    // número de dentro desta empresa continua sendo dado inventado.
    const ressalvaTransformacao =
      linha === "transformacao"
        ? ` ⚠ RESSALVA DESTA LINHA: a Transformação EXIGE afirmar uma mudança em curso — os DOIS polos ("está deixando de X e começando a Y", "antes era X, hoje é Y", "vem sendo") são a própria linha editorial e NÃO contam como dado inventado, desde que enunciados como TENDÊNCIA AMPLA de mercado, de comportamento ou de tecnologia. Segue reprovado o detalhe operacional que ninguém informou: o MECANISMO ("por causa da mudança nas regras das plataformas"), o GATILHO ou a OCASIÃO ("nas reuniões de revisão do semestre"), o NÚMERO, o PRAZO e a ETAPA. Teste prático: se a afirmação vale para o setor inteiro, aprove; se ela descreve o que acontece DENTRO desta empresa, ou POR QUE a mudança aconteceu, reprove.`
        : "";

    const res = await fetchOpenAIChat(
      apiKey,
      {
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content:
              "Você é um editor rigoroso avaliando UMA frase. Responda SOMENTE com JSON válido. Em dúvida sobre qualquer critério, marque false — é preferível pedir outra frase a deixar passar uma ruim.",
          },
          {
            role: "user",
            content: `EMPRESA: ${companyName || "(não informada)"}
ATIVIDADE: ${mainActivity || "(não informada)"}
PRODUTO/SERVIÇO/TEMA DESTA PEÇA: ${objeto || "(nenhum)"}
${hint ? `PISTA QUE O USUÁRIO DEU: "${hint}"\n` : ""}${
              relacaoReal
                ? `RELAÇÃO REAL DERIVADA deste item (inferida do nome + atividade, NÃO informada pelo cliente): "${relacaoReal}"
Use isto como base do que se pode afirmar: o que for coerente com esta relação conta como ancorado. Mas ela é INFERÊNCIA, não declaração do cliente — não autoriza detalhes novos (número, prazo, etapa, ferramenta) que nem ela nem a atividade contenham.\n`
                : ""
            }
LINHA EDITORIAL PEDIDA: ${spec.label} — "${spec.pergunta}"
O que ela exige: ${spec.guia}

FRASE A AVALIAR: "${proposicao}"

Responda JSON com estas chaves booleanas e um "motivo" curto (só quando reprovar):
1. fatoOk — a frase evita AFIRMAR como fato um dado específico sobre este produto/serviço/método que NÃO dá para confirmar pela ATIVIDADE, pelo NOME do item ou pela PISTA acima? Conta como dado inventado: descrever COMO o serviço é feito, POR QUEM, EM QUANTO TEMPO, com QUE ferramenta, ou como a alternativa/concorrência funciona — quando nada disso foi informado. Soar plausível NÃO basta. Em dúvida, false.${ressalvaTransformacao}
2. linhaOk — a frase cumpre a linha editorial pedida acima, ou escorregou para outra? (Diagnóstico que virou conselho, Conhecimento que virou dica, Experiência que virou convite a testar, Transformação sem o ponto de partida, Decisão que empurra uma das opções.) Em dúvida, false.
3. proposicaoOk — é uma frase que AFIRMA alguma coisa, com sujeito e predicado inteiros — e não um título, um assunto solto ou um slogan institucional?${criterioDecisao}
5. respeitoOk — a frase evita criticar, culpar ou ridicularizar o leitor e o método que ele usa hoje ("achismo", "amadorismo", "você está perdendo dinheiro", "quem faz assim não sabe")? Apontar uma limitação de forma factual é permitido; qualificar de forma depreciativa não.
6. promessaOk — a frase evita atribuir ao produto/serviço um poder que ele não tem? Reprove quando o item aparece como AGENTE de um resultado que depende do cliente ou de outros fatores ("[produto] decide resultados", "garante vendas", "traz clientes", "resolve o negócio", "transforma a empresa"). Um serviço mostra, aponta, revela, organiza, orienta — quem decide e quem executa é o empresário. Verbo verificável passa; verbo grandioso, não.

{"fatoOk":true,"linhaOk":true,"proposicaoOk":true,"${linha === "decisao" ? "criterioOk" : "relevanciaOk"}":true,"respeitoOk":true,"promessaOk":true,"motivo":""}`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      },
      JUIZ_EDITORIAL_TIMEOUT_MS,
    );

    if (!res.ok) return { ok: true, failReason: "falha_tecnica" };
    const content = res.data.choices?.[0]?.message?.content;
    if (!content) return { ok: true, failReason: "falha_tecnica" };

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: true, failReason: "falha_tecnica" };
    }

    const quartaChave = linha === "decisao" ? "criterioOk" : "relevanciaOk";
    const allOk =
      parsed.fatoOk === true &&
      parsed.linhaOk === true &&
      parsed.proposicaoOk === true &&
      parsed[quartaChave] === true &&
      parsed.respeitoOk === true &&
      parsed.promessaOk === true;
    if (allOk) return { ok: true };

    return {
      ok: false,
      motivo:
        typeof parsed.motivo === "string" && parsed.motivo.trim()
          ? parsed.motivo.trim()
          : "o juiz reprovou a proposição (dado não confirmável, linha editorial trocada, falta de ideia, desrespeito ao leitor ou promessa que o serviço não cumpre) sem detalhar — reescreva ancorando só no que foi informado",
    };
  } catch {
    return { ok: true, failReason: "falha_tecnica" };
  }
}

/**
 * Gera UMA proposição editorial. Uma chamada do usuário = uma proposição
 * (item 30 do pedido) — o laço abaixo é retry de QUALIDADE sobre a mesma
 * proposição, nunca geração de alternativas.
 */
export async function generateSugestaoEditorial(
  apiKey: string,
  input: EditorialEngineInput,
): Promise<EditorialEngineResult> {
  const linha =
    input.linhaEscolhida === "auto"
      ? resolverLinhaAuto({
          mode: input.mode,
          objetivo: input.objetivo,
          linhasUsadas: input.linhasUsadas,
          attempt: input.attempt,
        })
      : input.linhaEscolhida;

  // Lente: mesma biblioteca do motor Legacy (OPENING_LENSES). Rotação
  // determinística por sessão + tentativa, para que as 3 sugestões de uma
  // rodada com a MESMA linha editorial (caso manual) variem de ângulo em vez de
  // virarem paráfrase uma da outra — item 33 do pedido.
  const lente = OPENING_LENSES[(input.sessionSeed + input.attempt) % OPENING_LENSES.length];

  // RELAÇÃO REAL — o sistema descobrindo o que o serviço é, em vez de perguntar.
  //
  // Achado real 09/09/2026: o juiz reprovou 3 de 6 propostas, todas por "não há
  // informação suficiente sobre o serviço". Ele estava certo em cada caso e
  // errado no conjunto — o Kit guarda o NOME do produto e a atividade, e nada
  // sobre o que cada serviço entrega. Numa linha DECISÃO, que exige nomear
  // entre o que se escolhe, qualquer alternativa proposta seria não-confirmável.
  //
  // A saída NÃO foi pedir um campo novo ao usuário (decisão do Ari, e princípio
  // já registrado: "a inteligência é interna, nunca vira caixa na tela").
  // Reaproveita `deriveRelacaoRealComTesteDeTroca`, que já roda em produção no
  // caminho Legacy: recebe nome + atividade e devolve a relação real do item,
  // com o TESTE DE TROCA embutido contra generalidade ("se trocar o item por
  // outro qualquer, a relação continuaria verdadeira? então é genérica demais").
  //
  // MESMO RECORTE DO LEGACY: só quando há objeto e ele NÃO é produto físico —
  // item de VAREJO ancora a cena sozinho, serviço e tema não. gpt-4.1-mini,
  // ~US$ 0,0004. Falha ABERTA: sem relação, o prompt fica como estava.
  const objetoTrim = input.objeto.trim();
  const relacaoReal =
    objetoTrim && classifyItemType(objetoTrim) !== "VAREJO"
      ? await deriveRelacaoRealComTesteDeTroca(
          apiKey,
          objetoTrim,
          input.companyName,
          input.mainActivity,
          input.segment,
        )
      : null;

  const allowedContext = [
    input.hint,
    input.mainActivity,
    input.companyName,
    input.objeto,
    relacaoReal || "",
  ]
    .filter(Boolean)
    .join(" ");

  const basePrompt = buildEditorialPrompt(input, linha, lente, relacaoReal);

  let melhor = "";
  let melhorMotivos: string[] | null = null;
  let motivos: string[] = [];
  const veredictos: Array<JuizEditorialVeredito & { pass: number }> = [];

  for (let pass = 1; pass <= MAX_EDITORIAL_ATTEMPTS; pass++) {
    const reforco =
      pass > 1 && motivos.length
        ? `\n\nATENÇÃO: a tentativa anterior teve este problema: ${motivos.join("; ")}. Reescreva corrigindo isso, mantendo a MESMA linha editorial e o MESMO assunto.`
        : "";

    const result = await fetchOpenAIChat(apiKey, {
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "Você é editor-chefe de uma publicação de negócios brasileira. Escreva com gramática e ortografia impecáveis conforme a norma culta do português brasileiro. Responda SEMPRE com JSON válido. Antes de devolver, confira: (1) é uma frase que AFIRMA algo, não um título nem um assunto solto? (2) uma pessoa com ensino médio entende de primeira, sem reler? (3) a frase cumpre a linha editorial pedida, ou escorregou para outra? (4) há algum dado (preço, prazo, número, condição) que não foi informado? Se falhar em qualquer uma, reescreva antes de responder.",
        },
        { role: "user", content: basePrompt + reforco },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
    });

    if (!result.ok) {
      const err = new Error(result.error) as Error & { status?: number };
      err.status = result.status;
      throw err;
    }

    const content = result.data.choices?.[0]?.message?.content;
    let parsed: { sugestao?: string } = {};
    try {
      parsed = JSON.parse(content || "{}");
    } catch {
      parsed = {};
    }
    let candidato = String(parsed.sugestao || "")
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim();
    if (candidato && !/[.!?]$/.test(candidato)) candidato = `${candidato}.`;

    motivos = validarProposicaoEditorial(candidato, allowedContext, {
      objeto: input.objeto,
      usoObjeto: input.usoObjeto,
    });

    // JUIZ — só quando as checagens determinísticas passaram. Chamar o juiz
    // sobre um candidato já reprovado gastaria uma chamada de modelo para
    // confirmar o que a régua barata já sabe.
    if (candidato && motivos.length === 0) {
      const veredito = await judgeProposicaoEditorial(apiKey, {
        proposicao: candidato,
        linha,
        companyName: input.companyName,
        mainActivity: input.mainActivity,
        objeto: input.objeto,
        hint: input.hint,
        relacaoReal,
      });
      veredictos.push({ ...veredito, pass });
      if (veredito.failReason) {
        console.warn("[editorial] juiz indisponível — seguindo sem ele");
      } else if (!veredito.ok && veredito.motivo) {
        motivos = [veredito.motivo];
      }
    }

    if (candidato && (melhorMotivos === null || motivos.length < melhorMotivos.length)) {
      melhor = candidato;
      melhorMotivos = motivos;
    }
    if (candidato && motivos.length === 0) break;
  }

  // NUNCA trunca: proposição cortada perde o predicado e deixa de afirmar — o
  // defeito que este modo existe para evitar. Devolve a melhor tentativa.
  return { sugestao: melhor, linhaEditorial: linha, veredictos };
}
