// Primitivos visuais da aba Planos — extraído de PlansTab.tsx (Fase 9).

export const Th = ({ children }: { children: React.ReactNode; title?: string }) => (
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
export const Td = ({ children }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{ padding: "8px 10px" }}>{children}</td>
);
export const btn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #cbd5e1",
  padding: "4px 10px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};
export const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: 16,
};
export const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  width: "100%",
  maxWidth: 420,
  maxHeight: "90vh",
  overflowY: "auto",
};
export const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#0f172a" };
export const inp: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  background: "#fff",
};
export const Inp = ({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) => (
  <label style={{ display: "grid", gap: 4 }}>
    <span style={lbl}>{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inp} />
  </label>
);

export const mCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
};
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
