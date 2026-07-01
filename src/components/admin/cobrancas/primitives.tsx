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
