import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandKit, FaixaEtaria, ImageKit, MethodOpResult, MoodCode } from "../../types";
import { PersonagemGender } from "../../core/visualDirection";
import { generateSequencePdf } from "../../utils/generatePdf";
import { mopName } from "../../utils/file";
import { resolveModelo, type ModeloOP } from "../../core/personalizacaoMop";
import { useAppProfile } from "../../contexts/ProfileContext";
import { useImageGenAlert } from "./PreImageAlert";
import { AnchorBanner } from "./results/AnchorBanner";
import { useBlockGenders } from "./results/useBlockGenders";
import { useAnchorControl } from "./results/useAnchorControl";
import { buildDaySequence } from "./results/sequence";
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
  const { guard, dialog } = useImageGenAlert();
  const { refreshProfile } = useAppProfile();

  // Força um refresh ao montar — evita defasagem entre dados de perfil
  // atualizados (ex.: plano) e o que o app vê em cache.
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const {
    anchorBannerOpen,
    setAnchorBannerOpen,
    anchorMode,
    setAnchorMode,
    anchorControl,
    anchorGenderEffective,
    anchoraPersonagem,
    ancoragePapel,
    clothingSeed,
  } = useAnchorControl(result, faixaEtariaForm, generoPrefForm);

  // Posição da sequência na fila de variação — decidida na geração e guardada
  // com o resultado (ver useMopHandlers). Viaja para todas as peças pelo mesmo
  // caminho do clothingSeed, que também é uma decisão por sequência: é o que
  // faz o carrossel inteiro sair na mesma paleta. Sequências antigas, geradas
  // antes de 12/08/2026, não têm o campo — aí o comportamento de sorteio
  // anterior continua valendo, sem quebrar nada.
  const variacaoSeed = result?.variacaoSeed;

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

  // Gênero do personagem por bloco (estático + carrossel + fechamento + reels)
  // — ver useBlockGenders.
  const blockGenders = useBlockGenders(result, anchorGenderEffective);

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
      // Rota autenticada — envia o token de sessão (mesmo padrão de useReelsGeneration).
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      await fetch("/api/supabase-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  const { sequence, estaticos, carousels } = buildDaySequence(result);

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
        <AnchorBanner
          control={anchorControl}
          mode={anchorMode}
          onToggleMode={() => setAnchorMode((m) => (m === "ancora" ? "livre" : "ancora"))}
          open={anchorBannerOpen}
          onToggleOpen={() => setAnchorBannerOpen((o) => !o)}
        />
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
                  onImageGenerated={onImageGenerated}
                  userId={userId}
                  forcedGender={bg?.estatico ?? "homem"}
                  anchoraPersonagem={anchoraPersonagem}
                  ancoragePapel={ancoragePapel}
                  clothingSeed={clothingSeed}
                  variacaoSeed={variacaoSeed}
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
                  onImageGenerated={onImageGenerated}
                  userId={userId}
                  forcedGender={bg?.final ?? "homem"}
                  anchoraPersonagem={anchoraPersonagem}
                  ancoragePapel={ancoragePapel}
                  clothingSeed={clothingSeed}
                  variacaoSeed={variacaoSeed}
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
                  onImageGenerated={onImageGenerated}
                  userId={userId}
                  forcedGenders={bg?.carrossel ?? item.cards.map(() => "homem" as PersonagemGender)}
                  anchoraPersonagem={anchoraPersonagem}
                  ancoragePapel={ancoragePapel}
                  clothingSeed={clothingSeed}
                  variacaoSeed={variacaoSeed}
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
                  onImageGenerated={onImageGenerated}
                  userId={userId}
                  forcedGender={bg?.reels ?? "homem"}
                  anchoraPersonagem={anchoraPersonagem}
                  ancoragePapel={ancoragePapel}
                  clothingSeed={clothingSeed}
                  variacaoSeed={variacaoSeed}
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
