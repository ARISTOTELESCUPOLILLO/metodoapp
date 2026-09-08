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
  if (opts?.usoObjeto === "nome" && objeto) {
    // O cadastro costuma ser longo ("Terno Masculino Slim Corte Italiano
    // Microfibra Preto Ref. 4758") e o modo MOSTRAR NOME admite o NÚCLEO
    // COMERCIAL ("Terno Slim Preto"). Por isso a checagem é de PRESENÇA DE
    // ALGUMA palavra de conteúdo do cadastro, não da palavra mais longa: exigir
    // a mais longa reprovava justamente o encurtamento que a regra permite.
    // É backstop contra o nome sumir por inteiro; a fidelidade fica com o modelo.
    const semAcento = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const alvo = semAcento(t);
    const palavras = objeto
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter((w) => w.replace(/[^\p{L}]/gu, "").length >= 4);
    if (palavras.length && !palavras.some((w) => alvo.includes(semAcento(w).slice(0, 5)))) {
      motivos.push(
        `o modo de uso é MOSTRAR NOME, mas "${objeto}" não aparece nomeado na frase — inclua o nome (ou seu núcleo comercial reconhecível)`,
      );
    }
  }

  return motivos;
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
export function buildRegraLinhaEditorial(params: {
  linhaEditorial: LinhaEditorial | null;
  usoObjeto?: UsoDoObjeto;
  objeto?: string;
  alvo: "pu" | "mop";
}): string {
  const { linhaEditorial, usoObjeto = "auto", objeto = "", alvo } = params;
  if (!linhaEditorial) return "";
  const spec = LINHA_EDITORIAL_SPEC[linhaEditorial];
  const item = objeto.trim();

  const objetoLinha =
    !item || usoObjeto === "auto"
      ? ""
      : usoObjeto === "nome"
        ? `\n- OBJETO DESTA PEÇA — MOSTRAR NOME: "${item}" (ou seu núcleo comercial reconhecível) deve aparecer NOMEADO no título OU no texto. PROIBIDO trocá-lo por outro item da mesma categoria — encurtar o nome é permitido, mudar o produto não.`
        : usoObjeto === "sem_nome"
          ? `\n- OBJETO DESTA PEÇA — REFERIR SEM NOME: a peça trata de "${item}", mas o nome cadastrado NÃO pode ser escrito. Mantenha o vínculo por descrição (o que é, para que serve), de modo que o leitor reconheça do que se trata sem ler a etiqueta.`
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
