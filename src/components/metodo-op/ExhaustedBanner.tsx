interface Props {
  exhaustedHint: "mop" | "pu" | "bonus" | null;
}

const bannerStyle = {
  background: "rgba(239,68,68,.15)",
  border: "1px solid rgba(239,68,68,.30)",
  borderRadius: 8,
  padding: "6px 14px",
  color: "#fca5a5",
  fontSize: 12,
  fontWeight: 600,
  textAlign: "center" as const,
};

export function ExhaustedBanner({ exhaustedHint }: Props) {
  if (!exhaustedHint) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
      {exhaustedHint === "mop" && (
        <div style={bannerStyle}>Método OP esgotado — Renove com o administrador</div>
      )}
      {exhaustedHint === "pu" && (
        <div style={bannerStyle}>Post Único esgotado — Renove com o administrador</div>
      )}
      {exhaustedHint === "bonus" && <div style={bannerStyle}>Bônus Esgotado</div>}
    </div>
  );
}
