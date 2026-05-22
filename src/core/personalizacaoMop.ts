// Mapa de regras de personalização do Método OP.
// Tradução literal das Tabelas 1, 2 e 3 do documento 006_SIMULAÇÃO.
// Para cada (modelo, segmento) devolve a lista de slots que o sistema
// recomenda personalizar com o Kit Imagem do usuário.
//
// REGRAS GERAIS:
// - 1 uso personalizado = 1 imagem gerada com Kit Imagem ativo.
// - Carrossel completo NÃO é personalizado nesta fase. Apenas 1 card-chave
//   em VAREJO nas sequências (S3V/S6V/S9V/S6C/S9C).
// - No cinemático: a imagem-base do reels conta como uso personalizado.
//   O render de vídeo nunca conta.
// - O usuário não escolhe livremente onde — só liga/desliga e (quando o
//   slot for "produto") escolhe quais produtos numerados do Kit.

import type { Segment, Track } from '../types';

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
  // Texto humano da recomendação (mostrado no tooltip do badge)
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

// Cota legada por ModeloOP (Tabela 4 do PDF) — mantida só como referência
// visual. A cota real agora vem do plano + extras do usuário (ver CotaPorTipo).
const COTA: Record<ModeloOP, number> = {
  EXP: 1,
  PU2: 1, PU4: 2, PU8: 4,
  S3V: 2, S6V: 4, S9V: 4,
  S3C: 2, S6C: 4, S9C: 4,
};

export function getCotaPersonalizacao(modelo: ModeloOP): number {
  return COTA[modelo] ?? 0;
}

// ============= Cota por tipo (nova) =============
// Substitui o número único da tabela acima. O orçamento de personalizados
// agora é por tipo de peça, somando: base do plano1 + base do plano2 +
// base do bônus + extras do usuário (que zeram junto com o plano1).
export type TipoPersonalizado = 'estatico' | 'carrossel' | 'estatico_final' | 'reels';

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

// Mapeia o `formato` do slot para o bucket de cota
export function tipoDoSlot(formato: SlotFormato): TipoPersonalizado {
  if (formato === 'estatico_final') return 'estatico_final';
  if (formato === 'carrossel') return 'carrossel';
  if (formato === 'reels') return 'reels';
  return 'estatico';
}

// Mapa principal — por (modelo, segmento) → slots recomendados.
// Cada entrada traduz literalmente as linhas das Tabelas 1, 2 e 3.
type Tabela = Record<ModeloOP, Record<Segment, SlotPersonalizacao[]>>;

const TABELA: Tabela = {
  // ============== EXP — Experimentação ==============
  EXP: {
    'SERVIÇOS': [
      { formato: 'estatico_final', posicao: 1, elemento: 'avatar',
        motivo: 'Fechar com presença profissional do avatar' },
    ],
    'VAREJO': [
      // PDF aceita "1 card-chave do carrossel OU estático inicial". Recomendamos
      // o estático inicial por ser mais previsível (carrossel libera só 1 card).
      { formato: 'estatico', posicao: 1, elemento: 'produto',
        motivo: 'Destacar produto principal logo na entrada' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario',
        motivo: 'Atmosfera e identidade visual da marca' },
    ],
  },

  // ============== PU2/PU4/PU8 — Posts Únicos múltiplos (reservado p/ Fase 2) ==============
  PU2: {
    'SERVIÇOS': [
      { formato: 'estatico', posicao: 2, elemento: 'avatar', motivo: 'Fechar com presença profissional' },
    ],
    'VAREJO': [
      { formato: 'estatico', posicao: 1, elemento: 'produto', motivo: 'Destacar produto principal' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Construir percepção visual da marca' },
    ],
  },
  PU4: {
    'SERVIÇOS': [
      { formato: 'estatico', posicao: 2, elemento: 'cenario+avatar', motivo: 'Cenário contextualiza' },
      { formato: 'estatico', posicao: 4, elemento: 'cenario+avatar', motivo: 'Avatar afirma' },
    ],
    'VAREJO': [
      { formato: 'estatico', posicao: 1, elemento: 'produto', motivo: 'Produto principal' },
      { formato: 'estatico', posicao: 3, elemento: 'produto', motivo: 'Produto secundário' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario+avatar', motivo: 'Atmosfera no início' },
      { formato: 'estatico', posicao: 4, elemento: 'cenario+avatar', motivo: 'Vínculo no fechamento' },
    ],
  },
  PU8: {
    'SERVIÇOS': [
      { formato: 'estatico', posicao: 2, elemento: 'cenario+avatar', motivo: 'Alternar contexto e presença' },
      { formato: 'estatico', posicao: 4, elemento: 'cenario+avatar', motivo: 'Alternar contexto e presença' },
      { formato: 'estatico', posicao: 6, elemento: 'cenario+avatar', motivo: 'Alternar contexto e presença' },
      { formato: 'estatico', posicao: 8, elemento: 'cenario+avatar', motivo: 'Alternar contexto e presença' },
    ],
    'VAREJO': [
      { formato: 'estatico', posicao: 1, elemento: 'produto', motivo: 'Produto selecionado do Kit' },
      { formato: 'estatico', posicao: 3, elemento: 'produto', motivo: 'Produto selecionado do Kit' },
      { formato: 'estatico', posicao: 5, elemento: 'produto', motivo: 'Produto selecionado do Kit' },
      { formato: 'estatico', posicao: 7, elemento: 'produto', motivo: 'Produto selecionado do Kit' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario+avatar', motivo: 'Construir universo visual' },
      { formato: 'estatico', posicao: 3, elemento: 'cenario+avatar', motivo: 'Construir universo visual' },
      { formato: 'estatico', posicao: 6, elemento: 'cenario+avatar', motivo: 'Personagem de marca' },
      { formato: 'estatico', posicao: 8, elemento: 'cenario+avatar', motivo: 'Personagem de marca' },
    ],
  },

  // ============== S3V — Sequência 3 Visual ==============
  S3V: {
    'SERVIÇOS': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário inicial profissional' },
      { formato: 'estatico_final', posicao: 1, elemento: 'avatar', motivo: 'Fechamento com presença' },
    ],
    'VAREJO': [
      { formato: 'estatico', posicao: 1, elemento: 'produto', motivo: 'Produto principal na entrada' },
      { formato: 'carrossel', posicao: 1, cardCarrossel: 3, elemento: 'produto', motivo: 'Card-chave do carrossel com produto' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Atmosfera de marca' },
      { formato: 'estatico_final', posicao: 1, elemento: 'cenario+avatar', motivo: 'Avatar ou cenário simbólico no fechamento' },
    ],
  },

  // ============== S6V — Sequência 6 Visual ==============
  S6V: {
    'SERVIÇOS': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário inicial' },
      { formato: 'estatico', posicao: 2, elemento: 'cenario+avatar', motivo: 'Cenário ou avatar leve' },
      { formato: 'estatico_final', posicao: 1, elemento: 'avatar', motivo: 'Avatar no fechamento 1' },
      { formato: 'estatico_final', posicao: 2, elemento: 'avatar', motivo: 'Avatar no fechamento 2' },
    ],
    'VAREJO': [
      { formato: 'estatico', posicao: 1, elemento: 'produto', motivo: 'Produto na entrada' },
      { formato: 'carrossel', posicao: 1, cardCarrossel: 3, elemento: 'produto', motivo: 'Card-chave carrossel 1' },
      { formato: 'estatico', posicao: 2, elemento: 'produto', motivo: 'Produto no segundo bloco' },
      { formato: 'carrossel', posicao: 2, cardCarrossel: 3, elemento: 'produto', motivo: 'Card-chave carrossel 2' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário 1' },
      { formato: 'estatico', posicao: 2, elemento: 'cenario+avatar', motivo: 'Cenário/avatar 2' },
      { formato: 'estatico_final', posicao: 1, elemento: 'avatar', motivo: 'Personagem de marca 1' },
      { formato: 'estatico_final', posicao: 2, elemento: 'avatar', motivo: 'Personagem de marca 2' },
    ],
  },

  // ============== S9V — Sequência 9 Visual ==============
  S9V: {
    'SERVIÇOS': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário 1' },
      { formato: 'estatico', posicao: 2, elemento: 'cenario+avatar', motivo: 'Cenário/avatar 2' },
      { formato: 'estatico_final', posicao: 2, elemento: 'avatar', motivo: 'Avatar fechamento 2' },
      { formato: 'estatico_final', posicao: 3, elemento: 'avatar', motivo: 'Avatar fechamento 3' },
    ],
    'VAREJO': [
      { formato: 'estatico', posicao: 1, elemento: 'produto', motivo: 'Produto principal 1' },
      { formato: 'carrossel', posicao: 1, cardCarrossel: 3, elemento: 'produto', motivo: 'Card-chave carrossel 1' },
      { formato: 'estatico', posicao: 2, elemento: 'produto', motivo: 'Produto secundário' },
      { formato: 'carrossel', posicao: 2, cardCarrossel: 3, elemento: 'produto', motivo: 'Card-chave carrossel 2' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário 1' },
      { formato: 'estatico', posicao: 3, elemento: 'cenario', motivo: 'Cenário 3' },
      { formato: 'estatico_final', posicao: 2, elemento: 'cenario+avatar', motivo: 'Avatar/cenário 2' },
      { formato: 'estatico_final', posicao: 3, elemento: 'cenario+avatar', motivo: 'Avatar/cenário 3' },
    ],
  },

  // ============== S3C — Sequência 3 Cinemática ==============
  S3C: {
    'SERVIÇOS': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário inicial' },
      { formato: 'reels', posicao: 1, elemento: 'avatar', motivo: 'Avatar na imagem-base do reels' },
    ],
    'VAREJO': [
      { formato: 'estatico', posicao: 1, elemento: 'produto', motivo: 'Produto na entrada' },
      { formato: 'reels', posicao: 1, elemento: 'avatar+produto', motivo: 'Vendedor/produto na imagem-base do reels' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário inicial' },
      { formato: 'reels', posicao: 1, elemento: 'cenario+avatar', motivo: 'Avatar ou cenário simbólico no reels' },
    ],
  },

  // ============== S6C — Sequência 6 Cinemática ==============
  S6C: {
    'SERVIÇOS': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário 1' },
      { formato: 'estatico', posicao: 2, elemento: 'cenario+avatar', motivo: 'Cenário/avatar leve 2' },
      { formato: 'reels', posicao: 1, elemento: 'avatar', motivo: 'Avatar reels 1' },
      { formato: 'reels', posicao: 2, elemento: 'avatar', motivo: 'Avatar reels 2' },
    ],
    'VAREJO': [
      { formato: 'estatico', posicao: 1, elemento: 'produto', motivo: 'Produto 1' },
      { formato: 'carrossel', posicao: 1, cardCarrossel: 3, elemento: 'produto', motivo: 'Card-chave carrossel 1' },
      { formato: 'estatico', posicao: 2, elemento: 'produto', motivo: 'Produto 2' },
      { formato: 'reels', posicao: 2, elemento: 'avatar+produto', motivo: 'Vendedor/produto reels 2' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário 1' },
      { formato: 'estatico', posicao: 2, elemento: 'cenario', motivo: 'Cenário 2' },
      { formato: 'reels', posicao: 1, elemento: 'cenario+avatar', motivo: 'Reels 1' },
      { formato: 'reels', posicao: 2, elemento: 'cenario+avatar', motivo: 'Reels 2' },
    ],
  },

  // ============== S9C — Sequência 9 Cinemática ==============
  S9C: {
    'SERVIÇOS': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário 1' },
      { formato: 'estatico', posicao: 3, elemento: 'cenario+avatar', motivo: 'Cenário/avatar 3' },
      { formato: 'reels', posicao: 2, elemento: 'avatar', motivo: 'Avatar reels 2' },
      { formato: 'reels', posicao: 3, elemento: 'avatar', motivo: 'Avatar reels 3' },
    ],
    'VAREJO': [
      { formato: 'estatico', posicao: 1, elemento: 'produto', motivo: 'Produto 1' },
      { formato: 'carrossel', posicao: 1, cardCarrossel: 3, elemento: 'produto', motivo: 'Card-chave carrossel 1' },
      { formato: 'estatico', posicao: 2, elemento: 'produto', motivo: 'Produto 2' },
      { formato: 'reels', posicao: 3, elemento: 'avatar+produto', motivo: 'Vendedor/produto reels 3' },
    ],
    'MARCA': [
      { formato: 'estatico', posicao: 1, elemento: 'cenario', motivo: 'Cenário 1' },
      { formato: 'estatico', posicao: 3, elemento: 'cenario', motivo: 'Cenário 3' },
      { formato: 'reels', posicao: 2, elemento: 'cenario+avatar', motivo: 'Avatar/cenário simbólico reels 2' },
      { formato: 'reels', posicao: 3, elemento: 'cenario+avatar', motivo: 'Avatar/cenário simbólico reels 3' },
    ],
  },
};

export function getSlotsRecomendados(modelo: ModeloOP, segmento: Segment): SlotPersonalizacao[] {
  return TABELA[modelo]?.[segmento] || [];
}

// Helper: dado um item já renderizado em ResultsView, encontra o slot
// recomendado (se houver) consultando a tabela.
export function buscarSlot(
  slots: SlotPersonalizacao[],
  formato: SlotFormato,
  posicao: number,
  cardCarrossel?: number,
): SlotPersonalizacao | null {
  return (
    slots.find((s) => {
      if (s.formato !== formato) return false;
      if (s.posicao !== posicao) return false;
      if (s.formato === 'carrossel') return s.cardCarrossel === cardCarrossel;
      return true;
    }) || null
  );
}

// Verifica se o Kit Imagem do usuário tem o elemento que a regra pede.
// Quando elemento é "produto", retorna true se houver pelo menos 1 produto.
export function kitTemElemento(
  elemento: ElementoPersonalizacao,
  kit: { avatar?: string; cenarios?: (string | null)[]; produtos: (string | null)[] },
): boolean {
  const temCenario = !!kit.cenarios && kit.cenarios.some((c) => !!c);
  switch (elemento) {
    case 'avatar':
      return !!kit.avatar;
    case 'cenario':
      return temCenario;
    case 'produto':
      return kit.produtos.some((p) => !!p);
    case 'cenario+avatar':
      return temCenario || !!kit.avatar;
    case 'avatar+produto':
      return !!kit.avatar || kit.produtos.some((p) => !!p);
  }
}

export function nomeElemento(el: ElementoPersonalizacao): string {
  switch (el) {
    case 'avatar': return 'avatar';
    case 'cenario': return 'cenário';
    case 'produto': return 'produto';
    case 'cenario+avatar': return 'cenário + avatar';
    case 'avatar+produto': return 'avatar + produto';
  }
}

// ============================================================
// Extras → expansão de regra
// ============================================================
// Quando o usuário tem EXTRAS de personalização (comprados/dados pelo admin),
// a tabela MOP base passa a ser apenas uma recomendação. O Kit Imagem
// disponível do usuário pode oferecer escolhas adicionais (avatar OU cenário
// OU produto) no mesmo slot, e o app pode liberar formatos não previstos pela
// tabela (ex.: MARCA com extra de carrossel).

// Tipos atômicos que o Kit Imagem fornece.
export type ElementoAtomico = 'avatar' | 'cenario' | 'produto';

// Lista todos os elementos atômicos disponíveis no Kit do usuário.
export function elementosAtomicosNoKit(kit: {
  avatar?: string; cenarios?: (string | null)[]; produtos: (string | null)[];
}): ElementoAtomico[] {
  const out: ElementoAtomico[] = [];
  if (kit.avatar) out.push('avatar');
  if (kit.cenarios && kit.cenarios.some((c) => !!c)) out.push('cenario');
  if (kit.produtos.some((p) => !!p)) out.push('produto');
  return out;
}

// Decompõe um ElementoPersonalizacao em átomos (avatar/cenario/produto).
export function decomporElemento(el: ElementoPersonalizacao): ElementoAtomico[] {
  switch (el) {
    case 'avatar': return ['avatar'];
    case 'cenario': return ['cenario'];
    case 'produto': return ['produto'];
    case 'cenario+avatar': return ['cenario', 'avatar'];
    case 'avatar+produto': return ['avatar', 'produto'];
  }
}

// Compõe de volta. Só temos os 5 valores legais — qualquer combinação fora
// disso cai pro mais próximo que cubra os átomos pedidos.
export function comporElemento(atoms: ElementoAtomico[]): ElementoPersonalizacao {
  const has = (a: ElementoAtomico) => atoms.includes(a);
  const a = has('avatar'), c = has('cenario'), p = has('produto');
  if (c && a && p) return 'cenario+avatar'; // produto entra como opcional só em avatar+produto;
                                             // damos prioridade ao avatar+cenario quando os 3 existem
  if (c && a) return 'cenario+avatar';
  if (a && p) return 'avatar+produto';
  if (c) return 'cenario';
  if (p) return 'produto';
  return 'avatar';
}

// Expande o elemento recomendado pela tabela MOP com tudo que o Kit do
// usuário tem disponível. Ex.: tabela recomenda 'avatar' mas o Kit também
// tem cenário → vira 'cenario+avatar' para que o usuário escolha qual aplicar.
export function expandirElementoComKit(
  base: ElementoPersonalizacao,
  kit: { avatar?: string; cenarios?: (string | null)[]; produtos: (string | null)[] },
): ElementoPersonalizacao {
  const atomsBase = decomporElemento(base);
  const atomsKit = elementosAtomicosNoKit(kit);
  // Une preservando o que a tabela já pedia + tudo disponível no Kit.
  const merged = Array.from(new Set<ElementoAtomico>([...atomsBase, ...atomsKit]));
  return comporElemento(merged);
}

// Sugere o elemento padrão para um formato quando a tabela não cobre aquele
// (modelo, segmento, formato) — usado para slots virtuais por extras.
function elementoPadraoParaFormato(formato: SlotFormato, segment: Segment): ElementoPersonalizacao {
  if (segment === 'VAREJO') return 'produto';
  if (segment === 'MARCA') return 'cenario+avatar';
  // SERVIÇOS
  if (formato === 'reels' || formato === 'estatico_final') return 'avatar';
  return 'cenario';
}

// Gera "slots virtuais" para extras que sobraram além do que a tabela
// recomenda. Recebe a contagem de itens visíveis na sequência por formato
// (ex.: { estatico: 2, estatico_final: 1, carrossel: 1, reels: 0 }).
// Devolve slots novos para preencher os formatos cuja cota total > nº de
// slots já listados pela tabela, até o nº de itens disponíveis na sequência.
export interface ItensSequencia {
  estatico: number;       // posicoes existentes (Day 1, Day 2...)
  estatico_final: number;
  carrossel: number;
  reels: number;
  carrosselCardKey?: number; // qual card do carrossel destacar (default 3)
}

export function slotsVirtuaisPorExtras(
  segment: Segment,
  slotsTabela: SlotPersonalizacao[],
  cotaPorTipo: CotaPorTipo,
  itens: ItensSequencia,
): SlotPersonalizacao[] {
  const out: SlotPersonalizacao[] = [];
  const formatos: SlotFormato[] = ['estatico', 'estatico_final', 'carrossel', 'reels'];
  for (const f of formatos) {
    const tipo = tipoDoSlot(f);
    const cota = cotaPorTipo[tipo] || 0;
    if (cota <= 0) continue;
    const jaNaTabela = slotsTabela.filter((s) => s.formato === f).length;
    const totalItens = (itens as any)[f] as number;
    if (!totalItens || totalItens <= 0) continue;
    // Quantos slots adicionais podemos criar = min(cota, itens) - jaNaTabela
    const desejado = Math.min(cota, totalItens);
    const extras = desejado - jaNaTabela;
    if (extras <= 0) continue;
    // Cria slots para as próximas posições não cobertas pela tabela.
    const posicoesCobertas = new Set(
      slotsTabela.filter((s) => s.formato === f).map((s) => s.posicao),
    );
    let criados = 0;
    for (let pos = 1; pos <= totalItens && criados < extras; pos++) {
      if (posicoesCobertas.has(pos)) continue;
      const elemento = elementoPadraoParaFormato(f, segment);
      const slot: SlotPersonalizacao = {
        formato: f,
        posicao: pos,
        elemento,
        motivo: 'Slot liberado por extras de personalização',
      };
      if (f === 'carrossel') slot.cardCarrossel = itens.carrosselCardKey ?? 3;
      out.push(slot);
      criados++;
    }
  }
  return out;
}
