// Primitivos visuais da aba Histórico de Planos — extraído de PlanHistoricoTab.tsx (Fase 9.1).

export function Th({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        padding: "8px 10px",
        textAlign: "left",
        fontWeight: 700,
        fontSize: 12,
        color: "#64748b",
        background: "#f8fafc",
        ...style,
      }}
    >
      {children}
    </th>
  );
}
export function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "8px 10px",
        fontSize: 13,
        borderTop: "1px solid #e2e8f0",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
