import { UsersTab } from "./UsersTab";
import { TestUsersTab } from "./TestUsersTab";
import { CobrancasTab } from "./CobrancasTab";
import { PlanHistoricoTab } from "./PlanHistoricoTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const trigger =
  "rounded-none bg-transparent shadow-none px-3.5 py-2 text-[13px] font-semibold -mb-px border-b-2 border-transparent data-[state=active]:border-brand-primary data-[state=active]:text-brand-primary data-[state=inactive]:text-slate-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none";

export function ClientesTab() {
  return (
    <Tabs defaultValue="usuarios">
      <TabsList className="h-auto gap-0 bg-transparent p-0 border-b border-slate-200 mb-5 flex-wrap rounded-none">
        <TabsTrigger value="usuarios" className={trigger}>Usuários</TabsTrigger>
        <TabsTrigger value="testes" className={trigger}>Testes</TabsTrigger>
        <TabsTrigger value="cobrancas" className={trigger}>Cobranças</TabsTrigger>
        <TabsTrigger value="historico" className={trigger}>Histórico de Planos</TabsTrigger>
      </TabsList>
      <TabsContent value="usuarios"><UsersTab /></TabsContent>
      <TabsContent value="testes"><TestUsersTab /></TabsContent>
      <TabsContent value="cobrancas"><CobrancasTab /></TabsContent>
      <TabsContent value="historico"><PlanHistoricoTab /></TabsContent>
    </Tabs>
  );
}
