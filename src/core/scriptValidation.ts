// Régua do ROTEIRO FALADO do Reels (campo "script").
//
// POR QUE EXISTE (achado real 09/09/2026, S3C da conta admin): o roteiro é o
// ÚNICO campo do sistema que vira SOM, e era o único sem régua própria. Ele era
// validado disfarçado de "texto" — normalizeMethodResult manda
// `{ titulo: r.hook, texto: r.script }` para validatePieceFields, e validateTexto
// só olha terminação pendurada, pontuação e fecho genérico. Sem contagem, sem
// estrutura, sem fecho.
//
// O QUE SAIU NA PRÁTICA:
//   "Muitos cliques não trazem consulta real. Só número alto não resolve o dia
//    a dia do time."
// 17 palavras, duas frases de MENSAGEM e NENHUM fecho — a regra do prompt pedia
// 19-22 palavras em duas partes, com a segunda sendo o fecho. O vídeo terminou
// no meio de uma ideia, sem cadência de encerramento, e a IA de voz não tinha
// onde descer. O defeito é do TEXTO, não da locução.
//
// MEDIÇÃO QUE CALIBROU ESTA RÉGUA: o MP4 gerado tinha 5,29 s de áudio para 17
// palavras = 3,21 palavras/s ≈ 193 palavras por minuto. Locução em português
// corre a 140-160 ppm; conversa natural, 160-180. A fala saiu apressada porque
// o alvo do prompt era contagem de palavras, não tempo de fala.
//
// ALVO NOVO: ~8 s de locução a ~150 ppm = 20 palavras COM PAUSA ESCRITA. A
// pausa não é enfeite — é a vírgula que faz o sintetizador respirar. Sem ela,
// as mesmas 20 palavras saem corridas.

import { checkDanglingEnding, checkPunctuation } from "./textWordUtils";

/** Faixa de palavras do roteiro inteiro — fonte única (prompt + validação). */
export const SCRIPT_MIN_WORDS = 18;
export const SCRIPT_MAX_WORDS = 24;

/** A frase de fecho é curta de propósito: é onde a voz desce. */
export const SCRIPT_FECHO_MIN_WORDS = 3;
export const SCRIPT_FECHO_MAX_WORDS = 7;

/** A mensagem precisa de respiro escrito. */
export const SCRIPT_MENSAGEM_MIN_WORDS = 11;

function contar(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** Separa em frases por . ! ? — descarta vazios. */
export function frasesDoScript(script: string): string[] {
  return (script || "")
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Valida o roteiro falado. Devolve motivos (vazio = aprovado) no mesmo formato
 * das demais validações, para entrar em validatePieceFields e alimentar a
 * regeneração automática de campo flagado (autoRegenerateFlaggedFields).
 *
 * NÃO tenta julgar se o fecho "conclui" — isso é semântico e é trabalho do
 * prompt. Cobra o que é verificável: tamanho total, existência de uma frase de
 * fecho curta e separada, e respiro escrito na mensagem. As três juntas pegam
 * o defeito real que motivou a régua.
 */
export function validateScriptReels(script: string): string[] {
  const t = (script || "").trim();
  const motivos: string[] = [];
  if (!t) return ["roteiro falado vazio"];

  const total = contar(t);
  if (total < SCRIPT_MIN_WORDS)
    motivos.push(
      `roteiro com ${total} palavras — abaixo de ${SCRIPT_MIN_WORDS}; a locução fica curta demais para o vídeo`,
    );
  if (total > SCRIPT_MAX_WORDS)
    motivos.push(
      `roteiro com ${total} palavras — acima de ${SCRIPT_MAX_WORDS}; passa de ~10 s de locução e a fala sai corrida`,
    );

  const frases = frasesDoScript(t);
  if (frases.length < 2) {
    motivos.push(
      "roteiro tem uma frase só — falta a FRASE DE FECHO curta e separada, que é onde a voz desce e o vídeo encerra",
    );
  } else {
    const fecho = frases[frases.length - 1];
    const nFecho = contar(fecho);
    if (nFecho > SCRIPT_FECHO_MAX_WORDS)
      motivos.push(
        `a última frase tem ${nFecho} palavras — não é um fecho, é continuação da mensagem; o fecho tem ${SCRIPT_FECHO_MIN_WORDS} a ${SCRIPT_FECHO_MAX_WORDS} palavras e encerra a ideia`,
      );
    if (nFecho < SCRIPT_FECHO_MIN_WORDS)
      motivos.push(
        `a última frase tem ${nFecho} palavra(s) — curta demais para soar como fecho falado`,
      );

    // Respiro escrito: sem vírgula a locução atravessa a mensagem sem pausa.
    // Só cobrado quando a mensagem é longa o suficiente para precisar de ar.
    const mensagem = frases.slice(0, -1).join(" ");
    if (contar(mensagem) >= SCRIPT_MENSAGEM_MIN_WORDS && !/,/.test(mensagem)) {
      motivos.push(
        "a mensagem não tem nenhuma vírgula — sem pausa escrita o sintetizador lê tudo corrido; inclua o respiro no ponto natural da frase",
      );
    }
  }

  const dangling = checkDanglingEnding(t);
  if (dangling) motivos.push(dangling);
  const punct = checkPunctuation(t, "texto");
  if (punct) motivos.push(punct);

  return motivos;
}
