// Lista mobile da aba Consumo — extraído de UsageTab.tsx (Fase 9).
import { usuarioLabel } from "./UsuarioCell";
import type { Log, ProfileInfo } from "./types";

export function UsageMobileList({
  logs,
  profiles,
  usdRate,
}: {
  logs: Log[];
  profiles: Record<string, ProfileInfo>;
  usdRate: number;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {logs.map((l) => (
        <div
          key={l.id}
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <strong>{l.evento}</strong>
            <span style={{ color: "#64748b", fontSize: 12 }}>
              {new Date(l.created_at).toLocaleString("pt-BR")}
            </span>
          </div>
          <div style={{ color: "#475569", fontSize: 12, marginBottom: 6, wordBreak: "break-all" }}>
            {usuarioLabel(l, profiles)}
            {l.modulo ? ` · ${l.modulo}` : ""}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, flexWrap: "wrap" }}>
            <span>
              Img: <strong>{l.qtd_imagens}</strong>
            </span>
            <span>
              Rdr: <strong>{l.qtd_renders}</strong>
            </span>
            <span>
              Ger: <strong>{l.qtd_geracoes}</strong>
            </span>
            <span>
              US$ <strong>{Number(l.custo_usd).toFixed(2)}</strong>
            </span>
            <span>
              R$ <strong>{(Number(l.custo_usd) * usdRate).toFixed(2)}</strong>
            </span>
          </div>
        </div>
      ))}
      {logs.length === 0 && (
        <p style={{ textAlign: "center", color: "#64748b" }}>Sem registros no período.</p>
      )}
    </div>
  );
}
