// Tipos e helpers de personalização do Método OP (Kit Imagem).
// O usuário escolhe livremente quais imagens do Kit usar por peça em
// UsoReferenciasDia.tsx — a tabela de recomendação automática por
// (modelo, segmento, posição) que existia aqui foi removida junto com o
// PersonalizacaoBadge.tsx (componente morto, sem import ativo).

import type { Track } from '../types';

export type ModeloOP =
  | 'EXP'
  | 'PU2' | 'PU4' | 'PU8'
  | 'S3V' | 'S6V' | 'S9V'
  | 'S3C' | 'S6C' | 'S9C';

export type ElementoPersonalizacao =
  | 'avatar'
  | 'produto'
  | 'cenario'
  | 'cenario+avatar'
  | 'avatar+produto';

// Tipo da peça-alvo dentro do feed gerado
export type SlotFormato = 'estatico' | 'estatico_final' | 'carrossel' | 'reels';

export interface SlotPersonalizacao {
  // Tipo da peça
  formato: SlotFormato;
  // Posição 1-based dentro do grupo (ex.: estático 1, estático 2, carrossel 1)
  posicao: number;
  // Elemento do Kit Imagem que a regra recomenda
  elemento: ElementoPersonalizacao;
  // Para carrossel: número do card (1-5) que aceita personalização
  cardCarrossel?: number;
  // Texto humano da recomendação (vestígio do badge antigo; não exibido hoje)
  motivo: string;
}

// Resolve o ModeloOP a partir do que o app já tem (Track + sequenceSize).
// PU2/PU4/PU8 ainda não existem como modo de geração no MOP — ficam aqui
// reservados pra Fase 2.
export function resolveModelo(track: Track | undefined, sequenceSize: 3 | 6 | 9): ModeloOP | null {
  if (track === 'experimentacao') return 'EXP';
  if (track === 'visual') {
    if (sequenceSize === 3) return 'S3V';
    if (sequenceSize === 6) return 'S6V';
    if (sequenceSize === 9) return 'S9V';
  }
  if (track === 'cinematica' || !track) {
    if (sequenceSize === 3) return 'S3C';
    if (sequenceSize === 6) return 'S6C';
    if (sequenceSize === 9) return 'S9C';
  }
  return null;
}

// ============= Cota por tipo =============
// O orçamento de personalizados é por tipo de peça, somando: base do plano1 +
// base do plano2 + base do bônus + extras do usuário (que zeram junto com o
// plano1).
export interface CotaPorTipo {
  estatico: number;
  carrossel: number;
  estatico_final: number;
  reels: number;
}

export interface PlanoBases {
  base_estatico?: number | null;
  base_carrossel?: number | null;
  base_estatico_final?: number | null;
  base_reels?: number | null;
}

export interface ExtrasOrigem {
  estatico?: number | null;
  carrossel?: number | null;
  estatico_final?: number | null;
  reels?: number | null;
}

export interface PlanoComExtras {
  plan: PlanoBases | null;
  extras?: ExtrasOrigem | null;
}

export const ZERO_COTA: CotaPorTipo = { estatico: 0, carrossel: 0, estatico_final: 0, reels: 0 };

// Soma, por tipo de peça, a base de cada plano ativo (P1, P2, B) com os
// extras atribuídos àquele plano. Extras de um plano vazio são ignorados.
export function computeCota(entries: PlanoComExtras[]): CotaPorTipo {
  const n = (v: any) => Number(v || 0);
  return entries.reduce<CotaPorTipo>((acc, e) => {
    if (!e.plan) return acc;
    return {
      estatico:       acc.estatico       + n(e.plan?.base_estatico)       + n(e.extras?.estatico),
      carrossel:      acc.carrossel      + n(e.plan?.base_carrossel)      + n(e.extras?.carrossel),
      estatico_final: acc.estatico_final + n(e.plan?.base_estatico_final) + n(e.extras?.estatico_final),
      reels:          acc.reels          + n(e.plan?.base_reels)          + n(e.extras?.reels),
    };
  }, { ...ZERO_COTA });
}
