import { useState } from "react";
import { BrandKit, CarouselCard, MoodCode } from "../../../types";
import { PersonagemGender } from "../../../core/visualDirection";
import { type RegenKind } from "../../../services/regenerateBlock";
import { downloadDataUrl } from "../../../utils/canvasComposer";
import { mopName } from "../../../utils/file";
import { emptyImageKit } from "../../../utils/imageKitStorage";
import { useIsMobile } from "../../../hooks/use-mobile";
import { ArchiveButton } from "../ArchiveButton";
import { MetaPublish } from "../MetaPublish";
import UsoReferenciasDia from "../UsoReferenciasDia";
import { useImageGenAlert } from "../PreImageAlert";
import { EditableField } from "./EditableField";
import { usePlanSlotsCtx } from "../../../contexts/PlanSlotsContext";
import { RefSelectorProps, RefsRegenButton } from "./RefsRegenButton";
import ConfirmDialog from "../ConfirmDialog";
import { USO_REF_PREFIX } from "../../../lib/storage/keys";
import { insertSignature, kitHasRefsForFormat, shareLegendaWhatsApp } from "./utils";
import { useCarouselCardEdits } from "./useCarouselCardEdits";
import { useCarouselGeneration } from "./useCarouselGeneration";

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
  onImageGenerated,
  userId,
  forcedGenders,
  anchoraPersonagem,
  ancoragePapel,
  clothingSeed,
  variacaoSeed,
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
  clothingSeed?: number;
  variacaoSeed?: number;
} & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { selectedSlot } = usePlanSlotsCtx();
  const blockStorageKey = `${USO_REF_PREFIX}:${userId || "anon"}:carrossel:${dayNumber}:bloco`;

  const {
    titulos,
    setTitulos,
    textos,
    setTextos,
    legendas,
    setLegendas,
    tCounts,
    setTCounts,
    xCounts,
    setXCounts,
    lCounts,
    setLCounts,
  } = useCarouselCardEdits(cards, userId, dayNumber);

  const {
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
  } = useCarouselGeneration({
    cards,
    kit,
    mood,
    dayNumber,
    segmento,
    modelo,
    imageKit,
    userId,
    forcedGenders,
    anchoraPersonagem,
    ancoragePapel,
    clothingSeed,
    variacaoSeed,
    onImageGenerated,
    guard,
    titulos,
    textos,
    blockStorageKey,
  });

  return (
    <>
      <ConfirmDialog
        open={confirmKind !== null}
        title={
          confirmKind === "refs"
            ? `Gerar ${cards.length} cards com referências?`
            : `Gerar ${cards.length} cards sem referências?`
        }
        message={
          confirmKind === "refs"
            ? `⚠️ Revise os títulos e textos antes — eles serão usados como estão.\n\nVocê ainda poderá regerar cards individualmente depois.`
            : `⚠️ Revise os títulos e textos de cada card antes — eles serão usados como estão.\n\nVocê ainda poderá regerar cards individualmente depois.`
        }
        confirmLabel="Gerar"
        onConfirm={() => {
          confirmKind === "refs" ? runGenerateAllWithRefs() : runGenerateAll();
        }}
        onCancel={() => setConfirmKind(null)}
      />
      {errMsg && (
        <div
          role="alert"
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{errMsg}</span>
          <button
            type="button"
            onClick={() => setErrMsg(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              color: "#991b1b",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
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
                preferredSlot: selectedSlot,
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
                    onChange={(v) =>
                      setTitulos((prev) => prev.map((p, i) => (i === index ? v : p)))
                    }
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
                      <img
                        src={previews[index]!}
                        alt={`Card ${card.card}`}
                        className="previewImg"
                      />
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
                      storageKey={`${USO_REF_PREFIX}:${userId || "anon"}:carrossel:${dayNumber}:c${card.card}`}
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
            {/* Publicação do carrossel INTEIRO: um post único, cards na ordem
                gerada, com a legenda do carrossel (a do último card — a mesma
                que o arquivamento usa). Só aparece com todos os cards gerados,
                senão o post sairia incompleto. */}
            {previews.length >= 2 && previews.every(Boolean) && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                <MetaPublish
                  imageDataUrls={previews as string[]}
                  caption={legendas[legendas.length - 1] || ""}
                />
              </div>
            )}
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
