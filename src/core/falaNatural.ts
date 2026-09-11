// A FALA COM RESPIRO — pausas inseridas automaticamente antes do TTS.
//
// POR QUE EXISTE (pedido do Ari, 11/09/2026, depois de ver o primeiro filme
// montado): a locução sai corrida, sem pausa, sem respiração, com ritmo
// constante. Parece robô lendo. E a correção NÃO pode virar escolha na tela —
// "o usuário não sabe o que é isto, nem escolher ele sabe". O sistema resolve
// sozinho ou não resolve.
//
// ⚠ O QUE AQUI NÃO SE CONSEGUE, e é honesto dizer: o modelo de voz que usamos
// (eleven_multilingual_v2) NÃO tem controle de velocidade por trecho. Não existe
// "fale esta parte mais devagar". O que muda a entrega é a PONTUAÇÃO, o tamanho
// das frases e a pausa explícita. Por isso este arquivo mexe só no que de fato
// responde: onde o silêncio entra.
//
// ⚠ E PAUSA CUSTA DINHEIRO: o vídeo é cobrado por segundo de áudio. Cada 0,6 s
// de respiro encarece a geração. Por isso as pausas são poucas e escolhidas, não
// espalhadas — o objetivo é soar humano, não soar lento.

/** Pausa curta — respiro dentro da ideia, na vírgula de fôlego. */
export const PAUSA_CURTA_S = 0.3;
/** Pausa normal — entre a mensagem e o fecho. É a que mais muda a percepção. */
export const PAUSA_NORMAL_S = 0.6;

/**
 * A marcação de pausa que o ElevenLabs entende dentro do texto.
 *
 * ⚠ Usar com parcimônia: a própria documentação avisa que excesso de marcações
 * desestabiliza a voz (gera artefato, muda timbre). Duas ou três por roteiro é
 * o que o nosso formato pede — MENSAGEM + FECHO, com uma vírgula de respiro.
 */
function marcar(segundos: number): string {
  return `<break time="${segundos}s" />`;
}

/**
 * Insere as pausas no texto que vai para a locução.
 *
 * ⚠ ISTO NÃO MUDA O ROTEIRO QUE APARECE NA TELA nem a legenda queimada: a
 * marcação existe só no caminho do TTS. O texto que o usuário lê e o que é
 * queimado no vídeo continuam limpos.
 *
 * Onde as pausas entram, e por quê:
 *  · na VÍRGULA DE RESPIRO da mensagem — é o ponto que a régua do roteiro já
 *    obriga a existir (ver core/scriptValidation.ts), justamente por ser o lugar
 *    natural de tomar ar;
 *  · ANTES DO FECHO — a frase de encerramento precisa chegar destacada, senão
 *    ela vira continuação da mensagem e o filme não "fecha".
 *
 * Só a PRIMEIRA vírgula de cada frase vira pausa: marcar todas transformaria a
 * fala em uma sequência de soluços.
 */
export function comRespiro(script: string): string {
  const limpo = (script || "").trim();
  if (!limpo) return limpo;

  const frases = limpo
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);
  if (!frases.length) return limpo;

  const comPausaInterna = frases.map((frase) => {
    // Uma pausa por frase, na primeira vírgula — e só quando ela não está
    // grudada no começo nem no fim (aí não é respiro, é vício de pontuação).
    const i = frase.indexOf(",");
    if (i < 8 || i > frase.length - 8) return frase;
    return `${frase.slice(0, i + 1)} ${marcar(PAUSA_CURTA_S)}${frase.slice(i + 1)}`;
  });

  return comPausaInterna.join(` ${marcar(PAUSA_NORMAL_S)} `);
}

/**
 * Quanto silêncio as pausas acrescentam, em segundos.
 *
 * Serve para prever o custo e para quem precisar descontar o silêncio de alguma
 * conta de tempo — o vídeo é cobrado por segundo.
 */
export function silencioAcrescentado(script: string): number {
  const texto = comRespiro(script);
  let total = 0;
  const re = /<break time="([\d.]+)s"\s*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) total += Number(m[1]) || 0;
  return Number(total.toFixed(2));
}
