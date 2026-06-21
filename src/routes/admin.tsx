import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthGate } from "@/components/app/AuthGate";
import { TopBar } from "@/components/app/TopBar";
import { ClientesTab } from "@/components/admin/ClientesTab";
import { InvitesTab } from "@/components/admin/InvitesTab";
import { PlansTab } from "@/components/admin/PlansTab";
import { UsageTab } from "@/components/admin/UsageTab";
import { FinanceiroTab } from "@/components/admin/FinanceiroTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { DivulgacaoTab } from "@/components/admin/DivulgacaoTab";
import { StorageTab } from "@/components/admin/StorageTab";

export const Route = createFileRoute("/admin")({
  component: () => (
    <AuthGate requireAdmin>
      <TopBar />
      <AdminPage />
    </AuthGate>
  ),
});

type Tab =
  | "clientes"
  | "convites"
  | "planos"
  | "consumo"
  | "financeiro"
  | "configuracoes"
  | "divulgacao"
  | "storage";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("clientes");
  const tabs: { id: Tab; label: string }[] = [
    { id: "clientes", label: "Clientes" },
    { id: "convites", label: "Convites" },
    { id: "planos", label: "Planos" },
    { id: "consumo", label: "Consumo" },
    { id: "financeiro", label: "Financeiro" },
    { id: "configuracoes", label: "Configurações" },
    { id: "divulgacao", label: "Divulgação" },
    { id: "storage", label: "Storage" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 12px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Administração</h1>
        <Link
          to="/"
          style={{ fontSize: 13, color: "#0f213f", textDecoration: "none", fontWeight: 600 }}
        >
          ← Voltar para Home
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid #e2e8f0",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "transparent",
              border: "none",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              color: tab === t.id ? "#0f213f" : "#64748b",
              borderBottom: tab === t.id ? "2px solid #0f213f" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "clientes" && <ClientesTab />}
      {tab === "convites" && <InvitesTab />}
      {tab === "planos" && <PlansTab />}
      {tab === "consumo" && <UsageTab />}
      {tab === "financeiro" && <FinanceiroTab />}
      {tab === "configuracoes" && <SettingsTab />}
      {tab === "divulgacao" && <DivulgacaoTab />}
      {tab === "storage" && <StorageTab />}
    </div>
  );
}
