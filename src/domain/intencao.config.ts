// Intenção declarada — tabelas de configuração puras (Regra 5 do PLANO_V2:
// dados separados de template; nenhuma lógica condicional mora aqui).
//
// O campo tem duas partes: a INTENÇÃO (o que o receptor deve passar a perceber)
// e a TRANSFORMAÇÃO (o que muda nele depois). Ver especificação em
// AJUSTE_CONFLITO/spec-intencao-declarada-metodo-op.md.
//
// NOMENCLATURA: a intenção "Compreensão" NÃO se chama "Clareza" de propósito —
// "clareza" já é o rótulo do mood OP-01 e está na lista de palavras proibidas
// no texto gerado (ver generate-pu-copy.ts / generate-caption.ts).
import type { Segment } from "../types";
import type { CamadaTransformacao, IntencaoDeclarada, TransformacaoPretendida } from "./intencao";

export type {
  CamadaTransformacao,
  IntencaoDeclarada,
  IntencaoOrigem,
  TransformacaoPretendida,
} from "./intencao";

export const INTENCOES: {
  valor: IntencaoDeclarada;
  rotulo: string;
  apoio: string;
}[] = [
  { valor: "compreensao", rotulo: "Compreensão", apoio: "Que ele entenda o que eu faço" },
  { valor: "seguranca", rotulo: "Segurança", apoio: "Que ele perca o medo de escolher errado" },
  { valor: "confianca", rotulo: "Confiança", apoio: "Que ele acredite que eu entrego" },
  { valor: "autoridade", rotulo: "Autoridade", apoio: "Que ele me veja como referência" },
];

export const TRANSFORMACOES: {
  valor: TransformacaoPretendida;
  rotulo: string;
  camada: CamadaTransformacao;
}[] = [
  {
    valor: "preferencia",
    rotulo: "Preferência — passa a me querer, e não o concorrente",
    camada: "interna",
  },
  { valor: "urgencia", rotulo: "Urgência — passa a sentir custo em adiar", camada: "interna" },
  { valor: "comentar", rotulo: "Comentar ou perguntar", camada: "no_post" },
  { valor: "salvar", rotulo: "Salvar", camada: "no_post" },
  { valor: "compartilhar", rotulo: "Compartilhar ou marcar alguém", camada: "no_post" },
  { valor: "seguir", rotulo: "Seguir o perfil", camada: "no_post" },
  { valor: "whatsapp", rotulo: "Chamar no WhatsApp", camada: "fora_do_post" },
  { valor: "orcamento", rotulo: "Pedir orçamento", camada: "fora_do_post" },
  { valor: "loja", rotulo: "Ir à loja", camada: "fora_do_post" },
  { valor: "ligar", rotulo: "Ligar", camada: "fora_do_post" },
];

// Curtida NÃO entra em TRANSFORMACOES de propósito: é a ação de menor custo do
// Instagram, acontece por hábito e reciprocidade independentemente de a peça ter
// acertado a intenção. Como ALVO produz índice alto que não prova nada; como
// BASE DE COMPARAÇÃO (salvamentos ÷ curtidas etc.) é útil — por isso a coleta de
// like_count segue existindo fora desta lista.

export const INTENCAO_ROTULO: Record<IntencaoDeclarada, string> = Object.fromEntries(
  INTENCOES.map((i) => [i.valor, i.rotulo]),
) as Record<IntencaoDeclarada, string>;

export const TRANSFORMACAO_ROTULO: Record<TransformacaoPretendida, string> = Object.fromEntries(
  TRANSFORMACOES.map((t) => [t.valor, t.rotulo]),
) as Record<TransformacaoPretendida, string>;

// Máximo de transformações secundárias. Apenas a PRINCIPAL alimenta medição
// futura — as secundárias existem para não amputar o cliente sem estragar o
// denominador do índice.
export const MAX_TRANSFORMACOES_SECUNDARIAS = 2;

// Como cada natureza de negócio CONSTRÓI cada intenção (seção 5.1 da spec).
// Entra no prompt como diretriz de MANIFESTAÇÃO — nunca como instrução de tom,
// que pertence ao Kit de Marca (direção de voz).
//
// "Natureza do negócio" NÃO é coluna nova: é o `segment` que o Kit de Marca já
// grava (SERVIÇOS/VAREJO/MARCA) — decisão do Ari em 15/08/2026, para não criar
// a terceira cópia da mesma variável (brand_kits.segment + profiles.segmento).
export const INTENCAO_MANIFESTACAO: Record<IntencaoDeclarada, Record<Segment, string>> = {
  compreensao: {
    SERVIÇOS: "Explica o que resolve",
    VAREJO: "Mostra o que tem — sortimento",
    MARCA: "Mostra o território que ocupa",
  },
  seguranca: {
    SERVIÇOS: "Processo e método visíveis",
    VAREJO: "Preço justo, troca, procedência",
    MARCA: "Consistência e previsibilidade",
  },
  confianca: {
    SERVIÇOS: "Prova — resultado, bastidor, gente",
    VAREJO: "Cumpre o anunciado — tem, entrega",
    MARCA: "Coerência de mundo, presença",
  },
  autoridade: {
    SERVIÇOS: "Domínio técnico demonstrado",
    VAREJO: "Curadoria — aqui tem o certo",
    MARCA: "Referência estética e cultural",
  },
};

// Transformações que a natureza põe PRIMEIRO na lista. A natureza não esconde
// opção nenhuma — apenas ordena (seção 5.1). O restante segue a ordem canônica
// de TRANSFORMACOES.
export const TRANSFORMACAO_PRIORIDADE_POR_SEGMENTO: Record<Segment, TransformacaoPretendida[]> = {
  SERVIÇOS: ["whatsapp", "orcamento", "comentar"],
  VAREJO: ["loja", "whatsapp", "urgencia", "salvar"],
  MARCA: ["preferencia", "seguir", "salvar", "compartilhar"],
};

// Pares intenção × transformação que a spec (seção 6) declara INCOERENTES. O
// aviso é a parte mais valiosa do recurso: é o momento em que o cliente descobre
// que estava pedindo à peça algo que a peça não pode dar. NUNCA bloqueia.
export const PARES_INCOERENTES: {
  intencao: IntencaoDeclarada;
  transformacao: TransformacaoPretendida;
  aviso: string;
}[] = [
  {
    intencao: "compreensao",
    transformacao: "orcamento",
    aviso:
      "Compreensão raramente produz orçamento direto. Ou a intenção é Confiança, ou a transformação é Salvar. Qual dos dois você quer trocar?",
  },
  {
    intencao: "compreensao",
    transformacao: "loja",
    aviso:
      "Quem ainda está entendendo o que você faz dificilmente sai de casa para ir à loja. Ou a intenção é Confiança, ou a transformação é Salvar. Qual dos dois você quer trocar?",
  },
  {
    intencao: "autoridade",
    transformacao: "orcamento",
    aviso:
      "Autoridade constrói referência, não pedido de preço. Ou a intenção é Confiança, ou a transformação é Compartilhar. Qual dos dois você quer trocar?",
  },
];

// Regra transversal: urgência só é coerente a partir de Confiança — ninguém tem
// pressa por quem acabou de conhecer.
export const INTENCOES_SEM_URGENCIA: IntencaoDeclarada[] = ["compreensao", "seguranca"];

// EXCEÇÃO DO VAREJO: compra de giro tem risco baixo e promoção com prazo é a
// linguagem nativa da categoria — lá a urgência já é coerente a partir de
// Segurança. Em Compreensão continua incoerente em todos os segmentos.
export const INTENCOES_SEM_URGENCIA_VAREJO: IntencaoDeclarada[] = ["compreensao"];

export const AVISO_URGENCIA =
  "Urgência pressupõe que ele já confia em você. Ninguém tem pressa por quem acabou de conhecer — ou a intenção é Confiança, ou a transformação é outra. Qual dos dois você quer trocar?";
