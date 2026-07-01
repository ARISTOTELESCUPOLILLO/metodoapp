// Primitivos de layout/tabela da aba Custos — extraído de CustosTab.tsx (Fase 9).
import type { CSSProperties, ReactNode } from "react";

export const tblWrap: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  overflowX: "auto",
};
export const tbl: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
export const tRow: CSSProperties = { borderTop: "1px solid #e2e8f0" };

export const Th = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <th
    style={{
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 12,
      color: "#475569",
      fontWeight: 600,
      ...style,
    }}
  >
    {children}
  </th>
);

export const Td = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => (
  <td style={{ padding: "8px 10px", ...style }}>{children}</td>
);

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export function SummaryCard({
  label,
  value,
  sub,
  description,
  dark,
  warn,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  description?: string;
  dark?: boolean;
  warn?: boolean;
  highlight?: boolean;
}) {
  const bg = dark ? "var(--brand-primary)" : highlight ? "#fef2f2" : warn ? "#fffbeb" : "#f1f5f9";
  const col = dark ? "#fff" : "#0f172a";
  const subCol = dark ? "rgba(255,255,255,.5)" : warn ? "#92400e" : "#94a3b8";
  return (
    <div style={{ background: bg, padding: "12px 14px", borderRadius: 10 }}>
      <div
        style={{ fontSize: 11, color: dark ? "rgba(255,255,255,.6)" : "#64748b", marginBottom: 2 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subCol, marginTop: 1 }}>{sub}</div>}
      {description && (
        <div
          style={{
            fontSize: 10,
            color: dark ? "rgba(255,255,255,.4)" : "#94a3b8",
            marginTop: 6,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
}
