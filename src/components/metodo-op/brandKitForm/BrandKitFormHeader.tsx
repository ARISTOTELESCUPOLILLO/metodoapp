// Cabeçalho recolhível do Kit de Marca (título, resumo quando fechado,
// botões "Carregar meu Kit"/"Limpar", seta de expandir) — extraído de
// BrandKitForm.tsx (PLANO_V2 Fase 9.1). JSX movido 1:1, sem mudança de
// comportamento.
import type { BrandKit } from "../../../types";

interface Props {
  kit: BrandKit;
  isOpen: boolean;
  onToggle: () => void;
  onLoad?: () => void;
  onClear?: () => void;
  loading?: boolean;
  saving?: boolean;
}

export function BrandKitFormHeader({
  kit,
  isOpen,
  onToggle,
  onLoad,
  onClear,
  loading,
  saving,
}: Props) {
  return (
    <div
      className="sectionHeader"
      onClick={onToggle}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 24,
        flexWrap: "wrap",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ margin: 0 }}>Kit de Marca</h2>
        {!isOpen && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
              flexWrap: "wrap",
            }}
          >
            {kit.companyName && (
              <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>
                {kit.companyName}
              </span>
            )}
            {(kit.primaryColor || kit.secondaryColor || kit.accentColor) && (
              <div style={{ display: "flex", gap: 4 }}>
                {[kit.primaryColor, kit.secondaryColor, kit.accentColor].map((c, i) =>
                  c ? (
                    <span
                      key={i}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: c,
                        border: "1.5px solid #e2e8f0",
                        display: "inline-block",
                      }}
                    />
                  ) : null,
                )}
              </div>
            )}
            <span style={{ fontSize: 11, color: "#94a3b8" }}>clique para editar</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {onLoad && isOpen && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLoad();
              }}
              disabled={loading || saving}
              style={{
                background: "#f8fafc",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "0 16px",
                minHeight: 40,
                fontWeight: 700,
                fontSize: 14,
                cursor: loading || saving ? "not-allowed" : "pointer",
              }}
              title="Carregar o Kit de Marca que você já salvou"
            >
              {loading ? "Carregando..." : "↺ Carregar meu Kit"}
            </button>
            {onClear && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                disabled={loading || saving}
                style={{
                  background: "#f8fafc",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  padding: "0 16px",
                  minHeight: 40,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading || saving ? "not-allowed" : "pointer",
                }}
                title="Limpar Kit de Marca e dados locais"
              >
                Limpar
              </button>
            )}
          </div>
        )}
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#64748b"
          strokeWidth={2.5}
          style={{
            flexShrink: 0,
            transition: "transform 0.3s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
