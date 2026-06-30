// Moduladores de momento de negócio e regra de sílabas — dados internos do buildMetodoOpPrompt.
interface MomentModulator {
  label: string;
  entryModifier: string;
  contextNote: string;
}

// Cada entryModifier já incorpora a nuance de SEGURANÇA usada quando
// isB2BOperational (era um campo `securityAngle` separado — fundido aqui
// porque só era lido nesse único branch).
export const momentModulators: Record<string, MomentModulator> = {
  lançamento: {
    label: "Lançamento",
    entryModifier:
      "modulada por DESCOBERTA e NOVIDADE — o 1º conteúdo apresenta o que ainda não é percebido pelo público, despertando curiosidade legítima sobre algo novo; em contexto B2B operacional, ancorar essa descoberta na previsibilidade e clareza da adoção do que está sendo introduzido, reduzindo a incerteza diante do novo.",
    contextNote: "Lançamento (empresa nova ou novo produto/serviço — ativação via descoberta)",
  },
  consolidação: {
    label: "Consolidação",
    entryModifier:
      "ativação padrão da entrada do segmento, sem modulação adicional — reforçar autoridade e prova sobre o que já é percebido; em contexto B2B operacional, ancorar essa autoridade na estabilidade comprovada e na previsibilidade operacional já consolidada.",
    contextNote: "Consolidação (operação estável buscando crescer — ativação padrão do segmento)",
  },
  reativação: {
    label: "Reativação",
    entryModifier:
      "modulada por RECONEXÃO e RELEVÂNCIA RENOVADA — reabre uma conversa que ficou em aberto, recuperando a atenção de quem já conhece mas se afastou; em contexto B2B operacional, ancorar essa reconexão em reduzir o risco percebido de retomar, mostrando que o caminho de volta é seguro e previsível.",
    contextNote: "Reativação (cliente parado, retomada após pausa — ativação via reconexão)",
  },
};

// Cláusula de exceção de sílabas no título — centralizada para evitar 4 cópias dessincronizadas.
export const SILABA_EXCECAO_RULE =
  'cada palavra com no máximo 4 sílabas (EXCETO o substantivo concreto central da informação-chave — produto, peça, serviço, objeto ou procedimento — que pode ter NO MÁXIMO 5 sílabas, nunca mais, quando essencial para clareza, ex.: "equipamento", "manutenção", "orçamento", "diagnóstico", "estratégia" — termos com 6+ sílabas devem ser trocados por sinônimo mais curto)';