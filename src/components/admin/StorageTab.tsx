import { useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStorageStats, type StorageStatsResult } from "@/lib/storageStats.functions";

const FREE_TIER_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAX_BYTES_PER_USER = 47 * 1024 * 1024; // 47 MB — 48 imgs (300KB) + 6 renders (5.5MB)

function fmtMB(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function barColor(pct: number) {
  if (pct < 50) return "#22c55e";
  if (pct < 75) return "#f59e0b";
  if (pct < 90) return "#f97316";
  return "#ef4444";
}

export function StorageTab() {
  const fetchStats = useServerFn(getStorageStats);
  const [stats, setStats] = useState<StorageStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStats();
      setStats(result);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar dados de storage.");
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  const usedPct = stats ? Math.min(100, (stats.totalBytes / FREE_TIER_BYTES) * 100) : 0;
  const freeBytes = FREE_TIER_BYTES - (stats?.totalBytes ?? 0);

  const activeUsers = stats ? stats.byUser.filter((u) => !u.is_test) : [];
  const avgBytesPerUser = activeUsers.length > 0 ? stats!.totalBytes / activeUsers.length : 0;

  const cabeAtual =
    avgBytesPerUser > 0 ? Math.max(0, Math.floor(freeBytes / avgBytesPerUser)) : null;
  const cabePiorCaso = Math.max(0, Math.floor(freeBytes / MAX_BYTES_PER_USER));

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Cabeçalho */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Storage — Supabase Free Tier</h2>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            background: "#0f213f",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Carregando…" : "↻ Atualizar"}
        </button>
        {lastRefresh && (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Atualizado às {lastRefresh.toLocaleTimeString("pt-BR")}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            color: "#991b1b",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {!stats && !loading && !error && (
        <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
          Clique em "Atualizar" para carregar os dados.
        </div>
      )}

      {stats && (
        <>
          {/* Card uso geral */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 8,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 15 }}>Uso do bucket</span>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {fmtMB(stats.totalBytes)} / 1.024 MB &nbsp;·&nbsp; {stats.totalFiles} arquivos
              </span>
            </div>
            <div style={{ height: 16, background: "#e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 8,
                  width: `${usedPct.toFixed(1)}%`,
                  background: barColor(usedPct),
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
              {usedPct.toFixed(1)}% ocupado &nbsp;·&nbsp; {fmtMB(freeBytes)} livres
            </div>
          </div>

          {/* Card previsão */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              Previsão de capacidade
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              <Metric label="Usuários reais com storage" value={String(activeUsers.length)} />
              <Metric
                label="Uso médio por usuário"
                value={avgBytesPerUser > 0 ? fmtMB(avgBytesPerUser) : "—"}
              />
              <Metric label="Máximo teórico/usuário" value="47 MB" sub="48 imgs + 6 renders" />
              {cabeAtual !== null && (
                <Metric
                  label="Ainda cabem (ritmo atual)"
                  value={`~${cabeAtual} usuários`}
                  highlight
                />
              )}
              <Metric
                label="Ainda cabem (pior caso)"
                value={`~${cabePiorCaso} usuários`}
                highlight
              />
            </div>
          </div>

          {/* Tabela por usuário */}
          {stats.byUser.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Por usuário</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      {["Nome", "E-mail", "Storage", "Arquivos", ""].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 10px",
                            textAlign: "left",
                            fontWeight: 600,
                            color: "#475569",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byUser.map((u) => (
                      <tr key={u.user_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 500 }}>
                          {u.nome ?? <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                        <td style={{ padding: "8px 10px", color: "#64748b" }}>
                          {u.email ?? u.user_id.slice(0, 8) + "…"}
                        </td>
                        <td style={{ padding: "8px 10px", fontVariantNumeric: "tabular-nums" }}>
                          {fmtMB(u.bytes)}
                        </td>
                        <td style={{ padding: "8px 10px", color: "#64748b" }}>{u.files}</td>
                        <td style={{ padding: "8px 10px" }}>
                          {u.is_test && (
                            <span
                              style={{
                                fontSize: 11,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "#fef9c3",
                                color: "#854d0e",
                                fontWeight: 600,
                              }}
                            >
                              teste
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${highlight ? "#bfdbfe" : "#e2e8f0"}`,
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: highlight ? "#1d4ed8" : "#0f213f" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
