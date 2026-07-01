// Estilos inline compartilhados da aba Usuários — extraído de UsersTab.tsx (Fase 9).
import type { CSSProperties } from "react";

export const actionBtn: CSSProperties = {
  background: "transparent",
  border: "1px solid #cbd5e1",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};

export const pill = (color: string): CSSProperties => ({
  background: color,
  color: "#fff",
  border: "none",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  textTransform: "lowercase",
});

export const dangerBtn: CSSProperties = {
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
};

export const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: 16,
};

export const modal: CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  width: "100%",
  maxWidth: 380,
  maxHeight: "90vh",
  overflowY: "auto",
};

export const lbl: CSSProperties = { fontSize: 12, fontWeight: 600, color: "#0f172a" };

export const inp: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  background: "#fff",
};

export const miniSave: CSSProperties = {
  background: "#15803d",
  color: "#fff",
  border: "none",
  padding: "1px 6px",
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

export const miniCancel: CSSProperties = {
  background: "#94a3b8",
  color: "#fff",
  border: "none",
  padding: "1px 6px",
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
