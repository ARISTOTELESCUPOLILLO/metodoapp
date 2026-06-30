import { useEffect, useMemo, useState } from "react";
import { BrandKit, FeedItem, MoodCode } from "../../../types";
import { PersonagemGender } from "../../../core/visualDirection";
import { type RegenKind } from "../../../services/regenerateBlock";
import { generatePostImage } from "../../../services/api";
import { composeFinalPng, downloadDataUrl } from "../../../utils/canvasComposer";
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
import { RefSelectorProps } from "./RefsRegenButton";
import { insertSignature, kitHasRefsForFormat, useSyncUpstream, shareLegendaWhatsApp } from "./utils";

export function FinalCard({
  item,
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
  forcedGender,
  anchoraPersonagem,
  ancoragePapel,
}: {
  item: FeedItem;
  kit: BrandKit;
  mood: MoodCode;
  dayNumber: number;
  keyInfo: string;
  guard: ReturnType<typeof useImageGenAlert>["guard"];
  onImageGenerated?: () => void;
  userId?: string | null;
  forcedGender: PersonagemGender;
  anchoraPersonagem?: string;
  ancoragePapel?: string;
} & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyRefs, setBusyRefs] = useState(false);
  const cacheKey = `final:${dayNumber}`;
  const [preview, setPreview] = useState<string | null>(() => getSessionImage(userId, cacheKey));
  function updatePreview(value: string | null) {
    setPreview(value);
    setSessionImage(userId, cacheKey, value);
  }
  const isMobile = useIsMobile();
  const storageKey = `uso-ref:estatico_final:${item.dia}`;
  const sel = useRefSelection(storageKey);

  const savedCopyEdit = useMemo(() => loadCopyEdit(userId, cacheKey), [userId, cacheKey]);
  const [titulo, setTitulo] = useState(savedCopyEdit?.titulo ?? item.titulo);
  const [texto, setTexto] = useState(savedCopyEdit?.texto ?? item.texto);
  const [legenda, setLegenda] = useState(savedCopyEdit?.legenda ?? item.legenda);
  const [tCount, setTCount] = useState(savedCopyEdit?.tCount ?? 0);
  const [xCount, setXCount] = useState(savedCopyEdit?.xCount ?? 0);
  const [lCount, setLCount] = useState(savedCopyEdit?.lCount ?? 0);
  useEffect(() => {
    saveCopyEdit(userId, cacheKey, { titulo, texto, legenda, tCount, xCount, lCount });
  }, [userId, cacheKey, titulo, texto, legenda, tCount, xCount, lCount]);
  useSyncUpstream(item.titulo, titulo, setTitulo);
  useSyncUpstream(item.texto, texto, setTexto);
  useSyncUpstream(item.legenda, legenda, setLegenda);

  async function runGenerate() {
    setBusy(true);
    try {
      const url = await generatePostImage({
        imagePrompt: item.imagem,
        titulo,
        texto,
        companyName: kit.companyName,
        mainActivity: kit.mainActivity,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || "#f4b000",
        fontFamily: kit.fontPair || "Montserrat",
        secondaryFont: kit.secondaryFont,
        mood,
        vertical: "estatico_final",
        logoPosition: kit.logoPosition,
        leituraCenica: item.leituraCenica,
        forcedGender,
        anchoraPersonagem,
        ancoragePapel,
        segment: segmento,
      });
      const final = await composeFinalPng(kit, { ...item, titulo, texto, legenda }, url);
      updatePreview(final);
      onImageGenerated?.();
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  function handleGenerate() {
    guard({ hasPreview: !!preview, tipo: "Estático Final", run: runGenerate });
  }

  async function runGenerateWithRefs() {
    if (!sel.hasAny) return;
    setBusyRefs(true);
    try {
      const url = await regenerateWithKit({
        slot: { formato: "estatico_final", posicao: dayNumber, elemento: "avatar", motivo: "" },
        kit,
        imageKit: imageKit ?? emptyImageKit,
        mood,
        keyInfo: `${item.titulo || ""}. ${item.imagem || ""}`.slice(0, 500),
        titulo,
        texto,
        imagePrompt: item.imagem,
        leituraCenica: item.leituraCenica,
        formato: "post",
        selecaoDireta: {
          usarAvatar: sel.avatarNum != null,
          avatarNum: sel.avatarNum as 1 | 2 | null,
          usarFachada: sel.usarFachada,
          cenarioNum: sel.cenarioNum,
          produtosNums: sel.produtosNums,
          useUniforme: sel.useUniforme,
          produtoTelaInformativa: sel.produtoTelaInformativa,
        },
        anchoraPersonagem,
        ancoragePapel,
        forcedGender,
        userId,
      });
      const final = await composeFinalPng(kit, { ...item, titulo, texto, legenda }, url);
      updatePreview(final);
      onImageGenerated?.();
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`);
    } finally {
      setBusyRefs(false);
    }
  }

  function handleGenerateWithRefs() {
    guard({ hasPreview: !!preview, tipo: "Estático Final", run: runGenerateWithRefs });
  }

  const ctx = (kind: RegenKind) => ({
    kind,
    companyName: kit.companyName,
    mainActivity: kit.mainActivity,
    keyInfo,
    formato: "Estático Final",
    tituloAtual: titulo,
    textoAtual: texto,
    legendaAtual: legenda,
  });

  return (
    <article className="contentCard">
      <button className="cardHeader" type="button" onClick={() => setOpen((o) => !o)}>
        <div className="cardHeaderLeft">
          <span className="cardTag">Dia {dayNumber} · Estático Final</span>
          <strong className="cardTitle">{titulo}</strong>
        </div>
        <span className="cardChevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="cardBody">
          <UsoReferenciasDia
            segmento={segmento}
            modelo={modelo}
            formato="estatico_final"
            posicao={dayNumber}
            extrasCarrossel={extrasCarrossel}
            kit={kit}
            imageKit={imageKit ?? emptyImageKit}
            mood={mood}
            titulo={titulo}
            texto={texto}
            imagePrompt={item.imagem}
            leituraCenica={item.leituraCenica}
            storageKey={storageKey}
            userId={userId}
            forcedGender={forcedGender}
            anchoraPersonagem={anchoraPersonagem}
            ancoragePapel={ancoragePapel}
            onGerou={async (url) => {
              try {
                const final = await composeFinalPng(kit, { ...item, titulo, texto, legenda }, url);
                updatePreview(final);
              } catch {
                updatePreview(url);
              }
            }}
          />
          <EditableField
            label="Título"
            kind="titulo"
            value={titulo}
            original={item.titulo}
            count={tCount}
            onChange={setTitulo}
            onRegenSuccess={() => setTCount((c) => c + 1)}
            ctxBuilder={() => ctx("titulo")}
            maxWords={6}
          />
          <EditableField
            label="Texto"
            kind="texto"
            value={texto}
            original={item.texto}
            count={xCount}
            onChange={setTexto}
            onRegenSuccess={() => setXCount((c) => c + 1)}
            ctxBuilder={() => ctx("texto")}
            multiline
            maxWords={15}
          />
          <EditableField
            label="Legenda"
            kind="legenda"
            value={legenda}
            original={item.legenda}
            count={lCount}
            onChange={setLegenda}
            onRegenSuccess={() => setLCount((c) => c + 1)}
            ctxBuilder={() => ctx("legenda")}
            multiline
            maxWords={40}
            excludeTexts={kit.assinatura ? [kit.assinatura] : undefined}
          />
          {legenda.trim() && isMobile && (
            <button
              className="downloadBtn"
              type="button"
              style={{ width: "100%", minHeight: 44, fontSize: 15, marginTop: 4 }}
              onClick={() => shareLegendaWhatsApp("Estático Final", legenda)}
            >
              📲 Compartilhar legenda no WhatsApp
            </button>
          )}
          {preview && (
            <div className="previewWrapper">
              <img src={preview} alt="Preview" className="previewImg" />
            </div>
          )}
          <div className="cardActions">
            <button
              type="button"
              disabled={!(kit.assinatura && !legenda.includes(kit.assinatura))}
              onClick={() => {
                if (kit.assinatura && !legenda.includes(kit.assinatura))
                  setLegenda(insertSignature(legenda, kit.assinatura));
              }}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: kit.assinatura && !legenda.includes(kit.assinatura) ? "pointer" : "default",
                background:
                  kit.assinatura && !legenda.includes(kit.assinatura) ? "#0f172a" : "#e2e8f0",
                color: kit.assinatura && !legenda.includes(kit.assinatura) ? "#fff" : "#94a3b8",
              }}
            >
              Inserir Assinatura
            </button>
            <button
              className="generateBtn"
              type="button"
              onClick={handleGenerate}
              disabled={busy || busyRefs}
            >
              {busy ? "Gerando..." : preview ? "↻ Gerar outra (sem refs)" : "⬇ Gerar fechamento"}
            </button>
            {sel.hasAny && kitHasRefsForFormat(imageKit, "estatico_final", segmento, modelo) && (
              <button
                className="generateBtn"
                type="button"
                onClick={handleGenerateWithRefs}
                disabled={busy || busyRefs}
                title="Gerar usando as referências marcadas acima"
              >
                {busyRefs ? "Gerando..." : preview ? "↻ Gerar outra com refs" : "⬇ Gerar com refs"}
              </button>
            )}
            {preview && (
              <button
                className="downloadBtn"
                type="button"
                onClick={() =>
                  downloadDataUrl(
                    preview,
                    mopName({
                      company: kit.companyName,
                      tipo: `estf${String(dayNumber).padStart(2, "0")}`,
                      ext: "jpg",
                    }),
                  )
                }
              >
                Baixar
              </button>
            )}
            <ArchiveButton
              tipo="S3V"
              formato="estatico_final"
              dia={dayNumber}
              legenda={legenda}
              imageDataUrls={[preview]}
              titulo={titulo}
              disabledReason="Gere o fechamento antes de arquivar"
            />
          </div>
        </div>
      )}
    </article>
  );
}
