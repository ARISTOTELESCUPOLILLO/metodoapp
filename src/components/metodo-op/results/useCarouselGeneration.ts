// Geração de imagem dos cards do carrossel (individual, com/sem refs do Kit
// Imagem, e "gerar todos") — extraído de CarouselCardBlock.tsx (PLANO_V2
// Fase 9.1). Lógica movida 1:1, sem mudança de comportamento.
import { useState } from "react";
import { lsGetRaw } from "../../../lib/storage/store";
import { BrandKit, CarouselCard, FeedItem, ImageKit, MoodCode } from "../../../types";
import { PersonagemGender } from "../../../core/visualDirection";
import { generatePostImage } from "../../../services/api";
import { composeFeedPng } from "../../../utils/canvasComposer";
import { emptyImageKit } from "../../../utils/imageKitStorage";
import { getSessionImage, setSessionImage } from "../../../utils/sessionImageCache";
import { regenerateWithKit } from "../../../services/regenerateWithKit";
import { useImageGenAlert } from "../PreImageAlert";
import { useRefSelection } from "../UsoReferenciasDia";
import { BRAND_ACCENT } from "../../../data/brandColors";
import { GENERATE_ALL_CONCURRENCY, runWithConcurrency } from "./utils";

// Distribuição de fotos de produto selecionadas (Kit Imagem) pelos cards do
// carrossel de VAREJO — sem misturar produtos fora do conteúdo (só usa as
// fotos selecionadas pelo usuário para este bloco).
//
// Cobertura completa (fotos marcadas >= nº de cards): 1 foto distinta por
// card, na ordem em que foram marcadas (o numerinho que aparece ao marcar
// cada tile) — card 1 = foto 1, card 2 = foto 2, etc., sempre como produto
// inteiro. Sem reaproveitamento, então não há por que recortar em detalhe.
//
// Cobertura parcial (menos fotos que cards): 1ª foto = card inicial (produto
// inteiro); última foto selecionada = card final (produto inteiro); fotos do
// meio (se houver) são distribuídas entre os cards centrais em modo
// detalhe/recorte — se não houver foto dedicada para um card central, repete
// (round-robin) uma das fotos do meio (ou a única foto, se só 1 selecionada)
// em modo detalhe.
function distributeProduto(
  produtosNums: number[],
  index: number,
  total: number,
): { num: number; isFull: boolean } | null {
  if (!produtosNums.length) return null;
  if (produtosNums.length >= total) {
    return { num: produtosNums[index], isFull: true };
  }
  if (index === 0) return { num: produtosNums[0], isFull: true };
  if (index === total - 1) return { num: produtosNums[produtosNums.length - 1], isFull: true };
  const middlePool = produtosNums.length >= 3 ? produtosNums.slice(1, -1) : produtosNums;
  const m = index - 1;
  return { num: middlePool[m % middlePool.length], isFull: false };
}

export function useCarouselGeneration(params: {
  cards: CarouselCard[];
  kit: BrandKit;
  mood: MoodCode;
  dayNumber: number;
  segmento: BrandKit["segment"];
  imageKit?: ImageKit;
  userId?: string | null;
  forcedGenders: PersonagemGender[];
  anchoraPersonagem?: string;
  ancoragePapel?: string;
  onImageGenerated?: () => void;
  guard: ReturnType<typeof useImageGenAlert>["guard"];
  titulos: string[];
  textos: string[];
  blockStorageKey: string;
}) {
  const {
    cards,
    kit,
    mood,
    dayNumber,
    segmento,
    imageKit,
    userId,
    forcedGenders,
    anchoraPersonagem,
    ancoragePapel,
    onImageGenerated,
    guard,
    titulos,
    textos,
    blockStorageKey,
  } = params;

  const blockSel = useRefSelection(blockStorageKey);

  const [previews, setPreviews] = useState<(string | null)[]>(() =>
    cards.map((c) => getSessionImage(userId, `carousel:${dayNumber}:${c.card}`)),
  );
  function updatePreview(index: number, value: string) {
    setPreviews((prev) => prev.map((p, i) => (i === index ? value : p)));
    setSessionImage(userId, `carousel:${dayNumber}:${cards[index].card}`, value);
  }
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [busyMode, setBusyMode] = useState<"noref" | "refs" | null>(null);
  const [busyAllMode, setBusyAllMode] = useState<"refs" | "noref" | null>(null);
  const busyAll = busyAllMode !== null;
  const [allProgress, setAllProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirmKind, setConfirmKind] = useState<"noref" | "refs" | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function runGenerate(index: number) {
    setBusyIndex(index);
    setBusyMode("noref");
    try {
      const card = cards[index];
      const url = await generatePostImage({
        imagePrompt: card.imagePrompt,
        titulo: titulos[index],
        texto: textos[index],
        companyName: kit.companyName,
        mainActivity: kit.mainActivity,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || BRAND_ACCENT,
        fontFamily: kit.fontPair || "Montserrat",
        secondaryFont: kit.secondaryFont,
        mood,
        vertical: "post",
        logoPosition: kit.logoPosition,
        leituraCenica: card.leituraCenica,
        forcedGender: forcedGenders[index],
        anchoraPersonagem,
        ancoragePapel,
      });
      const item: FeedItem = {
        dia: dayNumber,
        formato: "Carrossel",
        titulo: titulos[index],
        texto: textos[index],
        legenda: "",
        imagem: card.imagePrompt,
      };
      const final = await composeFeedPng(kit, item, url);
      updatePreview(index, final);
      onImageGenerated?.();
    } catch (e) {
      setErrMsg(`Erro ao gerar card: ${(e as Error).message}`);
    } finally {
      setBusyIndex(null);
      setBusyMode(null);
    }
  }

  function handleGenerate(index: number) {
    guard({ hasPreview: !!previews[index], tipo: "Carrossel", run: () => runGenerate(index) });
  }

  function handleGenerateWithRefs(index: number) {
    guard({
      hasPreview: !!previews[index],
      tipo: "Carrossel",
      run: () => runGenerateWithRefs(index),
    });
  }

  // Lê seleção efetiva para um card: prefere storage do bloco (consolidado)
  // mapeando card[i] → produto[i]; fallback para storage individual por card.
  function selecaoParaCard(index: number): {
    usarAvatar: boolean;
    avatarNum: 1 | 2 | null;
    usarFachada?: boolean;
    cenarioNum: number | null;
    produtosNums: number[];
    produtoDetalhe?: boolean;
    useUniforme?: boolean;
    produtoTelaInformativa?: boolean;
  } | null {
    const card = cards[index];
    // Migração do formato antigo (usarAvatar boolean) → avatarNum (1|2|null).
    const avatarNumDe = (j: { avatarNum?: unknown; usarAvatar?: unknown }): 1 | 2 | null =>
      typeof j.avatarNum === "number" ? (j.avatarNum as 1 | 2) : j.usarAvatar ? 1 : null;
    // 1) Bloco consolidado
    try {
      const raw = lsGetRaw(blockStorageKey);
      if (raw) {
        const j = JSON.parse(raw);
        if (j.enabled) {
          // Filtra fantasmas (números de uma seleção anterior cuja foto não
          // existe mais no Kit) — sem isso o índice aponta pra produto nulo e
          // o card sai sem produto na geração.
          const produtos: number[] = Array.isArray(j.produtosNums)
            ? j.produtosNums.filter(
                (n: unknown) => typeof n === "number" && !!imageKit?.produtos[n - 1],
              )
            : [];
          const avatarNum = avatarNumDe(j);
          // VAREJO: distribui as fotos selecionadas pelos cards (1ª/última =
          // produto inteiro, meio = detalhe/recorte) — ver distributeProduto.
          if (segmento === "VAREJO") {
            const d = distributeProduto(produtos, index, cards.length);
            return {
              usarAvatar: avatarNum != null,
              avatarNum,
              usarFachada: !!j.usarFachada,
              cenarioNum: typeof j.cenarioNum === "number" ? j.cenarioNum : null,
              produtosNums: d ? [d.num] : [],
              produtoDetalhe: d ? !d.isFull : false,
              useUniforme: avatarNum != null && !!j.useUniforme,
              produtoTelaInformativa: produtos.length > 0 && !!j.produtoTelaInformativa,
            };
          }
          // Outros segmentos: 1 produto por card, revezando entre os
          // selecionados (round-robin) em vez de travar no produto[0] quando
          // há mais cards do que produtos selecionados.
          const pick = produtos.length ? produtos[index % produtos.length] : null;
          return {
            usarAvatar: avatarNum != null,
            avatarNum,
            usarFachada: !!j.usarFachada,
            cenarioNum: typeof j.cenarioNum === "number" ? j.cenarioNum : null,
            produtosNums: pick != null ? [pick] : [],
            useUniforme: avatarNum != null && !!j.useUniforme,
            produtoTelaInformativa: pick != null && !!j.produtoTelaInformativa,
          };
        }
      }
    } catch {
      /* ignore */
    }
    // 2) Storage individual por card (legacy)
    try {
      const raw = lsGetRaw(`uso-ref:carrossel:${dayNumber}:c${card.card}`);
      if (!raw) return null;
      const j = JSON.parse(raw);
      if (!j.enabled) return null;
      const avatarNum = avatarNumDe(j);
      return {
        usarAvatar: avatarNum != null,
        avatarNum,
        usarFachada: !!j.usarFachada,
        cenarioNum: typeof j.cenarioNum === "number" ? j.cenarioNum : null,
        produtosNums: Array.isArray(j.produtosNums) ? j.produtosNums : [],
        useUniforme: avatarNum != null && !!j.useUniforme,
        produtoTelaInformativa: !!j.produtoTelaInformativa,
      };
    } catch {
      return null;
    }
  }

  async function runGenerateWithRefs(index: number) {
    const s = selecaoParaCard(index);
    if (!s) return;
    const card = cards[index];
    setBusyIndex(index);
    setBusyMode("refs");
    try {
      const url = await regenerateWithKit({
        slot: {
          formato: "carrossel",
          posicao: dayNumber,
          elemento: "avatar",
          cardCarrossel: card.card,
          motivo: "",
        },
        kit,
        imageKit: imageKit ?? emptyImageKit,
        mood,
        keyInfo: `${card.titulo || ""}. ${card.imagePrompt || ""}`.slice(0, 500),
        titulo: titulos[index],
        texto: textos[index],
        imagePrompt: card.imagePrompt,
        leituraCenica: card.leituraCenica,
        formato: "post",
        selecaoDireta: s,
        anchoraPersonagem,
        ancoragePapel,
        forcedGender: forcedGenders[index],
        userId,
      });
      const item: FeedItem = {
        dia: dayNumber,
        formato: "Carrossel",
        titulo: titulos[index],
        texto: textos[index],
        legenda: "",
        imagem: card.imagePrompt,
      };
      const final = await composeFeedPng(kit, item, url);
      updatePreview(index, final);
      onImageGenerated?.();
    } catch (e) {
      setErrMsg(`Erro ao gerar card: ${(e as Error).message}`);
    } finally {
      setBusyIndex(null);
      setBusyMode(null);
    }
  }

  // Gera os N cards em sequência SEM imagens de referência.
  async function runGenerateAll() {
    setConfirmKind(null);
    setBusyAllMode("noref");
    const total = cards.length;
    const failures: number[] = [];
    let done = 0;
    setAllProgress({ done: 0, total });
    try {
      await runWithConcurrency(cards, GENERATE_ALL_CONCURRENCY, async (card, i) => {
        try {
          const url = await generatePostImage({
            imagePrompt: card.imagePrompt,
            titulo: titulos[i],
            texto: textos[i],
            companyName: kit.companyName,
            mainActivity: kit.mainActivity,
            primaryColor: kit.primaryColor,
            accentColor: kit.accentColor || BRAND_ACCENT,
            fontFamily: kit.fontPair || "Montserrat",
            secondaryFont: kit.secondaryFont,
            mood,
            vertical: "post",
            logoPosition: kit.logoPosition,
            leituraCenica: card.leituraCenica,
            forcedGender: forcedGenders[i],
            anchoraPersonagem,
            ancoragePapel,
          });
          const item: FeedItem = {
            dia: dayNumber,
            formato: "Carrossel",
            titulo: titulos[i],
            texto: textos[i],
            legenda: "",
            imagem: card.imagePrompt,
          };
          const final = await composeFeedPng(kit, item, url);
          updatePreview(i, final);
        } catch (err) {
          console.error(`Falha card ${i + 1}:`, err);
          failures.push(i + 1);
        } finally {
          done++;
          setAllProgress({ done, total });
        }
      });
      if (failures.length) {
        failures.sort((a, b) => a - b);
        setErrMsg(
          `${failures.length} de ${total} card(s) falharam (cards ${failures.join(", ")}). Use "⬇ Gerar card" no card para tentar de novo.`,
        );
      } else {
        onImageGenerated?.();
      }
    } finally {
      setBusyAllMode(null);
      setTimeout(() => setAllProgress(null), 1500);
    }
  }

  // Gera os N cards em sequência usando refs consolidadas do bloco.
  async function runGenerateAllWithRefs() {
    if (!blockSel.hasAny) return;
    setConfirmKind(null);
    setBusyAllMode("refs");
    const total = cards.length;
    const failures: number[] = [];
    const skipped: number[] = [];
    let done = 0;
    setAllProgress({ done: 0, total });
    try {
      await runWithConcurrency(cards, GENERATE_ALL_CONCURRENCY, async (card, i) => {
        try {
          const s = selecaoParaCard(i);
          if (!s) {
            skipped.push(i + 1);
            return;
          }
          const url = await regenerateWithKit({
            slot: {
              formato: "carrossel",
              posicao: dayNumber,
              elemento: "avatar",
              cardCarrossel: card.card,
              motivo: "",
            },
            kit,
            imageKit: imageKit ?? emptyImageKit,
            mood,
            keyInfo: `${card.titulo || ""}. ${card.imagePrompt || ""}`.slice(0, 500),
            titulo: titulos[i],
            texto: textos[i],
            imagePrompt: card.imagePrompt,
            leituraCenica: card.leituraCenica,
            formato: "post",
            selecaoDireta: s,
            anchoraPersonagem,
            ancoragePapel,
            forcedGender: forcedGenders[i],
            userId,
          });
          const item: FeedItem = {
            dia: dayNumber,
            formato: "Carrossel",
            titulo: titulos[i],
            texto: textos[i],
            legenda: "",
            imagem: card.imagePrompt,
          };
          const final = await composeFeedPng(kit, item, url);
          updatePreview(i, final);
        } catch (err) {
          console.error(`Falha card ${i + 1}:`, err);
          failures.push(i + 1);
        } finally {
          done++;
          setAllProgress({ done, total });
        }
      });
      if (failures.length || skipped.length) {
        failures.sort((a, b) => a - b);
        skipped.sort((a, b) => a - b);
        const partes: string[] = [];
        if (failures.length)
          partes.push(`${failures.length} falharam (cards ${failures.join(", ")})`);
        if (skipped.length)
          partes.push(
            `${skipped.length} sem seleção de referência válida (cards ${skipped.join(", ")})`,
          );
        setErrMsg(
          `Geração com referências: ${partes.join("; ")}. Use o botão "↻ Gerar outra com refs" no card para tentar de novo.`,
        );
      } else {
        onImageGenerated?.();
      }
    } finally {
      setBusyAllMode(null);
      setTimeout(() => setAllProgress(null), 1500);
    }
  }

  return {
    blockSel,
    previews,
    busyIndex,
    busyMode,
    busyAllMode,
    busyAll,
    allProgress,
    confirmKind,
    setConfirmKind,
    errMsg,
    setErrMsg,
    handleGenerate,
    handleGenerateWithRefs,
    runGenerateAll,
    runGenerateAllWithRefs,
  };
}
