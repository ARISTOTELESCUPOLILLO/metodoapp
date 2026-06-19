// Política de uso de Imagens de Referência (IMG_RF).
//
// Regra unificada nos 3 segmentos (VAREJO/SERVIÇOS/MARCA), EXCETO produto no
// MOP estático/estático_final (só VAREJO — ver auditoria 2026-06-20: tinha
// sido liberado pra todos por efeito colateral do commit d311f49, sem relação
// com o que aquele commit dizia fazer; restaurado por decisão de negócio). A
// fachada entra como elemento padrão em toda peça, fora da contagem de
// cenários (slot próprio no Kit Imagem, não faz parte do pool de cenários):
//
//   EXP            : 1 avatar + 1 fachada + até 2 cenários + até 5 produtos
//   PU 2/4/8       : 1 avatar + 1 fachada + até 2 cenários + até 3 produtos
//   MOP estatico       : 1 avatar + 1 fachada + 1 cenário + até 3 produtos (apenas VAREJO; SERVIÇOS/MARCA sem produto)
//   MOP carrossel      : sem avatar + 1 fachada + 1 cenário + até 5 produtos (todos os segmentos)
//   MOP estatico_final : 1 avatar + 1 fachada + 1 cenário + até 3 produtos (apenas VAREJO; SERVIÇOS/MARCA sem produto)
//   MOP reels          : 1 avatar + 1 fachada + até 2 cenários, sem produto
//
// O freio para o carrossel é o toggle "usar referências" (default OFF) em
// UsoReferenciasDia — não há mais sistema de "extras personalizados".

import type { Segment } from "../types";
import type { ModeloOP, SlotFormato } from "./personalizacaoMop";

export interface RefPolicy {
  avatar: boolean; // pode escolher avatar?
  fachada: boolean; // pode usar a fachada do Kit?
  cenarios: number; // quantos cenários (0..2)
  produtos: number; // quantos produtos (0..5)
}

export const NO_POLICY: RefPolicy = { avatar: false, fachada: false, cenarios: 0, produtos: 0 };

// Limite de produtos na PU — mesmo valor em qualquer segmento/formato.
// Fonte única de verdade: PostUnicoComposicaoVisual.tsx lê isso direto,
// sem precisar chamar policyPorFormato com parâmetros neutros.
export const PU_MAX_PRODUTOS = 3;

function isEXP(m: ModeloOP | null): boolean {
  return m === "EXP";
}
function isPU(m: ModeloOP | null): boolean {
  return m === "PU2" || m === "PU4" || m === "PU8";
}

export function policyPorFormato(
  segmento: Segment,
  formato: SlotFormato,
  modelo: ModeloOP | null,
): RefPolicy {
  // EXP — generoso em todos os formatos
  if (isEXP(modelo)) {
    return { avatar: true, fachada: true, cenarios: 2, produtos: 5 };
  }
  // PU — generoso em todos os formatos
  if (isPU(modelo)) {
    return { avatar: true, fachada: true, cenarios: 2, produtos: PU_MAX_PRODUTOS };
  }

  // MOP — carrossel: sem avatar; 1 cenário compartilhado pela sequência inteira
  // + até 5 produtos (cada card recebe 1 produto, na ordem marcada). Igual
  // nos 3 segmentos.
  if (formato === "carrossel") return { avatar: false, fachada: true, cenarios: 1, produtos: 5 };
  if (formato === "reels") return { avatar: true, fachada: true, cenarios: 2, produtos: 0 };

  // S*V / S*C — estatico / estatico_final: produto restrito a VAREJO (decisão
  // de negócio confirmada 2026-06-20) — SERVIÇOS/MARCA sem produto.
  if (segmento === "VAREJO") {
    return { avatar: true, fachada: true, cenarios: 1, produtos: 3 };
  }
  return { avatar: true, fachada: true, cenarios: 1, produtos: 0 };
}

// Compat: extras personalizados foram removidos. A função permanece para
// não quebrar imports, mas é no-op.
export function policyComExtras(
  base: RefPolicy,
  _ctx: {
    segmento: Segment;
    formato: SlotFormato;
    modelo: ModeloOP | null;
    extrasCarrossel: number;
  },
): RefPolicy {
  return base;
}

// Conta quantas imagens, no total, o usuário pode escolher para esta peça.
export function totalImagens(p: RefPolicy): number {
  return (p.avatar ? 1 : 0) + (p.fachada ? 1 : 0) + p.cenarios + p.produtos;
}

// Ordem dos grupos de tiles na UI de seleção (UsoReferenciasDia,
// PostUnicoComposicaoVisual) — reflete a mesma prioridade que já orienta o
// prompt (VAREJO→produto, SERVIÇOS→pessoa, MARCA→território), pra que a UI
// mostre primeiro o que mais importa pra cada segmento.
export type GrupoTile = "avatar" | "fachada" | "cenario" | "produto";
const ORDEM_PADRAO: GrupoTile[] = ["avatar", "fachada", "cenario", "produto"];
export function ordemGruposPorSegmento(segment: Segment): GrupoTile[] {
  if (segment === "VAREJO") return ["produto", "avatar", "fachada", "cenario"];
  if (segment === "MARCA") return ["cenario", "fachada", "avatar", "produto"];
  return ORDEM_PADRAO; // SERVIÇOS — avatar (pessoa) já lidera a ordem padrão
}

// Resumo humano da regra: "1 avatar, fachada, 1 cenário (dentre até 2 cadastrados), até 3 produtos".
// Cenário é sempre 1 por geração — o número em `p.cenarios` é quantas opções
// cadastradas no Kit ficam disponíveis para escolha, não quantas são usadas juntas.
export function descrevePolicy(p: RefPolicy): string {
  const parts: string[] = [];
  if (p.avatar) parts.push("1 avatar");
  if (p.fachada) parts.push("fachada");
  if (p.cenarios > 0) {
    parts.push(p.cenarios > 1 ? `1 cenário (dentre até ${p.cenarios} cadastrados)` : "1 cenário");
  }
  if (p.produtos > 0) parts.push(`até ${p.produtos} produto${p.produtos > 1 ? "s" : ""}`);
  return parts.length ? parts.join(", ") : "nenhuma imagem permitida";
}
