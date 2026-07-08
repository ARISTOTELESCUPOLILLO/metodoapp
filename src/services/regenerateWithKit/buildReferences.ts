// Fonte única de montagem de referências (avatar/cenário/produtos/uniforme)
// — usada pelo MOP (regenerateWithKit.ts) e pela PU (usePostUnicoGeneration.ts),
// que antes montava o objeto `references` manualmente e por isso só ela
// suportava "personagem sem avatar + uniforme". Extraído de
// regenerateWithKit.ts (PLANO_V2 Fase 9.1) — movido 1:1, sem mudança de
// comportamento. Reexportado por regenerateWithKit.ts para manter os
// imports existentes (usePostUnicoGeneration.ts, __tests__/buildReferences.test.ts)
// funcionando sem alteração.
import type { ImageKit } from "../../types";
import type { SelecaoDireta } from "../../domain/visualSelection";
import type { PostUnicoReferences } from "../../shared/visual/references";
import type { ElementoPersonalizacao } from "../../core/personalizacaoMop";

export function buildReferences(
  elemento: ElementoPersonalizacao,
  imageKit: ImageKit,
  produtosSelecionados?: number[],
  cenarioSelecionado?: number | null,
  selecaoDireta?: SelecaoDireta,
  uniformeDataUrl?: string,
): PostUnicoReferences {
  const refs: PostUnicoReferences = {};
  const wantsAvatar = selecaoDireta
    ? selecaoDireta.usarAvatar
    : elemento === "avatar" || elemento === "cenario+avatar" || elemento === "avatar+produto";
  const wantsFachada = !!selecaoDireta?.usarFachada;
  const wantsCenario = selecaoDireta
    ? selecaoDireta.cenarioNum != null
    : elemento === "cenario" || elemento === "cenario+avatar";
  const wantsProduto = selecaoDireta
    ? !!(selecaoDireta.produtosNums && selecaoDireta.produtosNums.length)
    : elemento === "produto" || elemento === "avatar+produto";
  const cenarioPick = selecaoDireta
    ? (selecaoDireta.cenarioNum ?? null)
    : (cenarioSelecionado ?? null);
  const produtosPick = selecaoDireta
    ? (selecaoDireta.produtosNums ?? [])
    : (produtosSelecionados ?? []);

  if (wantsAvatar) {
    const avatarNum = selecaoDireta?.avatarNum ?? 1;
    const avatarUrl = avatarNum === 2 ? imageKit.avatar2 || imageKit.avatar : imageKit.avatar;
    if (avatarUrl) refs.avatar = avatarUrl;
  }
  if (wantsFachada && imageKit.fachada) {
    refs.fachada = imageKit.fachada;
  }
  if (wantsCenario) {
    const idx = (cenarioPick ?? 1) - 1;
    const fallbackIdx = imageKit.cenarios.findIndex((c) => !!c);
    const finalIdx = imageKit.cenarios[idx] ? idx : fallbackIdx;
    const chosen = finalIdx >= 0 ? imageKit.cenarios[finalIdx] : null;
    if (chosen) {
      refs.cenario = chosen;
    }
  }
  if (wantsProduto) {
    const nums = produtosPick.length
      ? produtosPick
      : imageKit.produtos.map((p, i) => (p ? i + 1 : null)).filter((n): n is number => n !== null);
    const lista = nums
      .map((n) => {
        const url = imageKit.produtos[n - 1];
        return url ? { num: n, dataUrl: url } : null;
      })
      .filter((p): p is { num: number; dataUrl: string } => p !== null);
    if (lista.length) {
      refs.produtos = lista;
      // Degrada pro tratamento padrão de tela (sem forçar nitidez total)
      // quando há avatar ativo na mesma geração — investigação real
      // (2026-07-07, revisão cruzada Opus 4.8 + Fable 5) achou vazamento de
      // conteúdo de tela pra tampa/carcaça repetidamente nessa combinação
      // (avatar + produto-tela), mesmo após reforçar bastante o texto de
      // contenção; a hipótese é "bleeding" entre duas referências do mesmo
      // domínio fotorrealista, que texto de prompt sozinho não resolve. Sem
      // avatar (produto+cenário, por exemplo), o caso de uso real do
      // checkbox (produto digital como herói solo) permanece intacto.
      if (selecaoDireta?.produtoTelaInformativa && !refs.avatar) refs.produtoTelaInformativa = true;
    }
  }
  // Uniforme: veste o avatar (quando presente) OU cria um personagem do zero
  // sem avatar — mesma capacidade que antes só existia na PU. A idade do
  // personagem sem avatar vale sempre que ativo, com ou sem uniforme — ele
  // representa o público-alvo por padrão; o uniforme só entra quando o
  // usuário escolhe explicitamente que esse personagem é o EMISSOR
  // (comUniforme=true) e há uma foto de uniforme cadastrada.
  if (selecaoDireta?.useUniforme && refs.avatar && uniformeDataUrl) {
    refs.uniforme = uniformeDataUrl;
  } else if (!refs.avatar && selecaoDireta?.personagemSemAvatar?.ativo) {
    refs.personagemSemAvatarAtivo = true;
    refs.personagemIdade = selecaoDireta.personagemSemAvatar.idade;
    if (selecaoDireta.personagemSemAvatar.comUniforme && uniformeDataUrl) {
      refs.uniforme = uniformeDataUrl;
    }
  }
  return refs;
}
