// Intenção declarada — motor puro (Regra 4 do PLANO_V2: sem React, sem
// Supabase, sem localStorage; recebe tudo por parâmetro e devolve string/objeto).
//
// REGRA CRÍTICA DESTE MÓDULO (seção 12.1 da spec): quando não há intenção, os
// builders devolvem STRING VAZIA por RETORNO ANTECIPADO. O prompt de quem está
// fora do beta precisa ser idêntico ao de hoje, byte a byte — concatenação
// condicional deixa passar uma quebra de linha ou um separador vazio, e ninguém
// reporta, porque a alteração é invisível e os afetados não sabem que existe
// campo novo.
import type { Segment } from "../types";
import {
  AVISO_URGENCIA,
  INTENCAO_MANIFESTACAO,
  INTENCAO_ROTULO,
  INTENCOES,
  INTENCOES_SEM_URGENCIA,
  INTENCOES_SEM_URGENCIA_VAREJO,
  PARES_INCOERENTES,
  TRANSFORMACAO_PRIORIDADE_POR_SEGMENTO,
  TRANSFORMACAO_ROTULO,
  TRANSFORMACOES,
  type IntencaoDeclarada,
  type TransformacaoPretendida,
} from "../domain/intencao.config";

const INTENCOES_VALIDAS = new Set<string>(INTENCOES.map((i) => i.valor));
const TRANSFORMACOES_VALIDAS = new Set<string>(TRANSFORMACOES.map((t) => t.valor));
const SEGMENTOS_VALIDOS = new Set<string>(["SERVIÇOS", "VAREJO", "MARCA"]);

/** Aceita só os 4 valores do enum; qualquer outra coisa vira null. */
export function parseIntencao(raw: unknown): IntencaoDeclarada | null {
  const v = typeof raw === "string" ? raw : "";
  return INTENCOES_VALIDAS.has(v) ? (v as IntencaoDeclarada) : null;
}

/** Aceita só os 10 valores do enum; qualquer outra coisa vira null. */
export function parseTransformacao(raw: unknown): TransformacaoPretendida | null {
  const v = typeof raw === "string" ? raw : "";
  return TRANSFORMACOES_VALIDAS.has(v) ? (v as TransformacaoPretendida) : null;
}

function parseSegment(raw: unknown): Segment | null {
  const v = typeof raw === "string" ? raw : "";
  return SEGMENTOS_VALIDOS.has(v) ? (v as Segment) : null;
}

export interface IntencaoPrompt {
  intencao: IntencaoDeclarada | null;
  transformacaoPrincipal: TransformacaoPretendida | null;
  segment: string | null;
}

// A percepção NUNCA deve ser nomeada no texto final: ela é produzida pelo que o
// texto afirma, não anunciada. "Compreensão" e "Autoridade" não estão na lista
// de palavras proibidas dos endpoints (essa lista guarda os nomes de MOOD), por
// isso a proibição precisa viajar junto com o bloco.
const REGRA_NAO_NOMEAR =
  '⚠ ALVO, NÃO TOM: o tom continua sendo o da direção de voz e do objetivo — o alvo diz O QUE o leitor precisa passar a perceber, não o vocabulário nem o registro. PROIBIDO nomear a percepção no texto (não escreva "compreensão", "segurança", "confiança", "autoridade", nem "urgência"/"preferência" como palavra): ela tem de ser PRODUZIDA pelo que a peça afirma, nunca anunciada.';

/**
 * Bloco de alvo perceptual para o motor de TÍTULO/TEXTO da PU
 * (generate-pu-copy). Entra no bloco de CONTEXTO, junto de segmento, público,
 * faixa etária, voz e objetivo — não no bloco de regras.
 *
 * Chama-se "ALVO PERCEPTUAL", e não "INTENÇÃO", de propósito: o prompt da PU já
 * tem uma linha "INTENÇÃO:" derivada do objetivo da peça (OBJETIVO_INTENCAO em
 * generate-pu-copy.ts). Dois conceitos diferentes disputando o mesmo rótulo
 * dentro do mesmo prompt é ambiguidade gratuita.
 */
export function buildIntencaoBlock(params: IntencaoPrompt): string {
  const intencao = params.intencao;
  // RETORNO ANTECIPADO — ver nota de topo do arquivo.
  if (!intencao) return "";

  const segment = parseSegment(params.segment);
  const manifestacao = segment ? INTENCAO_MANIFESTACAO[intencao][segment] : null;
  const transformacao = params.transformacaoPrincipal;

  const linhas = [
    `ALVO PERCEPTUAL DESTA PEÇA (o que ela deve provocar em quem vê): ${INTENCAO_ROTULO[intencao]} — ${
      INTENCOES.find((i) => i.valor === intencao)?.apoio ?? ""
    }.`,
  ];
  if (manifestacao) {
    linhas.push(
      `COMO ESTE NEGÓCIO CONSTRÓI ESSA PERCEPÇÃO: ${manifestacao}. Esta é a MANIFESTAÇÃO esperada — o que a peça precisa mostrar/afirmar para a percepção acontecer.`,
    );
  }
  if (transformacao) {
    linhas.push(
      `TRANSFORMAÇÃO PRETENDIDA NO LEITOR: ${TRANSFORMACAO_ROTULO[transformacao]}. O texto prepara essa mudança — não a exige nem a menciona como pedido.`,
    );
  }
  linhas.push(REGRA_NAO_NOMEAR);

  return `${linhas.join("\n")}\n`;
}

export interface IntencaoRegraOferta extends IntencaoPrompt {
  /**
   * Bloco de apoio que acompanha o título NESTA geração — decide se a regra
   * fala sobre ele. `null` quando o prompt regenera só o título
   * (regenerate-block), onde não há apoio sobre o que instruir.
   */
  apoio: "texto" | "topicos" | null;
}

/**
 * Regra de alvo perceptual para o modo AJUSTADO (PU promoção + oferta concreta
 * na informação-chave — ver core/ofertaDetection.ts). Entra no BLOCO DE REGRAS,
 * ao contrário de buildIntencaoBlock, que entra no contexto.
 *
 * POR QUE ELA EXISTE (achado do teste cego de 16/08/2026): no modo AJUSTADO o
 * bloco de regras do título é SUBSTITUÍDO por "NÃO busque um ângulo diferente
 * do que a informação-chave já diz / PROIBIDO omitir o preço", que é o oposto
 * do que o alvo perceptual pede. Com o alvo só no contexto, a ordem concreta e
 * mais próxima do fim vencia, e a intenção sumia inteira: dos 9 pares do teste,
 * o único empate absoluto foi justamente o único cuja informação-chave tinha
 * preço (capacete R$ 129,00 — título gerado: a informação-chave transcrita com
 * "APROVEITE HOJE" colado no fim). Mesmo mecanismo de posição já provado no
 * título editado à mão (22/07) e na assinatura de paleta (14/08).
 *
 * O que ela NÃO faz: afrouxar a preservação dos dados concretos. No título de
 * oferta o preço manda mesmo — a decisão de 15/07 continua de pé. O que a regra
 * recupera é tudo o que os dados não decidem: o recorte da oferta, as palavras
 * que não são dado e o conteúdo do bloco de apoio.
 */
export function buildIntencaoRegraOferta(params: IntencaoRegraOferta): string {
  const intencao = params.intencao;
  // RETORNO ANTECIPADO — ver nota de topo do arquivo. Vale igual aqui: fora do
  // piloto, o bloco de regras do modo AJUSTADO fica idêntico ao de hoje.
  if (!intencao) return "";

  const segment = parseSegment(params.segment);
  const manifestacao = segment ? INTENCAO_MANIFESTACAO[intencao][segment] : null;
  const transformacao = params.transformacaoPrincipal;
  const rotulo = INTENCAO_ROTULO[intencao];

  const linhas = [
    `- ⚠ A OFERTA NÃO CANCELA O ALVO PERCEPTUAL — REGRA DE DESEMPATE DESTA GERAÇÃO: item, preço, prazo e condição continuam intocáveis e vêm na frente, exatamente como as regras acima determinam. O que eles NÃO decidem é todo o resto: qual face da oferta vira manchete, quais palavras acompanham os dados e o que fica de fora. Isso quem decide é o ALVO PERCEPTUAL declarado no contexto — ${rotulo}${
      manifestacao ? `, que neste negócio se constrói assim: ${manifestacao}` : ""
    }. A mesma oferta pode ser anunciada de vários modos; anuncie do modo que produz essa percepção.`,
    `- PROIBIDO devolver a informação-chave transcrita com um fecho colado no fim (ex.: "...aproveite hoje", "...corra", "...confira"): isso não é manchete publicitária, é cópia, e não constrói percepção nenhuma. Preservar os dados citados é obrigatório; repetir a frase inteira do usuário não é.`,
  ];
  if (params.apoio) {
    const apoioFrase =
      params.apoio === "topicos"
        ? "Os tópicos são onde a percepção se constrói: sustentam"
        : "O texto de apoio é onde a percepção se constrói: sustenta";
    linhas.push(
      `- ${apoioFrase} a MESMA oferta do título, mas SEM repetir os dados já anunciados nele — esse espaço serve ao alvo perceptual (sem nomeá-lo)${
        transformacao
          ? ` e prepara a transformação pretendida (${TRANSFORMACAO_ROTULO[transformacao]}), sem exigi-la nem mencioná-la como pedido`
          : ""
      }.`,
    );
  }

  // Começa com quebra de linha e NÃO termina com uma: cola no fim da última
  // regra do ramo AJUSTADO, que já é o fim do bloco.
  return `\n${linhas.join("\n")}`;
}

/**
 * Bloco de alvo perceptual para o motor de LEGENDA (generate-caption). Mais
 * enxuto que o do título: a legenda continua a peça, não a redefine.
 */
export function buildIntencaoBlockLegenda(params: IntencaoPrompt): string {
  const intencao = params.intencao;
  // RETORNO ANTECIPADO — ver nota de topo do arquivo.
  if (!intencao) return "";

  const segment = parseSegment(params.segment);
  const manifestacao = segment ? INTENCAO_MANIFESTACAO[intencao][segment] : null;
  const transformacao = params.transformacaoPrincipal;

  const linhas = [
    `ALVO PERCEPTUAL DESTA PEÇA (a legenda serve ao mesmo alvo da arte): ${INTENCAO_ROTULO[intencao]} — ${
      INTENCOES.find((i) => i.valor === intencao)?.apoio ?? ""
    }.`,
  ];
  if (manifestacao) {
    linhas.push(`COMO ESTE NEGÓCIO CONSTRÓI ESSA PERCEPÇÃO: ${manifestacao}.`);
  }
  if (transformacao) {
    linhas.push(
      `TRANSFORMAÇÃO PRETENDIDA NO LEITOR: ${TRANSFORMACAO_ROTULO[transformacao]}. O CTA pode convidar a ela, sem prometer nem pressionar.`,
    );
  }
  linhas.push(REGRA_NAO_NOMEAR);

  return `${linhas.join("\n")}\n`;
}

/**
 * Aviso de coerência (seção 6 da spec) — AVISA, NUNCA BLOQUEIA. Devolve null
 * quando o par é coerente. O usuário pode ignorar e prosseguir.
 */
export function checkCoerencia(
  intencao: IntencaoDeclarada | null,
  transformacao: TransformacaoPretendida | null,
  segment?: string | null,
): string | null {
  if (!intencao || !transformacao) return null;

  if (transformacao === "urgencia") {
    // Em VAREJO a régua é mais curta: compra de giro tem risco baixo e promoção
    // com prazo é a linguagem nativa da categoria.
    const bloqueadas =
      parseSegment(segment) === "VAREJO" ? INTENCOES_SEM_URGENCIA_VAREJO : INTENCOES_SEM_URGENCIA;
    return bloqueadas.includes(intencao) ? AVISO_URGENCIA : null;
  }

  const par = PARES_INCOERENTES.find(
    (p) => p.intencao === intencao && p.transformacao === transformacao,
  );
  return par ? par.aviso : null;
}

/**
 * Ordena as transformações pondo na frente as que a natureza do negócio torna
 * mais prováveis. NÃO esconde nenhuma opção — só ordena (seção 5.1).
 */
export function ordenarTransformacoes(segment?: string | null): typeof TRANSFORMACOES {
  const seg = parseSegment(segment);
  if (!seg) return TRANSFORMACOES;
  const prioridade = TRANSFORMACAO_PRIORIDADE_POR_SEGMENTO[seg];
  const primeiras = prioridade
    .map((v) => TRANSFORMACOES.find((t) => t.valor === v))
    .filter((t): t is (typeof TRANSFORMACOES)[number] => !!t);
  const resto = TRANSFORMACOES.filter((t) => !prioridade.includes(t.valor));
  return [...primeiras, ...resto];
}
