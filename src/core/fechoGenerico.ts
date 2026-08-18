// Fecho genérico — motor puro (Regra 4 do PLANO_V2: sem React, sem Supabase,
// sem localStorage; recebe string e devolve string/null).
//
// POR QUE EXISTE (achado do teste R1-R7, 18/08/2026): quatro das sete peças do
// dia desaguaram num qualificador que não diz nada —
//   R2  "…dois profissionais conferem tudo COM ATENÇÃO."
//   R4  "…sua ideia em imagem e palavra, SEMPRE COM ATENÇÃO."
//   R5  "…que dominam rotinas PARA CHEGAR AO MELHOR RESULTADO."
//   R6  "…Atendimento contínuo, SEMPRE COM ATENÇÃO ao seu momento."
//   legenda R3 "…de dois profissionais distintos PARA GARANTIR PRECISÃO E
//               QUALIDADE antes da publicação final."
// E, antes deles, a rodada de tráfego: "de forma consistente" (3B, 3F), "de
// forma ágil" (peça 3), "com rapidez" (peça 1).
//
// A CAUSA não é repertório, é OMISSÃO DE REGRA — e o próprio corpus traz o
// grupo de controle. O sistema já sabe proibir isto, e a proibição funciona:
// generate-pu-copy.ts manda "PROIBIDO TERMINAR o título em fechamento
// abstrato/intercambiável entre qualquer empresa", titleValidation.ts tem
// checkAbstractClosing e sugestaoValidation tem SUGESTAO_GENERIC_PATTERNS
// ("com segurança$", "do jeito certo$", "na medida certa$"). Os TRÊS aparelhos
// olham só para o título ou só para a Sugestão. Resultado medido nas mesmas
// peças: 0 fechos genéricos em 12 títulos, 5 em 8 textos de apoio e legendas.
// O campo que tem a régua não cai; o campo que não tem, cai.
//
// A pressão que preenche o vazio é o limite de palavras lido como META: as três
// peças que bateram EXATAMENTE nas 14 palavras (R2, R5, R6) são as três que
// terminaram em qualificador; R1/R3/R7 pararam em 11/12/13 e saíram limpas
// (R4, com 12, é a exceção — por isso a regra do prompt diz que o teto não é
// meta, em vez de mexer no teto).
//
// GRAMÁTICA DO DEFEITO — é o que torna a detecção possível: todas as
// ocorrências são ADJUNTO SEM REFERENTE NOVO, de modo ("com atenção", "de forma
// consistente") ou de finalidade ("para garantir qualidade", "para o melhor
// resultado"). O teste é limpo: apagar o trecho não tira nenhuma informação da
// frase.
//
// POR QUE INCONDICIONAL, ao contrário de core/polaridadeKeyInfo.ts: lá o gatilho
// está na MATÉRIA-PRIMA (a informação-chave tem ou não tem negação), então dá
// para deixar o prompt dos demais idêntico byte a byte. Aqui o defeito só existe
// na SAÍDA — não há como saber de antemão quem vai cometê-lo. O preço em VOLUME
// (ver project-contexto-perde-para-ordem-2026-08-17) foi pago em uma linha só,
// contra as ~2.000 palavras de regras de título que ela disputa.

// ── Vocabulário do vazio ──────────────────────────────────────────────────────
// As classes toleram forma acentuada e não acentuada ([çc], [ãa]) pelo mesmo
// motivo de ABSTRACT_CLOSING_RE em titleValidation.ts — o texto chega como o
// modelo escreveu, e nove entradas de DANGLING_END_WORDS já ficaram anos sem
// bater com nada por causa de acento (ver o bug do corte de 14 palavras,
// commit 9fd9333).

// Substantivo de qualidade que não nomeia nada de concreto. FORA da lista, de
// propósito: "constância"/"constante" — é o vocabulário da camada silenciosa da
// tabela de manifestações ("Mostra a rotina de trabalho que se repete"), e
// barrá-lo aqui seria uma régua brigando com a outra.
const SUBSTANTIVO_VAZIO =
  "aten[çc][ãa]o|cuidado|qualidade|precis[ãa]o|efici[êe]ncia|efic[áa]cia|excel[êe]ncia|responsabilidade|dedica[çc][ãa]o|profissionalismo|compromisso|capricho|carinho|seriedade|agilidade|rapidez|transpar[êe]ncia|seguran[çc]a|tranquilidade|zelo|esmero|maestria";

// Adjetivo de qualidade que só aparece como adjunto de modo. FORA da lista:
// "simples", "prática", "objetiva", "gratuita", "presencial", "online",
// "parcelada" — essas carregam informação real sobre o serviço.
const ADJETIVO_VAZIO =
  "consistente|[áa]gil|eficiente|eficaz|cuidados[ao]|atencios[ao]|precis[ao]|r[áa]pid[ao]|caprichad[ao]|dedicad[ao]|respons[áa]vel|profissional|segur[ao]|tranquil[ao]|adequad[ao]|corret[ao]|ideal|perfeit[ao]|impec[áa]vel|primoros[ao]|assertiv[ao]|personalizad[ao]|diferenciad[ao]|humanizad[ao]|transparente|s[ée]ri[ao]|comprometid[ao]|caprichos[ao]";

// O que o superlativo promete sem entregar. "preço", "prazo", "desconto" e
// afins ficam de fora: superlativo em cima de dado concreto é oferta, não vazio.
const SUBSTANTIVO_PROMETIDO =
  "resultados?|qualidade|experi[êe]ncia|efici[êe]ncia|desempenho|atendimento|seguran[çc]a|satisfa[çc][ãa]o|conforto|comodidade|tranquilidade|precis[ãa]o|cuidado";

// (a) adjunto de MODO — "com atenção", "com todo o cuidado", "sempre com
//     precisão". O artigo/intensificador no meio é opcional.
const MODO_SUBSTANTIVO_RE = new RegExp(
  `\\b(?:com|sempre\\s+com)\\s+(?:(?:a|o|as|os|muita|muito|toda\\s+a|todo\\s+o|total|m[áa]xim[ao])\\s+)?(?:${SUBSTANTIVO_VAZIO})\\b`,
  "i",
);

// (b) adjunto de MODO com adjetivo — "de forma consistente", "de maneira ágil",
//     "de um jeito cuidadoso". Exige o "de forma/maneira/modo/jeito" na frente
//     justamente para não confundir com o verbo ("você precisa", "seria").
const MODO_ADJETIVO_RE = new RegExp(
  `\\bde\\s+(?:forma|maneira|modo|um\\s+jeito)\\s+(?:mais\\s+)?(?:${ADJETIVO_VAZIO})\\b`,
  "i",
);

// (c) SUPERLATIVO vazio — "o melhor resultado", "máxima qualidade", "mais
//     segurança".
const SUPERLATIVO_RE = new RegExp(
  `\\b(?:melhor(?:es)?|maior(?:es)?|m[áa]xim[ao]|total|mais)\\s+(?:${SUBSTANTIVO_PROMETIDO})\\b`,
  "i",
);

// (d) FINALIDADE genérica — "para garantir qualidade", "buscando excelência",
//     "entregar precisão". O verbo por radical cobre todas as pessoas e tempos.
const FINALIDADE_RE = new RegExp(
  `\\b(?:garant|assegur|proporcion|entreg|oferec|alcan[çc]|ating|obt|mant|busc|vis)\\w*\\s+(?:(?:a|o|as|os|mais|maior|toda\\s+a|todo\\s+o|total|m[áa]xima?)\\s+)?(?:${SUBSTANTIVO_VAZIO})\\b`,
  "i",
);

const PADROES: RegExp[] = [MODO_SUBSTANTIVO_RE, MODO_ADJETIVO_RE, SUPERLATIVO_RE, FINALIDADE_RE];

/**
 * Acusa o qualificador vazio em texto de apoio, tópico ou corpo de legenda.
 * Devolve null quando não há.
 *
 * Não é ancorado no fim da frase de propósito: em R2 o "com atenção" fechava a
 * PRIMEIRA das duas orações ("…conferem tudo com atenção. Seu conteúdo vai mais
 * seguro."), e na legenda R3 o "para garantir precisão e qualidade" vinha antes
 * do último sintagma. Num texto de 14 palavras, o adjunto é vazio onde quer que
 * esteja.
 */
export function checkFechoGenerico(texto: string): string | null {
  const trimmed = (texto || "").trim();
  if (!trimmed) return null;
  for (const re of PADROES) {
    const m = trimmed.match(re);
    if (m) {
      return `texto usa qualificador vazio ("${m[0]}") — não acrescenta informação nenhuma; troque por um dado concreto da atividade (o que se faz, quem faz, quando, onde, quanto) ou termine a frase antes: o limite de palavras é teto, não meta`;
    }
  }
  return null;
}

/**
 * Regra de prompt correspondente. Vai no bloco de REGRAS dos quatro motores de
 * texto (MOP, PU, legenda e regeneração), sempre perto do fim — e, na PU, ANTES
 * de `intencaoRegraApoio`, que tem contrato de posição próprio (fecha o prompt,
 * travado por teste).
 *
 * Diz O QUE ESCREVER NO LUGAR, e não só o que é proibido: proibição sem saída
 * declarada já falhou três vezes neste projeto (carcaça do monitor 22/07, logo
 * desenhada pela IA 27/07, primeira versão da régua de ética 18/08) — o modelo
 * cumpre a proibição de fachada e reintroduz o defeito com outras palavras.
 */
export const FECHO_GENERICO_RULE =
  '- ⚠ FECHO DO TEXTO — PROIBIDO QUALIFICADOR VAZIO: não feche (nem encha) a frase com modo — "com atenção", "com cuidado", "com qualidade", "com precisão", "com profissionalismo", "de forma consistente", "de forma ágil" — nem com finalidade genérica — "para garantir qualidade", "para chegar ao melhor resultado", "buscando excelência", "com máxima segurança". TESTE ANTES DE RESPONDER: apague as últimas 2 a 4 palavras; se nada de concreto se perder, elas não deviam estar ali. NO LUGAR, escolha uma das duas: um SEGUNDO FATO da atividade (o que se faz, quem faz, quando, onde, quanto, com o quê) ou NADA — a frase pode terminar antes do limite de palavras, que é TETO e não meta.';
