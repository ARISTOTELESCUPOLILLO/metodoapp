import { stripAccents } from "./textWordUtils";
import type { ValidationFlag } from "../types";

// ANCORAGEM CONCRETA — ANTI-SÍMBOLO (organizaMethodEngine.ts,
// generate-pu-copy.ts): "[abstrato] faz/traz/gera/vira/se torna/transforma
// [outro abstrato]" — sujeito e predicado abstratos, sem cena fotografável
// (ex.: "Responder faz diferença de verdade"). Reforça no D1 a regra do
// prompt para o caso em que o modelo ainda assim a produzir.
const ABSTRACT_PREDICATE_RE =
  /\b(faz|fazem|traz|trazem|gera|geram|vira|viram|transforma|transformam|se\s+torna|se\s+tornam)\s+(a\s+|o\s+|uma?\s+|um\s+)?(diferen[çc]as?|resultados?|mudan[çc]as?|sucesso|crescimento|solu[çc][õo]es?|valor|oportunidades?)\b/i;

export function checkAbstractPredicate(titulo: string): string | null {
  const m = titulo.match(ABSTRACT_PREDICATE_RE);
  if (m)
    return `título usa padrão "${m[0]}" — predicado abstrato sem cena fotografável (ANTI-SÍMBOLO)`;
  return null;
}

// Fechamento abstrato/emocional genérico no final do título — substantivo +
// "certo(a)" ou clichê equivalente (ex.: "...decisão certa", "...escolha
// certa", "...caminho certo"). Intercambiável entre qualquer empresa/segmento
// (não entrega ganho de negócio específico da atividade — ver commit
// 21add66, que corrigiu só o Estático Final do MOP; este regex cobre o
// mesmo problema em QUALQUER título, PU ou MOP, qualquer formato).
const ABSTRACT_CLOSING_RE =
  /\b(decis[ãa]o|escolha|caminho|aposta|dire[çc][ãa]o|jornada|passo|rumo)\s+(cert[ao]|feita)\b|\b(confian[çc]a|tranquilidade|paz\s+de\s+esp[íi]rito|rotina\s+resolvida|futuro\s+garantido)\s*[!.]?\s*$/i;

export function checkAbstractClosing(titulo: string): string | null {
  const m = titulo.match(ABSTRACT_CLOSING_RE);
  if (m)
    return `título termina em fechamento abstrato/intercambiável ("${m[0]}") — troque por um ganho de negócio específico da atividade`;
  return null;
}

// Advérbios/chamadas de urgência temporal no título — clichê que o deixa
// artificial e repetitivo (ver commit d0e3baa). Antes só bloqueado no prompt
// de generate-pu-copy.ts e só para objetivo promocao/oportunidade; centralizado
// aqui pra cobrir título PU (qualquer objetivo, qualquer endpoint — inclusive
// "Gerar outro" via regenerate-block.ts) e título MOP, sem depender do prompt.
const TITULO_URGENCY_PHRASE_RE =
  /\b(corra|ainda\s+hoje|neste\s+momento|aproveite\s+agora|garanta\s+ja|ultima\s+chance|so\s+hoje)\b/;
// "hoje"/"agora"/"já" sozinhos costumam ser advérbio gramatical comum, não
// urgência-clichê, quando abrem o título ou seguem "quem" (ex.: "Já é hora de
// cuidar do carro", "Quem já confia na gente") — só reprovam nas demais
// posições, onde o padrão observado é sempre chamada de ação (ex.: "Troque já
// a peça", "...sua ideia já").
const TITULO_URGENCY_BARE_WORDS = new Set(["hoje", "agora", "ja"]);

export function checkTituloUrgency(titulo: string): string | null {
  const normalized = stripAccents(titulo.toLowerCase());
  const phraseMatch = normalized.match(TITULO_URGENCY_PHRASE_RE);
  if (phraseMatch) {
    return `título usa chamada de urgência temporal ("${phraseMatch[0]}") — clichê artificial e repetitivo; expresse valor, produto, condição ou contexto favorável sem depender de urgência`;
  }
  const words = normalized
    .replace(/[.,!?;:]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  for (let i = 1; i < words.length; i++) {
    if (TITULO_URGENCY_BARE_WORDS.has(words[i]) && words[i - 1] !== "quem") {
      return `título usa chamada de urgência temporal ("${words[i]}") — clichê artificial e repetitivo; expresse valor, produto, condição ou contexto favorável sem depender de urgência`;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// ECO DA INFORMAÇÃO-CHAVE — o título é a frase escrita pelo usuário com
// palavras coladas no começo ou no fim.
//
// Achado real 17/08/2026 (Ari, PU Promoção com preço): a informação-chave
// "Capacete para motociclista por R$ 129,00" devolveu o título "Capacete para
// motociclista por R$129,00 chegou agora". No modo AJUSTADO os dados são
// OBRIGATÓRIOS — e é justamente por isso que nenhuma regra de prompt sozinha
// resolve: "preserve o preço e a condição" convive bem demais com transcrever
// a frase inteira. Trocar o fecho proibido por outro ("aproveite hoje" →
// "chegou agora") custa nada ao modelo. Esta checagem é a trava
// determinística, e o motivo volta ao prompt de regeneração como MOTIVO DA
// REJEIÇÃO (ver autoRegenerate.ts).
//
// Conservadora de propósito: compara só tokens de CONTEÚDO (preposição e
// artigo fora, para o eco não escapar trocando "por" por "a"), exige no mínimo
// 3 deles e ordem preservada. Reordenar OU deixar um elemento de fora já
// caracteriza composição e passa — que é exatamente o que se quer permitir.
// ─────────────────────────────────────────────────────────────────────────

const ECO_STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "para",
  "pra",
  "pro",
  "com",
  "sem",
  "ao",
  "aos",
  "as",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "ou",
  "que",
  "seu",
  "sua",
  "seus",
  "suas",
  "the",
]);

const ECO_MIN_TOKENS = 3;

function ecoContentTokens(texto: string): string[] {
  return stripAccents(texto.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !ECO_STOPWORDS.has(t));
}

export function checkEcoKeyInfo(titulo: string, keyInfo: string): string | null {
  const chave = ecoContentTokens(keyInfo || "");
  if (chave.length < ECO_MIN_TOKENS) return null;

  const alvo = ecoContentTokens(titulo || "");
  // Subsequência gulosa: todos os tokens da informação-chave reaparecem no
  // título na mesma ordem relativa (não precisam ser contíguos — "Capacete
  // para motociclista AGORA por R$ 129,00" é a mesma transcrição).
  let i = 0;
  for (const token of alvo) {
    if (token === chave[i]) i++;
    if (i === chave.length) break;
  }
  if (i < chave.length) return null;

  return "título é a informação-chave transcrita, com palavras apenas acrescentadas no começo ou no fim — preservar item, preço, prazo e condição continua obrigatório, mas a manchete precisa ser COMPOSTA: mude a ordem, o sujeito ou a construção da frase em vez de colar um fecho na frase escrita pelo usuário";
}

// ─────────────────────────────────────────────────────────────────────────
// Medida C (sequência MOP) — "rótulo do leitor" como sujeito do título
// substitui a FORMA do estágio que o título deveria entregar (ver item 11 /
// FUNÇÕES COMUNICATIVAS POR PEÇA em organizaMethodEngine.ts): em vez de
// observação, critério, prova, posicionamento ou convite, o título descreve
// quem decide/usa/cuida de fora. Chamadas só por normalizeMethodResult
// (sequência MOP) — não entra em validateTitulo/validatePieceFields, então
// não afeta o Post Único.
// ─────────────────────────────────────────────────────────────────────────

const OBSERVER_NOUNS =
  "(?:gestor(?:es)?|decisor(?:es)?|equipes?|times?|administrador(?:es)?|respons[áa]ve(?:l|is)|profissionais)";
// Verbos de estado/percepção/decisão que, após "quem", descrevem o leitor de
// fora (ex.: "Quem usa decide", "Quem cuida pensa") — diferente de um título
// tipo "Quem registra vendas controla estoque", que é uma observação sobre um
// PROCESSO (ação → consequência), não um rótulo do leitor.
const OBSERVER_QUEM_VERBS =
  "(?:cuida|cuidam|usa|usam|decide|decidem|escolhe|escolhem|administra|administram|gerencia|gerenciam|pensa|pensam|sabe|sabem|entende|entendem|percebe|percebem|prefere|preferem|confia|confiam|busca|buscam|precisa|precisam|quer|querem|vive|vivem|resolve|resolvem)";
const OBSERVER_SUBJECT_RE = new RegExp(
  `^(?:quem\\s+${OBSERVER_QUEM_VERBS}|(?:a|as|o|os)\\s+${OBSERVER_NOUNS}|${OBSERVER_NOUNS})\\b`,
  "i",
);
const OBSERVER_LABEL_RE = new RegExp(`\\b${OBSERVER_NOUNS}\\b`, "i");

export function checkObserverSubject(titulo: string): string | null {
  const m = titulo.trim().match(OBSERVER_SUBJECT_RE);
  if (!m) return null;
  return `título abre nomeando o leitor de fora ("${m[0]}") — entregue a FORMA do estágio (observação, critério, prova, posicionamento ou convite, ver item 11) em vez de descrever quem decide/usa/cuida`;
}

function canonicalObserverLabel(word: string): string {
  const w = stripAccents(word.toLowerCase());
  if (w.startsWith("gestor")) return "gestor";
  if (w.startsWith("decisor")) return "decisor";
  if (w.startsWith("equipe")) return "equipe";
  if (w.startsWith("time")) return "time";
  if (w.startsWith("administrador")) return "administrador";
  if (w.startsWith("responsave")) return "responsavel";
  if (w.startsWith("profissio")) return "profissional";
  return w;
}

// Flaga quando o mesmo rótulo do leitor (gestor/decisor/equipe/time...)
// aparece nos títulos de mais de uma peça da sequência — sinal de que o
// rótulo está substituindo a FORMA específica de cada estágio.
export function checkCrossPieceLabelRepeat(
  pieces: { campo: string; titulo: string }[],
): ValidationFlag[] {
  const flags: ValidationFlag[] = [];
  const seen = new Map<string, string>();
  for (const { campo, titulo } of pieces) {
    const m = titulo.match(OBSERVER_LABEL_RE);
    if (!m) continue;
    const label = canonicalObserverLabel(m[0]);
    const prevCampo = seen.get(label);
    if (prevCampo) {
      flags.push({
        campo: `${campo}.titulo`,
        motivo: `título repete o rótulo do leitor ("${m[0]}"), já usado em ${prevCampo} — varie o sujeito ou entregue a FORMA do estágio sem rotular o leitor`,
      });
    } else {
      seen.set(label, campo);
    }
  }
  return flags;
}

// Flaga quando dois títulos de PEÇAS DIFERENTES da mesma sequência
// compartilham as mesmas palavras iniciais (o núcleo concreto da
// informação-chave, ex.: "ordem de serviço digital") e só trocam a(s)
// última(s) palavra(s) — sintoma de abertura e fechamento "disfarçando" a
// mesma frase (ex.: "Ordem de serviço digital ativa" / "...digital
// resolve"). Diferente de checkCrossPieceLabelRepeat (rótulo do leitor):
// aqui o que se compara é o PREFIXO comum de palavras do título inteiro.
function titleWords(titulo: string): string[] {
  return stripAccents(titulo.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function checkCrossPieceTitleRepeat(
  pieces: { campo: string; titulo: string }[],
): ValidationFlag[] {
  const flags: ValidationFlag[] = [];
  const wordLists = pieces.map((p) => ({ campo: p.campo, words: titleWords(p.titulo) }));
  for (let i = 0; i < wordLists.length; i++) {
    for (let j = i + 1; j < wordLists.length; j++) {
      const a = wordLists[i].words;
      const b = wordLists[j].words;
      let prefixLen = 0;
      while (prefixLen < a.length && prefixLen < b.length && a[prefixLen] === b[prefixLen])
        prefixLen++;
      const shorter = Math.min(a.length, b.length);
      // >=2 palavras iniciais idênticas cobrindo ao menos metade do título
      // mais curto — limiar pensado para pegar títulos de 4-6 palavras
      // (faixa permitida) do tipo "X Y [adjetivo] verbo1" vs "X Y [adjetivo]
      // verbo2", sem pegar títulos que só compartilham 1 palavra solta
      // (artigo, preposição) por coincidência.
      if (prefixLen >= 2 && shorter > 0 && prefixLen / shorter >= 0.5) {
        flags.push({
          campo: `${wordLists[j].campo}.titulo`,
          motivo: `título repete quase literalmente o início do título de ${wordLists[i].campo} (só troca a palavra final) — varie a estrutura, o sujeito ou o ângulo, não apenas o verbo de encerramento`,
        });
      }
    }
  }
  return flags;
}
