// Tile de seleção de referência visual (avatar/fachada/cenário/produto/fato/
// venda) do Post Único — extraído de PostUnicoComposicaoVisual.tsx (PLANO_V2
// Fase 9.1). JSX movido 1:1, sem mudança de comportamento.
export function Tile({
  checked,
  onToggle,
  url,
  label,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  url?: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      title={disabled ? "Limite atingido — desmarque um item para trocar" : undefined}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "#cffafe" : "#fff",
        border: `1px solid ${checked ? "#0891b2" : "#e2e8f0"}`,
        fontSize: 10,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 6,
          overflow: "hidden",
          background: "#fff",
          border: "1px solid #cbd5e1",
        }}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              color: "#94a3b8",
            }}
          >
            —
          </span>
        )}
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            width: 16,
            height: 16,
            minWidth: 16,
            margin: 0,
            padding: 0,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#0f172a",
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        {label}
      </span>
    </label>
  );
}
