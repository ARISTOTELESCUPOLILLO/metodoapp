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
    camada: "silenciosa",
  },
  { valor: "urgencia", rotulo: "Urgência — passa a sentir custo em adiar", camada: "silenciosa" },
  { valor: "comentar", rotulo: "Comentar ou perguntar", camada: "interna" },
  { valor: "salvar", rotulo: "Salvar", camada: "interna" },
  { valor: "compartilhar", rotulo: "Compartilhar ou marcar alguém", camada: "interna" },
  { valor: "seguir", rotulo: "Seguir o perfil", camada: "interna" },
  { valor: "whatsapp", rotulo: "Chamar no WhatsApp", camada: "externa" },
  { valor: "orcamento", rotulo: "Pedir orçamento", camada: "externa" },
  { valor: "loja", rotulo: "Ir à loja", camada: "externa" },
  { valor: "ligar", rotulo: "Ligar", camada: "externa" },
];

export const TRANSFORMACAO_CAMADA: Record<TransformacaoPretendida, CamadaTransformacao> =
  Object.fromEntries(TRANSFORMACOES.map((t) => [t.valor, t.camada])) as Record<
    TransformacaoPretendida,
    CamadaTransformacao
  >;

// Camada usada quando não há transformação declarada. A interface do piloto
// exige a principal (PostUnicoForm: `intencaoPendente` trava a geração sem
// ela), mas o backend não pode depender disso — valor inválido no corpo da
// requisição vira null, e o MOP usa o mesmo endpoint de regeneração sem mandar
// transformação nenhuma. A silenciosa é o denominador comum: é a única que não
// pressupõe ação do leitor, então nunca pede à peça algo que ninguém escolheu.
export const CAMADA_PADRAO: CamadaTransformacao = "silenciosa";

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

// Como cada natureza de negócio CONSTRÓI cada intenção (seção 5.1 da spec),
// AGORA TAMBÉM POR CAMADA (17/08/2026). Entra no prompt como diretriz de
// MANIFESTAÇÃO — nunca como instrução de tom, que pertence ao Kit de Marca
// (direção de voz).
//
// "Natureza do negócio" NÃO é coluna nova: é o `segment` que o Kit de Marca já
// grava (SERVIÇOS/VAREJO/MARCA) — decisão do Ari em 15/08/2026, para não criar
// a terceira cópia da mesma variável (brand_kits.segment + profiles.segmento).
//
// POR QUE A CAMADA ENTROU: até 17/08 cada casa tinha UMA frase, então o mesmo
// cliente recebia a mesma manifestação em toda peça — a variável era constante,
// que é a mesma causa de repetição já provada nos moods. A camada foi a
// dimensão escolhida (em vez do objetivo da peça) porque tem ligação semântica
// direta: a prova que faz alguém atravessar a cidade não é a que faz alguém
// compartilhar um post, e "Promoção" ou "Aviso" não dizem nada sobre onde a
// prova acontece. São 3 valores e não 7, o que também mantém o repertório
// escrevível à mão.
//
// ⚠ RÉGUA DE ESCRITA (Ari, 17/08/2026 — vale para toda frase nova aqui):
// a manifestação descreve o TIPO de prova, nunca a prova específica. NÃO PODE
// obrigar o cliente a prometer política comercial (troca, devolução, garantia,
// prazo, entrega) nem lembrar o consumidor dos direitos dele — "cliente pequeno
// tem manias". Em SERVIÇOS soma-se a profissão regulamentada (advogado,
// dentista, médico, contador), que não pode prometer resultado nem exibir
// antes/depois. Três frases foram aposentadas por essa régua: "Preço justo,
// TROCA, procedência" e "Cumpre o anunciado — tem, ENTREGA" no varejo, e
// "Prova — RESULTADO, bastidor, gente" em serviços.
//
// E a manifestação diz COMO a percepção se constrói, não o efeito que produz —
// o efeito já está no rótulo da intenção. Por isso "Mostra procedência do que
// vende" e não "Tira o receio de errar".
export const INTENCAO_MANIFESTACAO: Record<
  IntencaoDeclarada,
  Record<Segment, Record<CamadaTransformacao, string>>
> = {
  compreensao: {
    SERVIÇOS: {
      externa: "Nomeia o problema que resolve na palavra do cliente",
      interna: "Mostra o que o serviço cobre",
      silenciosa: "Fixa qual problema aquele profissional resolve",
    },
    VAREJO: {
      externa: "Mostra o que a loja vende e onde ela fica",
      interna: "Explica para que serve o que está na prateleira",
      silenciosa: "Fixa a loja como o lugar daquele tipo de produto",
    },
    MARCA: {
      externa: "Diz o que a marca faz sem rodeio",
      interna: "Mostra o território que ocupa",
      silenciosa: "Fixa o assunto que é dela",
    },
  },
  seguranca: {
    SERVIÇOS: {
      // "Mostra como começa o trabalho" e não o trabalho inteiro: o que faz
      // alguém chamar no WhatsApp é enxergar o primeiro passo, que é barato.
      // Ninguém pede orçamento para o passo cinco.
      externa: "Mostra como começa o trabalho",
      interna: "Antecipa a dúvida que trava a decisão",
      silenciosa: "Torna o método visível",
    },
    VAREJO: {
      externa: "Mostra que tem quem oriente na hora da escolha",
      interna: "Antecipa a dúvida mais comum da categoria",
      silenciosa: "Mostra procedência do que vende",
    },
    MARCA: {
      externa: "Mostra que há gente por trás, acessível",
      interna: "Mantém o mesmo jeito de aparecer",
      silenciosa: "Sustenta consistência ao longo do tempo",
    },
  },
  confianca: {
    // A linha inteira de SERVIÇOS fica em gente, bastidor e constância — é o
    // que sobra quando se tira a promessa de resultado, e é justamente o que
    // serve a qualquer prestador, regulamentado ou não.
    SERVIÇOS: {
      externa: "Mostra quem faz o trabalho",
      interna: "Mostra o trabalho acontecendo",
      // ERA "Mostra constância no jeito de trabalhar" — trocada em 18/08 depois
      // de falhar 0/2 no texto de apoio (peças 3A e 3B em AJUSTE_CONFLITO),
      // enquanto as duas irmãs acertavam. A causa não é a regra nem a posição
      // dela no prompt: "constância" é uma PROPRIEDADE, e as irmãs entregam um
      // OBJETO — quem faz (uma pessoa), o trabalho acontecendo (uma ação). Sem
      // objeto, e sob o teto de 14 palavras do apoio, o modelo teria de
      // inventar um fato que não está na informação-chave; volta a parafraseá-la.
      // "A rotina que se repete" é o mesmo tipo de prova com objeto nomeado.
      // TESTE EM CURSO: se duas peças de Preferência trouxerem a rotina no
      // apoio, o mesmo critério vale para as outras cinco silenciosas sem
      // objeto (segurança×MARCA, confiança×VAREJO, confiança×MARCA,
      // autoridade×SERVIÇOS, autoridade×MARCA). Se não, a hipótese morre e o
      // caminho passa a ser o rodízio de 2+ frases por casa.
      silenciosa: "Mostra a rotina que se repete",
    },
    VAREJO: {
      externa: "O que está na peça está na loja",
      interna: "Mostra o movimento real do dia a dia",
      silenciosa: "O que foi anunciado se sustenta depois",
    },
    MARCA: {
      externa: "Mostra a marca no mundo real",
      interna: "Mostra coerência entre o que diz e o que faz",
      silenciosa: "Marca presença de forma constante",
    },
  },
  autoridade: {
    SERVIÇOS: {
      externa: "Responde o que o cliente não sabe a quem perguntar",
      interna: "Mostra o critério técnico por trás da decisão",
      silenciosa: "Demonstra domínio do ofício",
    },
    VAREJO: {
      externa: "Indica o item certo para cada uso",
      interna: "Mostra a diferença entre opções parecidas",
      silenciosa: "Mostra o repertório de quem vive daquilo",
    },
    MARCA: {
      externa: "Toma posição sobre o que importa no setor",
      interna: "Indica o que merece atenção no setor",
      silenciosa: "Mostra repertório estético próprio",
    },
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
