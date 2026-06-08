// Política de uso de Imagens de Referência (IMG_RF).
//
// Regra unificada (atualizada):
//
//   EXP        (todos os segmentos): 1 avatar + até 3 cenários + até 5 produtos
//   PU 2/4/8   (todos os segmentos): 1 avatar + até 3 cenários + até 3 produtos
//
//   MOP (S*V / S*C) — TODOS os segmentos (SERVIÇOS, MARCA, VAREJO):
//     estatico       : 1 avatar + até 3 cenários + até 3 produtos (apenas VAREJO; SERVIÇOS/MARCA sem produto)
//     carrossel      : sem avatar — 1 cenário (compartilhado por todos os cards) + até 5 produtos (1/card)
//     estatico_final : 1 avatar + até 3 cenários + até 3 produtos (apenas VAREJO; SERVIÇOS/MARCA sem produto)
//     reels          : 1 avatar + até 3 cenários (NUNCA produto)
//
// O freio para o carrossel é o toggle "usar referências" (default OFF) em
// UsoReferenciasDia — não há mais sistema de "extras personalizados".

import type { Segment } from '../types';
import type { ModeloOP, SlotFormato } from './personalizacaoMop';

export interface RefPolicy {
  avatar: boolean;     // pode escolher avatar?
  cenarios: number;    // quantos cenários (0..3)
  produtos: number;    // quantos produtos (0..5)
}

export const NO_POLICY: RefPolicy = { avatar: false, cenarios: 0, produtos: 0 };

function isEXP(m: ModeloOP | null): boolean {
  return m === 'EXP';
}
function isPU(m: ModeloOP | null): boolean {
  return m === 'PU2' || m === 'PU4' || m === 'PU8';
}

export function policyPorFormato(
  segmento: Segment,
  formato: SlotFormato,
  modelo: ModeloOP | null,
): RefPolicy {
  // EXP — generoso em todos os formatos
  if (isEXP(modelo)) {
    return { avatar: true, cenarios: 3, produtos: 5 };
  }
  // PU — generoso em todos os formatos
  if (isPU(modelo)) {
    return { avatar: true, cenarios: 3, produtos: 3 };
  }

  // MOP — carrossel: sem avatar; 1 cenário compartilhado pela sequência inteira
  // + até 5 produtos (cada card recebe 1 produto, na ordem marcada).
  if (formato === 'carrossel')       return { avatar: false, cenarios: 1, produtos: 5 };
  if (formato === 'reels')           return { avatar: true,  cenarios: 3, produtos: 0 };

  // S*V / S*C — estatico / estatico_final
  if (segmento === 'VAREJO') {
    return { avatar: true, cenarios: 3, produtos: 3 };
  }
  // SERVIÇOS / MARCA — estatico / estatico_final sem produto
  return { avatar: true, cenarios: 3, produtos: 0 };
}

// Compat: extras personalizados foram removidos. A função permanece para
// não quebrar imports, mas é no-op.
export function policyComExtras(
  base: RefPolicy,
  _ctx: { segmento: Segment; formato: SlotFormato; modelo: ModeloOP | null; extrasCarrossel: number },
): RefPolicy {
  return base;
}

// Conta quantas imagens, no total, o usuário pode escolher para esta peça.
export function totalImagens(p: RefPolicy): number {
  return (p.avatar ? 1 : 0) + p.cenarios + p.produtos;
}

// Resumo humano da regra: "1 avatar, 1 cenário, até 3 produtos".
export function descrevePolicy(p: RefPolicy): string {
  const parts: string[] = [];
  if (p.avatar) parts.push('1 avatar');
  if (p.cenarios > 0) parts.push(`até ${p.cenarios} cenário${p.cenarios > 1 ? 's' : ''}`);
  if (p.produtos > 0) parts.push(`até ${p.produtos} produto${p.produtos > 1 ? 's' : ''}`);
  return parts.length ? parts.join(', ') : 'nenhuma imagem permitida';
}
