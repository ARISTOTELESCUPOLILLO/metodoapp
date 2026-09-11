// MONTAGEM DO REELS — a linha do tempo do filme final, em números.
//
// POR QUE EXISTE: até 10/09/2026 o reels entregue era o clipe cru do Kling,
// com a capa vivendo à parte como imagem de post. O Ari trouxe um filme de
// referência (8,363 s, 1080x1920) montado por fora, e pediu o mesmo dentro do
// app. Este arquivo é a PARTE PURA dessa montagem: só contas de tempo. Quem
// desenha pixels está em utils/montagemFrames.ts e quem chama o FFmpeg está em
// utils/montarReels.ts — Regra 4 do PLANO_V2 (motor puro: sem canvas, sem DOM,
// sem HTTP).
//
// A FORMA DO FILME, decidida com o Ari em 10/09/2026:
//
//   0,0 ─ 0,4   capa parada
//   0,4 ─ 0,4+D filme com locução e legendas queimadas
//               (D = duração do clipe já aparado na fala)
//         ↓     0,6 s de fade cruzado, SOBREPOSTO ao fim do filme
//   fim ─ +2,0  assinatura em fundo preto
//
// ⚠ O FADE NÃO SOMA TEMPO: ele acontece POR CIMA do fim do filme, e é por isso
// que a assinatura começa a aparecer 0,6 s antes de o filme acabar. Somar o
// fade ao total foi o primeiro erro de conta que eu cometi ao desenhar isto.

/** Quadros por segundo do filme final — o mesmo do clipe do Kling (medido). */
export const FPS = 30;

/** O clipe do Kling sai 1072x1920; a peça final é 1080x1920 (medido nos dois). */
export const LARGURA = 1080;
export const ALTURA = 1920;

/** Capa parada na abertura. */
export const CAPA_S = 0.4;

/**
 * Fade cruzado entre o filme e a assinatura. Sobreposto, não somado.
 *
 * Era 0,5 s. O Ari viu o filme montado e pediu um pouco mais — 0,6 s. Passagem
 * curta demais faz a assinatura "aparecer", e o que se quer é ela CHEGAR.
 */
export const TRANSICAO_S = 0.6;

/** Assinatura em fundo preto, contada a partir do fim do filme. */
export const ASSINATURA_S = 2.0;

/** A marca chega por aproximação e ASSENTA — movimento só no começo. */
export const LOGO_ENTRADA_S = 0.7;

/**
 * O telefone entra DEPOIS que a marca assenta.
 *
 * Decisão de acabamento: o olho termina de ler a marca e só então o contato
 * aparece. Entrando junto, os dois disputam a mesma fração de segundo.
 */
export const TEXTO_ATRASO_S = 0.2;

/** Duração do deslizamento do telefone. */
export const TEXTO_ENTRADA_S = 0.4;

/**
 * Respiro entre a base da logo e o bloco do contato.
 *
 * O Ari pediu 30 px e, no filme montado, o texto saiu COLADO na marca. O motivo
 * não era a conta do texto: era o ÍCONE, que sobe acima da linha das letras e
 * comia o respiro sozinho. Agora o respiro é medido até o topo do elemento mais
 * alto do bloco (ícone ou letra), e subiu os 15 px que ele pediu em cima disso.
 */
export const RESPIRO_LOGO_TEXTO_PX = 45;

/**
 * Trilha por baixo da fala e depois da fala.
 *
 * ⚠ 0,18 ERA ALTO DEMAIS — o Ari ouviu no primeiro filme real: "a trilha tá
 * muito alta no fundo". Debaixo de voz, trilha e cama, nao companhia: tem de
 * estar presente e nao disputar. 0,07 e o patamar de cama; a subida no fim,
 * quando a voz sai, continua dando a sensacao de encerramento.
 */
export const TRILHA_VOL_FALA = 0.07;
export const TRILHA_VOL_FINAL = 0.45;
/** Tempo que a trilha leva para subir quando a locução acaba. */
export const TRILHA_SUBIDA_S = 0.5;
/** Desaparecimento no fim — parar a música seca soa como falha. */
export const TRILHA_FADE_OUT_S = 0.6;

export interface Cena {
  /** Segundo em que aparece no filme final. */
  inicio: number;
  /** Segundo em que sai. */
  fim: number;
}

export interface PlanoMontagem {
  /** Duração do clipe de vídeo que entra na montagem (já aparado). */
  filmeS: number;
  /** A capa parada. */
  capa: Cena;
  /** O filme, deslocado pela capa. */
  filme: Cena;
  /**
   * A assinatura, INCLUINDO o fade que corre por cima do filme.
   * `inicio` é quando ela começa a aparecer; `opacaEm` é quando ela já cobre.
   */
  assinatura: Cena & { opacaEm: number };
  /** Duração total do filme final. */
  totalS: number;
  /** Quadros de assinatura a desenhar (fade + assinatura inteira). */
  quadrosAssinatura: number;
}

/**
 * Monta a linha do tempo a partir da duração do clipe.
 *
 * `filmeS` é a duração do vídeo que vai entrar — na prática, o clipe JÁ aparado
 * na fala (ver trimVideoToSpeech). Passar o clipe cru aqui faz a assinatura
 * entrar depois de segundos de silêncio.
 */
export function planejarMontagem(filmeS: number): PlanoMontagem {
  const d = Math.max(0, filmeS);
  const fimDoFilme = CAPA_S + d;
  const inicioAssinatura = Math.max(0, fimDoFilme - TRANSICAO_S);
  const total = fimDoFilme + ASSINATURA_S;
  return {
    filmeS: d,
    capa: { inicio: 0, fim: CAPA_S },
    filme: { inicio: CAPA_S, fim: fimDoFilme },
    assinatura: { inicio: inicioAssinatura, opacaEm: fimDoFilme, fim: total },
    totalS: total,
    quadrosAssinatura: Math.round((total - inicioAssinatura) * FPS),
  };
}

export interface Legenda extends Cena {
  texto: string;
}

/**
 * Palavras e caracteres por pedaço de legenda.
 *
 * ⚠ ANTES ERA UMA LEGENDA POR FRASE, e com o roteiro de 10 segundos a primeira
 * frase passou de vinte palavras: virou um bloco de três linhas parado na tela
 * por quase dez segundos. O Ari disse o que faltava — "tem que aparecer e se
 * apagar conforme o personagem fala, e assim seria sempre uma linha".
 *
 * Os dois tetos trabalham juntos: o de palavras dá o ritmo (troca a cada ~1,5 s)
 * e o de caracteres garante que cabe em UMA linha, porque quatro palavras longas
 * ocupam mais que seis curtas.
 */
export const LEGENDA_MAX_PALAVRAS = 4;
export const LEGENDA_MAX_CARACTERES = 26;

/**
 * Reparte o roteiro em legendas curtas, sincronizadas com a fala.
 *
 * O tempo de cada pedaço é proporcional ao número de PALAVRAS dele — é a melhor
 * aproximação que se tem sem alinhamento fonético, e erra pouco porque a fala
 * sai em ritmo constante.
 *
 * ⚠ Pedaço nenhum atravessa o ponto final: o fim de frase é onde a voz desce, e
 * a legenda tem de descer junto.
 */
export function montarLegendas(script: string, falaS: number, offsetS = CAPA_S): Legenda[] {
  const frases = (script || "")
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);
  if (!frases.length || falaS <= 0) return [];

  // Reparte cada frase em pedaços de uma linha.
  const pedacos: string[] = [];
  for (const frase of frases) {
    let atual: string[] = [];
    let letras = 0;
    for (const palavra of frase.split(/\s+/).filter(Boolean)) {
      const cabeEmPalavras = atual.length < LEGENDA_MAX_PALAVRAS;
      const cabeEmLetras =
        letras + palavra.length + (atual.length ? 1 : 0) <= LEGENDA_MAX_CARACTERES;
      if (atual.length && (!cabeEmPalavras || !cabeEmLetras)) {
        pedacos.push(atual.join(" "));
        atual = [];
        letras = 0;
      }
      letras += palavra.length + (atual.length ? 1 : 0);
      atual.push(palavra);
    }
    if (atual.length) pedacos.push(atual.join(" "));
  }
  if (!pedacos.length) return [];

  const palavras = pedacos.map((p) => p.split(/\s+/).filter(Boolean).length);
  const totalPalavras = palavras.reduce((a, b) => a + b, 0);
  if (!totalPalavras) return [];

  const legendas: Legenda[] = [];
  let t = offsetS;
  pedacos.forEach((texto, i) => {
    const fatia = (palavras[i] / totalPalavras) * falaS;
    legendas.push({ texto, inicio: t, fim: t + fatia });
    t += fatia;
  });
  // A última fecha exatamente com a fala — sem isto, arredondamento deixa a
  // legenda no ar por alguns quadros depois da voz terminar.
  legendas[legendas.length - 1].fim = offsetS + falaS;
  return legendas;
}

/**
 * Tira o telefone da ASSINATURA que o Kit de Marca já guarda.
 *
 * ⚠ POR QUE NÃO UM CAMPO NOVO: o campo existe desde sempre e está preenchido em
 * quase toda conta — "Contato pelo Whatsapp: (66) 99239-9246", "Marmitex pelo
 * WhatsApp (66) 99281-1616". Criar uma caixa nova na tela nasceria desmarcada e
 * não chegaria a quem já usa o sistema (ver a memória
 * feedback-inteligencia-interna-sem-escolha-na-tela). A inteligência é interna:
 * lê-se o que já está lá.
 *
 * Devolve o PRIMEIRO número no formato brasileiro, normalizado, ou "" quando a
 * assinatura não tem telefone — caso real de contas que assinam com a bio do
 * Instagram. Sem telefone, a assinatura sai só com a marca.
 */
export function extrairContatoWhatsapp(assinatura: string | undefined): string {
  const t = (assinatura || "").replace(/\s+/g, " ");
  if (!t) return "";
  // DDD entre parênteses ou solto, com 8 ou 9 dígitos e separador opcional.
  // Tolera o espaço perdido de "( 66)98467-1866", que é digitação real do Kit.
  const m = t.match(/\(?\s*(\d{2})\s*\)?[\s.-]*(\d{4,5})[\s.-]?(\d{4})/);
  if (!m) return "";
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

/**
 * Curva de volume da trilha, em expressão de tempo para o FFmpeg.
 *
 * Baixa enquanto ele fala, sobe quando a locução acaba. A subida é o que dá a
 * sensação de encerramento no filme de referência — e ela precisa ser RAMPA,
 * não degrau: volume que muda de uma vez soa como erro de mixagem.
 */
export function curvaDaTrilha(plano: PlanoMontagem): string {
  const t1 = plano.filme.fim.toFixed(3);
  const t2 = (plano.filme.fim + TRILHA_SUBIDA_S).toFixed(3);
  const v1 = TRILHA_VOL_FALA;
  const v2 = TRILHA_VOL_FINAL;
  return `if(lt(t,${t1}),${v1},if(lt(t,${t2}),${v1}+(${v2}-${v1})*(t-${t1})/(${t2}-${t1}),${v2}))`;
}
