import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AnchoraVisual,
  BrandKit,
  CarouselCard,
  FaixaEtaria,
  FeedItem,
  ImageKit,
  MethodOpResult,
  MoodCode,
  ReelsGuide,
} from "../../types";
import { AGE_OPTIONS, mapFaixaToAnchorAge } from "../../core/audienceAge";
import { PersonagemGender } from "../../core/visualDirection";
import { generateSequencePdf } from "../../utils/generatePdf";
import { mopName } from "../../utils/file";
import {
  resolveModelo,
  ZERO_COTA,
  type CotaPorTipo,
  type ModeloOP,
} from "../../core/personalizacaoMop";
import { useProfile } from "../../hooks/useProfile";
import { useImageGenAlert } from "./PreImageAlert";
import { computeBlockGenders } from "./results/utils";
import { type AnchorControl } from "./results/AnchorIndicator";
import { FeedCard } from "./results/FeedCard";
import { FinalCard } from "./results/FinalCard";
import { CarouselCardBlock } from "./results/CarouselCardBlock";
import { ReelsCard } from "./results/ReelsCard";
import { StoriesBlock } from "./results/StoriesBlock";

interface Props {
  result?: MethodOpResult;
  kit: BrandKit;
  mood: MoodCode;
  onClear?: () => void;
  onRetry?: () => void;
  imageKit?: ImageKit;
  sequenceSize?: 3 | 6 | 9;
  onImageGenerated?: () => void;
  userId?: string | null;
  // Faixa etária e gênero escolhidos no form — pré-preenchem a âncora visual.
  faixaEtariaForm?: FaixaEtaria | null;
  generoPrefForm?: "M" | "F" | null;
}
const MOOD_NAMES: Record<string, string> = {
  "OP-01": "Clareza",
  "OP-02": "Impacto",
  "OP-03": "Instante",
  "OP-04": "Fragmento",
  "OP-05": "Desvio",
  "OP-06": "Silêncio",
};

export default function ResultsView({
  result,
  kit,
  mood,
  onClear,
  onRetry,
  imageKit,
  sequenceSize,
  onImageGenerated,
  userId,
  faixaEtariaForm,
  generoPrefForm,
}: Props) {
  const [savingPdf, setSavingPdf] = useState(false);
  const [anchorGenderFlipped, setAnchorGenderFlipped] = useState(false);
  const [anchorAgeOverride, setAnchorAgeOverride] = useState<string | undefined>(undefined);
  const [anchorBannerOpen, setAnchorBannerOpen] = useState(false);
  const [anchorMode, setAnchorMode] = useState<"ancora" | "livre">("ancora");
  const { guard, dialog } = useImageGenAlert();
  const { cotaPersonalizados, isAdmin, refresh: refreshProfile } = useProfile();

  // Força um refresh ao montar — evita defasagem entre o que o admin acabou
  // de configurar (extras) e o que o app vê em cache.
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // A cada nova geração, pré-preenche a âncora visual com a faixa etária e
  // o gênero escolhidos no form. O usuário pode ajustar depois no painel.
  useEffect(() => {
    if (!result) return;
    const mappedAge = mapFaixaToAnchorAge(faixaEtariaForm);
    setAnchorAgeOverride(mappedAge);
    if (generoPrefForm && result.ancora_visual) {
      const iaGenero = result.ancora_visual.genero; // "M" | "F"
      setAnchorGenderFlipped(iaGenero !== generoPrefForm);
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // `track` não consta em MethodOpResult e o motor não o popula hoje (o valor é
  // inferido por trackResolved abaixo); leitura defensiva p/ compat — mantido
  // como any pois tipar exigiria afirmar que o campo nunca existe.
  const trackRaw = (result as any)?.track as "cinematica" | "visual" | "experimentacao" | undefined;

  const allFeedAll = result?.feed || [];
  const inferredSize: 3 | 6 | 9 | undefined =
    sequenceSize ??
    (allFeedAll.length >= 7
      ? 9
      : allFeedAll.length >= 4
        ? 6
        : allFeedAll.length >= 1
          ? 3
          : undefined);
  const hasFinal = allFeedAll.some((f) => f.formato === "Estático Final");
  const hasReels = !!result?.reels;
  const trackResolved: "cinematica" | "visual" | "experimentacao" | undefined =
    hasFinal && !hasReels && trackRaw !== "experimentacao" ? "visual" : trackRaw;
  const modelo: ModeloOP | null = inferredSize ? resolveModelo(trackResolved, inferredSize) : null;

  // Extras de carrossel agregados — usado apenas como "flag de liberação" para
  // SERVIÇOS/MARCA exibirem produtos no carrossel. Não há débito por uso.
  const INF = 9999;
  const cotaPorTipo: CotaPorTipo = isAdmin
    ? { estatico: INF, carrossel: INF, estatico_final: INF, reels: INF }
    : cotaPersonalizados || ZERO_COTA;
  const extrasCarrossel = cotaPorTipo.carrossel || 0;

  // ancora_visual gerada pela IA junto com a sequência. Mostra sempre que existir —
  // a supressão por avatar acontece POR CARD em regenerateWithKit (hasAvatarRef),
  // não aqui: ter avatar no kit ≠ avatar sendo usado nesta geração específica.
  const ancoragem: AnchoraVisual | undefined = result?.ancora_visual;
  const anchorAgeEffective = anchorAgeOverride ?? ancoragem?.faixa_etaria ?? "";
  // No modo 'livre' o gerador de imagem não recebe constraint de tipo —
  // gênero é balanceado livremente por peça (M/F alternados).
  const anchorGenderEffective: PersonagemGender | undefined =
    ancoragem && anchorMode === "ancora"
      ? anchorGenderFlipped
        ? ancoragem.genero === "F"
          ? "homem"
          : "mulher"
        : ancoragem.genero === "F"
          ? "mulher"
          : "homem"
      : undefined;
  const anchoraPersonagem: string | undefined =
    ancoragem && anchorMode === "ancora"
      ? [anchorAgeEffective].filter(Boolean).join(", ") || undefined
      : undefined;
  const ancoragePapel: string | undefined = ancoragem?.papel;
  const anchorControl: AnchorControl | undefined = ancoragem
    ? {
        ancoragem,
        genderEffective: anchorGenderEffective ?? (ancoragem.genero === "F" ? "mulher" : "homem"),
        ageEffective: anchorAgeEffective,
        onFlipGender: () => setAnchorGenderFlipped((f) => !f),
        onChangeAge: (age) => setAnchorAgeOverride(age),
      }
    : undefined;

  // Gênero do personagem por bloco (estático + carrossel + fechamento) — ver
  // computeBlockGenders. Memoizado em `result`: persiste entre re-renders e
  // entre "gerar de novo" de cada peça, e só recalcula quando um novo plano é
  // gerado (result muda de referência).
  const blockGenders = useMemo(() => {
    const feed = result?.feed || [];
    const estaticosM = feed.filter((f) => f.formato !== "Estático Final");
    const estaticosFinaisM = feed.filter((f) => f.formato === "Estático Final");
    const reelsM = result?.reels || [];
    const carouselsM: CarouselCard[][] = [];
    if (result?.carousel?.length) {
      for (let i = 0; i < result.carousel.length; i += 5) {
        carouselsM.push(result.carousel.slice(i, i + 5));
      }
    }
    const maxBlocksM = Math.max(
      estaticosM.length,
      carouselsM.length,
      reelsM.length,
      estaticosFinaisM.length,
    );
    const blocks: {
      estatico: PersonagemGender;
      carrossel: PersonagemGender[];
      reels: PersonagemGender;
      final: PersonagemGender;
    }[] = [];
    for (let i = 0; i < maxBlocksM; i++) {
      const pieces: { titulo: string; texto: string }[] = [];
      if (estaticosM[i]) pieces.push({ titulo: estaticosM[i].titulo, texto: estaticosM[i].texto });
      (carouselsM[i] || []).forEach((c) => pieces.push({ titulo: c.titulo, texto: c.texto }));
      if (reelsM[i]) pieces.push({ titulo: reelsM[i].hook, texto: reelsM[i].script });
      if (estaticosFinaisM[i])
        pieces.push({ titulo: estaticosFinaisM[i].titulo, texto: estaticosFinaisM[i].texto });
      const genders = computeBlockGenders(pieces, anchorGenderEffective);
      let p = 0;
      const estatico: PersonagemGender = estaticosM[i] ? genders[p++] : "homem";
      const carrossel: PersonagemGender[] = (carouselsM[i] || []).map(() => genders[p++]);
      const reels: PersonagemGender = reelsM[i] ? genders[p++] : "homem";
      const final: PersonagemGender = estaticosFinaisM[i] ? genders[p++] : "homem";
      blocks.push({ estatico, carrossel, reels, final });
    }
    return blocks;
  }, [result, anchorGenderEffective]);

  if (!result) return null;

  // keyInfo não consta em MethodOpResult nem no shape conhecido de `raw`
  // (unknown vindo da IA); leitura defensiva c/ fallback — mantido como any
  // pois tipar exigiria afirmar campos que o motor não garante.
  const keyInfo = String(
    (result as any).keyInfo || (result.raw as { keyInfo?: unknown })?.keyInfo || "",
  );

  async function handlePdf() {
    setSavingPdf(true);
    try {
      const filename = mopName({ company: kit.companyName, tipo: "plano", ext: "pdf" });
      const bytes = generateSequencePdf(result!, kit, mood);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      await fetch("/api/supabase-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: kit.companyName, pdfBase64: base64, filename }),
      });
      // Auto-arquivamento foi substituído por botão "Arquivar" em cada box.
      // O PDF continua disponível como download manual aqui.
    } catch (e) {
      console.error("Erro ao salvar PDF:", e);
    } finally {
      setSavingPdf(false);
    }
  }

  type DayItem =
    | { type: "feed"; day: number; block: number; item: FeedItem }
    | { type: "final"; day: number; block: number; item: FeedItem }
    | { type: "carousel"; day: number; block: number; cards: CarouselCard[] }
    | { type: "reels"; day: number; block: number; reels: ReelsGuide };

  const allFeed = result.feed || [];
  const estaticos = allFeed.filter((f) => f.formato !== "Estático Final");
  const estaticosFinais = allFeed.filter((f) => f.formato === "Estático Final");

  const sequence: DayItem[] = [];
  let day = 1;
  const reelsList: ReelsGuide[] = result.reels || [];
  const carousels: CarouselCard[][] = [];

  if (result.carousel?.length) {
    for (let i = 0; i < result.carousel.length; i += 5) {
      carousels.push(result.carousel.slice(i, i + 5));
    }
  }

  const maxBlocks = Math.max(
    estaticos.length,
    carousels.length,
    reelsList.length,
    estaticosFinais.length,
  );
  for (let i = 0; i < maxBlocks; i++) {
    if (estaticos[i]) sequence.push({ type: "feed", day: day++, block: i, item: estaticos[i] });
    if (carousels[i])
      sequence.push({ type: "carousel", day: day++, block: i, cards: carousels[i] });
    if (reelsList[i]) sequence.push({ type: "reels", day: day++, block: i, reels: reelsList[i] });
    if (estaticosFinais[i])
      sequence.push({ type: "final", day: day++, block: i, item: estaticosFinais[i] });
  }

  return (
    <section className="panel resultPanel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Saída</span>
          <h2>Resultado do Método OP</h2>
          <span
            style={{
              display: "inline-block",
              marginTop: 4,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
              color: "#92400e",
              background: "rgba(244,176,0,.12)",
              border: "1px solid rgba(244,176,0,.35)",
              borderRadius: 6,
              padding: "2px 8px",
            }}
          >
            {MOOD_NAMES[mood] ?? mood} · {mood}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onClear && (
            <button className="clearBtn" type="button" onClick={onClear}>
              Limpar conteúdo
            </button>
          )}
          <button className="pdfBtn" type="button" onClick={handlePdf} disabled={savingPdf}>
            {savingPdf ? "Salvando..." : "📄 Baixar PDF"}
          </button>
        </div>
      </div>

      {anchorControl && (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            marginBottom: 12,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setAnchorBannerOpen((o) => !o)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 14px",
              background: "#f8fafc",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "#475569",
            }}
          >
            <span>
              Pessoa nas imagens:&nbsp;
              {anchorMode === "ancora" ? (
                <strong style={{ color: "#0f172a" }}>
                  {anchorControl.genderEffective === "mulher" ? "F" : "M"} ·{" "}
                  {anchorControl.ageEffective.replace(" anos", "").replace(" ano", "")}
                </strong>
              ) : (
                <strong style={{ color: "#64748b" }}>Livre</strong>
              )}
            </span>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{anchorBannerOpen ? "▲" : "▼"}</span>
          </button>
          {anchorBannerOpen && (
            <div
              style={{
                padding: "8px 14px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setAnchorMode((m) => (m === "ancora" ? "livre" : "ancora"))}
                style={{
                  fontSize: 12,
                  padding: "4px 12px",
                  border: "1px solid #e2e8f0",
                  background: anchorMode === "livre" ? "#f1f5f9" : "#0f172a",
                  color: anchorMode === "livre" ? "#475569" : "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {anchorMode === "ancora" ? "Mudar p/ Livre" : "Mudar p/ Âncora"}
              </button>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                {anchorMode === "ancora"
                  ? "Âncora: mesma pessoa em todas as peças."
                  : "Livre: a IA varia a pessoa em cada peça."}
              </span>
              {anchorMode === "ancora" && (
                <>
                  <button
                    type="button"
                    onClick={anchorControl.onFlipGender}
                    style={{
                      fontSize: 12,
                      padding: "4px 12px",
                      border: "1px solid #bfdbfe",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Trocar p/{" "}
                    {anchorControl.genderEffective === "mulher" ? "Masculino" : "Feminino"}
                  </button>
                  <select
                    value={anchorControl.ageEffective}
                    onChange={(e) => anchorControl.onChangeAge(e.target.value)}
                    style={{
                      fontSize: 12,
                      padding: "4px 8px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      background: "#fff",
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    {!AGE_OPTIONS.includes(anchorControl.ageEffective) && (
                      <option value={anchorControl.ageEffective}>
                        {anchorControl.ageEffective}
                      </option>
                    )}
                    {AGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {sequence.length > 0 && (
        <div className="resultBlock">
          <h3>Sequência do feed</h3>
          {estaticos.length > 0 && carousels.length === 0 && (
            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: 10,
                padding: "10px 12px",
                margin: "8px 0 12px",
                fontSize: 13,
                color: "#92400e",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ flex: 1 }}>
                ⚠️ Esta sequência veio sem o carrossel. Clique em <b>"Tentar novamente"</b> para
                receber a sequência completa.
              </span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  style={{
                    whiteSpace: "nowrap",
                    background: "#d97706",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 14px",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  ↻ Tentar novamente
                </button>
              )}
            </div>
          )}
          {sequence.map((item) => {
            const bg = blockGenders[item.block];
            if (item.type === "feed") {
              return (
                <FeedCard
                  key={`feed-${item.day}`}
                  item={item.item}
                  kit={kit}
                  mood={mood}
                  dayNumber={item.day}
                  keyInfo={keyInfo}
                  guard={guard}
                  segmento={kit.segment}
                  modelo={modelo}
                  imageKit={imageKit}
                  extrasCarrossel={extrasCarrossel}
                  onImageGenerated={onImageGenerated}
                  userId={userId}
                  forcedGender={bg?.estatico ?? "homem"}
                  anchoraPersonagem={anchoraPersonagem}
                  ancoragePapel={ancoragePapel}
                />
              );
            }
            if (item.type === "final") {
              return (
                <FinalCard
                  key={`final-${item.day}`}
                  item={item.item}
                  kit={kit}
                  mood={mood}
                  dayNumber={item.day}
                  keyInfo={keyInfo}
                  guard={guard}
                  segmento={kit.segment}
                  modelo={modelo}
                  imageKit={imageKit}
                  extrasCarrossel={extrasCarrossel}
                  onImageGenerated={onImageGenerated}
                  userId={userId}
                  forcedGender={bg?.final ?? "homem"}
                  anchoraPersonagem={anchoraPersonagem}
                  ancoragePapel={ancoragePapel}
                />
              );
            }
            if (item.type === "carousel") {
              return (
                <CarouselCardBlock
                  key={`car-${item.day}`}
                  cards={item.cards}
                  kit={kit}
                  mood={mood}
                  dayNumber={item.day}
                  keyInfo={keyInfo}
                  guard={guard}
                  segmento={kit.segment}
                  modelo={modelo}
                  imageKit={imageKit}
                  extrasCarrossel={extrasCarrossel}
                  onImageGenerated={onImageGenerated}
                  userId={userId}
                  forcedGenders={bg?.carrossel ?? item.cards.map(() => "homem" as PersonagemGender)}
                  anchoraPersonagem={anchoraPersonagem}
                  ancoragePapel={ancoragePapel}
                />
              );
            }
            if (item.type === "reels") {
              return (
                <ReelsCard
                  key={`reels-${item.day}`}
                  reels={item.reels}
                  kit={kit}
                  mood={mood}
                  dayNumber={item.day}
                  track={trackRaw}
                  keyInfo={keyInfo}
                  guard={guard}
                  segmento={kit.segment}
                  modelo={modelo}
                  imageKit={imageKit}
                  extrasCarrossel={extrasCarrossel}
                  onImageGenerated={onImageGenerated}
                  userId={userId}
                  forcedGender={bg?.reels ?? "homem"}
                  anchoraPersonagem={anchoraPersonagem}
                  ancoragePapel={ancoragePapel}
                />
              );
            }
            return null;
          })}
        </div>
      )}

      {(result.stories?.length ?? 0) > 0 && (
        <div className="resultBlock">
          <h3>Stories</h3>
          {result.stories!.map((seq) => (
            <StoriesBlock key={seq.dia} seq={seq} />
          ))}
        </div>
      )}

      {onClear && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid rgba(0,0,0,.06)",
          }}
        >
          <button
            type="button"
            onClick={onClear}
            title="Limpar geração"
            aria-label="Limpar geração"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#f8fafc",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "10px 18px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <Trash2 size={16} />
            Limpar geração
          </button>
        </div>
      )}

      {dialog}
    </section>
  );
}
