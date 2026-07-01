// Card de saldo de API (fal.ai/OpenAI) — extraído de VisaoGeralTab.tsx (Fase 9).
import { coverBg, coverColor, coverLabel } from "./computeVisaoGeralView";

export function ApiCard({
  name,
  balance,
  custo,
  cycles,
  barPct,
}: {
  name: string;
  balance: string;
  custo: string;
  cycles: number | null;
  barPct: number;
}) {
  const cc = coverColor(cycles);
  const bg = coverBg(cycles);
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "14px 18px",
        minWidth: 240,
        flex: 1,
      }}
    >
      <div
        style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-primary)", marginBottom: 8 }}
      >
        {name}
      </div>

      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}
      >
        <span style={{ color: "#64748b" }}>Saldo</span>
        <span style={{ fontWeight: 700, color: "var(--brand-primary)" }}>{balance}</span>
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 10 }}
      >
        <span style={{ color: "#64748b" }}>Custo proj.</span>
        <span style={{ fontWeight: 600, color: "#b45309" }}>{custo}</span>
      </div>

      <div style={{ background: "#e2e8f0", borderRadius: 99, height: 6, marginBottom: 6 }}>
        <div
          style={{
            background: cc,
            borderRadius: 99,
            height: 6,
            width: `${Math.max(2, barPct)}%`,
            transition: "width .3s",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>Cobertura</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            background: bg,
            color: cc,
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          {coverLabel(cycles)}
        </span>
      </div>
    </div>
  );
}
