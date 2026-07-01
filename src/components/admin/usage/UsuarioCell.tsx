// Renderização da coluna "Usuário" (identifica teste/bônus/admin gerador) —
// extraído de UsageTab.tsx (Fase 9).
import type { Log, ProfileInfo } from "./types";

export function UsuarioCell({
  log,
  profiles,
  adminEmails,
}: {
  log: Log;
  profiles: Record<string, ProfileInfo>;
  adminEmails: Record<string, string>;
}) {
  if (!log.user_id) return <span>—</span>;
  const p = profiles[log.user_id];

  if (p?.is_test) {
    // Preferência: admin que GEROU este item (impersonated_by); fallback: admin que CRIOU o teste.
    const generatorEmail = log.impersonated_by
      ? adminEmails[log.impersonated_by] || "?"
      : p.created_by
        ? adminEmails[p.created_by] || "?"
        : "—";
    return (
      <div>
        <span style={{ fontWeight: 700, color: "#d97706" }}>TESTE [{p.nome || "sem nome"}]</span>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{generatorEmail}</div>
      </div>
    );
  }

  if (log.slot === "bonus") {
    const nome = p?.nome || p?.email || log.user_id.slice(0, 8);
    const adminEmail = p?.bonus_assigned_by ? adminEmails[p.bonus_assigned_by] || "?" : "—";
    return (
      <div>
        <span style={{ fontWeight: 700, color: "#7c3aed" }}>BÔNUS [{nome}]</span>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{adminEmail}</div>
      </div>
    );
  }

  return <span>{p?.email || log.user_id.slice(0, 8)}</span>;
}

export function usuarioLabel(log: Log, profiles: Record<string, ProfileInfo>): string {
  if (!log.user_id) return "—";
  const p = profiles[log.user_id];
  if (p?.is_test) return `TESTE [${p.nome || "sem nome"}]`;
  if (log.slot === "bonus") return `BÔNUS [${p?.nome || p?.email || log.user_id.slice(0, 8)}]`;
  return p?.email || log.user_id.slice(0, 8);
}
