// Primitivos visuais da aba Cobranças — extraído de CobrancasTab.tsx (Fase 9).

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

export const Td = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => <td style={{ padding: "8px 10px", verticalAlign: "middle", ...style }}>{children}</td>;

export const actionBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #cbd5e1",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};

// Box de cliente (um por cliente, agrupando os slots dele).
export const mCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
};

// Linha label:valor empilhada (usada no layout mobile de cada slot).
export const Row = ({ k, v, vColor }: { k: string; v: string; vColor?: string }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "4px 0",
      fontSize: 13,
      borderTop: "1px solid #f1f5f9",
    }}
  >
    <span style={{ color: "#64748b" }}>{k}</span>
    <span style={{ fontWeight: 600, color: vColor ?? "#0f172a" }}>{v}</span>
  </div>
);
