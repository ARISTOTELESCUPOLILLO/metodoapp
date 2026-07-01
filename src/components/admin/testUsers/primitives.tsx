// Primitivos visuais da aba Testes — extraído de TestUsersTab.tsx (Fase 9.1).
import type { Plan, Segmento } from "./types";

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
  color: "#7c3aed",
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
export const MRow = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 0",
      borderTop: "1px solid #f1f5f9",
      fontSize: 13,
      gap: 8,
    }}
  >
    <span style={{ color: "#64748b" }}>{k}</span>
    <span style={{ textAlign: "right" }}>{children}</span>
  </div>
);
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</span>
      {children}
    </label>
  );
}

export function SlotBar({
  iu,
  il,
  ru,
  rl,
  gu,
  gl,
}: {
  iu: number;
  il: number;
  ru: number;
  rl: number;
  gu: number;
  gl: number;
}) {
  const pct = il > 0 ? Math.min(100, Math.round((iu / il) * 100)) : 0;
  const color = pct >= 100 ? "#dc2626" : pct >= 90 ? "#d97706" : "#2563eb";
  const extras = [ru > 0 ? `r ${ru}/${rl}` : "", gu > 0 ? `g ${gu}/${gl}` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <div style={{ marginTop: 4, minWidth: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color }}>
        <span>
          {iu}/{il} img{extras ? ` · ${extras}` : ""}
        </span>
        <span>{pct}%</span>
      </div>
      <div
        style={{
          height: 3,
          background: "#e2e8f0",
          borderRadius: 999,
          overflow: "hidden",
          marginTop: 2,
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

export function SegSelect({
  value,
  onChange,
}: {
  value: Segmento | null;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "4px 6px",
        borderRadius: 4,
        border: "1px solid #cbd5e1",
        fontSize: 12,
        maxWidth: 130,
      }}
    >
      <option value="">—</option>
      <option value="SERVIÇOS">SERVIÇOS</option>
      <option value="VAREJO">VAREJO</option>
      <option value="MARCA">MARCA</option>
    </select>
  );
}
export function PlanSelect({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: Plan[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "4px 6px",
        borderRadius: 4,
        border: "1px solid #cbd5e1",
        fontSize: 12,
        maxWidth: 150,
      }}
    >
      <option value="">— vazio —</option>
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.codigo}
        </option>
      ))}
    </select>
  );
}
