import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin")({
  component: () => (
    <AuthGate requireAdmin>
      <TopBar />
      <AdminPage />
    </AuthGate>
  ),
});

const trigger =
  "rounded-none bg-transparent shadow-none px-3.5 py-2.5 text-sm font-semibold -mb-px border-b-2 border-transparent data-[state=active]:border-brand-primary data-[state=active]:text-brand-primary data-[state=inactive]:text-slate-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none";

function AdminPage() {
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
          style={{ fontSize: 13, color: "var(--brand-primary)", textDecoration: "none", fontWeight: 600 }}
        >
          ← Voltar para Home
        </Link>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList className="h-auto gap-0 bg-transparent p-0 border-b border-slate-200 mb-5 flex-wrap rounded-none">
          <TabsTrigger value="clientes" className={trigger}>Clientes</TabsTrigger>
          <TabsTrigger value="convites" className={trigger}>Convites</TabsTrigger>
          <TabsTrigger value="planos" className={trigger}>Planos</TabsTrigger>
          <TabsTrigger value="consumo" className={trigger}>Consumo</TabsTrigger>
          <TabsTrigger value="financeiro" className={trigger}>Financeiro</TabsTrigger>
          <TabsTrigger value="configuracoes" className={trigger}>Configurações</TabsTrigger>
          <TabsTrigger value="divulgacao" className={trigger}>Divulgação</TabsTrigger>
          <TabsTrigger value="storage" className={trigger}>Storage</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes"><ClientesTab /></TabsContent>
        <TabsContent value="convites"><InvitesTab /></TabsContent>
        <TabsContent value="planos"><PlansTab /></TabsContent>
        <TabsContent value="consumo"><UsageTab /></TabsContent>
        <TabsContent value="financeiro"><FinanceiroTab /></TabsContent>
        <TabsContent value="configuracoes"><SettingsTab /></TabsContent>
        <TabsContent value="divulgacao"><DivulgacaoTab /></TabsContent>
        <TabsContent value="storage"><StorageTab /></TabsContent>
      </Tabs>
    </div>
  );
}
