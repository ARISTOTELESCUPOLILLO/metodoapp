// Marcador temporal da informação-chave — motor puro (Regra 4 do PLANO_V2:
// sem React, sem Supabase, sem localStorage; recebe string e devolve objeto/
// string).
//
// POR QUE EXISTE (defeito 2 de [[project-teste-repertorio-r1-r4-2026-08-18]],
// três ocorrências antes de virar tarefa: peças 3C, 3D e R3): quatro das 36
// casas da tabela de manifestações pedem TEMPO — que a peça mostre o que se
// repete ou há quanto tempo se repete. Quando a informação-chave não oferece
// esse gancho, ou oferece um gancho CONCORRENTE, o apoio de 14 palavras fica
// com o que a informação-chave deu e a camada evapora.
//
// R3 é o caso limpo: "TODA PEÇA passa por revisão de duas pessoas ANTES DE IR
// AO AR" tem os dois marcadores. O apoio saiu "Antes de publicar, duas revisões
// garantem que cada frase cumpre sua intenção" — ficou com o instante e perdeu
// a repetição, que estava ali de graça na própria frase do cliente.
//
// 3C e 3D são o outro caso: "reunião presencial tira dúvida NA HORA" só tem
// instante. Não há recorrência a preservar, e a manifestação pede uma.
//
// A DECISÃO DO ARI (18/08, perguntada e não inferida) para esse segundo caso:
// **derivar do próprio fato, nunca inventar cadência.** O presente do indicativo
// do português já é habitual — "tira dúvida na hora" quer dizer que tira sempre
// —, então a recorrência sai de tornar explícito o que a frase já afirma ("toda
// dúvida se resolve ali"), e não de acrescentar "todo dia"/"toda semana"/"24
// horas", que o anunciante não escreveu. Isso descarta o caminho que o R4 tinha
// tomado sozinho ("Todo dia traduzo sua ideia…", com a frequência inventada),
// mesmo tendo ficado bom: é a mesma família do defeito que a régua de polaridade
// combate — a peça afirmando o que o cliente não disse.
//
// CONDICIONAL em dois níveis, para não pagar VOLUME (ver
// project-contexto-perde-para-ordem-2026-08-17): só entra quando a casa pede
// tempo E só na forma que o caso exige. Quem está fora do piloto ou cai numa das
// 32 casas restantes recebe o prompt de hoje byte a byte.

import { stripAccents } from "./textWordUtils";

// ── O que a MANIFESTAÇÃO pede ────────────────────────────────────────────────
// Derivado do texto da própria casa, que é escrito por nós e vive em
// domain/intencao.config.ts — uma fonte de verdade só. O teste
// marcadorTemporal.test.ts fixa QUAIS das 36 casas caem aqui, para que reescrever
// uma frase da tabela não mude o comportamento em silêncio.
//
// FICAM DE FORA duas casas que roçam o tempo sem pedir REPETIÇÃO, e ficam de
// fora de propósito — o projeto já decidiu antes não mexer em casa sem falha
// medida (as duas silenciosas poupadas na revisão de 18/08):
//   - seguranca.MARCA.silenciosa "Mostra há quanto tempo faz o mesmo" é DURAÇÃO,
//     não repetição. Duração não se deriva do presente habitual: quem não disse
//     desde quando não tem como dizer, e a cláusula do CASO 2 pediria justamente
//     o que ela proíbe.
//   - seguranca.MARCA.interna "Mantém o mesmo jeito de aparecer" é constância de
//     MANEIRA, não de frequência.
const MANIFESTACAO_PEDE_RECORRENCIA_RE = /\b(se\s+repete|repete|volta\s+sempre|dia\s+a\s+dia)\b/i;

/** A frase da casa exige que a peça mostre repetição (ou tempo de estrada)? */
export function manifestacaoPedeRecorrencia(manifestacao?: string | null): boolean {
  return !!manifestacao && MANIFESTACAO_PEDE_RECORRENCIA_RE.test(manifestacao);
}

// ── O que a INFORMAÇÃO-CHAVE oferece ─────────────────────────────────────────
// Comparação sem acento (stripAccents) pelo mesmo motivo documentado no bug do
// corte de 14 palavras: nove entradas de DANGLING_END_WORDS guardavam a forma
// acentuada, eram comparadas sem acento e nunca batiam com nada.

// Repetição ou duração JÁ DITA pelo anunciante.
const RECORRENCIA_RE =
  /\b(tod[oa]s?\s+(?:o|a|os|as)?\s*\w+|sempre|cada\s+\w+|a\s+cada\s+\w+|diariamente|semanalmente|mensalmente|anualmente|rotina|habito|costume|de\s+novo|toda\s+vez|sempre\s+que|desde\s+\d|ha\s+\d+\s+(?:anos?|meses|dias)|constante\w*|frequente\w*|periodic\w*|recorrente\w*)\b/;

// Instante único, que é o que compete com a recorrência dentro de 14 palavras.
const PONTUAL_RE =
  /\b(na\s+hora|no\s+ato|na\s+mesma\s+hora|no\s+mesmo\s+dia|antes\s+de|depois\s+de|assim\s+que|ao\s+chegar|imediatamente|na\s+entrega|no\s+dia|em\s+\d+\s*(?:minutos?|horas?|dias?)|em\s+ate\s+\d)\b/;

export interface MarcadorTemporal {
  /** A informação-chave já diz o que se repete (ou há quanto tempo). */
  recorrencia: boolean;
  /** A informação-chave marca um instante único. */
  pontual: boolean;
}

export function detectarMarcadorTemporal(keyInfo?: string | null): MarcadorTemporal {
  const alvo = stripAccents(String(keyInfo || "").toLowerCase()).trim();
  if (!alvo) return { recorrencia: false, pontual: false };
  return {
    recorrencia: RECORRENCIA_RE.test(alvo),
    pontual: PONTUAL_RE.test(alvo),
  };
}

/**
 * Cláusula que entra DENTRO da regra do apoio (buildIntencaoRegraApoio), logo
 * depois da manifestação e antes da verificação final — ela qualifica COMO
 * cumprir a manifestação, então precisa vir colada nela.
 *
 * Devolve STRING VAZIA em três situações, e nas três o prompt fica idêntico ao
 * de hoje: sem manifestação, quando a casa não pede tempo, e quando a
 * informação-chave já traz a recorrência sozinha e sem concorrente — nesse
 * último caso não há nada a arbitrar, e a peça 3G prova que o motor dá conta.
 */
export function buildRegraRecorrenciaApoio(
  manifestacao?: string | null,
  keyInfo?: string | null,
): string {
  if (!manifestacaoPedeRecorrencia(manifestacao)) return "";
  const { recorrencia, pontual } = detectarMarcadorTemporal(keyInfo);

  // CASO 1 — os dois marcadores disputam. É o R3, e não há nada a inventar: a
  // repetição está escrita na frase do cliente, só foi preterida. Precedência.
  if (recorrencia && pontual) {
    return ' ATENÇÃO — A INFORMAÇÃO-CHAVE TEM DOIS MARCADORES DE TEMPO: um que SE REPETE ("toda peça", "cada", "sempre") e um INSTANTE ÚNICO ("antes de", "na hora", "assim que"). O texto de apoio fica com o que SE REPETE — é dele que a manifestação acima depende, e ele já está escrito na informação-chave. O instante é assunto do título, não deste texto.';
  }

  // CASO 2 — não há recorrência nenhuma. Decisão do Ari: derivar do fato, nunca
  // inventar cadência. Ver a nota de topo deste arquivo.
  if (!recorrencia) {
    return ' ATENÇÃO — A INFORMAÇÃO-CHAVE NÃO DIZ COM QUE FREQUÊNCIA ISSO ACONTECE. PROIBIDO inventar cadência que o anunciante não escreveu ("todo dia", "toda semana", "24 horas", "sempre que precisar"). A repetição sai do PRÓPRIO FATO, que já está no presente habitual: se ele diz que a reunião presencial tira dúvida na hora, então é assim que se trabalha ali — "toda dúvida se resolve na mesa" usa só o que o cliente afirmou. Torne explícito o hábito que a frase dele já carrega, sem acrescentar número, dia nem horário.';
  }

  return "";
}
