import { useState } from "react";
import { regenerateBlockClean, type RegenKind } from "../../../services/regenerateBlock";
import { useTextCorrection } from "../../../hooks/useTextCorrection";
import { REGEN_MAX, countWords } from "./utils";

/**
 * Campo editável com botões: regenerar IA (até 1x), editar manualmente,
 * voltar ao inicial. Aplica a regra de limite descrita no plano.
 */
export function EditableField(props: {
  label: string;
  kind: RegenKind;
  value: string;
  original: string;
  count: number;
  onChange: (v: string) => void;
  // Chamado só quando a regeneração entrega uma sugestão de fato (não em
  // falha/retorno vazio) — falha não deve consumir a cota persistida.
  onRegenSuccess: () => void;
  ctxBuilder: () => Parameters<typeof regenerateBlockClean>[0];
  multiline?: boolean;
  maxWords?: number;
  excludeTexts?: string[];
}) {
  const {
    label,
    value,
    original,
    count,
    onChange,
    onRegenSuccess,
    ctxBuilder,
    multiline,
    kind,
    maxWords,
    excludeTexts,
  } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const correction = useTextCorrection();
  const exhausted = count >= REGEN_MAX[kind];
  const changed = value !== original;

  async function handleRegen() {
    if (exhausted || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await regenerateBlockClean(ctxBuilder());
      const trimmed = (next || "").trim();
      if (trimmed) {
        setSuggestions((arr) => [...arr, trimmed]);
        onRegenSuccess();
      } else {
        setError("Sugestão vazia — tente de novo.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cardField" style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span className="fieldLabel">{label}</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleRegen}
            disabled={busy || exhausted}
            title={
              exhausted
                ? `Limite de ${REGEN_MAX[kind]} regenerações atingido`
                : `Gerar outra ${kind} com IA`
            }
            style={{
              background: "none",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "#0f172a",
              cursor: busy || exhausted ? "not-allowed" : "pointer",
              opacity: busy || exhausted ? 0.5 : 1,
            }}
          >
            {busy
              ? "Gerando…"
              : exhausted
                ? `✨ ${REGEN_MAX[kind]}/${REGEN_MAX[kind]}`
                : `✨ Gerar outro (${count}/${REGEN_MAX[kind]})`}
          </button>
          <button
            type="button"
            onClick={() =>
              correction.correct(value, (corrected) => setSuggestions((arr) => [...arr, corrected]))
            }
            disabled={correction.correcting || !value.trim()}
            title="Corrige ortografia e gramática deste texto"
            style={{
              background: "none",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 600,
              color: "#0f172a",
              cursor: correction.correcting || !value.trim() ? "not-allowed" : "pointer",
              opacity: correction.correcting || !value.trim() ? 0.5 : 1,
            }}
          >
            {correction.correcting ? "Corrigindo…" : "🔤 Corrigir português"}
          </button>
          {changed && (
            <button
              type="button"
              onClick={() => onChange(original)}
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
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: `1px solid ${exhausted ? "#fcd34d" : "#e2e8f0"}`,
            fontFamily: "inherit",
            fontSize: 14,
            lineHeight: 1.45,
            resize: "vertical",
            background: exhausted ? "#fffbeb" : "#fff",
            color: "#0f172a",
          }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: `1px solid ${exhausted ? "#fcd34d" : "#e2e8f0"}`,
            fontFamily: "inherit",
            fontSize: 14,
            background: exhausted ? "#fffbeb" : "#fff",
            color: "#0f172a",
          }}
        />
      )}
      {maxWords != null && (
        <div
          style={{
            textAlign: "right",
            fontSize: 11,
            marginTop: 2,
            color: countWords(value, excludeTexts) > maxWords ? "#dc2626" : "#94a3b8",
            fontWeight: countWords(value, excludeTexts) > maxWords ? 600 : 400,
          }}
        >
          {countWords(value, excludeTexts)}/{maxWords} palavras
        </div>
      )}
      {error && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b91c1c" }}>{error}</p>}
      {correction.msg && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#16a34a" }}>{correction.msg}</p>
      )}
      {correction.error && (
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b91c1c" }}>{correction.error}</p>
      )}
      {exhausted && !error && suggestions.length === 0 && (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#92400e" }}>
          Limite atingido — edite manualmente ou volte ao inicial.
        </p>
      )}
      {suggestions.length > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <span className="eyebrow" style={{ fontSize: 10, color: "#0f172a" }}>
              {suggestions.length > 1 ? "Sugestões da IA" : "Sugestão da IA"}
            </span>
            <button
              type="button"
              onClick={() => setSuggestions([])}
              style={{
                background: "none",
                border: "none",
                fontSize: 16,
                cursor: "pointer",
                color: "#64748b",
                padding: 0,
                lineHeight: 1,
              }}
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          {suggestions.length > 1 && (
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#64748b" }}>
              Compare e escolha a que preferir.
            </p>
          )}
          {kind === "legenda" && (
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#92400e" }}>
              Pendente — clique em "Usar esta" para substituir a legenda atual.
            </p>
          )}
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns:
                suggestions.length > 1 ? "repeat(auto-fit, minmax(200px, 1fr))" : "1fr",
            }}
          >
            {suggestions.map((sugg, idx) => (
              <div
                key={idx}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {suggestions.length > 1 && (
                  <span className="eyebrow" style={{ fontSize: 9, color: "#64748b" }}>
                    Sugestão {idx + 1}
                  </span>
                )}
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "#0f172a", flex: 1 }}>
                  {sugg}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onChange(sugg);
                    setSuggestions([]);
                  }}
                  style={{
                    background: "#0f172a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "5px 12px",
                    fontSize: 12,
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
        </div>
      )}
    </div>
  );
}
