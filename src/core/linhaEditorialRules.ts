// Regras PURAS da Informação-chave Editorial (piloto, atrás de
// profiles.beta_editorial).
//
// POR QUE SEPARADO DE core/editorialKeyInfo.ts: o motor de geração importa
// `fetchOpenAIChat` (@/lib/openaiClient.server) e por isso é server-only. Estas
// regras precisam rodar TAMBÉM no navegador — buildMetodoOpPrompt monta o
// prompt do MOP no cliente (ver services/api/generateMethodContent.ts), e a
// classificação de fala do microfone acontece na tela. Misturar os dois num
// arquivo só arrastaria o cliente OpenAI para o bundle do browser.
// Regra 4 do PLANO_V2 (motor puro) aplicada literalmente: nada aqui conhece
// React, Supabase, localStorage ou HTTP.

import { checkDanglingEnding } from "./textWordUtils";
import { checkInventedPromotion } from "./sugestaoValidation";
import {
  LINHA_EDITORIAL_SPEC,
  type LinhaEditorial,
  type UsoDoObjeto,
} from "../domain/linhaEditorial.config";

// ── Faixa de palavras da proposição editorial ─────────────────────────────
// FONTE ÚNICA (mesma disciplina de SUGESTAO_MIN/MAX_WORDS no Legacy): o número
// que o prompt pede e o número que a validação cobra têm de ser o mesmo.
// A faixa é DESEJADA, não corte rígido — decisão explícita do pedido ("pode
// passar um pouco se necessário para manter o sentido"). Por isso a reprovação
// só começa nos TETOS DUROS, e nunca há truncamento: cortar uma proposição no
// meio produz frase amputada, que é pior do que uma frase 2 palavras maior.
export const EDITORIAL_MIN_WORDS = 14;
export const EDITORIAL_MAX_WORDS = 22;
/** Abaixo disso não é proposição, é assunto — reprovada e regerada. */
export const EDITORIAL_HARD_MIN = 11;
/** Acima disso vira parágrafo — reprovada e regerada (nunca truncada). */
export const EDITORIAL_HARD_MAX = 28;

/** Teto de sugestões por rodada (item 5 do pedido). */
export const EDITORIAL_SUGGEST_MAX = 3;

// Termos reservados dos moods/templates internos — mesma lista já cobrada no
// Legacy e no MOP. A proposição vira a Informação-chave, então precisa nascer
// limpa: se "clareza" entra aqui, o MOP a proíbe depois e a peça perde
// justamente a palavra que sustentava a ideia.
const TERMOS_RESERVADOS =
  /\b(clareza|impacto|instante|fragmento|desvio|sil[êe]ncio|mood|OP-0[1-6])\b/i;

export function contarPalavras(texto: string): number {
  return (texto || "").trim().split(/\s+/).filter(Boolean).length;
}

// ─────────────────────────────────────────────────────────────────────────
// Fala do usuário: COMANDO × PISTA (item 28 do pedido)
// ─────────────────────────────────────────────────────────────────────────
//
// POR QUE DETERMINÍSTICO, sem IA: reconhecer "outra" como comando não é tarefa
// semântica difícil, e uma chamada de modelo custaria dinheiro e latência em
// cima de cada ditado. O risco de errar é assimétrico e conhecido: tratar um
// COMANDO como conteúdo faz a peça inteira falar sobre "me dê uma sugestão" —
// defeito visível e absurdo. Tratar uma PISTA como comando só perde a pista, e
// o usuário repete. Por isso a lista de comandos é FECHADA e curta: NA DÚVIDA,
// É PISTA.

export type TipoDeFala = "comando" | "pista" | "comando_com_pista";

export interface FalaClassificada {
  tipo: TipoDeFala;
  /** O que sobra depois de retirar o comando — vira `hint`. "" quando não há. */
  hint: string;
}

function normalizarFala(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.!?]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Núcleo do comando: o verbo/pedido, sem o complemento. Aceita vírgula depois
// do marcador ("outra, mas falando de preço") — sem isso o prefixo não casava e
// a fala inteira virava pista, que era o defeito pego pelo teste.
const COMANDO_NUCLEO =
  /^(?:(?:me|nos)\s+)?(?:d[ae]|manda|mande|gera|gere|cria|crie|faz|faca|sugere|sugira|quero|queria|preciso|pode)?\s*(?:me\s+)?(?:dar|gerar|criar|fazer|sugerir)?\s*(?:(?:uma?|mais\s+uma?|outra|outro|nova|novo|de\s+novo)[\s,]*)*(?:sugestao|sugestoes|ideia|ideias|opcao|opcoes)?[\s,]*/;

// Um verbo sozinho NÃO é comando: "quero outra" é comando, "quero falar de X"
// é conteúdo. O prefixo consumido só conta como comando se contiver um marcador
// de pedido de sugestão — é o que separa os dois casos sem lista infinita.
const MARCADOR_COMANDO = /\b(?:outra|outro|nova|novo|de\s+novo|sugest|ideia|opcao)/;

// Conectivos que separam o comando da pista: "outra, mas falando de preço".
const CONECTIVO_PISTA =
  /^(?:,\s*)?(?:mas\s+|so\s+que\s+|porem\s+|e\s+)?(?:agora\s+)?(?:falando\s+(?:de|do|da|sobre)|falar\s+(?:de|do|da|sobre)|sobre|a\s+respeito\s+de|que\s+fale\s+(?:de|do|da|sobre)|com\s+foco\s+em|focando\s+em|puxando\s+(?:para|pro|pra)|voltada?\s+(?:para|pro|pra)|no\s+tema\s+d[eoa])\s+/;

// Comandos puros — lista FECHADA. Qualquer coisa fora daqui que não case com
// núcleo + conectivo é tratada como PISTA.
const COMANDOS_PUROS = new Set([
  "outra",
  "outro",
  "mais uma",
  "mais um",
  "de novo",
  "denovo",
  "outra sugestao",
  "outra ideia",
  "outra opcao",
  "nova sugestao",
  "nova ideia",
  "sugestao",
  "sugere",
  "sugira",
  "gera",
  "gere",
  "me da outra",
  "me de outra",
  "quero outra",
  "quero mais uma",
  "me da uma sugestao",
  "me de uma sugestao",
  "me da uma ideia",
  "me de uma ideia",
  "gera outra",
  "gere outra",
  "faz outra",
  "faca outra",
  "tenta de novo",
  "tente de novo",
]);

/**
 * Classifica o que o usuário falou no microfone dentro do modo editorial.
 *
 * - "Me dê uma sugestão."            → comando (hint vazio)
 * - "Outra."                         → comando
 * - "Outra, mas falando de preço."   → comando_com_pista (hint "preço")
 * - "Quero falar daqueles anúncios…" → pista (hint = a fala inteira)
 */
export function classificarFalaEditorial(textoBruto: string): FalaClassificada {
  const bruto = (textoBruto || "").trim();
  if (!bruto) return { tipo: "pista", hint: "" };

  const norm = normalizarFala(bruto);
  if (COMANDOS_PUROS.has(norm)) return { tipo: "comando", hint: "" };

  const prefixo = norm.match(COMANDO_NUCLEO)?.[0] ?? "";
  const semNucleo = norm.slice(prefixo.length);
  // A fala não começa por um pedido de sugestão → é pista inteira (preserva o
  // texto original, com acento e pontuação, que vira matéria-prima do prompt).
  if (!MARCADOR_COMANDO.test(prefixo)) return { tipo: "pista", hint: bruto };
  if (!semNucleo.trim()) return { tipo: "comando", hint: "" };

  const semConectivo = semNucleo.replace(CONECTIVO_PISTA, "").trim();
  const houveConectivo = semConectivo !== semNucleo.trim();
  if (!semConectivo) return { tipo: "comando", hint: "" };
  // Sem conectivo explícito, o resto só vira pista se tiver corpo de assunto —
  // isso evita que "sugestão nova aí" produza a pista "aí".
  if (houveConectivo || contarPalavras(semConectivo) >= 3) {
    return { tipo: "comando_com_pista", hint: semConectivo };
  }
  return { tipo: "comando", hint: "" };
}

// ─────────────────────────────────────────────────────────────────────────
// Validação determinística da proposição (sem chamada de API)
// ─────────────────────────────────────────────────────────────────────────

export function validarProposicaoEditorial(
  texto: string,
  allowedContext: string,
  opts?: { objeto?: string; usoObjeto?: UsoDoObjeto },
): string[] {
  const t = (texto || "").trim();
  const motivos: string[] = [];
  if (!t) return ["proposição vazia"];

  const n = contarPalavras(t);
  if (n < EDITORIAL_HARD_MIN)
    motivos.push(
      `proposição com ${n} palavras — curta demais (a faixa é ${EDITORIAL_MIN_WORDS} a ${EDITORIAL_MAX_WORDS}); ela precisa AFIRMAR uma ideia, não só nomear um assunto`,
    );
  if (n > EDITORIAL_HARD_MAX)
    motivos.push(
      `proposição com ${n} palavras — longa demais (a faixa é ${EDITORIAL_MIN_WORDS} a ${EDITORIAL_MAX_WORDS}); corte uma ideia inteira, nunca palavras do fim`,
    );

  const dangling = checkDanglingEnding(t);
  if (dangling) motivos.push(dangling);

  const reservada = t.match(TERMOS_RESERVADOS);
  if (reservada)
    motivos.push(
      `usou a palavra reservada "${reservada[0]}" — troque por sinônimo (ex.: "clareza" → "entendimento sem ruído", "impacto" → "efeito")`,
    );

  // allowPromoLanguage: o que o item 36 do pedido proíbe é INVENTAR DADO
  // (preço, %, prazo, brinde, parcelamento, condição) — não o vocabulário
  // comercial comum. Sem isso, uma proposição de DIAGNÓSTICO sobre comunicação
  // era reprovada por conter a palavra "oferta", que é justamente o assunto.
  motivos.push(...checkInventedPromotion(t, allowedContext, { allowPromoLanguage: true }));

  // MOSTRAR NOME é a única promessa verificável sem semântica: se o modo pede o
  // nome, ao menos o núcleo do nome cadastrado tem de aparecer.
  const objeto = (opts?.objeto || "").trim();
  if (opts?.usoObjeto === "nome" && objeto && !nomeiaObjeto(t, objeto)) {
    motivos.push(
      `o modo de uso é MOSTRAR NOME, mas "${objeto}" não aparece nomeado na frase — inclua o nome (ou seu núcleo comercial reconhecível)`,
    );
  }

  return motivos;
}

/**
 * O nome cadastrado (ou seu núcleo comercial) aparece neste texto?
 *
 * O cadastro costuma ser longo ("Terno Masculino Slim Corte Italiano Microfibra
 * Preto Ref. 4758") e o modo MOSTRAR NOME admite o NÚCLEO COMERCIAL ("Terno Slim
 * Preto"). Por isso a checagem é de PRESENÇA DE ALGUMA palavra de conteúdo do
 * cadastro, não da palavra mais longa: exigir a mais longa reprovava justamente
 * o encurtamento que a regra permite (achado de 09/09/2026 — "Masculino" era a
 * palavra cobrada). É backstop contra o nome sumir por inteiro; a fidelidade do
 * recorte fica com o modelo.
 */
export function nomeiaObjeto(texto: string, objeto: string): boolean {
  const nome = (objeto || "").trim();
  if (!nome) return true;
  const semAcento = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const alvo = semAcento(texto || "");
  const palavras = nome
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.replace(/[^\p{L}]/gu, "").length >= 4);
  if (!palavras.length) return true;
  return palavras.some((w) => alvo.includes(semAcento(w).slice(0, 5)));
}

/**
 * TETO DO TÍTULO COM MOSTRAR NOME — 7 palavras (decisão do Ari, 10/09/2026).
 *
 * A régua do método é 6. Um nome cadastrado como "Consultoria de Marketing
 * Digital" ocupa 4 dessas 6 sozinho, e sobram 2 para dizer alguma coisa — foi
 * assim que o título bom da série saiu SEM o nome: não cabia. Como a exigência
 * do nome passou a ser cobrada de verdade, o teto sobe UMA palavra, e só quando
 * MOSTRAR NOME está ligado. Fora desse modo, a régua de 6 continua intacta.
 */
export const TITULO_MAX_WORDS_COM_NOME = 7;

/** O teto que vale para esta peça, dado o modo de uso do objeto. */
export function tetoTituloPorUso(
  usoObjeto: UsoDoObjeto | undefined,
  objeto: string,
): number | null {
  return usoObjeto === "nome" && (objeto || "").trim() ? TITULO_MAX_WORDS_COM_NOME : null;
}

/**
 * ESCOLHA É ESCOLHA — o nome tem de chegar ao TÍTULO DA PEÇA (decisão do Ari,
 * 10/09/2026).
 *
 * CASO REAL: linha CONHECIMENTO, MOSTRAR NOME em "Consultoria de Marketing
 * Digital". Saiu o melhor título da série — "Clique não é contato ainda" — e o
 * nome sumiu da peça INTEIRA, título e apoio. O juiz D2 aprovou (o registro
 * mostra a rodada sem nenhuma reprovação), e com razão: o critério 6 cobra a
 * LINHA EDITORIAL, não o nome.
 *
 * ⚠ A checagem do nome existia só para a PROPOSIÇÃO. Do título em diante a
 * exigência vivia apenas como texto de instrução no prompt — e instrução perde
 * quando o modelo encontra uma frase melhor sem o nome. O Ari escolheu MOSTRAR
 * NOME; escolha do usuário não pode ser vencida por acaso de geração.
 *
 * Devolve motivo (string) ou null. O apoio conta como cumprimento? NÃO: a regra
 * do prompt diz "não basta citá-lo no texto de apoio". Mas o motivo distingue os
 * dois casos, porque "está no apoio, falta no título" e "sumiu da peça" pedem
 * correções diferentes de quem reescreve.
 */
export function checkNomeNoTitulo(params: {
  titulo: string;
  texto?: string;
  objeto: string;
  usoObjeto?: UsoDoObjeto;
}): string | null {
  const { titulo, texto = "", objeto, usoObjeto } = params;
  const nome = (objeto || "").trim();
  if (usoObjeto !== "nome" || !nome) return null;
  if (nomeiaObjeto(titulo, nome)) return null;
  return nomeiaObjeto(texto, nome)
    ? `o modo de uso é MOSTRAR NOME e "${nome}" aparece só no texto de apoio — ele precisa estar no TÍTULO (encurtar para o núcleo comercial é permitido; deixá-lo de fora, não)`
    : `o modo de uso é MOSTRAR NOME, mas "${nome}" não aparece em lugar nenhum da peça — o nome (ou seu núcleo comercial reconhecível) tem de estar no TÍTULO`;
}

// ─────────────────────────────────────────────────────────────────────────
// Regra da LINHA EDITORIAL para os motores de peça (PU e MOP)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Bloco colado no prompt do PU (generate-pu-copy.ts) e do MOP
 * (organizaMethodEngine.ts) quando a Informação-chave nasceu de uma Linha
 * Editorial declarada.
 *
 * RETORNO ANTECIPADO com string vazia quando não há linha — mesmo contrato de
 * buildRegraProfissaoRegulamentada e buildRegraPolaridadeKeyInfo: quem está
 * fora do beta recebe o prompt de hoje inalterado, byte a byte, e o prefixo de
 * cache da OpenAI não se altera.
 *
 * ONDE COLAR: no fim do bloco de regras, ANTES de `intencaoRegraApoio`, que tem
 * contrato de posição próprio (fecha o prompt, travado por teste em
 * intencao.test.ts). O motivo de ser no fim é o já documentado em
 * [[project-contexto-perde-para-ordem]]: ordem correta seguida de ~2.000
 * palavras de ordem concorrente é obedecida raramente.
 *
 * POR QUE NÃO REVOGA A VIRADA (item 37 do pedido): a virada continua
 * obrigatória — o título não pode ser a informação-chave reescrita. O que esta
 * regra acrescenta é o LIMITE da virada: pode trocar o ângulo, não pode trocar
 * a intenção editorial nem abandonar a relação central.
 */
/**
 * O ITEM NÃO REALIZA SOZINHO O QUE DEPENDE DO CLIENTE.
 *
 * Nasceu dentro do MOSTRAR NOME, onde ter o nome no título convida a fazer o
 * produto agir. Mas o convite não vem do NOME — vem de o item ser o assunto da
 * peça. Caso real de 09/09/2026 no modo REFERIR SEM NOME, card 5 de um
 * carrossel: "Treinamento que sente o campo funciona" — o item ganhou uma
 * capacidade humana e virou sujeito do resultado, exatamente o que esta regra
 * proíbe. Ela não estava no prompt porque estava presa ao outro modo.
 */
/**
 * O VERBO QUE ACOMPANHA O NOME DO ITEM.
 *
 * CASO REAL (11/09/2026, reels de uma S3C): saiu "Por que USAR Diagnóstico
 * Digital?". Em português se FAZ um diagnóstico, como se faz um exame — "usar"
 * pede ferramenta. E há um segundo erro embutido: "usar" põe o cliente operando
 * o serviço, quando quem executa é a empresa.
 *
 * ⚠ NENHUMA REGRA GOVERNAVA ISSO. Havia regra para o nome aparecer no título e
 * regra para o item não ser o agente do resultado — nada sobre a combinação
 * verbo + item. Conferido: o prompt não usa "usar" em lugar nenhum que pudesse
 * contaminar, então foi escolha livre do modelo, por ausência de critério.
 *
 * O modelo consegue decidir sozinho: o nome cadastrado quase sempre diz o que a
 * coisa é, e a Atividade do Kit completa. Não precisa de campo novo.
 */
const REGRA_VERBO_DO_ITEM = `
- ⚠ O VERBO TEM DE COMBINAR COM O QUE O ITEM É: serviço ou procedimento se FAZ, se contrata, se passa por ("fazer um diagnóstico", "passar por uma avaliação") — NUNCA "usar"; sistema, aplicativo ou ferramenta se USA ou se acessa; produto físico se TEM, se leva, se compra. ⚠ "Usar" num serviço é erro duplo: soa errado em português e ainda põe o CLIENTE operando o que quem executa é a empresa. Caso real que originou esta regra: saiu "Por que usar Diagnóstico Digital?" quando o certo é "Por que fazer Diagnóstico Digital?".`;

const REGRA_PRODUTO_NAO_E_AGENTE = `
- ⚠ O ITEM DESTA PEÇA NÃO É O AGENTE DO RESULTADO: a tentação é fazê-lo realizar sozinho o que depende do cliente. PROIBIDO construções como "[item] decide resultados", "[item] garante vendas", "[item] traz clientes", "[item] resolve o negócio" — não se sustentam e soam infladas. PROIBIDO TAMBÉM dar a ele capacidade humana ("[item] que sente", "[item] que entende", "[item] que escuta"): quem sente, entende e escuta é gente. O que um serviço faz é mostrar, apontar, revelar, organizar, orientar; quem decide e quem executa é o empresário. Prefira o verbo verificável ao verbo grandioso.`;

/**
 * CRITÉRIO EXTRA DO JUIZ D2 — a peça continuou na linha editorial?
 *
 * POR QUE EXISTE (caso real de 10/09/2026, Post Único, linha CONHECIMENTO).
 * A proposição aceita distinguia dois lados com precisão: "Reconhecimento visual
 * imediato é quando a logomarca facilita ser encontrada; credibilidade percebida
 * é quando ela transmite confiança ao ser vista." O título que saiu foi
 * "Criação de logomarca: o que muda" — a pergunta da TRANSFORMAÇÃO, não a do
 * CONHECIMENTO, e uma fórmula que serve a qualquer anunciante do ramo ("Criação
 * de sites: o que muda" funciona igual).
 *
 * ⚠ NENHUMA régua pegava isso, e não por descuido: as validações determinísticas
 * aprovaram os dois campos, e o critério 3 do juiz ("genérico demais") não pega
 * um título que NOMEIA o produto. O que faltava era cobrar a LINHA.
 *
 * ⚠ O ESCOPO MUDA POR TRILHA, e isso não é detalhe:
 *  · PU — a peça é uma só e a regra do prompt diz que ela "precisa continuar
 *    sendo" da perspectiva da linha. Cobrança direta.
 *  · MOP — a mesma regra do prompt diz que a linha é ORIGEM, NÃO MOLDE: só a
 *    PRIMEIRA peça nasce da perspectiva, e as seguintes avançam pelos estágios
 *    da progressão. Cobrar a linha nas nove reprovaria o comportamento correto.
 *    Por isso, no MOP, só o primeiro item é cobrado; dos demais se exige apenas
 *    que não CONTRADIGAM a proposição.
 */
export function buildCriterioEditorialJuiz(params: {
  linhaEditorial: LinhaEditorial | null;
  alvo: "pu" | "mop";
  numero: number;
}): string {
  const { linhaEditorial, alvo, numero } = params;
  if (!linhaEditorial) return "";
  const spec = LINHA_EDITORIAL_SPEC[linhaEditorial];
  const escopo =
    alvo === "pu"
      ? `Vale para o TÍTULO e para o TEXTO desta peça.`
      : `⚠ Vale SOMENTE para o PRIMEIRO item da lista — no Método OP a linha editorial é a ORIGEM da sequência, não um molde: as peças seguintes avançam pelos estágios da progressão e NÃO devem repetir a perspectiva. Nos demais itens, reprove apenas se o campo CONTRADIZER a informação-chave.`;
  return `${numero}. ABANDONOU A LINHA EDITORIAL: a informação-chave desta geração nasceu da linha ${spec.label.toUpperCase()} — "${spec.pergunta}". ${spec.guia} ${escopo} Reprove quando o campo troca essa perspectiva por outra (a mais comum: virar promessa de mudança, "o que muda", "o que vem por aí") ou por uma fórmula de manchete que caberia em qualquer anunciante do mesmo ramo. TESTE: troque o produto por outro do mesmo ramo — se a frase continuar funcionando igual, ela abandonou a ideia. NÃO reprove por não repetir as palavras da informação-chave: condensar é permitido, trocar a ideia não.`;
}

/**
 * A EXCEÇÃO DA LEGENDA no modo REFERIR SEM NOME (decisão do Ari, 09/09/2026).
 *
 * O modo existe para a PEÇA não virar etiqueta: o título e o texto convidam
 * pela ideia, não pelo nome do produto. Mas quem lê a legenda já parou no post
 * — e aí esconder o nome deixa o leitor sem saber do que a empresa está
 * falando. A peça convida; a legenda diz do que se trata.
 *
 * Exportada porque a legenda do Post Único NÃO nasce no mesmo prompt do título
 * (é o endpoint generate-caption), então a regra precisa viajar sozinha até lá.
 * No MOP a legenda sai no mesmo JSON e ela chega junto com o resto.
 */
export function regraNomeNaLegenda(item: string): string {
  const nome = (item || "").trim();
  if (!nome) return "";
  return `\n- ⚠ A LEGENDA É A ÚNICA EXCEÇÃO: nela o nome "${nome}" DEVE aparecer escrito UMA vez, no CORPO da legenda, dentro de uma frase, de forma natural. Quem lê a legenda já parou no post e precisa saber do que se trata. PROIBIDO deixar o nome só na hashtag ou só no CTA, e PROIBIDO repeti-lo mais de uma vez na mesma legenda.`;
}

export function buildRegraLinhaEditorial(params: {
  linhaEditorial: LinhaEditorial | null;
  usoObjeto?: UsoDoObjeto;
  objeto?: string;
  /**
   * Os OUTROS produtos/serviços do Kit de Marca — sem o objeto desta peça.
   *
   * Servem a UMA coisa: dar ao modelo um teste verificável de até onde encurtar
   * o nome. "Ração para cão adulto" encurtado para "Ração" também serviria para
   * "Ração para gato filhote", que está cadastrado na mesma conta — e é assim
   * que se descobre que o corte foi longe demais. Sem a lista, "não corte
   * demais" é conselho vago; com ela, é uma checagem que o modelo consegue
   * fazer sozinho. Levantamento de 09/09/2026: os nomes de 4-5 palavras do
   * banco são majoritariamente PARES que só se distinguem pelo qualificador.
   */
  irmaos?: string[];
  alvo: "pu" | "mop";
}): string {
  const { linhaEditorial, usoObjeto = "auto", objeto = "", irmaos = [], alvo } = params;
  if (!linhaEditorial) return "";
  const spec = LINHA_EDITORIAL_SPEC[linhaEditorial];
  const item = objeto.trim();

  // MOSTRAR NOME — decisão do Ari (09/09/2026): o nome tem de aparecer NO
  // TÍTULO, não "no título ou no texto". Com a versão anterior o modelo cumpria
  // a regra escondendo o nome no texto de apoio, e o painel da sequência (que
  // mostra só títulos) parecia ignorar o produto escolhido.
  //
  // No MOP a exigência é no título da PRIMEIRA e da ÚLTIMA peça — as duas que a
  // ANCORAGEM CONCRETA DO EIXO já trata como abertura e fechamento. As peças do
  // meio ficam livres, senão a sequência vira catálogo.
  const ondeNomear =
    alvo === "mop"
      ? `deve aparecer NOMEADO no TÍTULO do PRIMEIRO Estático E no TÍTULO da última peça da sequência (Reels ou Estático Final). Nas peças do meio é opcional — não repita o nome em todas, ou a sequência vira catálogo`
      : `deve aparecer NOMEADO no TÍTULO da peça (não basta citá-lo no texto de apoio)`;

  // As três colisões abaixo são reais e precisam ser resolvidas DENTRO desta
  // regra. Ordem contraditória sem arbitragem explícita é resolvida pelo modelo
  // ao acaso — ver [[project-contexto-perde-para-ordem]].
  //
  //  1. TETO DE SÍLABAS: a régua geral é 4 sílabas por palavra, com exceção de
  //     até 5 só para "o substantivo concreto central da INFORMAÇÃO-CHAVE"
  //     (SILABA_EXCECAO_RULE) — condição que um nome escolhido no seletor de
  //     produto pode não satisfazer. E ela termina mandando trocar termos de 6+
  //     sílabas por sinônimo mais curto, o que para NOME DE PRODUTO é
  //     exatamente o proibido. Nomes reais estouram fácil: "consultoria" 5,
  //     "contabilidade" 6, "odontologia" 6, "fisioterapia" 7.
  //  2. DIVERSIDADE LEXICAL: o MOP proíbe repetir palavra de conteúdo entre os
  //     títulos da sequência, com exceção do substantivo-núcleo do eixo — que
  //     não é necessariamente o produto selecionado. Sem esta cláusula, "nomeie
  //     na primeira e na última" briga de frente com "não repita palavra".
  //  3. ABERTURA × FECHAMENTO: o MOP proíbe que os dois títulos soem como a
  //     mesma frase e sugere que um deles ancore no TEXTO. Aqui os dois ancoram
  //     no título por decisão de produto, então a diferenciação passa a ser
  //     inteiramente de sujeito, estrutura e ângulo.
  const isencaoSilabas = `\n- ⚠ NOME DE PRODUTO — ISENÇÃO DE SÍLABAS (vence a regra de sílabas quando houver conflito): as palavras de "${item}" NÃO têm teto de sílabas em nenhum campo. É nome próprio de produto/serviço, não vocabulário escolhido pelo redator: PROIBIDO trocá-lo por sinônimo mais curto, mesmo que a régua geral de 4 sílabas (ou a exceção de 5) peça. Trocar por outra palavra, nunca.`;

  // COMO ENCURTAR — o nome quase nunca cabe inteiro: um título tem 6 palavras,
  // e "Tráfego pago nos meios digitais" sozinho ocupa 5. Encurtar já era
  // permitido; o que faltava era CRITÉRIO, e sem critério o modelo corta até a
  // primeira palavra e troca o produto sem que a frase soe errada.
  const listaIrmaos = irmaos
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 9);
  const testeIrmaos = listaIrmaos.length
    ? ` TESTE OBRIGATÓRIO ANTES DE CORTAR — esta empresa também vende: ${listaIrmaos.map((p) => `"${p}"`).join(", ")}. A forma encurtada que você escolheu serviria igualmente para algum desses? Se serviria, você cortou demais: devolva a palavra que distingue um do outro (ex.: "Ração para cão adulto" encurtado para "Ração" também serve para "Ração para gato filhote" — o certo é "Ração para cão" ou "Ração adulto").`
    : // "claro/clara" é palavra BANIDA na saída do MOP (item 7 do prompt). Tê-la
      // aqui no texto da instrução prima o modelo a usá-la — o mesmo mecanismo
      // que já queimou este projeto antes. Trocada por "identifica".
      ` TESTE ANTES DE CORTAR: a forma encurtada ainda identifica QUAL produto é, ou passaria por outro serviço que esta empresa também poderia oferecer? Se passaria, devolva a palavra que distingue.`;

  const comoEncurtar = `\n- ENCURTAR O NOME — COMO: use o NÚCLEO COMERCIAL RECONHECÍVEL, no máximo 2 palavras de conteúdo (artigos e preposições — de, do, da, para, em, com — não contam). PROIBIDO descartar o qualificador que DEFINE o produto ("pago", "digital", "integrada", "adulto", "preto") só para caber: ele costuma ser a própria identidade do serviço, e sem ele a peça anuncia outro produto.${testeIrmaos}`;

  const isencaoRepeticao =
    alvo === "mop"
      ? `\n- O nome do produto é EXCEÇÃO à diversidade lexical (vence a proibição de repetir palavra de conteúdo entre títulos): ele pode e deve aparecer no título de abertura E no de fechamento. A proibição de "abertura e fechamento soarem a mesma frase" CONTINUA valendo — diferencie os dois pelo sujeito, pela estrutura sintática e pelo ângulo, nunca removendo o nome de um deles.
- ⚠ ESTA REGRA REVOGA A "ALTERNATIVA PREFERÍVEL" DA ANCORAGEM CONCRETA DO EIXO: lá acima, na ANCORAGEM CONCRETA DO EIXO, existe a recomendação de que "uma das duas peças ancora o elemento no TEXTO (não no título), liberando o título para um ângulo totalmente distinto". Com MOSTRAR NOME ligado essa alternativa NÃO VALE — ela é o caminho fácil que faz o produto sumir do título de abertura. O nome fica nos DOIS títulos, e a diferença entre eles se constrói por sujeito, estrutura e ângulo, não deixando de nomear.
- ⚠ TESTE DOS DOIS TÍTULOS — FAÇA ANTES DE RESPONDER: escreva o título de ABERTURA e o de FECHAMENTO um debaixo do outro e confira duas coisas. (a) Eles COMEÇAM com a mesma palavra? (b) Têm a MESMA forma, com só o verbo trocado? Se a resposta for sim para qualquer uma, você NÃO diferenciou — reescreva um dos dois. A saída é mudar o SUJEITO de um deles, mantendo o nome do produto em OUTRA posição da frase. Exemplos com um produto de OUTRO ramo, só para mostrar a mecânica — NÃO copie as palavras: ✗ "Revisão Preventiva evita paradas" / "Revisão Preventiva reduz custos" (mesmo sujeito, mesma forma, só o verbo mudou) · ✓ "Revisão Preventiva evita paradas" / "Sua frota roda com Revisão Preventiva" (o segundo troca o sujeito e leva o nome para o fim).
`
      : "";

  const objetoLinha =
    !item || usoObjeto === "auto"
      ? ""
      : usoObjeto === "nome"
        ? `\n- OBJETO DESTA PEÇA — MOSTRAR NOME: "${item}" (ou seu núcleo comercial reconhecível) ${ondeNomear}. PROIBIDO trocá-lo por outro item da mesma categoria — encurtar o nome é permitido, mudar o produto não.
- ⚠ TETO DE PALAVRAS DO TÍTULO SOBE PARA ${TITULO_MAX_WORDS_COM_NOME} (vence o "máximo de 6 palavras" declarado em outras partes deste pedido, e SÓ ${alvo === "mop" ? "nos títulos que precisam nomear o item — os demais seguem com 6" : "neste título"}): o nome ocupa espaço e a frase precisa sobrar para dizer alguma coisa. Não é licença para alongar — é a margem para o nome caber sem sacrificar a ideia. Se couber em 6, melhor.${comoEncurtar}${isencaoSilabas}${isencaoRepeticao}${REGRA_PRODUTO_NAO_E_AGENTE}${REGRA_VERBO_DO_ITEM}`
        : usoObjeto === "sem_nome"
          ? `\n- OBJETO DESTA PEÇA — REFERIR SEM NOME: a peça trata de "${item}", mas o nome cadastrado NÃO pode ser escrito NA PEÇA — nem no título, nem no texto de apoio, nem no texto da imagem, nem no roteiro falado. Mantenha o vínculo por descrição (o que é, para que serve), de modo que o leitor reconheça do que se trata sem ler a etiqueta.${REGRA_PRODUTO_NAO_E_AGENTE}${REGRA_VERBO_DO_ITEM}${regraNomeNaLegenda(item)}`
          : `\n- OBJETO DESTA PEÇA — NÃO USAR: existe um item selecionado, mas ele NÃO é a âncora desta peça. PROIBIDO nomeá-lo ou tomá-lo como assunto.`;

  const escopo =
    alvo === "pu"
      ? `- ⚠ LINHA EDITORIAL DESTA PEÇA — ${spec.label.toUpperCase()} ("${spec.pergunta}"): a informação-chave acima nasceu desta perspectiva, e a peça precisa continuar sendo dela. ${spec.guia}
- LIMITE DA VIRADA (esta regra NÃO revoga a VIRADA OBRIGATÓRIA — ela a delimita): o título pode e deve encontrar um ângulo que a informação-chave não expressa diretamente, mas esse ângulo tem de ser uma CONDENSAÇÃO da mesma ideia, nunca a troca dela por uma generalidade. TESTE ANTES DE RESPONDER: lendo só o título, ainda dá para dizer que a peça é sobre ESTA situação e com ESTA intenção? Ex. com a informação-chave "Se o Instagram da loja só mostra produto e preço, o cliente pode não encontrar motivos para acompanhar o perfil": ✓ "Por que seguir sua loja?" (mesma intenção, ângulo novo); ✗ "Fortaleça sua presença digital" (abandonou a ideia por uma frase que serviria a qualquer empresa). Se o seu título couber em qualquer outro anunciante do mesmo ramo, você trocou a ideia — reescreva.
- ${spec.evitar}
- O OBJETIVO DA PEÇA CONTINUA VALENDO: a linha editorial decide o ÂNGULO, não a função da peça. Aviso continua sendo aviso, homenagem continua sendo homenagem, promoção continua tendo função comercial.`
      : `- ⚠ LINHA EDITORIAL DE ORIGEM DA SEQUÊNCIA — ${spec.label.toUpperCase()} ("${spec.pergunta}"): a informação-chave desta sequência nasceu desta perspectiva. ${spec.guia}
- ELA É ORIGEM, NÃO MOLDE: a linha editorial define o ENQUADRAMENTO e o ponto de partida — PROIBIDO transformar todas as peças nela. A progressão psicológica declarada acima continua mandando na função de cada peça: a primeira parte desta perspectiva e as seguintes avançam pelos estágios, sem repetir o mesmo enquadramento.
- ${spec.evitar}`;

  return `${escopo}${objetoLinha}`;
}
