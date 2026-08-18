// Profissão regulamentada — motor puro (Regra 4 do PLANO_V2: sem React, sem
// Supabase, sem localStorage; recebe tudo por parâmetro e devolve string/boolean).
//
// POR QUE EXISTE (decisão do Ari, 18/08/2026): a régua de escrita que governa a
// tabela de manifestações (ver nota de topo de domain/intencao.config.ts) dizia
// que profissão regulamentada não pode prometer resultado — e essa régua NUNCA
// governou a SAÍDA. Ela decidia o que se escreve nas 36 frases da tabela;
// nenhuma regra do prompt impedia o texto GERADO de prometer resultado. Prova
// real: a peça 3G do piloto saiu com "garantir que os resultados se consolidem".
//
// DUAS DECISÕES DE PRODUTO tomadas pelo Ari ao encomendar isto:
// 1. A proibição NÃO vale para todo SERVIÇOS — em varejo e em serviço não
//    regulamentado, falar de resultado é normal e é o que o cliente quer. Vale
//    só para quem tem conselho profissional em cima (advogado, médico, dentista,
//    contador e afins), onde promessa de resultado é infração de código de ética.
// 2. Vale em TODA PEÇA daquele cliente — MOP e PU, com ou sem o piloto de
//    intenção ligado. É restrição da profissão, não recurso de composição: um
//    advogado fora do piloto tem o mesmo conselho em cima.
//
// COMO O SISTEMA SABE: pelo que já está escrito no Kit de Marca (atividade
// principal, com o nome da empresa como reforço) — mesmo padrão de classificação
// por vocabulário de isNonDigitalActivity/isApparelActivity em utils/promptRules.ts.
// Não há campo declarado no Kit, e criar um deixaria desmarcados justamente os
// advogados que já usam o sistema hoje.

// Regex com âncora \b (e não `includes`), pelo mesmo motivo documentado em
// APPAREL_ACTIVITY_PATTERNS: os termos deste campo são curtos e aparecem dentro
// de palavras de outro sentido. Sem a âncora, "medic" pegaria "medicamento"
// (farmácia, que é varejo) e "nutri" pegaria "nutrição animal" (ração).
// Comparados contra a atividade já normalizada (minúscula + NFD + strip).
const PROFISSAO_REGULAMENTADA_PATTERNS: RegExp[] = [
  // Direito (OAB) — o Provimento 205/2021 proíbe promessa de resultado.
  /\badvocaci/,
  /\badvogad/,
  /\bescritorio de advocacia/,
  /\bjuridic/,
  // Medicina (CFM) — Resolução 1.974: proibido prometer resultado e usar
  // antes/depois. "medic" isolado pegaria "medicamento", por isso os limites.
  /\bmedic[oa]s?\b/,
  /\bmedicina\b/,
  /\bconsultorio/,
  /\bclinic[ao]/,
  /\bcirurgi/,
  /\bdermatolog/,
  /\bcardiolog/,
  /\bpediatr/,
  /\bortoped/,
  /\bginecolog/,
  /\boftalmolog/,
  /\bpsiquiatr/,
  /\bradiolog/,
  /\banestesi/,
  // Odontologia (CFO)
  /\bdentist/,
  /\bodontolog/,
  /\bortodont/,
  /\bimplantodont/,
  // Contabilidade (CFC)
  /\bcontabil/,
  /\bcontador/,
  /\bcontadora/,
  // Psicologia (CFP)
  /\bpsicolog/,
  /\bpsicoterap/,
  /\bpsicanalis/,
  /\bpsicopedagog/,
  // Nutrição (CFN) — só o profissional; "nutricao" pegaria nutrição animal.
  /\bnutricionist/,
  // Fisioterapia e terapia ocupacional (COFFITO)
  /\bfisioterap/,
  /\bterapia ocupacional/,
  // Veterinária (CFMV)
  /\bveterinari/,
  // Enfermagem (COFEN)
  /\benfermag/,
  /\benfermeir/,
  // Fonoaudiologia (CFFa)
  /\bfonoaudiolog/,
  // Biomedicina (CFBM)
  /\bbiomedic/,
];

function normalizar(texto?: string): string {
  if (!texto) return "";
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * A atividade do anunciante é de profissão regulamentada por conselho?
 *
 * A ATIVIDADE PRINCIPAL é a fonte; o nome da empresa entra só como reforço,
 * porque muita gente escreve o ofício ali ("Silva Advogados Associados") e
 * deixa a atividade vazia. A ordem não importa — basta um dos dois bater.
 */
export function isProfissaoRegulamentada(mainActivity?: string, companyName?: string): boolean {
  const alvo = `${normalizar(mainActivity)} ${normalizar(companyName)}`.trim();
  if (!alvo) return false;
  return PROFISSAO_REGULAMENTADA_PATTERNS.some((re) => re.test(alvo));
}

/**
 * Regra de PROIBIÇÃO DE PROMESSA DE RESULTADO para o bloco de REGRAS dos
 * motores de texto (MOP, PU, legenda e regeneração de bloco).
 *
 * RETORNO ANTECIPADO quando a atividade não é regulamentada — mesmo contrato da
 * nota de topo de core/intencao.ts: o prompt de quem não é advogado/médico
 * precisa ficar idêntico ao de hoje, byte a byte. Concatenação condicional no
 * ponto de uso deixa passar uma quebra de linha e ninguém reporta.
 *
 * ONDE COLAR — perto do FIM do bloco de regras. Não basta estar no bloco certo:
 * o achado de 18/08 (ver project-contexto-perde-para-ordem) mostrou que uma
 * regra correta seguida de ~2.000 palavras de outras ordens é obedecida 1/3 das
 * vezes, e a MESMA regra num bloco curto pega 3/3. Esta aqui é uma proibição,
 * que é ainda mais frágil que uma ordem positiva — enterrá-la no meio equivale a
 * não tê-la.
 *
 * O bloco não se limita a proibir: ele diz O QUE FAZER NO LUGAR. Proibição sem
 * saída declarada é o mecanismo que já falhou duas vezes neste projeto (a
 * carcaça do monitor em 22/07, a logo desenhada pela IA em 27/07) — sem uma
 * alternativa, o modelo cumpre a proibição de fachada e reintroduz a promessa
 * com outras palavras.
 */
export function buildRegraProfissaoRegulamentada(
  mainActivity?: string,
  companyName?: string,
): string {
  if (!isProfissaoRegulamentada(mainActivity, companyName)) return "";
  return `- ⚠ PROFISSÃO REGULAMENTADA — PROIBIDO PROMETER RESULTADO (regra de ética profissional, vale acima de qualquer regra de persuasão acima): a atividade deste anunciante é fiscalizada por conselho (advocacia, medicina, odontologia, psicologia, contabilidade e afins), e o código de ética dela proíbe prometer, garantir ou sugerir resultado. PROIBIDO em TODOS os campos de texto (título, texto de apoio, tópicos, legenda): garantir/assegurar/prometer resultado, cura, ganho de causa, aprovação, economia ou melhora — inclusive de forma indireta e sem usar a palavra "resultado" ("você vai conseguir", "sua causa fica mais forte", "seu problema resolvido", "mais clientes todo dia", "recupere o que é seu"). PROIBIDO também: antes/depois, comparação de casos atendidos, número de vitórias/sucessos, e superlativo de comparação ("o melhor", "o mais eficaz", "líder"). O QUE ESCREVER NO LUGAR — fale do TRABALHO, nunca do efeito dele: o que se faz, o critério técnico por trás da decisão, o cuidado no processo, quem faz, a rotina, o que o cliente encontra ao chegar. Descrever o serviço com precisão é PERMITIDO e é o caminho; prometer o efeito dele não é.`;
}
