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
  // "Peça sem personagem" (PU) é exclusivo com qualquer forma de personagem: a
  // UI já impede marcar os dois, e aqui a exclusão é reforçada no motor para
  // que nenhum caminho (restauração de localStorage antigo, chamada
  // programática) consiga enviar avatar/uniforme junto do flag.
  const semPersonagem = !!selecaoDireta?.semPersonagem;
  const wantsAvatar =
    !semPersonagem &&
    (selecaoDireta
      ? selecaoDireta.usarAvatar
      : elemento === "avatar" || elemento === "cenario+avatar" || elemento === "avatar+produto");
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
      // Até 2026-07-08 esta flag era degradada (nunca ligava) quando havia
      // avatar na mesma geração — investigação de 2026-07-07 (Opus 4.8 +
      // Fable 5) achou vazamento de conteúdo de tela pra tampa/carcaça nessa
      // combinação, hipótese "bleeding" entre duas referências fotorrealistas
      // sobrepostas (avatar segurando o produto, rosto colado na tela).
      // Revertido em 2026-07-08 (achado real: dilema AJUSTE_CONFLITO, avatar+
      // uniforme+produto-tela em SERVIÇOS): a causa do bleeding era a
      // SOBREPOSIÇÃO ESPACIAL (produto nas mãos/perto do rosto), não a mera
      // presença de avatar — o novo modo "PRODUTO EXPOSTO — NÃO EM USO"
      // (buildDeviceRule) já impõe que o dispositivo fique separado do
      // personagem (apoiado numa superfície, fora das mãos), o que remove a
      // condição que causava o vazamento. Sem essa flag ligada, a tela nunca
      // era pedida fiel com avatar presente — causa raiz de 2 das 3 imagens
      // de teste do dilema.
      if (selecaoDireta?.produtoTelaInformativa) refs.produtoTelaInformativa = true;
      // Marca que o produto É um dispositivo digital SEMPRE que o usuário
      // marcou o checkbox — inclusive com avatar, quando a nitidez de tela
      // acima foi degradada. Sem essa flag, buildDeviceRule via só "há produto
      // físico + sem nitidez de tela" e tomava o ramo que PROÍBE todo
      // dispositivo, transformando o tablet num objeto genérico (pasta, placa)
      // — bug real 2026-07-08. Aqui só preserva o FATO de que é dispositivo;
      // a decisão de forçar (ou não) nitidez de tela continua sendo do flag
      // produtoTelaInformativa acima.
      if (selecaoDireta?.produtoTelaInformativa) refs.produtoEhDispositivo = true;
    }
  }
  // Uniforme: veste o avatar (quando presente) OU cria um personagem do zero
  // sem avatar — mesma capacidade que antes só existia na PU. A idade do
  // personagem sem avatar vale sempre que ativo, com ou sem uniforme — ele
  // representa o público-alvo por padrão; o uniforme só entra quando o
  // usuário escolhe explicitamente que esse personagem é o EMISSOR
  // (comUniforme=true) e há uma foto de uniforme cadastrada.
  // Look book — o personagem veste a peça. Ligado por último porque depende de
  // duas condições já resolvidas acima: existir produto e existir pessoa. Sem
  // alguém para vestir (peça sem personagem, ou nenhum personagem marcado), o
  // modo simplesmente não se aplica e a geração volta ao padrão (peça exposta),
  // em vez de emitir uma instrução que aponta para ninguém.
  const temPessoa = !!refs.avatar || !!selecaoDireta?.personagemSemAvatar?.ativo;
  if (selecaoDireta?.produtoVestido && refs.produtos?.length && !semPersonagem && temPessoa) {
    refs.produtoVestido = selecaoDireta.produtoVestido;
  }
  if (semPersonagem) {
    refs.semPersonagemAtivo = true;
  } else if (selecaoDireta?.useUniforme && refs.avatar && uniformeDataUrl && !refs.produtoVestido) {
    // Uniforme e look book disputam a mesma coisa — o corpo do personagem. No
    // look book quem veste é o produto; mandar as duas roupas no mesmo prompt
    // faria a IA escolher uma por conta própria. A UI já impede marcar os dois,
    // e aqui a exclusão é reforçada no motor.
    refs.uniforme = uniformeDataUrl;
  } else if (!refs.avatar && selecaoDireta?.personagemSemAvatar?.ativo) {
    refs.personagemSemAvatarAtivo = true;
    refs.personagemIdade = selecaoDireta.personagemSemAvatar.idade;
    if (selecaoDireta.personagemSemAvatar.comUniforme && uniformeDataUrl && !refs.produtoVestido) {
      refs.uniforme = uniformeDataUrl;
    }
  }
  return refs;
}
