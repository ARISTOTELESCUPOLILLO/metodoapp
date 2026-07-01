import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { startImpersonation } from "@/hooks/useImpersonation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfirm } from "@/hooks/useConfirm";
import {
  createTestUser,
  deleteTestUser,
  loadTestUsersData,
  updateTestSegmento,
  updateTestSlot,
  resetTestCounters,
} from "@/lib/testUsers.functions";
import { CreateTestUserForm } from "./testUsers/CreateTestUserForm";
import { TestUsersList } from "./testUsers/TestUsersList";
import type { Plan, Row, Segmento, SlotKey } from "./testUsers/types";

export function TestUsersTab() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const createTestUserFn = useServerFn(createTestUser);
  const deleteTestUserFn = useServerFn(deleteTestUser);
  const loadTestUsersDataFn = useServerFn(loadTestUsersData);
  const updateTestSegmentoFn = useServerFn(updateTestSegmento);
  const updateTestSlotFn = useServerFn(updateTestSlot);
  const resetTestCountersFn = useServerFn(resetTestCounters);

  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // form
  const [nome, setNome] = useState("");
  const [segmento, setSegmento] = useState<Segmento>("VAREJO");
  const [plano1Id, setPlano1Id] = useState("");
  const [plano2Id, setPlano2Id] = useState("");
  const [bonusId, setBonusId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadTestUsersDataFn({ data: undefined });
    setRows(data.rows);
    setPlans(data.plans);
    setLoading(false);
  }, [loadTestUsersDataFn]);

  useEffect(() => {
    load();
  }, [load]);

  async function createTest(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!nome.trim()) {
      setMsg("Informe um nome.");
      return;
    }
    setBusy("new");
    try {
      await createTestUserFn({
        data: {
          nome: nome.trim(),
          segmento,
          plano1_id: plano1Id || null,
          plano2_id: plano2Id || null,
          bonus_id: bonusId || null,
        },
      });
      setNome("");
      setPlano1Id("");
      setPlano2Id("");
      setBonusId("");
      setMsg("Teste criado.");
      load();
    } catch (err: unknown) {
      setMsg(`Erro: ${err instanceof Error ? err.message : "falha ao criar teste"}`);
    } finally {
      setBusy(null);
    }
  }

  function actAs(r: Row) {
    startImpersonation({ userId: r.id, nome: r.nome || "Teste", email: r.email, isTest: true });
    navigate({ to: "/app" });
  }

  async function changeSeg(r: Row, seg: string) {
    setBusy(r.id);
    await updateTestSegmentoFn({
      data: { userId: r.id, segmento: (seg || null) as Segmento | null },
    });
    await load();
    setBusy(null);
  }
  async function changeSlot(r: Row, slot: SlotKey, planId: string) {
    if (!(await confirm(`Alterar slot vai zerar o consumo. Continuar?`))) return;
    setBusy(r.id);
    await updateTestSlotFn({ data: { userId: r.id, slot, planId: planId || null } });
    await load();
    setBusy(null);
  }
  async function resetCounters(r: Row) {
    if (!(await confirm(`Zerar consumo de ${r.nome}?`))) return;
    setBusy(r.id);
    await resetTestCountersFn({ data: { userId: r.id } });
    await load();
    setBusy(null);
  }
  async function remove(r: Row) {
    if (!(await confirm(`Excluir teste "${r.nome}"? Apaga perfil, Kit de Marca e sequências.`)))
      return;
    const typed = prompt(`Digite EXCLUIR para confirmar:`);
    if (typed !== "EXCLUIR") {
      toast.info("Cancelado.");
      return;
    }
    setBusy(r.id);
    try {
      await deleteTestUserFn({ data: { id: r.id } });
      load();
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "falha ao excluir"}`);
    } finally {
      setBusy(null);
    }
  }

  const bonusPlans = plans.filter((p) => p.elegivel_bonus);
  const mainPlans = plans.filter((p) => !p.elegivel_bonus);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {dialog}
      <CreateTestUserForm
        isMobile={isMobile}
        plans={plans}
        nome={nome}
        segmento={segmento}
        plano1Id={plano1Id}
        plano2Id={plano2Id}
        bonusId={bonusId}
        busy={busy}
        msg={msg}
        onNomeChange={setNome}
        onSegmentoChange={setSegmento}
        onPlano1Change={setPlano1Id}
        onPlano2Change={setPlano2Id}
        onBonusChange={setBonusId}
        onSubmit={createTest}
      />
      <TestUsersList
        isMobile={isMobile}
        loading={loading}
        rows={rows}
        mainPlans={mainPlans}
        bonusPlans={bonusPlans}
        busy={busy}
        onActAs={actAs}
        onChangeSeg={changeSeg}
        onChangeSlot={changeSlot}
        onResetCounters={resetCounters}
        onRemove={remove}
      />
    </div>
  );
}
