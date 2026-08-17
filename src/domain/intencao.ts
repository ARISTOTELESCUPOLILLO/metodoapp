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
 * ONDE a transformação acontece — o palco em que a peça precisa provar o que
 * afirma:
 * - `externa`: o leitor sai do post (vai à loja, chama no WhatsApp, liga, pede
 *   orçamento). Prova cara: a peça tem de justificar um deslocamento.
 * - `interna`: o leitor age ali mesmo (comenta, salva, compartilha, segue).
 *   Medível pela Graph API.
 * - `silenciosa`: nada acontece do lado de fora — muda o que ele pensa
 *   (preferência, urgência). Medição futura só por proxy.
 *
 * Vocabulário fixado com o Ari em 17/08/2026. Os nomes anteriores
 * (`interna`/`no_post`/`fora_do_post`) foram trocados porque "interna"
 * significava a camada silenciosa e ele usa a mesma palavra para "age dentro do
 * post" — duas coisas opostas com o mesmo nome é armadilha garantida.
 *
 * DEIXOU DE SER METADADO MORTO na mesma data: a camada agora escolhe a
 * MANIFESTAÇÃO (ver INTENCAO_MANIFESTACAO), porque a prova que faz alguém
 * atravessar a cidade não é a mesma que faz alguém compartilhar um post.
 */
export type CamadaTransformacao = "externa" | "interna" | "silenciosa";

/**
 * Distingue, na medição futura, alinhamento alto de cliente que PENSOU de
 * alinhamento alto de cliente que ACEITOU sugestão. Na Fase 1 não existe
 * sugestão de intenção por IA — só "usuario" é emitido; os outros dois já
 * existem para não migrar dado depois.
 */
export type IntencaoOrigem = "usuario" | "sugerida_aceita" | "sugerida_editada";
