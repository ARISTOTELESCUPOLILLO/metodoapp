// Primitivos visuais da aba Projeção — extraído de ProjecaoTab.tsx (Fase 9).

export const usd = (v: number) => `US$ ${v.toFixed(2)}`;
export const fmt = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <h3
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: "var(--brand-primary)",
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </h3>
  );
}

export const Th = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <th
    style={{
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 12,
      color: "#475569",
      fontWeight: 600,
      whiteSpace: "nowrap",
      ...style,
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

export function ProjCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px" }}>
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color ?? "#111827" }}>{value}</div>
    </div>
  );
}

export function SupplierLink({
  href,
  color,
  label,
}: {
  href: string;
  color: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        fontSize: 12,
        fontWeight: 700,
        color,
        border: `1px solid ${color}40`,
        padding: "6px 14px",
        borderRadius: 6,
        textDecoration: "none",
        background: `${color}08`,
      }}
    >
      {label}
    </a>
  );
}
