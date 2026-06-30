import { CustosTab } from "./CustosTab";
import { ProjecaoTab } from "./ProjecaoTab";
import { ClientesFinanceiroTab } from "./ClientesFinanceiroTab";
import { VisaoGeralTab } from "./VisaoGeralTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const trigger =
  "rounded-none bg-transparent shadow-none px-3.5 py-2 text-[13px] font-semibold -mb-px border-b-2 border-transparent data-[state=active]:border-brand-primary data-[state=active]:text-brand-primary data-[state=inactive]:text-slate-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none";

export function FinanceiroTab() {
  return (
    <Tabs defaultValue="visao">
      <TabsList className="h-auto gap-0 bg-transparent p-0 border-b border-slate-200 mb-5 flex-wrap rounded-none">
        <TabsTrigger value="visao" className={trigger}>Painel</TabsTrigger>
        <TabsTrigger value="custos" className={trigger}>Custos e Consumo</TabsTrigger>
        <TabsTrigger value="projecao" className={trigger}>Projeção de Compras</TabsTrigger>
        <TabsTrigger value="clientes" className={trigger}>Clientes</TabsTrigger>
      </TabsList>
      <TabsContent value="visao"><VisaoGeralTab /></TabsContent>
      <TabsContent value="custos"><CustosTab /></TabsContent>
      <TabsContent value="projecao"><ProjecaoTab /></TabsContent>
      <TabsContent value="clientes"><ClientesFinanceiroTab /></TabsContent>
    </Tabs>
  );
}
