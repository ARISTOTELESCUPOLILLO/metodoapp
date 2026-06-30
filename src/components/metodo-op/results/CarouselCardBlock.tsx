import { useEffect, useMemo, useRef, useState } from "react";
import { lsGetRaw } from "../../../lib/storage/store";
import { BrandKit, CarouselCard, FeedItem, MoodCode } from "../../../types";
import { PersonagemGender } from "../../../core/visualDirection";
import { type RegenKind } from "../../../services/regenerateBlock";
import { generatePostImage } from "../../../services/api";
import { composeFeedPng, downloadDataUrl } from "../../../utils/canvasComposer";
import { mopName } from "../../../utils/file";
import { emptyImageKit } from "../../../utils/imageKitStorage";
import { getSessionImage, setSessionImage } from "../../../utils/sessionImageCache";
import { loadCopyEdit, saveCopyEdit } from "../../../utils/copyEditsStorage";
import { regenerateWithKit } from "../../../services/regenerateWithKit";
import { useIsMobile } from "../../../hooks/use-mobile";
import { ArchiveButton } from "../ArchiveButton";
import UsoReferenciasDia, { useRefSelection } from "../UsoReferenciasDia";
import { useImageGenAlert } from "../PreImageAlert";
import { EditableField } from "./EditableField";
import { RefSelectorProps, RefsRegenButton } from "./RefsRegenButton";
import ConfirmDialog from "../ConfirmDialog";
import { BRAND_ACCENT } from "../../../data/brandColors";
import {
  insertSignature,
  kitHasRefsForFormat,
  shareLegendaWhatsApp,
  GENERATE_ALL_CONCURRENCY,
  runWithConcurrency,
} from "./utils";

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

export function CarouselCardBlock({
  cards,
  kit,
  mood,
  dayNumber,
  keyInfo,
  guard,
  segmento,
  modelo,
  imageKit,
  extrasCarrossel,
  onImageGenerated,
  userId,
  forcedGenders,
  anchoraPersonagem,
  ancoragePapel,
}: {
  cards: CarouselCard[];
  kit: BrandKit;
  mood: MoodCode;
  dayNumber: number;
  keyInfo: string;
  guard: ReturnType<typeof useImageGenAlert>["guard"];
  onImageGenerated?: () => void;
  userId?: string | null;
  forcedGenders: PersonagemGender[];
  anchoraPersonagem?: string;
  ancoragePapel?: string;
} & RefSelectorProps) {
  const [open, setOpen] = useState(false);
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
  const isMobile = useIsMobile();
  const blockStorageKey = `uso-ref:carrossel:${dayNumber}:bloco`;
  const blockSel = useRefSelection(blockStorageKey);

  // Estado por card: titulo/texto/legenda editáveis + contadores
  const cardCopyKey = (index: number) => `carousel:${dayNumber}:${cards[index].card}`;
  const savedCardEdits = useMemo(
    () => cards.map((c) => loadCopyEdit(userId, `carousel:${dayNumber}:${c.card}`)),
    [userId, dayNumber, cards],
  );
  const [titulos, setTitulos] = useState(
    cards.map((c, i) => savedCardEdits[i]?.titulo ?? c.titulo),
  );
  const [textos, setTextos] = useState(cards.map((c, i) => savedCardEdits[i]?.texto ?? c.texto));
  const [legendas, setLegendas] = useState(
    cards.map((c, i) => savedCardEdits[i]?.legenda ?? c.legenda ?? ""),
  );
  const [tCounts, setTCounts] = useState(cards.map((_, i) => savedCardEdits[i]?.tCount ?? 0));
  const [xCounts, setXCounts] = useState(cards.map((_, i) => savedCardEdits[i]?.xCount ?? 0));
  const [lCounts, setLCounts] = useState(cards.map((_, i) => savedCardEdits[i]?.lCount ?? 0));
  useEffect(() => {
    cards.forEach((_, i) => {
      saveCopyEdit(userId, cardCopyKey(i), {
        titulo: titulos[i],
        texto: textos[i],
        legenda: legendas[i],
        tCount: tCounts[i],
        xCount: xCounts[i],
        lCount: lCounts[i],
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dayNumber, titulos, textos, legendas, tCounts, xCounts, lCounts]);

  // D2 pode corrigir card.titulo/texto/legenda depois que o bloco já foi
  // montado/aberto — resincroniza por índice quem o usuário não editou.
  const prevUpstreamCardsRef = useRef(
    cards.map((c) => ({ titulo: c.titulo, texto: c.texto, legenda: c.legenda || "" })),
  );
  useEffect(() => {
    const prev = prevUpstreamCardsRef.current;
    setTitulos((arr) =>
      arr.map((cur, i) =>
        cards[i].titulo !== prev[i]?.titulo && cur === prev[i]?.titulo ? cards[i].titulo : cur,
      ),
    );
    setTextos((arr) =>
      arr.map((cur, i) =>
        cards[i].texto !== prev[i]?.texto && cur === prev[i]?.texto ? cards[i].texto : cur,
      ),
    );
    setLegendas((arr) =>
      arr.map((cur, i) => {
        const upstream = cards[i].legenda || "";
        return upstream !== prev[i]?.legenda && cur === prev[i]?.legenda ? upstream : cur;
      }),
    );
    prevUpstreamCardsRef.current = cards.map((c) => ({
      titulo: c.titulo,
      texto: c.texto,
      legenda: c.legenda || "",
    }));
  }, [cards]);

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

  return (
    <>
    <ConfirmDialog
      open={confirmKind !== null}
      title={confirmKind === "refs" ? `Gerar ${cards.length} cards com referências?` : `Gerar ${cards.length} cards sem referências?`}
      message={
        confirmKind === "refs"
          ? `⚠️ Revise os títulos e textos antes — eles serão usados como estão.\n\nVocê ainda poderá regerar cards individualmente depois.`
          : `⚠️ Revise os títulos e textos de cada card antes — eles serão usados como estão.\n\nVocê ainda poderá regerar cards individualmente depois.`
      }
      confirmLabel="Gerar"
      onConfirm={() => { confirmKind === "refs" ? runGenerateAllWithRefs() : runGenerateAll(); }}
      onCancel={() => setConfirmKind(null)}
    />
    {errMsg && (
      <div
        role="alert"
        style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
      >
        <span>{errMsg}</span>
        <button type="button" onClick={() => setErrMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#991b1b", flexShrink: 0 }}>✕</button>
      </div>
    )}
    <article className="contentCard">
      <button className="cardHeader" type="button" onClick={() => setOpen((o) => !o)}>
        <div className="cardHeaderLeft">
          <span className="cardTag">
            Dia {dayNumber} · Carrossel · {cards.length} cards
          </span>
          <strong className="cardTitle">{titulos[0]}</strong>
        </div>
        <span className="cardChevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="cardBody">
          {/* Caixa CONSOLIDADA de Imagens de Referência para o carrossel inteiro.
              Marca-se 1 cenário + até N produtos aqui; card[i] usa produto[i]. */}
          <UsoReferenciasDia
            segmento={segmento}
            modelo={modelo}
            formato="carrossel"
            posicao={dayNumber}
            extrasCarrossel={extrasCarrossel}
            kit={kit}
            imageKit={imageKit ?? emptyImageKit}
            mood={mood}
            storageKey={blockStorageKey}
            userId={userId}
            compact
            onGerou={() => {
              /* disparo vem do botão "Gerar X cards com refs" */
            }}
            footerAction={
              blockSel.hasAny && kitHasRefsForFormat(imageKit, "carrossel", segmento, modelo) ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#475569" }}>
                    Cada card recebe o produto na ordem marcada (card 1 → produto 1, …).
                  </span>
                  <button
                    type="button"
                    className="generateBtn"
                    onClick={() => setConfirmKind("refs")}
                    disabled={busyAll || busyIndex !== null}
                    title="Gera os cards em sequência: card 1 com produto 1, card 2 com produto 2, e assim por diante"
                  >
                    {busyAllMode === "refs"
                      ? `Gerando ${(allProgress?.done ?? 0) + 1}/${allProgress?.total ?? cards.length}…`
                      : `✨ Gerar ${cards.length} cards com refs`}
                  </button>
                </div>
              ) : undefined
            }
          />

          {/* Caixa separada: gerar todos os cards sem imagens de referência. */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "8px 10px",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="generateBtn"
              onClick={() => setConfirmKind("noref")}
              disabled={busyAll || busyIndex !== null}
              title="Gera todos os cards em sequência sem imagem de referência. Revise os títulos e textos antes."
            >
              {busyAllMode === "noref"
                ? `Gerando ${(allProgress?.done ?? 0) + 1}/${allProgress?.total ?? cards.length}…`
                : `✨ Gerar todos os ${cards.length} cards (sem refs)`}
            </button>
          </div>
          {cards.map((card, index) => {
            const ctx = (kind: RegenKind) => ({
              kind,
              companyName: kit.companyName,
              mainActivity: kit.mainActivity,
              keyInfo,
              formato: `Carrossel — Card ${card.card}`,
              tituloAtual: titulos[index],
              textoAtual: textos[index],
              legendaAtual: legendas[index],
            });
            return (
              <div key={card.card} className="carouselCardBlock">
                <span className="cardTag">Card {card.card}</span>
                <EditableField
                  label="Título do card"
                  kind="titulo"
                  value={titulos[index]}
                  original={card.titulo}
                  count={tCounts[index]}
                  onChange={(v) => setTitulos((prev) => prev.map((p, i) => (i === index ? v : p)))}
                  onRegenSuccess={() =>
                    setTCounts((prev) => prev.map((c, i) => (i === index ? c + 1 : c)))
                  }
                  ctxBuilder={() => ctx("titulo")}
                  maxWords={6}
                />
                <EditableField
                  label="Texto do card"
                  kind="texto"
                  value={textos[index]}
                  original={card.texto}
                  count={xCounts[index]}
                  onChange={(v) => setTextos((prev) => prev.map((p, i) => (i === index ? v : p)))}
                  onRegenSuccess={() =>
                    setXCounts((prev) => prev.map((c, i) => (i === index ? c + 1 : c)))
                  }
                  ctxBuilder={() => ctx("texto")}
                  multiline
                  maxWords={12}
                />
                {index === cards.length - 1 && (
                  <>
                    <EditableField
                      label="Legenda do card"
                      kind="legenda"
                      value={legendas[index]}
                      original={card.legenda || ""}
                      count={lCounts[index]}
                      onChange={(v) =>
                        setLegendas((prev) => prev.map((p, i) => (i === index ? v : p)))
                      }
                      onRegenSuccess={() =>
                        setLCounts((prev) => prev.map((c, i) => (i === index ? c + 1 : c)))
                      }
                      ctxBuilder={() => ctx("legenda")}
                      multiline
                      maxWords={40}
                      excludeTexts={kit.assinatura ? [kit.assinatura] : undefined}
                    />
                    <div style={{ marginTop: 4 }}>
                      <button
                        type="button"
                        disabled={!(kit.assinatura && !legendas[index].includes(kit.assinatura))}
                        onClick={() => {
                          if (kit.assinatura && !legendas[index].includes(kit.assinatura))
                            setLegendas((prev) =>
                              prev.map((p, i) =>
                                i === index ? insertSignature(p, kit.assinatura!) : p,
                              ),
                            );
                        }}
                        style={{
                          padding: "6px 12px",
                          border: "none",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor:
                            kit.assinatura && !legendas[index].includes(kit.assinatura)
                              ? "pointer"
                              : "default",
                          background:
                            kit.assinatura && !legendas[index].includes(kit.assinatura)
                              ? "#0f172a"
                              : "#e2e8f0",
                          color:
                            kit.assinatura && !legendas[index].includes(kit.assinatura)
                              ? "#fff"
                              : "#94a3b8",
                        }}
                      >
                        Inserir Assinatura
                      </button>
                    </div>
                    {legendas[index].trim() && isMobile && (
                      <button
                        className="downloadBtn"
                        type="button"
                        style={{ width: "100%", minHeight: 44, fontSize: 15, marginTop: 4 }}
                        onClick={() => shareLegendaWhatsApp("Carrossel", legendas[index])}
                      >
                        📲 Compartilhar legenda no WhatsApp
                      </button>
                    )}
                  </>
                )}
                {previews[index] && (
                  <div className="previewWrapper">
                    <img src={previews[index]!} alt={`Card ${card.card}`} className="previewImg" />
                  </div>
                )}
                <div className="cardActions">
                  <button
                    className="generateBtn"
                    type="button"
                    onClick={() => handleGenerate(index)}
                    disabled={busyIndex !== null || busyAll}
                  >
                    {busyIndex === index && busyMode === "noref" && !busyAll
                      ? "Gerando..."
                      : previews[index]
                        ? "↻ Gerar outra (sem refs)"
                        : "⬇ Gerar card"}
                  </button>
                  <RefsRegenButton
                    storageKey={`uso-ref:carrossel:${dayNumber}:c${card.card}`}
                    fallbackKey={blockStorageKey}
                    busy={(busyIndex === index && busyMode === "refs") || busyAll}
                    onRun={() => handleGenerateWithRefs(index)}
                    imageKit={imageKit}
                    formato="carrossel"
                    segmento={segmento}
                    modelo={modelo}
                    hasPreview={!!previews[index]}
                  />
                  {previews[index] && (
                    <button
                      className="downloadBtn"
                      type="button"
                      onClick={() =>
                        downloadDataUrl(
                          previews[index]!,
                          mopName({
                            company: kit.companyName,
                            tipo: `car${String(dayNumber).padStart(2, "0")}_c${card.card}`,
                            ext: "jpg",
                          }),
                        )
                      }
                    >
                      Baixar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <ArchiveButton
              tipo="S3V"
              formato="carrossel"
              dia={dayNumber}
              legenda={legendas[legendas.length - 1] || ""}
              imageDataUrls={previews}
              titulo={titulos[0]}
              disabledReason="Gere todos os cards do carrossel antes de arquivar"
            />
          </div>
        </div>
      )}
    </article>
    </>
  );
}
