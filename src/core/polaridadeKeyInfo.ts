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
 */
export function buildRegraPolaridadeKeyInfo(keyInfo?: string): string {
  const tipo = detectarPolaridadeKeyInfo(keyInfo);
  if (!tipo) return "";
  if (tipo === "contraste") {
    return `- ⚠ A INFORMAÇÃO-CHAVE CONTRAPÕE DUAS COISAS — A DIFERENÇA É O DADO (regra que vence a VIRADA e a CENA quando houver conflito): ela afirma que uma coisa NÃO é, NÃO faz ou NÃO substitui a outra, e é essa distinção que o anunciante escolheu mostrar. O título OU o texto precisa manter os DOIS lados e a separação entre eles. PROIBIDO fundir os dois numa pessoa só, numa etapa só ou num movimento contínuo, e PROIBIDO reescrever a frase como afirmação única que apague a oposição — isso faz a peça dizer o CONTRÁRIO do que o cliente informou. Ex. com "quem escreve o texto não é quem faz a arte": ✗ "Traduzo sua ideia em imagem e palavra" (uma pessoa só — inverte o fato), ✗ "Texto ganha vida na criação visual" (funde as duas etapas), ✓ "Dois profissionais, duas etapas", ✓ "Quem escreve não é quem desenha". O QUE FAZER: nomeie os dois lados e deixe a diferença visível como vantagem observável — o ângulo novo se constrói SOBRE a distinção, nunca apagando-a.`;
  }
  return `- ⚠ A INFORMAÇÃO-CHAVE AFIRMA UMA AUSÊNCIA — A AUSÊNCIA É O DADO (regra que vence a VIRADA quando houver conflito): "sem X", "não precisa de Y", "nunca Z" é justamente o que o anunciante tem a dizer, e ele desaparece quando o texto troca a ausência pela presença do contrário. O título OU o texto precisa preservar a ausência declarada — literal ou em sinônimo direto ("sem taxa" pode virar "taxa zero", nunca "condições especiais"). PROIBIDO converter a ausência em promessa genérica de facilidade, conforto ou benefício, que serve a qualquer anunciante e apaga o dado. O QUE FAZER: mantenha o que NÃO existe como o centro da frase e diga o que isso libera na prática para quem contrata.`;
}
