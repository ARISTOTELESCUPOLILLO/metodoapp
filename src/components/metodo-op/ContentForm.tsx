import { useEffect, useRef, useState } from "react";
import { ContentFormData, FaixaEtaria, MoodCode, Segment, Track } from "../../types";
import TemplateChooser from "./TemplateChooser";
import type { PlanAccess } from "@/lib/planAccess";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getAuthHeaders } from "../../services/authHeaders";
import { IDEIAS_ASSUNTOS } from "@/data/ideiasAssuntos";
import ProductsChecklist from "./ProductsChecklist";
import { useTextCorrection } from "@/hooks/useTextCorrection";

interface Props {
  data: ContentFormData;
  onChange: (data: ContentFormData) => void;
  onGenerate: () => void;
  onClear: () => void;
  loading: boolean;
  segment: Segment;
  isPersonalBrand?: boolean;
  mood: MoodCode | null;
  onMoodChange: (mood: MoodCode) => void;
  rendersRestantes?: number;
  rendersTotal?: number;
  imgsRestantes?: number;
  imgsTotal?: number;
  geracoesRestantes?: number;
  geracoesTotal?: number;
  semPlano?: boolean;
  isAdmin?: boolean;
  planAccess?: PlanAccess;
  products?: string[];
}

const SEQUENCE_SIZES = [3, 6, 9] as const;

const KEYINFO_EXAMPLE: Record<Segment, string> = {
  SERVIÇOS:
    "Ex.: tráfego pago para lojas locais que impulsionam mas não convertem em vendas constantes",
  VAREJO:
    "Ex.: loja de roupas de bairro que quer transformar o Instagram em vitrine que vende todo dia",
  MARCA:
    "Ex.: marca consolidada pronta para ganhar autoridade e dar o próximo passo de posicionamento",
};

interface TrackOption {
  code: Track;
  label: string;
  description: string;
  badge?: string;
  disabled?: boolean;
}

const TRACK_OPTIONS: TrackOption[] = [
  {
    code: "cinematica",
    label: "Cinemática",
    description: "Termina com um vídeo (reels).",
  },
  {
    code: "visual",
    label: "Visual",
    description: "Tudo em imagem. Termina com um post de fechamento.",
  },
  {
    code: "experimentacao",
    label: "Experimentação",
    description: "Versão curta para testar: 3 peças.",
  },
];

export default function ContentForm({
  data,
  onChange,
  onGenerate,
  onClear,
  loading,
  segment,
  isPersonalBrand,
  mood,
  onMoodChange,
  rendersRestantes,
  rendersTotal,
  imgsRestantes,
  imgsTotal,
  geracoesRestantes,
  geracoesTotal,
  semPlano,
  isAdmin,
  planAccess,
  products,
}: Props) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestCount, setSuggestCount] = useState(0);
  const [showIdeiasPanel, setShowIdeiasPanel] = useState(false);
  const initialKeyInfoRef = useRef<string | null>(null);
  const allSessionSuggestionsRef = useRef<string[]>([]);
  // Semente fixa por sessão de sugestões — enviada ao servidor (stateless) pra
  // garantir que as tentativas 0/1/2 caiam em lentes diferentes dentro da
  // sessão, mas variem entre sessões novas (ver lensIndex em suggest-keyinfo.ts).
  const sessionSeedRef = useRef<number>(Math.floor(Math.random() * 1e9));
  const [selectedProducts, setSelectedProducts] = useState<string[]>(() => products || []);
  const keyInfoCorrection = useTextCorrection();

  const SUGGEST_MAX = 3;
  const hasKeyInfo = !!(data.keyInfo || "").trim();
  const suggestExhausted = !isAdmin && suggestCount >= SUGGEST_MAX;
  const canClear = hasKeyInfo || suggestCount > 0;
  const initialKeyInfo = initialKeyInfoRef.current;
  const canRevertInitial = initialKeyInfo !== null && data.keyInfo !== initialKeyInfo;

  useEffect(() => {
    setSuggestCount(0);
    setSuggestions([]);
    setSuggestError(null);
    initialKeyInfoRef.current = null;
    allSessionSuggestionsRef.current = [];
    sessionSeedRef.current = Math.floor(Math.random() * 1e9);
  }, [segment]);

  useEffect(() => {
    if (!data.keyInfo) {
      setSuggestions([]);
      setSuggestError(null);
      initialKeyInfoRef.current = null;
      // suggestCount e allSessionSuggestionsRef NÃO são resetados — preservam
      // o rodízio de produto/lente entre pedidos de sugestão
    }
  }, [data.keyInfo]);

  // Checklist de produtos/serviços — todos marcados por padrão; reseta
  // quando a lista do Kit de Marca muda (ex.: kit carregado ou editado).
  useEffect(() => {
    setSelectedProducts(products || []);
  }, [products]);

  async function fetchSuggestion() {
    if (suggestExhausted || hasKeyInfo) return;
    setSuggesting(true);
    setSuggestError(null);
    const attempt = suggestCount;

    try {
      const auth = await getAuthHeaders();
      const res = await fetch("/api/suggest-keyinfo", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          companyName: data.companyName,
          mainActivity: data.mainActivity || "",
          objetivo: "promocao",
          segment,
          isPersonalBrand,
          audience: data.audience,
          hint: "",
          mode: "metodo",
          attempt,
          sessionSeed: sessionSeedRef.current,
          subMode: "sugerir",
          previousSuggestions: allSessionSuggestionsRef.current,
          brandVoice: data.brandVoice || "",
          selectedProducts,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Falha (${res.status})`);
      }
      const json = await res.json();
      const newSugg = String(json.sugestao || "").trim();
      if (newSugg) {
        setSuggestions((arr) => [...arr, newSugg]);
        allSessionSuggestionsRef.current = [...allSessionSuggestionsRef.current, newSugg];
      }
      setSuggestCount((c) => c + 1);
    } catch (e) {
      setSuggestError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

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

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span>Informação-chave</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setShowIdeiasPanel(true)}
              title="Ver sugestões de assuntos para este segmento"
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              💡 Ideias
            </button>
            <button
              type="button"
              onClick={fetchSuggestion}
              disabled={suggesting || loading || hasKeyInfo || suggestExhausted}
              title={
                hasKeyInfo
                  ? "Limpe o campo para usar Sugestão"
                  : suggestExhausted
                    ? "Limite atingido"
                    : "Sugere um assunto pronto para você editar"
              }
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
                color: "#0f172a",
                cursor:
                  suggesting || loading || hasKeyInfo || suggestExhausted
                    ? "not-allowed"
                    : "pointer",
                opacity: suggesting || loading || hasKeyInfo || suggestExhausted ? 0.4 : 1,
              }}
            >
              {suggesting
                ? "Gerando…"
                : `✨ Sugestão${suggestCount > 0 ? ` (${suggestCount}/${isAdmin ? "∞" : SUGGEST_MAX})` : ""}`}
            </button>
            <button
              type="button"
              onClick={() =>
                keyInfoCorrection.correct(data.keyInfo || "", (corrected) => {
                  if (initialKeyInfoRef.current === null)
                    initialKeyInfoRef.current = data.keyInfo || "";
                  update("keyInfo", corrected);
                })
              }
              disabled={keyInfoCorrection.correcting || !hasKeyInfo}
              title="Corrige ortografia e gramática do texto"
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
                color: "#0f172a",
                cursor: keyInfoCorrection.correcting || !hasKeyInfo ? "not-allowed" : "pointer",
                opacity: keyInfoCorrection.correcting || !hasKeyInfo ? 0.4 : 1,
              }}
            >
              {keyInfoCorrection.correcting ? "Corrigindo…" : "🔤 Corrigir"}
            </button>
            <button
              type="button"
              onClick={() => {
                update("keyInfo", "");
                setSuggestCount(0);
                setSuggestions([]);
                setSuggestError(null);
                initialKeyInfoRef.current = null;
              }}
              disabled={!canClear}
              title="Limpar texto e reiniciar"
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
                color: "#0f172a",
                cursor: !canClear ? "not-allowed" : "pointer",
                opacity: !canClear ? 0.4 : 1,
              }}
            >
              🗑 Limpar
            </button>
            {canRevertInitial && (
              <button
                type="button"
                onClick={() => update("keyInfo", initialKeyInfo ?? "")}
                title="Voltar ao texto inicial"
                style={{
                  background: "none",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                ↺ Inicial
              </button>
            )}
          </div>
        </div>
        <ProductsChecklist
          products={products || []}
          selected={selectedProducts}
          onChange={setSelectedProducts}
        />
        <textarea
          value={data.keyInfo || ""}
          onChange={(e) => update("keyInfo", e.target.value)}
          placeholder={KEYINFO_EXAMPLE[segment]}
          rows={3}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: `1px solid ${suggestExhausted ? "#fcd34d" : "#e2e8f0"}`,
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: 1.45,
            resize: "vertical",
            minHeight: 84,
            background: suggestExhausted ? "#fffbeb" : "#fff",
            color: "#0f172a",
          }}
        />
        {keyInfoCorrection.msg && (
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#16a34a" }}>
            {keyInfoCorrection.msg}
          </p>
        )}
        {keyInfoCorrection.error && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b91c1c" }}>
            {keyInfoCorrection.error}
          </p>
        )}
        {(suggesting || suggestions.length > 0 || suggestError) && (
          <div
            style={{
              marginTop: 10,
              padding: 14,
              borderRadius: 12,
              background: suggestError ? "#fef2f2" : "#f8fafc",
              border: `1px solid ${suggestError ? "#fecaca" : "#e2e8f0"}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span className="eyebrow" style={{ color: suggestError ? "#b91c1c" : "#0f172a" }}>
                {suggesting
                  ? "Gerando sugestão…"
                  : suggestError
                    ? "Erro"
                    : suggestions.length > 1
                      ? "Sugestões"
                      : "Sugestão"}
              </span>
              {!suggesting && (
                <button
                  type="button"
                  onClick={() => {
                    setSuggestions([]);
                    setSuggestError(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 18,
                    cursor: "pointer",
                    color: "#64748b",
                    padding: 0,
                    lineHeight: 1,
                  }}
                  aria-label="Fechar"
                >
                  ×
                </button>
              )}
            </div>
            {suggesting && (
              <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Aguarde alguns segundos…</p>
            )}
            {!suggesting && suggestError && (
              <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{suggestError}</p>
            )}
            {!suggesting && !suggestError && suggestions.length > 0 && (
              <div>
                {suggestions.length > 1 && (
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>
                    Compare e escolha a que preferir.
                  </p>
                )}
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns:
                      suggestions.length > 1 ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr",
                  }}
                >
                  {suggestions.map((sugg, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {suggestions.length > 1 && (
                        <span className="eyebrow" style={{ fontSize: 10, color: "#64748b" }}>
                          Sugestão {idx + 1}
                        </span>
                      )}
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: "#0f172a",
                          flex: 1,
                        }}
                      >
                        {sugg}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (initialKeyInfoRef.current === null)
                            initialKeyInfoRef.current = data.keyInfo || "";
                          update("keyInfo", sugg);
                          setSuggestions([]);
                        }}
                        style={{
                          background: "#0f172a",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          alignSelf: "flex-start",
                        }}
                      >
                        Usar esta
                      </button>
                    </div>
                  ))}
                </div>
                {!suggestExhausted && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={fetchSuggestion}
                      disabled={hasKeyInfo}
                      style={{
                        background: "#fff",
                        color: "#0f172a",
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        padding: "6px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: hasKeyInfo ? "not-allowed" : "pointer",
                        opacity: hasKeyInfo ? 0.4 : 1,
                      }}
                    >
                      Gerar outra ({suggestCount}/{isAdmin ? "∞" : SUGGEST_MAX})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="formatBox">
        <strong>Quais conteúdos produzir?</strong>
        <div className="radioRow">
          {(["feed", "stories", "feed+stories"] as const).map((mode) => (
            <label key={mode} className="radioLabel">
              <input
                type="radio"
                name="outputMode"
                value={mode}
                checked={data.outputMode === mode}
                onChange={() => setMode(mode)}
              />
              {mode === "feed"
                ? "Apenas Feed"
                : mode === "stories"
                  ? "Apenas Stories"
                  : "Feed + Stories"}
            </label>
          ))}
        </div>

        {hasFeed && (
          <>
            <div className="subFormatBox">
              <span className="subFormatLabel">Tamanho da sequência</span>
              <div className="sequenceGrid">
                {SEQUENCE_SIZES.map((size) => {
                  const allowedBySize = isExperimentacao
                    ? size === 3
                    : sizeAllowed(currentTrack, size);
                  const isDisabled = isExperimentacao || !allowedBySize;
                  return (
                    <button
                      key={size}
                      type="button"
                      className={`sequenceCard${data.sequenceSize === size ? " active" : ""}${isDisabled ? " disabled" : ""}`}
                      onClick={() => !isDisabled && update("sequenceSize", size)}
                      disabled={isDisabled}
                      title={
                        !allowedBySize && !isExperimentacao
                          ? `Você não tem plano para ${size} peças em ${TRACK_OPTIONS.find((t) => t.code === currentTrack)?.label ?? currentTrack} — fale com o admin`
                          : undefined
                      }
                    >
                      <span className="sequenceNum">{size} peças</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="subFormatBox">
              <span className="subFormatLabel">Trilha narrativa</span>
              <div className="sequenceGrid trackGrid">
                {TRACK_OPTIONS.map((opt) => {
                  const isActive = currentTrack === opt.code;
                  const noPlan = !trackAllowed(opt.code);
                  const isDisabled = !!opt.disabled || noPlan;
                  const classes = [
                    "sequenceCard",
                    "trackCard",
                    isActive ? "active" : "",
                    isDisabled ? "disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={opt.code}
                      type="button"
                      className={classes}
                      onClick={() => setTrack(opt.code)}
                      disabled={isDisabled}
                      title={
                        opt.disabled
                          ? "Disponível em breve"
                          : noPlan
                            ? `Você não tem plano para ${opt.label} — fale com o admin`
                            : opt.description
                      }
                    >
                      <span className="sequenceNum">{opt.label}</span>
                      <span className="trackDescription">{opt.description}</span>
                      {opt.badge && <span className="trackBadge">{opt.badge}</span>}
                      {noPlan && !opt.disabled && (
                        <span
                          className="trackBadge"
                          style={{ background: "#fee2e2", color: "#b91c1c" }}
                        >
                          sem plano
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {hasStories && (
          <div className="subFormatBox">
            <span className="subFormatLabel">Configuração dos Stories</span>
            <div className="grid2">
              <label>
                Número de dias
                <select
                  value={data.storiesDays}
                  onChange={(e) =>
                    update("storiesDays", Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "dia" : "dias"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stories por sequência
                <select
                  value={data.storiesQuantity}
                  onChange={(e) => update("storiesQuantity", Number(e.target.value) as 3 | 6)}
                >
                  <option value={3}>3 stories</option>
                  <option value={6}>6 stories</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

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

      <Sheet open={showIdeiasPanel} onOpenChange={setShowIdeiasPanel}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader style={{ marginBottom: 20 }}>
            <SheetTitle
              style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
            >
              Ideias de Assuntos
              <span
                style={{
                  background: "#eff6ff",
                  color: "#1e40af",
                  border: "1px solid #bfdbfe",
                  borderRadius: 6,
                  padding: "2px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {segment === "SERVIÇOS" ? "Serviços" : segment === "VAREJO" ? "Varejo" : "Marca"}
              </span>
            </SheetTitle>
          </SheetHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {IDEIAS_ASSUNTOS[segment].map((cat) => (
              <div key={cat.titulo}>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ fontSize: 14, color: "#0f172a" }}>{cat.titulo}</strong>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    ({cat.subtitulo})
                  </div>
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  {cat.itens.map((item, i) => (
                    <li key={i} style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
                      {item}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 20, borderBottom: "1px solid #f1f5f9" }} />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
