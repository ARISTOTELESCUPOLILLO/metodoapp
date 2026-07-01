// Primitivos visuais da aba Consumo — extraído de UsageTab.tsx (Fase 9).

export const Th = ({ children }: { children: React.ReactNode }) => (
  <th
    style={{
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 12,
      color: "#475569",
      fontWeight: 600,
    }}
  >
    {children}
  </th>
);
export const Td = ({ children }: { children: React.ReactNode }) => (
  <td style={{ padding: "8px 10px" }}>{children}</td>
);
export const Card = ({ label, value }: { label: string; value: string }) => (
  <div style={{ background: "#f1f5f9", padding: 12, borderRadius: 8 }}>
    <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--brand-primary)", marginTop: 2 }}>
      {value}
    </div>
  </div>
);
