import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { loadClientesFinanceiroData } from "@/lib/clientesFinanceiro.functions";
import { computeClientesFinanceiroView } from "./clientesFinanceiro/computeClientesFinanceiroView";
import { ClientCard } from "./clientesFinanceiro/ClientCard";
import type { Plan, Profile } from "./clientesFinanceiro/types";

function MiniCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "10px 16px",
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: color ?? "var(--brand-primary)" }}>
        {value}
      </div>
    </div>
  );
}

export function ClientesFinanceiroTab() {
  const loadClientesFinanceiroDataFn = useServerFn(loadClientesFinanceiroData);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [usdRate, setUsdRate] = useState(5.8);
  const [imgRef, setImgRef] = useState(0.058);
  const [renderPrice, setRenderPrice] = useState(1.6);
  const [geracaoPrice, setGeracaoPrice] = useState(0.013);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadClientesFinanceiroDataFn({ data: undefined });
    setProfiles(data.profiles);
    setPlans(data.plans);
    setAdminIds(new Set(data.adminIds));
    setUsdRate(data.usdRate);
    setImgRef(data.imgRef);
    setRenderPrice(data.renderPrice);
    setGeracaoPrice(data.geracaoPrice);
    setLoading(false);
  }, [loadClientesFinanceiroDataFn]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p style={{ color: "#64748b" }}>Carregando clientes…</p>;

  const clients = computeClientesFinanceiroView(
    profiles,
    plans,
    adminIds,
    { usdRate, imgRef, renderPrice, geracaoPrice },
    search,
  );

  return (
    <div>
      {/* Totais gerais (Total vendido/Custo/Lucro/Margem) já estão no Painel —
          aqui só a contagem, que serve de cabeçalho da lista filtrável abaixo. */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <MiniCard label="Clientes" value={String(clients.length)} />
      </div>

      <input
        placeholder="Buscar por nome ou e-mail"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: "8px 12px",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          fontSize: 14,
          width: "100%",
          maxWidth: 360,
          marginBottom: 16,
          display: "block",
        }}
      />

      {clients.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Nenhum cliente encontrado.</p>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 16 }}>
        "Vendido" = valor cobrado do cliente (campo R$ na aba Clientes/Usuários). "Custo proj." =
        custo projetado com 100% de uso × câmbio. "Lucro" = Vendido − Custo proj.
      </p>
    </div>
  );
}
