// Validação e vocabulário do formato "Tópicos com ícone" (alternativa ao
// texto de apoio corrido na PU — ver PostUnicoFormatoTexto em types.ts).
import { truncateWords, checkDanglingEnding } from "./textWordUtils";

export const TOPICO_MAX_WORDS = 8;
export const TOPICOS_COUNT = 3;

// Vocabulário FECHADO de ícones — o ícone é desenhado pela própria IA de
// imagem junto com o título/tópicos (mesma tipografia, não é asset SVG
// nosso), então precisa ser um conceito simples e universal o bastante para
// o modelo renderizar de forma reconhecível. Uma lista aberta arriscaria a
// IA tentar desenhar um ícone específico demais e o resultado sair ilegível.
export const TOPICO_ICON_VOCAB = [
  "relógio",
  "aperto de mãos",
  "estrela",
  "escudo",
  "selo de aprovação (check)",
  "telefone",
  "balão de conversa",
  "cifrão",
  "gráfico crescente",
  "calendário",
  "presente",
  "mapa/localização",
  "megafone",
  "coração",
  "polegar para cima",
] as const;

const TOPICO_ICON_SET = new Set<string>(TOPICO_ICON_VOCAB);

// Ícone de fallback determinístico quando a IA devolve algo fora do
// vocabulário fechado — evita reprovar a geração inteira por causa só do
// ícone (o texto do tópico já passou pelas próprias checagens).
const TOPICO_ICON_FALLBACK: (typeof TOPICO_ICON_VOCAB)[number] = "selo de aprovação (check)";

export function normalizeTopicoIcone(icone: string): string {
  const norm = icone.trim().toLowerCase();
  for (const opt of TOPICO_ICON_VOCAB) {
    if (opt.toLowerCase() === norm) return opt;
  }
  return TOPICO_ICON_SET.has(norm) ? norm : TOPICO_ICON_FALLBACK;
}

// Validação determinística por tópico — mesmo padrão leve já usado em
// validateSugestao (textValidation.ts): tamanho e fecho pendurado, sem juiz
// LLM (fora de escopo do v1 deste formato, ver plano da feature).
export function validateTopico(texto: string): string[] {
  const trimmed = texto.trim();
  const motivos: string[] = [];
  if (!trimmed) return ["tópico vazio"];

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (words > TOPICO_MAX_WORDS)
    motivos.push(`tópico com ${words} palavras — acima do máximo de ${TOPICO_MAX_WORDS}`);

  const dangling = checkDanglingEnding(trimmed);
  if (dangling) motivos.push(dangling);

  return motivos;
}

export function finalizeTopicoTexto(texto: string): string {
  return truncateWords(texto.trim(), TOPICO_MAX_WORDS);
}
