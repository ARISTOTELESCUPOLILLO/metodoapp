import { AnchoraVisual } from "../../../types";
import { PersonagemGender } from "../../../core/visualDirection";
import { AGE_OPTIONS } from "../../../core/audienceAge";

export interface AnchorControl {
  ancoragem: AnchoraVisual;
  genderEffective: PersonagemGender;
  ageEffective: string;
  onFlipGender: () => void;
  onChangeAge: (age: string) => void;
}

export function AnchorIndicator({
  control,
  hideWhenAvatar,
}: {
  control?: AnchorControl;
  hideWhenAvatar: boolean;
}) {
  if (!control || hideWhenAvatar) return null;
  const sex = control.genderEffective === "mulher" ? "F" : "M";
  const age = control.ageEffective.replace(" anos", "").replace(" ano", "");
  const currentAge = control.ageEffective;
  const ageInList = AGE_OPTIONS.includes(currentAge);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "6px 0 10px",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#475569",
          fontWeight: 700,
          background: "#f1f5f9",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          padding: "3px 9px",
          letterSpacing: 0.3,
        }}
      >
        {sex} · {age}
      </span>
      <button
        type="button"
        onClick={control.onFlipGender}
        style={{
          fontSize: 11,
          padding: "3px 10px",
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
        value={currentAge}
        onChange={(e) => control.onChangeAge(e.target.value)}
        style={{
          fontSize: 11,
          padding: "3px 6px",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          background: "#fff",
          color: "#475569",
          cursor: "pointer",
        }}
      >
        {!ageInList && <option value={currentAge}>{currentAge}</option>}
        {AGE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
