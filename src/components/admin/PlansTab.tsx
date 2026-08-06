import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfirm } from "@/hooks/useConfirm";
import { loadPlansData, savePlan, deletePlan } from "@/lib/plans.functions";
import { PlansList } from "./plans/PlansList";
import { PlanEditModal, type EditingPlan } from "./plans/PlanEditModal";
import { EMPTY_PLAN, type Costs, type Plan } from "./plans/types";

export function PlansTab() {
  const isMobile = useIsMobile();
  const { confirm, dialog } = useConfirm();
  const loadPlansDataFn = useServerFn(loadPlansData);
  const savePlanFn = useServerFn(savePlan);
  const deletePlanFn = useServerFn(deletePlan);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [usdRate, setUsdRate] = useState(5.8);
  // Estado inicial antes do load() resolver — mesmo fallback de plans.functions.ts (DEFAULT_COSTS).
  const [costs, setCosts] = useState<Costs>({ imageRef: 0.08, video: 1.6, content: 0.013 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadPlansDataFn({ data: undefined });
    setPlans(data.plans);
    setUsdRate(data.usdRate);
    setCosts(data.costs);
    setLoading(false);
  }, [loadPlansDataFn]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing) return;
    setSaving(true);
    setMsg(null);
    try {
      await savePlanFn({
        data: {
          id: editing.id,
          codigo: editing.codigo,
          nome: editing.nome,
          tipo: editing.tipo,
          limite_imagens: Number(editing.limite_imagens),
          limite_renders: Number(editing.limite_renders),
          // limite_geracoes não é mais enviado — o servidor força 0 (campo morto,
          // ver plans.functions.ts e PlanEditModal).
          limite_regen_texto: Number(editing.limite_regen_texto || 0),
          limite_sugestoes: Number(editing.limite_sugestoes || 0),
          limite_primeira_geracao: Number(editing.limite_primeira_geracao || 0),
          limite_imgs_display:
            editing.limite_imgs_display !== null ? Number(editing.limite_imgs_display) : null,
          limite_renders_display:
            editing.limite_renders_display !== null ? Number(editing.limite_renders_display) : null,
          preco_maximo_brl: Number(editing.preco_maximo_brl || 0),
          ativo: editing.ativo,
          base_estatico: Number(editing.base_estatico || 0),
          base_carrossel: Number(editing.base_carrossel || 0),
          base_estatico_final: Number(editing.base_estatico_final || 0),
          base_reels: Number(editing.base_reels || 0),
        },
      });
      setEditing(null);
      await load();
    } catch (e) {
      setMsg(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    }
    setSaving(false);
  }

  async function remove(p: Plan) {
    if (!(await confirm(`Excluir plano "${p.nome}"?`))) return;
    try {
      await deletePlanFn({ data: { planId: p.id } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) return <p>Carregando planos…</p>;

  return (
    <div>
      {dialog}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Planos</h2>
        <button
          onClick={() => setEditing({ ...EMPTY_PLAN })}
          style={{
            background: "var(--brand-primary)",
            color: "#fff",
            border: "none",
            padding: "8px 14px",
            borderRadius: 6,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          + Novo plano
        </button>
      </div>

      <PlansList
        isMobile={isMobile}
        plans={plans}
        costs={costs}
        usdRate={usdRate}
        onEdit={setEditing}
        onRemove={remove}
      />

      {editing && (
        <PlanEditModal
          editing={editing}
          saving={saving}
          msg={msg}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
