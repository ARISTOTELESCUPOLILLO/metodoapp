// Primitivos visuais da aba Convites — extraído de InvitesTab.tsx (Fase 9).

export const card: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 20,
};
export const cardTitle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 16,
  fontWeight: 700,
  color: "#2563eb",
};
export const inp: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  width: "100%",
};
export const btn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #cbd5e1",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};

export const Th = ({ children }: { children: React.ReactNode }) => (
  <th
    style={{
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 12,
      color: "#64748b",
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
}) => <td style={{ padding: "10px", verticalAlign: "middle", ...style }}>{children}</td>;

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</span>
      {children}
    </label>
  );
}

export const IRow = ({ k, v }: { k: string; v: string }) => (
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
    <span style={{ fontWeight: 600, color: "#0f172a" }}>{v}</span>
  </div>
);
