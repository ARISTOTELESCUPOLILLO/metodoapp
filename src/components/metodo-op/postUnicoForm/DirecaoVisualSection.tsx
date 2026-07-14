// Bloco "Direção visual" (Livre vs. Com estilo visual + grid de moods) do
// Post Único — extraído de PostUnicoForm.tsx (PLANO_V2 Fase 9.1). JSX
// movido 1:1, sem mudança de comportamento.
import { Lightbulb, Zap, Camera, Layers, Shuffle, VolumeX, type LucideIcon } from "lucide-react";
import type { MoodCode, PostUnicoDirecao } from "../../../types";

const MOODS: { code: MoodCode; label: string }[] = [
  { code: "OP-01", label: "Clareza" },
  { code: "OP-04", label: "Fragmento" },
  { code: "OP-03", label: "Instante" },
  { code: "OP-05", label: "Desvio" },
  { code: "OP-02", label: "Impacto" },
  { code: "OP-06", label: "Silêncio" },
];

const MOOD_ICONS: Record<MoodCode, LucideIcon> = {
  "OP-01": Lightbulb,
  "OP-02": Zap,
  "OP-03": Camera,
  "OP-04": Layers,
  "OP-05": Shuffle,
  "OP-06": VolumeX,
};

interface Props {
  direcao: PostUnicoDirecao;
  mood?: MoodCode;
  isNenhum: boolean;
  setDirecao: (dir: PostUnicoDirecao) => void;
  onMoodChange: (mood: MoodCode) => void;
  fragmentoBloqueado?: boolean;
}

export function DirecaoVisualSection({
  direcao,
  mood,
  isNenhum,
  setDirecao,
  onMoodChange,
  fragmentoBloqueado,
}: Props) {
  return (
    <div className="formatBox">
      <strong>Direção visual</strong>
      <div className="radioRow">
        <label className="radioLabel">
          <input
            type="radio"
            name="direcao"
            checked={direcao === "livre"}
            onChange={() => setDirecao("livre")}
          />
          Livre — a IA decide o estilo
        </label>
        <label
          className="radioLabel"
          style={{ opacity: isNenhum ? 0.4 : 1, cursor: isNenhum ? "not-allowed" : "pointer" }}
        >
          <input
            type="radio"
            name="direcao"
            checked={direcao === "mood"}
            onChange={() => {
              if (!isNenhum) setDirecao("mood");
            }}
            disabled={isNenhum}
          />
          Com estilo visual
        </label>
      </div>

      {direcao === "mood" && (
        <>
          {!mood && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
              Escolha um estilo visual abaixo para liberar a geração.
            </p>
          )}
          <div className="sequenceGrid" style={{ marginTop: 12 }}>
            {MOODS.map((m) => {
              const bloqueado = m.code === "OP-04" && !!fragmentoBloqueado;
              return (
                <button
                  key={m.code}
                  type="button"
                  disabled={bloqueado}
                  title={bloqueado ? "Indisponível no formato Tópicos com ícone" : undefined}
                  className={`sequenceCard${mood === m.code ? " active" : ""}`}
                  onClick={() => {
                    if (!bloqueado) onMoodChange(m.code);
                  }}
                  style={bloqueado ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                >
                  <span
                    className="sequenceNum"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      justifyContent: "center",
                    }}
                  >
                    {m.label}
                    {(() => {
                      const Icon = MOOD_ICONS[m.code];
                      return Icon ? <Icon size={12} strokeWidth={1.8} /> : null;
                    })()}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
