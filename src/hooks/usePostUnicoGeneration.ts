import { useState, useRef, useEffect } from "react";
import type { BrandKit, ImageKit, PostUnicoFormData, PostUnicoVisualSelection } from "../types";
import {
  generatePostUnico,
  generatePostUnicoCaption,
  type PostUnicoCaption,
  type PostUnicoCopy,
} from "../services/postUnico";
import { buildReferences } from "../services/regenerateWithKit";
import { checkCoerencia } from "../core/intencao";
import { detectForcedGenderFromCopy, PersonagemGender } from "../core/visualDirection";
import { loadImageKitAsync } from "../utils/imageKitStorage";
import { lsSetQuotaSafe } from "../lib/storage/store";
import { nextVariacaoSeed } from "../utils/storage";
import { PU_IMG_KEY, PU_STARTED_KEY } from "../lib/storage/keys";

interface Params {
  postUnico: PostUnicoFormData;
  kit: BrandKit;
  imageKit: ImageKit;
  setImageKit: (kit: ImageKit) => void;
  visualSelection: PostUnicoVisualSelection;
  selectedSlot: "plano1" | "plano2" | "bonus";
  effectiveUserId: string | null;
  refreshProfile: () => void;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
}

export function usePostUnicoGeneration({
  postUnico,
  kit,
  imageKit,
  setImageKit,
  visualSelection,
  selectedSlot,
  effectiveUserId,
  refreshProfile,
  setLoading,
  setError,
}: Params) {
  const [postUnicoImg, setPostUnicoImg] = useState<string | undefined>();
  const [postUnicoStarted, setPostUnicoStarted] = useState(false);
  const [caption, setCaption] = useState<PostUnicoCaption | undefined>();
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionError, setCaptionError] = useState("");
  const [puTituloRegen, setPuTituloRegen] = useState(0);
  const [puTextoRegen, setPuTextoRegen] = useState(0);
  const [puCaptionRegen, setPuCaptionRegen] = useState(0);
  const [puCopy, setPuCopy] = useState<PostUnicoCopy | null>(null);
  const [puCopyOriginal, setPuCopyOriginal] = useState<PostUnicoCopy | null>(null);
  const postUnicoGenderRef = useRef<PersonagemGender | undefined>(undefined);
  const lastPuCopyRef = useRef<{ titulo: string; texto: string } | undefined>(undefined);

  useEffect(() => {
    if (puCopy) lastPuCopyRef.current = { titulo: puCopy.titulo, texto: puCopy.texto };
  }, [puCopy]);

  async function handleGenerateCaption() {
    setCaptionLoading(true);
    setCaptionError("");
    try {
      const c = await generatePostUnicoCaption(
        {
          ...postUnico,
          companyName: postUnico.companyName || kit.companyName,
          mainActivity: postUnico.mainActivity || kit.mainActivity || "",
        },
        {
          brandVoice: kit.brandVoice,
          previousCaption: caption?.full,
          // Título/tópicos finais da peça (já com edições manuais) — a legenda
          // precisa continuar o que está escrito na arte, não o keyInfo antigo.
          titulo: puCopy?.titulo,
          topicos: puCopy?.topicos?.map((t) => t.texto),
          // Natureza do negócio — só é lida no servidor quando há intenção
          // declarada (piloto). Ver buildIntencaoBlockLegenda.
          segment: kit.segment,
        },
      );
      setCaption(c);
      setPuCaptionRegen((n) => n + 1);
    } catch (e) {
      setCaptionError(String((e as Error).message || e));
    } finally {
      setCaptionLoading(false);
    }
  }

  async function handleGeneratePostUnico(
    copy?: { titulo: string; texto: string },
    opts?: { regenerate?: boolean },
  ) {
    const isRegenerate = !!opts?.regenerate;
    const effectiveCopy = copy ?? (isRegenerate ? lastPuCopyRef.current : undefined);
    if (copy) lastPuCopyRef.current = copy;
    copy = effectiveCopy;
    setLoading(true);
    setError("");
    setPostUnicoImg(undefined);
    setPostUnicoStarted(true);
    setCaption(undefined);
    setCaptionError("");
    setPuCaptionRegen(0);
    const data = {
      ...postUnico,
      companyName: postUnico.companyName || kit.companyName,
      mainActivity: postUnico.mainActivity || kit.mainActivity || "",
    };
    // Peça de catálogo com "sem legenda também": a loja quer só a imagem para
    // mandar ao cliente e escreve o que quiser por fora. Pular aqui é o que de
    // fato economiza — a legenda é uma chamada de texto paga.
    const catalogo = !!(visualSelection.produtoVestido && visualSelection.lookCatalogo);
    const catalogoSemLegenda = catalogo && !!visualSelection.catalogoSemLegenda;
    if (!catalogoSemLegenda) {
      setCaptionLoading(true);
      generatePostUnicoCaption(data, {
        debit: true,
        brandVoice: kit.brandVoice,
        preferredSlot: selectedSlot,
        // `copy` é o título/texto confirmado deste clique (inclui edição manual);
        // puCopy cobre o caso em que a geração não recebeu copy explícito.
        // No catálogo a imagem não tem título nenhum: ancorar a legenda num
        // título que sobrou no estado de uma peça anterior faria a legenda
        // "continuar" um texto que o cliente nunca vai ver.
        titulo: catalogo ? undefined : copy?.titulo || puCopy?.titulo,
        topicos: catalogo ? undefined : puCopy?.topicos?.map((t) => t.texto),
        // Natureza do negócio — só é lida no servidor quando há intenção
        // declarada (piloto). Este é o clique final: é o evento
        // "gerar_post_unico" daqui que registra a intenção em usage_logs.
        segment: kit.segment,
        avisoCoerenciaIgnorado: !!checkCoerencia(
          postUnico.intencao ?? null,
          postUnico.transformacaoPrincipal ?? null,
          kit.segment,
        ),
      })
        .then((c) => {
          setCaption(c);
          refreshProfile();
        })
        .catch((e) => setCaptionError(String((e as Error).message || e)))
        .finally(() => setCaptionLoading(false));
    }
    try {
      const freshImageKit = await loadImageKitAsync(effectiveUserId).catch(() => imageKit);
      setImageKit(freshImageKit);
      // O gênero/idade do personagem sem avatar já vêm semeados a partir de
      // generoPref/faixaEtaria só na ATIVAÇÃO do checkbox (ver
      // PersonagemSemAvatarBlock.tsx) — depois disso, o toggle manual "Trocar
      // p/ Feminino"/select de idade é a fonte da verdade. Reaplicar o
      // override aqui a cada geração sobrescrevia silenciosamente a escolha
      // manual do usuário de volta para o valor do formulário inicial
      // (achado 16/07/2026).
      // "Peça sem personagem" vence qualquer personagem que tenha ficado
      // marcado antes (a UI já desmarca, isto cobre estado restaurado do
      // localStorage de uma sessão anterior).
      const semPersonagem = !!visualSelection.semPersonagem;
      const personagemSemAvatar =
        !semPersonagem && visualSelection.personagemSemAvatar?.ativo
          ? visualSelection.personagemSemAvatar
          : undefined;
      const references = buildReferences(
        "avatar",
        freshImageKit,
        undefined,
        undefined,
        {
          usarAvatar: semPersonagem ? false : visualSelection.useAvatar,
          avatarNum: visualSelection.avatarSelecionado ?? 1,
          usarFachada: visualSelection.useFachada,
          cenarioNum: visualSelection.useCenario ? (visualSelection.cenarioSelecionado ?? 1) : null,
          produtosNums: visualSelection.useProdutos
            ? visualSelection.produtosSelecionados
            : undefined,
          useUniforme: semPersonagem ? false : visualSelection.useUniforme,
          personagemSemAvatar,
          semPersonagem,
          produtoTelaInformativa: visualSelection.produtoTelaInformativa,
          produtoVestido: visualSelection.produtoVestido,
          lookCatalogo: visualSelection.lookCatalogo,
        },
        kit.uniformeDataUrl,
      );
      if (visualSelection.useFato && freshImageKit.fato) references.fato = freshImageKit.fato;
      if (visualSelection.useVenda && freshImageKit.venda) references.venda = freshImageKit.venda;
      const hasRefs = !!(
        references.avatar ||
        references.fachada ||
        references.cenario ||
        references.produtos?.length ||
        references.uniforme ||
        references.personagemSemAvatarAtivo ||
        references.semPersonagemAtivo ||
        references.fato ||
        references.venda
      );
      const formGender: PersonagemGender | null =
        data.generoPref === "F" ? "mulher" : data.generoPref === "M" ? "homem" : null;
      if (postUnicoGenderRef.current === undefined) {
        postUnicoGenderRef.current =
          detectForcedGenderFromCopy(copy?.titulo, copy?.texto) ??
          (Math.random() < 0.5 ? "mulher" : "homem");
      }
      // Sem personagem não existe gênero a forçar: mandar um aqui reativaria o
      // bloco "a pessoa retratada DEVE ser X" (genderSafetyBlock em
      // buildPuPrompt / genderBlock nos moods), que é justamente o que faz a
      // peça sair com gente mesmo sem avatar.
      const effectiveForcedGender: PersonagemGender | undefined = semPersonagem
        ? undefined
        : ((personagemSemAvatar?.genero as PersonagemGender | undefined) ??
          formGender ??
          postUnicoGenderRef.current);
      // Posição desta peça na fila de variação visual do usuário — a MESMA fila
      // que o MOP já usa (useMopHandlers). Ela rege paleta, arquétipo e os cinco
      // eixos de câmera desta peça.
      //
      // Até 13/08/2026 a PU tinha fila PRÓPRIA e mais pobre: um seed sorteado
      // por sessão com Math.floor(Math.random() * 5) guardado em useRef, mais um
      // contador de tentativas. Três defeitos vinham disso, e todos batiam
      // exatamente no que o "arco visual na PU" queria resolver:
      //   1. só 5 posições iniciais possíveis — o ciclo dos eixos de câmera é 12
      //      (CLAREZA, IMPACTO, SILÊNCIO) e 60 (DESVIO), então a cauda da fila
      //      NUNCA era visitada na primeira peça de uma sessão;
      //   2. sem memória entre peças — cada peça nova resorteava, com 1 em 5 de
      //      chance de cair na MESMA posição da anterior, ou seja, mesma câmera,
      //      mesma paleta e mesmo arquétipo em peças seguidas;
      //   3. sem persistência — recarregar a página zerava tudo.
      // nextVariacaoSeed resolve os três: contador inteiro em localStorage,
      // escopado por usuário, que só anda para a frente.
      const tonalidadeSeed = nextVariacaoSeed(effectiveUserId);
      const dataUrl = await generatePostUnico({
        data,
        kit,
        copy,
        references: hasRefs ? references : undefined,
        preferredSlot: selectedSlot,
        forcedGender: effectiveForcedGender,
        variationHint: isRegenerate,
        tonalidadeSeed,
      });
      lsSetQuotaSafe(PU_IMG_KEY, JSON.stringify(dataUrl), effectiveUserId);
      lsSetQuotaSafe(PU_STARTED_KEY, "false", effectiveUserId);
      setPostUnicoImg(dataUrl);
      refreshProfile();
    } catch (e) {
      lsSetQuotaSafe(PU_STARTED_KEY, "false", effectiveUserId);
      setError(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }

  function clearPostUnicoState() {
    setPostUnicoImg(undefined);
    setPostUnicoStarted(false);
    setCaption(undefined);
    setCaptionError("");
    postUnicoGenderRef.current = undefined;
    // A fila de variação NÃO se reseta aqui: ela é do usuário, não da peça, e é
    // justamente a memória entre peças que faz a próxima não repetir a câmera da
    // anterior. Zerá-la aqui era o defeito nº 2 descrito em handleGeneratePostUnico.
    lastPuCopyRef.current = undefined;
    setPuTituloRegen(0);
    setPuTextoRegen(0);
    setPuCaptionRegen(0);
    setPuCopy(null);
    setPuCopyOriginal(null);
  }

  return {
    postUnicoImg,
    setPostUnicoImg,
    postUnicoStarted,
    setPostUnicoStarted,
    caption,
    setCaption,
    captionLoading,
    captionError,
    setCaptionError,
    puTituloRegen,
    setPuTituloRegen,
    puTextoRegen,
    setPuTextoRegen,
    puCaptionRegen,
    puCopy,
    setPuCopy,
    puCopyOriginal,
    setPuCopyOriginal,
    handleGeneratePostUnico,
    handleGenerateCaption,
    clearPostUnicoState,
  };
}
