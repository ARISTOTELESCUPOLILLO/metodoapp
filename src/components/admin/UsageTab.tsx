import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { loadUsageData } from "@/lib/usage.functions";
import { Card } from "./usage/primitives";
import { UsageTable } from "./usage/UsageTable";
import { UsageMobileList } from "./usage/UsageMobileList";
import type { Log, ProfileInfo } from "./usage/types";

export function UsageTab() {
  const isMobile = useIsMobile();
  const loadUsageDataFn = useServerFn(loadUsageData);

  const [logs, setLogs] = useState<Log[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [adminEmails, setAdminEmails] = useState<Record<string, string>>({});
  const [days, setDays] = useState(30);
  const [usdRate, setUsdRate] = useState(5.8);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadUsageDataFn({ data: { days } });
    setLogs(data.logs);
    setProfiles(data.profiles);
    setAdminEmails(data.adminEmails);
    setUsdRate(data.usdRate);
    setLoading(false);
  }, [loadUsageDataFn, days]);

  useEffect(() => {
    load();
  }, [load]);

  const q = search.toLowerCase().trim();
  const filteredLogs = q
    ? logs.filter((l) => {
        const p = l.user_id ? profiles[l.user_id] : undefined;
        const email = p?.email || "";
        const nome = p?.nome || "";
        const label = p?.is_test
          ? `teste [${nome}]`
          : l.slot === "bonus"
            ? `bônus [${nome || email}]`
            : email;
        return (
          label.toLowerCase().includes(q) ||
          email.toLowerCase().includes(q) ||
          nome.toLowerCase().includes(q) ||
          (l.user_id || "").toLowerCase().startsWith(q) ||
          (l.modulo || "").toLowerCase().includes(q) ||
          l.evento.toLowerCase().includes(q)
        );
      })
    : logs;

  const totalImgs = filteredLogs.reduce((s, l) => s + (l.qtd_imagens || 0), 0);
  const totalRenders = filteredLogs.reduce((s, l) => s + (l.qtd_renders || 0), 0);
  const totalGeracoes = filteredLogs.reduce((s, l) => s + (l.qtd_geracoes || 0), 0);
  const totalUsd = filteredLogs.reduce((s, l) => s + Number(l.custo_usd || 0), 0);
  const totalBrl = totalUsd * usdRate;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Consumo</h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #cbd5e1",
            fontSize: 13,
          }}
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          câmbio US$ 1 = R$ {usdRate.toFixed(2)}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <input
            placeholder="Buscar por nome, e-mail, evento ou módulo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "6px 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 13,
              minWidth: 240,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                padding: "5px 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                background: "#f1f5f9",
                fontSize: 12,
                cursor: "pointer",
                color: "#475569",
              }}
            >
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Card label="Imagens" value={totalImgs.toLocaleString("pt-BR")} />
        <Card label="Renders" value={totalRenders.toLocaleString("pt-BR")} />
        <Card label="Gerações" value={totalGeracoes.toLocaleString("pt-BR")} />
        <Card label="Custo US$" value={`$ ${totalUsd.toFixed(2)}`} />
        <Card label="Custo R$" value={`R$ ${totalBrl.toFixed(2)}`} />
      </div>

      {loading ? (
        <p>Carregando…</p>
      ) : isMobile ? (
        <UsageMobileList logs={filteredLogs} profiles={profiles} usdRate={usdRate} />
      ) : (
        <UsageTable
          logs={filteredLogs}
          profiles={profiles}
          adminEmails={adminEmails}
          usdRate={usdRate}
        />
      )}
    </div>
  );
}
