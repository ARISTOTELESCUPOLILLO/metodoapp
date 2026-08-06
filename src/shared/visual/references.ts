// Tipos e utilitários de referências visuais compartilhados entre MOP e PU.
// Fonte única para PostUnicoReferences e orderedReferenceImages — antes ambos
// viviam em postUnico.ts e regenerateWithKit.ts importava de lá, criando
// uma dependência MOP → PU conceitualmente invertida.

import type { TipoPecaVestuario } from "../../domain/visualSelection";

export interface PostUnicoReferences {
  avatar?: string;
  // Foto da fachada/frente do estabelecimento — slot próprio no Kit Imagem,
  // independente do cenário (antes era um "tipo" de cenário).
  fachada?: string;
  cenario?: string;
  produtos?: { num: number; dataUrl: string }[];
  // Foto do uniforme da empresa (kit.uniformeDataUrl) — veste o personagem
  // da peça com esta peça de roupa em vez do figurino livre sorteado.
  uniforme?: string;
  // Faixa etária do personagem sem avatar (ex.: "30–40 anos") — ver
  // PERSONAGEM OBRIGATÓRIO em referencesBlock.
  personagemIdade?: string;
  // Personagem sem avatar ativo — representa o público-alvo por padrão
  // (figurino livre); veste uniforme apenas quando refs.uniforme também
  // está presente (usuário escolheu que esse personagem é o emissor).
  personagemSemAvatarAtivo?: boolean;
  // Peça sem nenhuma pessoa na imagem — desliga as instruções que afirmam
  // personagem (gênero obrigatório, personagem no cenário, papel do
  // público-alvo) e declara o sujeito alternativo da composição. Ver
  // core/semPersonagem.ts. Nunca coexiste com avatar/uniforme/
  // personagemSemAvatarAtivo.
  semPersonagemAtivo?: boolean;
  // Foto de um acontecimento (Kit Imagem, slot próprio) — objetivo "Fatos",
  // aplicação direta sem reinvenção pela IA.
  fato?: string;
  // Foto de colaborador com o produto (Kit Imagem, slot próprio) — objetivo
  // "Venda", mesmo tratamento de preservação do "Fato".
  venda?: string;
  // O(s) produto(s) referenciados são, eles mesmos, uma tela/dispositivo cujo
  // conteúdo exibido é a identidade do produto — suspende a regra global de
  // desfoque de tela (buildDeviceRule) para esta geração. Ver
  // PostUnicoVisualSelection.produtoTelaInformativa.
  produtoTelaInformativa?: boolean;
  // O produto referenciado é ele mesmo um DISPOSITIVO DIGITAL (tablet, notebook,
  // celular, monitor) — FATO físico do produto, independente de forçar nitidez
  // de tela. Preserva esse fato mesmo quando produtoTelaInformativa é degradado
  // por causa do avatar presente (ver buildReferences): sem ele, buildDeviceRule
  // toma o ramo "produto físico → proibir todo dispositivo" e transforma o
  // tablet num objeto genérico (pasta, placa) — bug real 2026-07-08.
  produtoEhDispositivo?: boolean;
  // Modo look book: o personagem VESTE o produto referenciado, em pose e
  // enquadramento de modelo. O valor é o tipo da peça e determina o
  // enquadramento obrigatório (ver TipoPecaVestuario e core/lookBook.ts).
  // Só é preenchido quando há produto E pessoa em cena — sem alguém para vestir
  // a peça, o modo não faz sentido e volta ao padrão (produto exposto).
  produtoVestido?: TipoPecaVestuario;
  // Modo CATÁLOGO: peça de look book SEM nenhum texto na imagem, com a modelo
  // centrada — só a logomarca, aplicada depois. Só é preenchido junto com
  // produtoVestido (ver buildReferences e core/lookBook.ts).
  lookCatalogo?: boolean;
}

// Ordem fixa das imagens de referência enviadas ao modelo: avatar -> uniforme
// -> fachada -> cenário -> fato -> venda -> produtos (por número) — espelha
// a sequência do Kit Imagem (Identidade: avatar/uniforme/fachada; depois
// Ambiente: cenário; depois Fato/Venda, documentais). Compartilhada entre PU
// e MOP — os rótulos "IMAGEM #N" só fazem sentido se essa ordem for idêntica
// nos dois motores, e antes cada um tinha sua própria cópia (refsToArray/buildRefs).
export function orderedReferenceImages(
  refs?: PostUnicoReferences,
  opts?: { withAvatar?: boolean },
): string[] {
  if (!refs) return [];
  const withAvatar = opts?.withAvatar ?? true;
  const imgs: string[] = [];
  if (withAvatar && refs.avatar) imgs.push(refs.avatar);
  if (refs.uniforme) imgs.push(refs.uniforme);
  if (refs.fachada) imgs.push(refs.fachada);
  if (refs.cenario) imgs.push(refs.cenario);
  if (refs.fato) imgs.push(refs.fato);
  if (refs.venda) imgs.push(refs.venda);
  if (refs.produtos?.length) {
    for (const p of [...refs.produtos].sort((a, b) => a.num - b.num)) {
      imgs.push(p.dataUrl);
    }
  }
  return imgs;
}
