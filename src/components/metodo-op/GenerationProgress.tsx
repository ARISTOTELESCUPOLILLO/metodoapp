import { useEffect, useState } from "react";

interface Props {
  active: boolean;
  // Tempo esperado em ms para a barra alcançar ~90%
  expectedMs?: number;
  label?: string;
}

export default function GenerationProgress({
  active,
  expectedMs = 60_000,
  label = "Gerando sua peça",
}: Props) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!active) {
      // Completa pra 100% e depois reseta no próximo ciclo
      setPct(100);
      const t = setTimeout(() => setPct(0), 600);
      return () => clearTimeout(t);
    }
    setPct(0);
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      // Curva que desacelera: assintótica a 90%
      const target = 90 * (1 - Math.exp(-elapsed / (expectedMs / 2.3)));
      setPct(target);
    }, 200);
    return () => clearInterval(id);
  }, [active, expectedMs]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "20px 22px",
        background: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 14,
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          height: 6,
          width: "100%",
          background: "rgba(15,23,42,0.08)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--brand-primary, #123a63)",
            borderRadius: 999,
            transition: "width 350ms ease-out",
          }}
        />
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "rgba(15,23,42,0.65)", letterSpacing: 0.2 }}>
        {label}
      </p>
    </div>
  );
}
