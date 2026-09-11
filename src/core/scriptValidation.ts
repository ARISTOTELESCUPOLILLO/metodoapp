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
// ALVO ATUAL: 10 SEGUNDOS DE LOCUÇÃO (decisão do Ari, 11/09/2026, à tarde).
//
// Por que subiu: com 24 palavras cabe uma afirmação e um fecho, e não cabe
// VIRADA. Virada é o que faz alguém salvar e mandar para outra pessoa, que é o
// que empurra o alcance para fora dos seguidores. Dez segundos dão o terceiro
// movimento dentro da mensagem, sem virar palestra.
//
// A CONTA, CORRIGIDA POR MEDIÇÃO (11/09/2026, à noite). A primeira faixa de 10 s
// (27 a 31 palavras) saiu de uma estimativa de 2,95 palavras/s e ERROU: o filme
// real veio com 14,30 s, dos quais 0,4 de capa e 2,0 de assinatura — 11,9 s de
// fala para uma faixa de ~29 palavras, ou seja **2,44 palavras/s**, não 2,95.
//
// MEDIÇÃO DEFINITIVA (11/09/2026, 18h33, geração real com a voz do Kit): 24
// palavras em 9,038 s de locução a velocidade 1,0 = 2,66 palavras/s. É o número
// que o registro da rota devolveu, não estimativa.
//
// A 2,66, dez segundos são ~26,6 palavras. Daí a faixa de 25 a 28, que cai entre
// 9,4 e 10,5 segundos.
//
// A rota de vídeo registra palavras e segundos medidos a cada geração
// ("[generate-video] fala palavras=… speechSeconds=…"). Conferir nela antes de
// mexer nesta faixa de novo — é o único jeito de não voltar a estimar.

import { checkDanglingEnding, checkPunctuation } from "./textWordUtils";

/** Faixa de palavras do roteiro inteiro — fonte única (prompt + validação). */
export const SCRIPT_MIN_WORDS = 25;
export const SCRIPT_MAX_WORDS = 28;

/** A frase de fecho é curta de propósito: é onde a voz desce. */
export const SCRIPT_FECHO_MIN_WORDS = 3;
export const SCRIPT_FECHO_MAX_WORDS = 7;

/** A mensagem precisa de respiro escrito. */
export const SCRIPT_MENSAGEM_MIN_WORDS = 19;

/**
 * Teto da mensagem. Existe desde 09/09/2026 (tarde): saiu um roteiro de 42
 * palavras em 3 frases cujo FECHO estava correto (7 palavras) — só o total
 * reprovava, e uma única reprovação genérica ("acima de 24") não diz ao modelo
 * ONDE cortar. Ele cortava do fecho, que era a parte certa.
 */
export const SCRIPT_MENSAGEM_MAX_WORDS = 23;

/** MENSAGEM + FECHO. A fala tem duas frases, e a terceira é sempre invasão. */
export const SCRIPT_FRASES = 2;

/**
 * Palavras mínimas ANTES da primeira vírgula.
 *
 * ⚠ A vírgula de respiro é obrigatória desde 09/09, e o modelo aprendeu a
 * cumpri-la do jeito mais barato: pondo um advérbio solto na frente. Saiu
 * "Agora, quem lidera produto novo já busca apoio…" — a "afirmação" antes da
 * pausa tem UMA palavra e não diz nada. Quem assiste ouve um "agora" e continua
 * sem saber do que se trata.
 */
export const SCRIPT_ABERTURA_MIN_WORDS = 5;

/**
 * Aberturas que ADIAM o ponto — o defeito de retenção medido em 11/09/2026.
 *
 * Levantamento dos cinco roteiros reais que o sistema produziu: QUATRO começavam
 * com subordinada ou verbo no infinitivo, e só entregavam a ideia por volta da
 * décima palavra ("Quando a escolha de criar conteúdo só entra em pauta após um
 * alerta…", "Buscar apoio logo no começo muda tudo, porque…"). Em reels isso é
 * tempo suficiente para a pessoa ir embora. O único que abria afirmando foi o
 * que o Ari elogiou.
 *
 * ⚠ Isto NÃO é fórmula de viralizar. É entregar a ideia mais cedo — a frase
 * continua sendo a mesma, só não começa pelo acessório.
 */
const ABERTURA_QUE_ADIA = new Set([
  "quando",
  "se",
  "ao",
  "caso",
  "embora",
  "enquanto",
  "conforme",
  "apesar",
  "porque",
  "como",
  "depois",
  "antes",
  "sempre",
  "toda",
  "todo",
]);

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
      `roteiro com ${total} palavras — acima de ${SCRIPT_MAX_WORDS}; passa dos ~10 s de locução que o filme comporta`,
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

    // Duas frases, não três. O roteiro de 42 palavras de 09/09 tinha fecho
    // correto e duas frases de mensagem empilhadas antes dele — e passava por
    // aqui com uma queixa só, a do total. Dizer QUAL frase sobra é o que faz a
    // reescrita cortar no lugar certo.
    if (frases.length > SCRIPT_FRASES)
      motivos.push(
        `roteiro com ${frases.length} frases — a fala tem ${SCRIPT_FRASES}: uma MENSAGEM e um FECHO. Junte ou elimine o que sobra na mensagem, nunca o fecho`,
      );

    const mensagem = frases.slice(0, -1).join(" ");
    const nMensagem = contar(mensagem);

    // ── ABERTURA: a ideia tem que chegar cedo ───────────────────────────────
    const palavrasMsg = mensagem.split(/\s+/).filter(Boolean);
    const primeira = (palavrasMsg[0] || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z]/g, "");
    const segunda = (palavrasMsg[1] || "").toLowerCase().replace(/[^a-zà-ú]/gi, "");
    // Infinitivo abrindo a frase ("Buscar apoio…", "Só repetir passo…") adia o
    // sujeito tanto quanto uma subordinada.
    const infinitivo = (p: string) => p.length >= 5 && /(ar|er|ir)$/.test(p);
    if (ABERTURA_QUE_ADIA.has(primeira) || infinitivo(primeira) || infinitivo(segunda)) {
      motivos.push(
        `o roteiro abre com "${palavrasMsg[0]}" e adia a ideia — comece pela AFIRMAÇÃO, não pela condição nem pelo verbo no infinitivo; em reels os primeiros segundos decidem se a pessoa fica`,
      );
    }

    // A vírgula de respiro precisa vir DEPOIS de algo que se sustenta sozinho.
    const antesDaVirgula = mensagem.split(",")[0] || "";
    if (/,/.test(mensagem) && contar(antesDaVirgula) < SCRIPT_ABERTURA_MIN_WORDS) {
      motivos.push(
        `antes da primeira vírgula há só ${contar(antesDaVirgula)} palavra(s) — a pausa tem de vir depois de uma afirmação que se sustenta sozinha, não depois de um advérbio solto`,
      );
    }
    if (nMensagem > SCRIPT_MENSAGEM_MAX_WORDS)
      motivos.push(
        `a mensagem tem ${nMensagem} palavras — acima de ${SCRIPT_MENSAGEM_MAX_WORDS}; encurte a MENSAGEM e preserve o fecho`,
      );

    // Respiro escrito: sem vírgula a locução atravessa a mensagem sem pausa.
    // Só cobrado quando a mensagem é longa o suficiente para precisar de ar.
    if (nMensagem >= SCRIPT_MENSAGEM_MIN_WORDS && !/,/.test(mensagem)) {
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
