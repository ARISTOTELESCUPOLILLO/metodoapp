// Matriz segmento × audiência — entrada/bloqueio psicológicos e progressão narrativa.
// Extraído de organizaMethodEngine.ts para separar dados de lógica.

import type { Audience, Segment } from "../types";

interface SegmentAudienceEntry {
  entrada: string;
  bloqueio: string;
  progressionText: string;
}

export const AUDIENCE_SEGMENT_CONFIG: Record<
  Audience,
  Record<Segment, SegmentAudienceEntry>
> = {
  B2C: {
    SERVIÇOS: {
      entrada: "clareza e organização mental",
      bloqueio: "confusão e desconfiança",
      progressionText: "ENTENDIMENTO → SEGURANÇA → CONFIANÇA → AUTORIDADE → AGIR",
    },
    VAREJO: {
      entrada: "identificação e movimento",
      bloqueio: "indecisão e inércia",
      progressionText: "IDENTIFICAÇÃO → DESEJO → SEGURANÇA → CONFIANÇA → AGIR",
    },
    MARCA: {
      entrada: "reconhecimento e vínculo",
      bloqueio: "desconexão e falta de familiaridade",
      progressionText: "RECONHECIMENTO → IDENTIFICAÇÃO → SEGURANÇA → CONFIANÇA → AGIR",
    },
  },
  B2B: {
    SERVIÇOS: {
      entrada: "eficiência e previsibilidade operacional",
      bloqueio: "risco de mudança e falta de referências",
      progressionText: "ENTENDIMENTO → CONFIANÇA → SEGURANÇA → AUTORIDADE → AGIR",
    },
    VAREJO: {
      entrada: "margem e giro de estoque",
      bloqueio: "custo de troca e incerteza de demanda",
      progressionText: "ENTENDIMENTO → CONFIANÇA → SEGURANÇA → AUTORIDADE → AGIR",
    },
    MARCA: {
      entrada: "posicionamento e diferenciação no mercado",
      bloqueio: "comoditização e falta de percepção de valor",
      progressionText: "ENTENDIMENTO → CONFIANÇA → SEGURANÇA → AUTORIDADE → AGIR",
    },
  },
} as const;
