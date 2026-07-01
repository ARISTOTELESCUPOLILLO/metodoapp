// Primitivos de tabela compartilhados da aba Usuários — extraído de UsersTab.tsx (Fase 9).
import type { ReactNode } from "react";

export const Th = ({ children, title }: { children: ReactNode; title?: string }) => (
  <th
    title={title}
    style={{
      padding: "6px 8px",
      textAlign: "left",
      fontSize: 12,
      color: "#475569",
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </th>
);

export const Td = ({ children }: { children: ReactNode }) => (
  <td style={{ padding: "6px 8px", verticalAlign: "middle" }}>{children}</td>
);

export const MRow = ({ k, children }: { k: string; children: ReactNode }) => (
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
