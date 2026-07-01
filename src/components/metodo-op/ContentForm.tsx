import { useEffect, useState } from "react";
import { ContentFormData, FaixaEtaria, MoodCode, Track } from "../../types";
import TemplateChooser from "./TemplateChooser";
import { useBrandKit } from "../../contexts/BrandKitContext";
import { useAppProfile } from "../../contexts/ProfileContext";
import { useMood } from "../../contexts/MoodContext";
import { KeyInfoSection } from "./contentForm/KeyInfoSection";
import { FormatSection, TRACK_OPTIONS } from "./contentForm/FormatSection";
import { IdeiasSheet } from "./contentForm/IdeiasSheet";

interface Props {
  data: ContentFormData;
  onChange: (data: ContentFormData) => void;
  onGenerate: () => void;
  onClear: () => void;
  loading: boolean;
}

export default function ContentForm({ data, onChange, onGenerate, onClear, loading }: Props) {
  const { kit } = useBrandKit();
  const { rendersRestantes, rendersTotal, imgsRestantes, imgsTotal, geracoesRestantes, geracoesTotal, semPlano, effectiveAdmin: isAdmin, planAccess } = useAppProfile();
  const { mood, setMood: onMoodChange } = useMood();
  const segment = kit.segment;
  const isPersonalBrand = kit.isPersonalBrand;
  const products = kit.products || [];
  const [showIdeiasPanel, setShowIdeiasPanel] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>(() => products || []);

  // Checklist de produtos/serviços — todos marcados por padrão; reseta
  // quando a lista do Kit de Marca muda (ex.: kit carregado ou editado).
  useEffect(() => {
    setSelectedProducts(products || []);
  }, [products]);

  const update = <K extends keyof ContentFormData>(key: K, value: ContentFormData[K]) =>
    onChange({ ...data, [key]: value });

  const setMode = (mode: ContentFormData["outputMode"]) => {
    const hasFeed = mode === "feed" || mode === "feed+stories";
    const hasStories = mode === "stories" || mode === "feed+stories";
    const outputFormats: ContentFormData["outputFormats"] = [
      ...(hasFeed ? (["feed", "carrossel", "reels"] as const) : []),
      ...(hasStories ? ["stories" as const] : []),
    ];
    onChange({ ...data, outputMode: mode, outputFormats });
  };

  const trackAllowed = (t: Track) => (!planAccess ? true : !!planAccess.tracks[t]);
  const sizeAllowed = (t: Track, size: number) =>
    !planAccess ? true : (planAccess.sizesByTrack[t] || []).includes(size);

  const setTrack = (track: Track) => {
    const opt = TRACK_OPTIONS.find((t) => t.code === track);
    if (opt?.disabled) return;
    if (!trackAllowed(track)) return;
    const sizes = planAccess?.sizesByTrack[track] || [3, 6, 9];
    const nextSize =
      track === "experimentacao"
        ? 3
        : sizeAllowed(track, data.sequenceSize)
          ? data.sequenceSize
          : sizes[0] || data.sequenceSize;
    const next: ContentFormData =
      track === "experimentacao"
        ? { ...data, track, sequenceSize: 3 }
        : { ...data, track, sequenceSize: nextSize as ContentFormData["sequenceSize"] };
    onChange(next);
  };

  const hasFeed = data.outputMode === "feed" || data.outputMode === "feed+stories";
  const hasStories = data.outputMode === "stories" || data.outputMode === "feed+stories";
  const currentTrack: Track = data.track || "cinematica";
  const isExperimentacao = currentTrack === "experimentacao";

  // Auto-corrige seleção atual se ficou fora dos planos (vale para todos, incluindo admin)
  useEffect(() => {
    if (!planAccess) return;
    const validTracks: Track[] = (["cinematica", "visual", "experimentacao"] as Track[]).filter(
      trackAllowed,
    );
    if (validTracks.length === 0) return;
    if (!trackAllowed(currentTrack)) {
      setTrack(validTracks[0]);
      return;
    }
    if (currentTrack !== "experimentacao" && !sizeAllowed(currentTrack, data.sequenceSize)) {
      const sizes = planAccess.sizesByTrack[currentTrack];
      if (sizes && sizes.length) {
        onChange({ ...data, sequenceSize: sizes[0] as ContentFormData["sequenceSize"] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planAccess, currentTrack, data.sequenceSize]);

  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Criar conteúdo</span>
          <h2>Geração de conteúdo</h2>
        </div>
      </div>

      <div className="grid2">
        <label>
          Público-alvo
          <select
            value={data.audience}
            onChange={(e) => update("audience", e.target.value as ContentFormData["audience"])}
          >
            <option value="B2C">B2C — consumidor final</option>
            <option value="B2B">B2B — empresas/decisores</option>
          </select>
        </label>
        <label>
          Momento do negócio
          <select
            value={data.businessMoment}
            onChange={(e) =>
              update("businessMoment", e.target.value as ContentFormData["businessMoment"])
            }
          >
            <option value="lançamento">Lançamento</option>
            <option value="consolidação">Consolidação</option>
            <option value="reativação">Reativação</option>
          </select>
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: "#64748b",
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {data.businessMoment === "lançamento" &&
              "Público descobrindo a marca pela primeira vez"}
            {data.businessMoment === "consolidação" &&
              "Público já compra de você — fortalecer preferência"}
            {data.businessMoment === "reativação" && "Público que conhecia mas parou de engajar"}
          </span>
        </label>
      </div>

      <div className="grid2">
        <label>
          Faixa etária do público
          <select
            value={data.faixaEtaria ?? ""}
            onChange={(e) =>
              update("faixaEtaria", (e.target.value || null) as FaixaEtaria | null)
            }
          >
            <option value="">Sem direcionamento</option>
            <option value="18-34">18 a 34 anos</option>
            <option value="35-49">35 a 49 anos</option>
            <option value="50-65">50 a 65 anos</option>
          </select>
        </label>
        <label>
          Gênero na imagem
          <select
            value={data.generoPref ?? ""}
            onChange={(e) =>
              update("generoPref", (e.target.value || null) as "M" | "F" | null)
            }
          >
            <option value="">Automático</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </label>
      </div>

      <KeyInfoSection
        data={data}
        update={update}
        segment={segment}
        isPersonalBrand={isPersonalBrand}
        products={products}
        selectedProducts={selectedProducts}
        setSelectedProducts={setSelectedProducts}
        loading={loading}
        isAdmin={isAdmin}
        onOpenIdeias={() => setShowIdeiasPanel(true)}
      />

      <FormatSection
        data={data}
        update={update}
        setMode={setMode}
        setTrack={setTrack}
        currentTrack={currentTrack}
        isExperimentacao={isExperimentacao}
        hasFeed={hasFeed}
        hasStories={hasStories}
        trackAllowed={trackAllowed}
        sizeAllowed={sizeAllowed}
      />

      {data.outputMode === "stories" ? (
        <div
          className="storiesNotice"
          style={{
            padding: "12px 14px",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#f8fafc",
            color: "#475569",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#0f172a" }}>Stories são apenas texto.</strong> Sai só como
          roteiro, pronto pra digitar ou gravar — não geramos imagem aqui.
        </div>
      ) : (
        <>
          <TemplateChooser segment={segment} selected={mood} onSelect={onMoodChange} />
          {data.outputMode === "feed+stories" && (
            <div
              className="storiesNotice"
              style={{
                marginTop: -8,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fef9c3",
                color: "#713f12",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              Os stories desta trilha são <strong>apenas texto</strong>. O estilo visual escolhido
              vale para as peças do feed.
            </div>
          )}
        </>
      )}

      {(() => {
        const semSaldo =
          !isAdmin &&
          typeof imgsRestantes === "number" &&
          imgsRestantes <= 0 &&
          (imgsTotal || 0) > 0;
        const semGeracoes =
          !isAdmin &&
          typeof geracoesRestantes === "number" &&
          geracoesRestantes <= 0 &&
          (geracoesTotal || 0) > 0;
        const semPlanoTrilha =
          !isAdmin &&
          !!planAccess &&
          (!trackAllowed(currentTrack) ||
            (currentTrack !== "experimentacao" && !sizeAllowed(currentTrack, data.sequenceSize)));
        const mostrarAviso = isAdmin || semPlano;
        const semMood = !mood && data.outputMode !== "stories";
        return (
          <>
            {mostrarAviso && (
              <div
                style={{
                  fontSize: 12,
                  color: semPlano ? "#b91c1c" : "#475569",
                  textAlign: "right",
                  marginTop: -4,
                }}
              >
                {isAdmin ? "Geração ilimitada (admin)." : "Sem plano ativo — fale com o admin."}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
              <button
                className="primaryBtn"
                type="button"
                onClick={onGenerate}
                disabled={
                  loading ||
                  semSaldo ||
                  semGeracoes ||
                  (!isAdmin && semPlano) ||
                  semPlanoTrilha ||
                  semMood
                }
                title={
                  semGeracoes
                    ? "Limite de gerações do plano atingido — fale com o admin"
                    : semSaldo
                      ? "Limite de imagens do plano atingido — fale com o admin"
                      : !isAdmin && semPlano
                        ? "Sem plano ativo — fale com o admin"
                        : semPlanoTrilha
                          ? "Combinação fora dos seus planos — escolha outra trilha/tamanho"
                          : semMood
                            ? "Escolha uma forma visual acima antes de gerar"
                            : undefined
                }
                style={{ flex: 1 }}
              >
                {loading
                  ? "Gerando..."
                  : isExperimentacao
                    ? "Gerar Experimentação"
                    : "Gerar conteúdo"}
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={loading}
                style={{
                  background: "#f8fafc",
                  color: "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "0 18px",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Limpar
              </button>
            </div>
          </>
        );
      })()}

      <IdeiasSheet segment={segment} open={showIdeiasPanel} onOpenChange={setShowIdeiasPanel} />
    </section>
  );
}
