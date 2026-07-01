// Bloco "Quais conteúdos produzir?" (modo Feed/Stories, tamanho da sequência,
// trilha narrativa, configuração dos Stories) do formulário de conteúdo do
// Método OP — extraído de ContentForm.tsx (PLANO_V2 Fase 9.1). JSX movido
// 1:1, sem mudança de comportamento.
import { ContentFormData, Track } from "../../../types";

const SEQUENCE_SIZES = [3, 6, 9] as const;

interface TrackOption {
  code: Track;
  label: string;
  description: string;
  badge?: string;
  disabled?: boolean;
}

export const TRACK_OPTIONS: TrackOption[] = [
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

interface Props {
  data: ContentFormData;
  update: <K extends keyof ContentFormData>(key: K, value: ContentFormData[K]) => void;
  setMode: (mode: ContentFormData["outputMode"]) => void;
  setTrack: (track: Track) => void;
  currentTrack: Track;
  isExperimentacao: boolean;
  hasFeed: boolean;
  hasStories: boolean;
  trackAllowed: (t: Track) => boolean;
  sizeAllowed: (t: Track, size: number) => boolean;
}

export function FormatSection({
  data,
  update,
  setMode,
  setTrack,
  currentTrack,
  isExperimentacao,
  hasFeed,
  hasStories,
  trackAllowed,
  sizeAllowed,
}: Props) {
  return (
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
                onChange={(e) => update("storiesDays", Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
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
  );
}
