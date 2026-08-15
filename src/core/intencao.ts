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
