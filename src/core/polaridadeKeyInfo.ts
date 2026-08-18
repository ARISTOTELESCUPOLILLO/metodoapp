// Polaridade da informação-chave — motor puro (Regra 4 do PLANO_V2: sem React,
// sem Supabase, sem localStorage; recebe tudo por parâmetro e devolve
// string/boolean).
//
// POR QUE EXISTE (achado real do teste R1-R4, 18/08/2026): a informação-chave
// "Quem escreve o texto NÃO É quem faz a arte" — duas pessoas distintas —
// produziu o apoio "Todo dia TRADUZO sua ideia em imagem e palavra": uma pessoa
// só, fazendo as duas coisas. O título ("Texto ganha vida na criação visual")
// fundiu as duas etapas que o fato separava. A peça AFIRMOU O OPOSTO do que o
// cliente informou.
//
// A CAUSA está na soma das regras que já existem em generate-pu-copy.ts, e não
// em nenhuma delas isolada:
//   - VIRADA OBRIGATÓRIA manda achar "um ângulo que a informação-chave não
//     expressa diretamente";
//   - ANCORAGEM CONCRETA — ANTI-SÍMBOLO manda o título virar "uma FOTO de
//     pessoa real em ação observável";
//   - CICLO DA PALAVRA manda escrever pensando em "alguém fazendo algo";
//   - PRESERVAÇÃO DO ELEMENTO preserva "produto, serviço, canal, objeto,
//     procedimento" — ou seja, SUBSTANTIVOS.
// Três ordens empurrando para uma cena positiva de alguém agindo, uma regra que
// preserva só os substantivos, e NENHUMA que preserve a relação afirmada. Uma
// negativa não é fotografável como ação única: a foto possível é alguém
// criando. Os substantivos sobreviveram ("texto", "arte"); o "não é" evaporou.
// É a mesma família de [[project-logo-ancora-topo-bloco-2026-08-04]] e
// [[project-clareza-laptop-opcional-2026-08-12]] — afirmação positiva vence
// negação —, só que aqui na MATÉRIA-PRIMA e não na regra.
//
// POR QUE CONDICIONAL, e não uma regra fixa a mais no prompt: o achado do
// VOLUME (18/08, ver project-contexto-perde-para-ordem) mostrou que ordem
// concorrente soterra ordem. Regra que só aparece quando a informação-chave tem
// negação não cobra nada das outras gerações — o prompt de quem escreveu um
// fato positivo continua idêntico, byte a byte.

// SEGUNDA RODADA (teste R6, mesmo dia): a primeira versão da regra consertou o
// contraste (R5 preservou "texto e arte não são iguais") e FALHOU na ausência.
// "Atendemos sem hora marcada" saiu como título "SEM FILA, seu plano corre
// junto": a regra preservou o OPERADOR de negação e deixou o TERMO NEGADO solto,
// e o modelo trocou por outro que o cliente nunca disse — e que é provavelmente
// falso, porque quem atende sem agendamento atende por ordem de chegada, que é
// onde a fila se forma. Trocar "hora marcada" por "fila" passa por qualquer
// filtro de FORMA: continua sendo "sem X", continua concreto, continua curto.
// Por isso as duas variantes agora cobram o PAR COMPLETO (operador + termo, tal
// como escrito), com teste explícito antes de responder. O mesmo buraco existia
// no contraste — trocar um dos lados mantém a oposição e inventa o fato — e foi
// fechado junto, antes de aparecer numa peça.

/** Que tipo de polaridade a informação-chave declara. */
export type PolaridadeKeyInfo = "contraste" | "ausencia" | null;

// CONTRASTE — a frase contrapõe DOIS termos ("X não é Y", "A em vez de B").
// Aqui o defeito é fundir os dois num só. Testado contra o texto já normalizado
// (minúscula + NFD + strip de acento), por isso "nao" e "inves" sem acento.
const CONTRASTE_PATTERNS: RegExp[] = [
  // "não é / não são / não era / não significa..." — o núcleo do caso R4.
  /\bnao\s+(e|sao|era|eram|foi|sera|serao|significa|quer dizer|substitui|vira)\b/,
  // "nem A nem B" — precisa dos dois "nem" para não pegar "nem sempre".
  /\bnem\b[^.!?]*\bnem\b/,
  /\bem vez d[eoa]/,
  /\bao inves d[eoa]/,
  /\bno lugar d[eoa]/,
  /\bao contrario d[eoa]/,
  /\bdiferente(mente)? d[eoa]/,
  // "…, e não …" / "…, mas não …" — contraposição colada no fim da frase.
  /\b(e|mas)\s+nao\b/,
];

// AUSÊNCIA — a frase afirma que algo NÃO existe, NÃO é preciso ou NÃO se cobra
// ("sem taxa", "não precisa de fiador"). Aqui o defeito é trocar a ausência pela
// presença do contrário, que apaga justamente o dado.
const AUSENCIA_PATTERNS: RegExp[] = [
  // "sem" seguido de palavra — "sem juros", "sem fila", "sem fidelidade".
  // Exige a palavra seguinte para não pegar "sem" solto de outra construção.
  /\bsem\s+[a-z]/,
  /\bnunca\b/,
  /\bjamais\b/,
  /\bnada de\b/,
  /\bnao\s+(precisa|tem|ha|existe|cobra|exige|usa|paga|fica|depende|requer)\b/,
];

function normalizar(texto?: string): string {
  if (!texto) return "";
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * A informação-chave declara uma contraposição ou uma ausência?
 *
 * CONTRASTE VENCE AUSÊNCIA quando os dois aparecem: contrapor dois termos é
 * estrutural (some a distinção inteira), enquanto a ausência perde só um dado.
 * Ex.: "Atendemos sem hora marcada, e não por ordem de chegada" tem os dois; o
 * que não pode desaparecer ali é a oposição.
 */
export function detectarPolaridadeKeyInfo(keyInfo?: string): PolaridadeKeyInfo {
  const alvo = normalizar(keyInfo);
  if (!alvo) return null;
  if (CONTRASTE_PATTERNS.some((re) => re.test(alvo))) return "contraste";
  if (AUSENCIA_PATTERNS.some((re) => re.test(alvo))) return "ausencia";
  return null;
}

/**
 * Regra de PRESERVAÇÃO DA POLARIDADE para o bloco de REGRAS dos motores de
 * texto (MOP, PU, legenda e regeneração de bloco).
 *
 * RETORNO ANTECIPADO quando não há negação na informação-chave — mesmo contrato
 * de buildRegraProfissaoRegulamentada: quem escreveu um fato positivo precisa
 * receber o prompt de hoje inalterado.
 *
 * ONDE COLAR — perto do FIM do bloco de regras, e SEMPRE ANTES de
 * `intencaoRegraApoio`, que tem contrato de posição próprio (fecha o prompt,
 * travado por teste em intencao.test.ts). O motivo de ser no fim é o mesmo da
 * régua de ética: uma regra correta seguida de ~2.000 palavras de outras ordens
 * é obedecida 1/3 das vezes; num bloco curto, 3/3.
 *
 * O bloco diz O QUE FAZER NO LUGAR e traz exemplo concreto. Proibição sem saída
 * declarada é o mecanismo que já falhou três vezes neste projeto (carcaça do
 * monitor 22/07, logo desenhada pela IA 27/07, promessa de resultado 18/08): sem
 * alternativa, o modelo cumpre a proibição de fachada e reintroduz o defeito com
 * outras palavras.
 *
 * TERCEIRA RODADA (18/08, noite) — a saída declarada do ramo AUSÊNCIA estava
 * ROUBANDO O SUJEITO DO APOIO. Ela terminava em "diga o que isso libera na
 * prática PARA QUEM CONTRATA", e a manifestação da casa confiança × SERVIÇOS ×
 * silenciosa pede o oposto: "Mostra a rotina DE TRABALHO que se repete", sujeito
 * no anunciante. Duas ordens de "o que fazer" no mesmo prompt apontando para
 * sujeitos diferentes, e o apoio tem 14 palavras — não cabem as duas. Em três
 * peças seguidas com "Atendemos sem hora marcada" o apoio foi para o lado do
 * cliente e a camada evaporou:
 *   R6  "Acompanhar SEU DIA vira rotina aqui"
 *   R7  "…o que faz sentido NA SUA ROTINA"
 *   T3  "…caminhos práticos PARA VOCÊ seguir adiante"
 * O ramo CONTRASTE nunca produziu isso porque a saída dele ("deixe a diferença
 * visível como vantagem observável") não troca o sujeito — foi por isso que o T2,
 * com a MESMA regra ligada e a MESMA casa, marcou a camada sem esforço. A
 * comparação entre os dois ramos é que isola a causa: não é a existência da
 * regra de polaridade, é a frase final de um dos ramos.
 * Conserto: a saída passa a valer explicitamente para o TÍTULO — que é onde ela
 * foi validada (R7: "Sem hora marcada, venha quando quiser") — e devolve o apoio
 * para a regra dele.
 */
export function buildRegraPolaridadeKeyInfo(keyInfo?: string): string {
  const tipo = detectarPolaridadeKeyInfo(keyInfo);
  if (!tipo) return "";
  if (tipo === "contraste") {
    return `- ⚠ A INFORMAÇÃO-CHAVE CONTRAPÕE DUAS COISAS — A DIFERENÇA É O DADO (regra que vence a VIRADA e a CENA quando houver conflito): ela afirma que uma coisa NÃO é, NÃO faz ou NÃO substitui a outra, e é essa distinção que o anunciante escolheu mostrar. O título OU o texto precisa manter os DOIS lados e a separação entre eles. PROIBIDO fundir os dois numa pessoa só, numa etapa só ou num movimento contínuo, e PROIBIDO reescrever a frase como afirmação única que apague a oposição — isso faz a peça dizer o CONTRÁRIO do que o cliente informou. Ex. com "quem escreve o texto não é quem faz a arte": ✗ "Traduzo sua ideia em imagem e palavra" (uma pessoa só — inverte o fato), ✗ "Texto ganha vida na criação visual" (funde as duas etapas), ✓ "Dois profissionais, duas etapas", ✓ "Quem escreve não é quem desenha". PROIBIDO TAMBÉM trocar um dos lados por outro termo: manter a oposição e substituir o que se opõe continua sendo um fato que o anunciante não disse. O QUE FAZER: nomeie os dois lados COM OS TERMOS DA INFORMAÇÃO-CHAVE (ou sinônimo direto deles) e deixe a diferença visível como vantagem observável — o ângulo novo se constrói SOBRE a distinção, nunca apagando-a.`;
  }
  return `- ⚠ A INFORMAÇÃO-CHAVE AFIRMA UMA AUSÊNCIA — A AUSÊNCIA É O DADO (regra que vence a VIRADA quando houver conflito): "sem X", "não precisa de Y", "nunca Z" é justamente o que o anunciante tem a dizer, e ele desaparece quando o texto troca a ausência pela presença do contrário. O título OU o texto precisa preservar o PAR COMPLETO — o "sem/não/nunca" E O TERMO NEGADO, exatamente o que o anunciante escreveu. Sinônimo direto do termo é permitido ("sem taxa" pode virar "taxa zero"); TROCAR O TERMO POR OUTRO É PROIBIDO, mesmo que a frase continue começando com "sem" e mesmo que o outro termo pareça próximo — "sem hora marcada" NÃO vira "sem fila", "sem espera" nem "sem burocracia": são fatos DIFERENTES, e o anunciante não disse nenhum deles. PROIBIDO também converter a ausência em promessa genérica de facilidade, conforto ou benefício, que serve a qualquer anunciante e apaga o dado. TESTE ANTES DE RESPONDER: o que vem depois do "sem" é a MESMA palavra (ou sinônimo direto dela) que está na informação-chave? Se for outra, você inventou um fato — reescreva. O QUE FAZER: mantenha o que NÃO existe como o centro da frase e, NO TÍTULO, complete dizendo o que isso libera na prática. ATENÇÃO — esta regra decide o TÍTULO: quem decide o TEXTO DE APOIO é a regra própria dele, no fim deste bloco; não repita ali a mesma ideia do título.`;
}
