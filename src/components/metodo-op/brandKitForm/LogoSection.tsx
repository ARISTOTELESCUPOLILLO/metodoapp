// Seção de Logotipo (upload/preview/remover), Posição da logomarca na peça
// e Uniforme da empresa (upload/preview/remover) do Kit de Marca — extraído
// de BrandKitForm.tsx (PLANO_V2 Fase 9.1). JSX movido 1:1, sem mudança de
// comportamento.
import type { BrandKit, LogoPosition } from "../../../types";
import { fileToDataUrl } from "../../../utils/file";

const LOGO_POSITIONS: { value: LogoPosition; label: string; hint: string }[] = [
  { value: "bottom-right", label: "Inferior direito", hint: "Padrão" },
  { value: "top-center", label: "Topo central", hint: "" },
  { value: "bottom-center", label: "Inferior central", hint: "" },
];

function LogoPositionPreview({ position, active }: { position: LogoPosition; active: boolean }) {
  const dot = {
    width: 10,
    height: 10,
    background: active ? "#0f172a" : "#475569",
    borderRadius: 2,
    position: "absolute" as const,
  };
  const style: React.CSSProperties =
    position === "top-center"
      ? { ...dot, top: 6, left: "50%", transform: "translateX(-50%)" }
      : position === "bottom-center"
        ? { ...dot, bottom: 6, left: "50%", transform: "translateX(-50%)" }
        : { ...dot, bottom: 6, right: 6 };
  return (
    <div
      style={{
        position: "relative",
        width: 44,
        height: 56,
        border: `1.5px solid ${active ? "#0f172a" : "#cbd5e1"}`,
        borderRadius: 4,
        background: "#fff",
      }}
    >
      <span style={style} />
    </div>
  );
}

interface Props {
  kit: BrandKit;
  update: <K extends keyof BrandKit>(key: K, value: BrandKit[K]) => void;
  onRemoveLogoClick: () => void;
  onRemoveUniformeClick: () => void;
}

export function LogoSection({ kit, update, onRemoveLogoClick, onRemoveUniformeClick }: Props) {
  return (
    <>
      <div className="grid2">
        <label>
          Logotipo
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) update("logoDataUrl", await fileToDataUrl(file));
            }}
          />
          {kit.logoDataUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <img
                src={kit.logoDataUrl}
                alt="logo"
                style={{
                  height: 40,
                  objectFit: "contain",
                  borderRadius: 8,
                  background: "#f1f5f9",
                  padding: 4,
                }}
              />
              <button
                type="button"
                onClick={onRemoveLogoClick}
                style={{
                  background: "#fff",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                title="Remover a logomarca atual"
              >
                🗑 Remover logomarca
              </button>
            </div>
          )}
        </label>

        <div>
          <strong style={{ display: "block", fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
            Posição da logomarca na peça
          </strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {LOGO_POSITIONS.map((p) => {
              const active = (kit.logoPosition || "bottom-right") === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => update("logoPosition", p.value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: `2px solid ${active ? "#0f172a" : "#cbd5e1"}`,
                    borderRadius: 10,
                    background: active ? "#f1f5f9" : "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                  title={`${p.label}${p.hint ? " — " + p.hint : ""}`}
                >
                  <LogoPositionPreview position={p.value} active={active} />
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      lineHeight: 1.2,
                    }}
                  >
                    {p.label}
                    {p.hint && (
                      <small style={{ color: "#64748b", fontWeight: 500 }}>{p.hint}</small>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="checkRow" style={{ alignSelf: "end", marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={kit.logoHasName}
            onChange={(e) => update("logoHasName", e.target.checked)}
          />
          Logotipo já contém o nome da marca
        </label>
      </div>

      <div className="grid2">
        <label>
          Uniforme da empresa (opcional)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) update("uniformeDataUrl", await fileToDataUrl(file));
            }}
          />
          <small style={{ color: "#64748b", fontWeight: 500, display: "block", marginTop: 4 }}>
            Foto da camisa/uniforme, sem rosto — usamos só a cor, o modelo e a posição da logo.
            Habilita a opção "Gerar com uniforme" nas peças.
          </small>
          {kit.uniformeDataUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <img
                src={kit.uniformeDataUrl}
                alt="uniforme"
                style={{
                  height: 64,
                  objectFit: "contain",
                  borderRadius: 8,
                  background: "#f1f5f9",
                  padding: 4,
                }}
              />
              <button
                type="button"
                onClick={onRemoveUniformeClick}
                style={{
                  background: "#fff",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
                title="Remover a foto do uniforme atual"
              >
                🗑 Remover uniforme
              </button>
            </div>
          )}
        </label>
      </div>
    </>
  );
}
