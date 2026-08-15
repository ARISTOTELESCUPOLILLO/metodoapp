// Intenção declarada — tipos puros do domínio (Regra 3 do PLANO_V2: um shape,
// uma definição). Este arquivo NÃO importa nada, de propósito: `types.ts` o
// importa, e o inverso criaria ciclo — mesmo padrão de domain/visualSelection.ts.
//
// As TABELAS (rótulos, matriz por natureza, pares incoerentes) ficam em
// intencao.config.ts; a LÓGICA que as usa fica em core/intencao.ts.

/**
 * O que o receptor deve passar a PERCEBER. Derivada da sequência do Método OP
 * (Clareza → Segurança → Confiança → Autoridade → Agir), com o degrau "Agir"
 * removido porque ele pertence à transformação.
 *
 * "compreensao" e não "clareza": `clareza` já é o rótulo do mood OP-01 e está
 * na lista de palavras proibidas no texto gerado.
 */
export type IntencaoDeclarada = "compreensao" | "seguranca" | "confianca" | "autoridade";

/** O que MUDA no receptor depois — o outro lado do campo. */
export type TransformacaoPretendida =
  | "preferencia"
  | "urgencia"
  | "comentar"
  | "salvar"
  | "compartilhar"
  | "seguir"
  | "whatsapp"
  | "orcamento"
  | "loja"
  | "ligar";

/**
 * Camada A = mudança interna (medição futura por proxy, no comentário);
 * B = comportamento no post (via Graph API); C = comportamento fora do post
 * (declarado pelo cliente). Não muda o prompt — existe para a medição da Fase 5.
 */
export type CamadaTransformacao = "interna" | "no_post" | "fora_do_post";

/**
 * Distingue, na medição futura, alinhamento alto de cliente que PENSOU de
 * alinhamento alto de cliente que ACEITOU sugestão. Na Fase 1 não existe
 * sugestão de intenção por IA — só "usuario" é emitido; os outros dois já
 * existem para não migrar dado depois.
 */
export type IntencaoOrigem = "usuario" | "sugerida_aceita" | "sugerida_editada";
