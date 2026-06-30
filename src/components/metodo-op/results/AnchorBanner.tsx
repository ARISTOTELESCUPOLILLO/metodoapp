// Banner de controle da "pessoa nas imagens" (âncora vs. livre) — extraído de
// ResultsView.tsx (Fase 8).

import { AGE_OPTIONS } from "../../../core/audienceAge";
import type { AnchorControl } from "./AnchorIndicator";

interface AnchorBannerProps {
  control: AnchorControl;
  mode: "ancora" | "livre";
  onToggleMode: () => void;
  open: boolean;
  onToggleOpen: () => void;
}

export function AnchorBanner({
  control,
  mode,
  onToggleMode,
  open,
  onToggleOpen,
}: AnchorBannerProps) {
  return (
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
        onClick={onToggleOpen}
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
          {mode === "ancora" ? (
            <strong style={{ color: "#0f172a" }}>
              {control.genderEffective === "mulher" ? "F" : "M"} ·{" "}
              {control.ageEffective.replace(" anos", "").replace(" ano", "")}
            </strong>
          ) : (
            <strong style={{ color: "#64748b" }}>Livre</strong>
          )}
        </span>
        <span style={{ fontSize: 10, color: "#94a3b8" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
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
            onClick={onToggleMode}
            style={{
              fontSize: 12,
              padding: "4px 12px",
              border: "1px solid #e2e8f0",
              background: mode === "livre" ? "#f1f5f9" : "#0f172a",
              color: mode === "livre" ? "#475569" : "#fff",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {mode === "ancora" ? "Mudar p/ Livre" : "Mudar p/ Âncora"}
          </button>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {mode === "ancora"
              ? "Âncora: mesma pessoa em todas as peças."
              : "Livre: a IA varia a pessoa em cada peça."}
          </span>
          {mode === "ancora" && (
            <>
              <button
                type="button"
                onClick={control.onFlipGender}
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
                Trocar p/ {control.genderEffective === "mulher" ? "Masculino" : "Feminino"}
              </button>
              <select
                value={control.ageEffective}
                onChange={(e) => control.onChangeAge(e.target.value)}
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
                {!AGE_OPTIONS.includes(control.ageEffective) && (
                  <option value={control.ageEffective}>{control.ageEffective}</option>
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
  );
}
