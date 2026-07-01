import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startImpersonation } from "@/hooks/useImpersonation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfirm } from "@/hooks/useConfirm";
import { assignPlanSlot, removePlanSlot } from "@/lib/planHistory.functions";
import {
  deleteUser,
  loadUsersList,
  updateUserNome,
  updateUserSlotPreco,
  setUserStatus,
  setUserAdmin,
  updateUserSegmento,
  resetUserCounters,
  setUserVoiceAvatar,
} from "@/lib/users.functions";

import { AssignPlanModal } from "./users/AssignPlanModal";
import { UserMobileCard } from "./users/UserMobileCard";
import { UserTableRow } from "./users/UserTableRow";
import { Th } from "./users/primitives";
import type { AssignModal, Costs, Plan, Row, SlotKey, UserRowActions } from "./users/types";

export function UsersTab() {
  const isMobile = useIsMobile();
  const assignPlanSlotFn = useServerFn(assignPlanSlot);
  const removePlanSlotFn = useServerFn(removePlanSlot);
  const deleteUserFn = useServerFn(deleteUser);
  const loadUsersListFn = useServerFn(loadUsersList);
  const updateUserNomeFn = useServerFn(updateUserNome);
  const updateUserSlotPrecoFn = useServerFn(updateUserSlotPreco);
  const setUserStatusFn = useServerFn(setUserStatus);
  const setUserAdminFn = useServerFn(setUserAdmin);
  const updateUserSegmentoFn = useServerFn(updateUserSegmento);
  const resetUserCountersFn = useServerFn(resetUserCounters);
  const setUserVoiceAvatarFn = useServerFn(setUserVoiceAvatar);

  const [rows, setRows] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editNome, setEditNome] = useState<{ id: string; val: string } | null>(null);
  const [assignModal, setAssignModal] = useState<AssignModal | null>(null);
  const [costs, setCosts] = useState<Costs>({ imageRef: 0.058, video: 1.6, content: 0.013 });
  const [usdRate, setUsdRate] = useState(5.8);

  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();

  async function actAs(r: Row) {
    if (
      !(await confirm(`Atuar como ${r.nome || r.email}? Você poderá editar o Kit de Marca dele.`))
    )
      return;
    startImpersonation({ userId: r.id, nome: r.nome || r.email, email: r.email });
    navigate({ to: "/app" });
  }

  function verGeracoes(r: Row) {
    startImpersonation({ userId: r.id, nome: r.nome || r.email, email: r.email });
    navigate({ to: "/historico" });
  }

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const {
          rows: nextRows,
          plans: nextPlans,
          costs: nextCosts,
          usdRate: nextUsdRate,
        } = await loadUsersListFn({ data: undefined });
        setRows(nextRows);
        setPlans(nextPlans);
        setCosts(nextCosts);
        setUsdRate(nextUsdRate);
      } catch (e) {
        toast.error(`Erro ao carregar usuários: ${(e as Error).message}`);
      }
      setLoading(false);
    },
    [loadUsersListFn],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function changeNome(userId: string, nome: string) {
    setBusy(userId);
    try {
      await updateUserNomeFn({ data: { userId, nome } });
    } catch (e) {
      toast.error(`Erro ao renomear: ${(e as Error).message}`);
    }
    setEditNome(null);
    await load({ silent: true });
    setBusy(null);
  }

  async function changePreco(userId: string, slot: SlotKey, val: number | null) {
    try {
      await updateUserSlotPrecoFn({ data: { userId, slot, val } });
    } catch (e) {
      toast.error(`Erro ao salvar preço: ${(e as Error).message}`);
    }
    await load({ silent: true });
  }

  function openAssignModal(r: Row, slot: SlotKey, options: Plan[], forceReset = false) {
    const originalPlanId =
      slot === "plano1" ? r.plano1_id : slot === "plano2" ? r.plano2_id : r.bonus_id;
    const currentMeses =
      slot === "plano1"
        ? r.plano1_meses_contrato || 1
        : slot === "plano2"
          ? r.plano2_meses_contrato || 1
          : r.bonus_meses_contrato || 1;
    const today = new Date().toISOString().split("T")[0];
    setAssignModal({
      userId: r.id,
      userName: r.nome || r.email,
      slot,
      originalPlanId,
      options,
      selectedPlanId: originalPlanId || "",
      dateVal: today,
      mesesContrato: currentMeses,
      resetCounters: forceReset,
    });
  }

  async function removeSlot(userId: string, slot: SlotKey) {
    const label = slot === "plano1" ? "Plano 1" : slot === "plano2" ? "Plano 2" : "Bônus";
    if (!(await confirm(`Remover ${label}? Isso vai zerar os contadores deste slot.`))) return;
    setBusy(userId);
    const extraPrefix = slot === "plano1" ? "p1" : slot === "plano2" ? "p2" : "b";
    try {
      await removePlanSlotFn({ data: { userId, slot, extraPrefix } });
    } catch (e) {
      toast.error(`Erro ao remover slot: ${(e as Error).message}`);
    }
    await load({ silent: true });
    setBusy(null);
  }

  async function assignSlot() {
    if (!assignModal || !assignModal.selectedPlanId || !assignModal.dateVal) return;
    const { userId, slot, selectedPlanId, dateVal, mesesContrato, resetCounters } = assignModal;
    setBusy(userId);
    const extraPrefix = slot === "plano1" ? "p1" : slot === "plano2" ? "p2" : "b";

    const {
      data: { user: adminUser },
    } = await supabase.auth.getUser();

    try {
      await assignPlanSlotFn({
        data: {
          userId,
          slot,
          planId: selectedPlanId,
          inicio: dateVal,
          mesesContrato: mesesContrato || 1,
          resetCounters,
          extraPrefix,
          adminUserId: adminUser?.id ?? null,
        },
      });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    setAssignModal(null);
    await load({ silent: true });
    setBusy(null);
  }

  async function toggleStatus(r: Row) {
    const blocking = r.status === "ativo";
    if (blocking) {
      if (!(await confirm(`Bloquear ${r.email}? O usuário não poderá mais usar o app.`))) return;
      const typed = prompt(
        `Confirmação dupla — digite BLOQUEAR para confirmar o bloqueio de ${r.email}:`,
      );
      if (typed !== "BLOQUEAR") {
        toast.error("Confirmação inválida. Bloqueio cancelado.");
        return;
      }
    } else {
      if (!(await confirm(`Desbloquear ${r.email}?`))) return;
    }
    setBusy(r.id);
    try {
      await setUserStatusFn({ data: { userId: r.id, status: blocking ? "bloqueado" : "ativo" } });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    await load({ silent: true });
    setBusy(null);
  }

  async function toggleAdmin(r: Row) {
    setBusy(r.id);
    try {
      await setUserAdminFn({ data: { userId: r.id, makeAdmin: !r.is_admin } });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    await load({ silent: true });
    setBusy(null);
  }

  async function changeSegmento(r: Row, seg: string) {
    setBusy(r.id);
    try {
      await updateUserSegmentoFn({ data: { userId: r.id, segmento: seg } });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    await load({ silent: true });
    setBusy(null);
  }

  async function resetCounters(r: Row) {
    if (!(await confirm(`Zerar contadores de ${r.email} (todos os slots)?`))) return;
    setBusy(r.id);
    try {
      await resetUserCountersFn({ data: { userId: r.id } });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    await load({ silent: true });
    setBusy(null);
  }

  async function handleDeleteUser(r: Row) {
    if (r.is_admin) {
      toast.error("Não é possível excluir um administrador. Remova o papel de admin antes.");
      return;
    }
    if (
      !(await confirm(
        `Excluir PERMANENTEMENTE ${r.email}?\n\nIsso remove gerações, kit de marca, voz clonada e a conta do usuário. Esta ação NÃO PODE ser desfeita.`,
      ))
    )
      return;
    const typed = prompt(
      `Confirmação dupla — digite EXCLUIR para confirmar a exclusão de ${r.email}:`,
    );
    if (typed !== "EXCLUIR") {
      toast.error("Confirmação inválida. Exclusão cancelada.");
      return;
    }
    setBusy(r.id);
    try {
      await deleteUserFn({ data: { id: r.id } });
      await load({ silent: true });
    } catch (e) {
      toast.error(`Erro ao excluir: ${(e as Error).message}`);
    }
    setBusy(null);
  }

  function hasCinematicsPlan(r: Row): boolean {
    return [r.plano1_id, r.plano2_id, r.bonus_id].some((id) => {
      const p = plans.find((pl) => pl.id === id);
      return !!p && /^S\d+C$/i.test(p.codigo);
    });
  }

  async function toggleVoiceAvatar(r: Row, slot: 1 | 2) {
    const next = slot === 1 ? !r.voice_avatar1_enabled : !r.voice_avatar2_enabled;
    setBusy(r.id);
    try {
      await setUserVoiceAvatarFn({ data: { userId: r.id, slot, enabled: next } });
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    await load({ silent: true });
    setBusy(null);
  }

  async function resetPassword(r: Row) {
    if (!(await confirm(`Enviar e-mail de redefinição de senha para ${r.email}?`))) return;
    setBusy(r.id);
    const { error } = await supabase.auth.resetPasswordForEmail(r.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(null);
    if (error) toast.error(`Erro: ${error.message}`);
    else toast.success(`E-mail de redefinição enviado para ${r.email}.`);
  }

  const bonusPlans = plans.filter((p) => p.elegivel_bonus);
  const mainPlans = plans.filter((p) => !p.elegivel_bonus);
  const filtered = rows.filter((r) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (r.email || "").toLowerCase().includes(s) || (r.nome || "").toLowerCase().includes(s);
  });

  const rowActions: UserRowActions = {
    onActAs: actAs,
    onVerGeracoes: verGeracoes,
    onChangeNome: changeNome,
    onChangePreco: changePreco,
    onOpenAssignModal: openAssignModal,
    onRemoveSlot: removeSlot,
    onToggleStatus: toggleStatus,
    onToggleAdmin: toggleAdmin,
    onChangeSegmento: changeSegmento,
    onResetCounters: resetCounters,
    onResetPassword: resetPassword,
    onDeleteUser: handleDeleteUser,
    onToggleVoiceAvatar: toggleVoiceAvatar,
  };

  if (loading) return <p>Carregando usuários…</p>;

  return (
    <div>
      {dialog}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 12,
        }}
      >
        <input
          placeholder="Buscar por nome ou e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 10px",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            fontSize: 14,
            flex: 1,
            maxWidth: 320,
          }}
        />
        <span style={{ fontSize: 12, color: "#64748b" }}>{filtered.length} usuário(s)</span>
      </div>

      {isMobile ? (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((r) => (
            <UserMobileCard
              key={r.id}
              r={r}
              busy={busy === r.id}
              editNome={editNome}
              setEditNome={setEditNome}
              mainPlans={mainPlans}
              bonusPlans={bonusPlans}
              costs={costs}
              usdRate={usdRate}
              hasCinematicsPlan={hasCinematicsPlan(r)}
              actions={rowActions}
            />
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Usuário</Th>
                <Th>Plano 1</Th>
                <Th>Plano 2</Th>
                <Th>Bônus</Th>
                <Th>🎙 Voz</Th>
                <Th title="Soma dos preços aplicados nos slots ativos">Faturamento</Th>
                <Th>Segmento</Th>
                <Th>Consumo</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <UserTableRow
                  key={r.id}
                  r={r}
                  busy={busy === r.id}
                  editNome={editNome}
                  setEditNome={setEditNome}
                  mainPlans={mainPlans}
                  bonusPlans={bonusPlans}
                  costs={costs}
                  usdRate={usdRate}
                  hasCinematicsPlan={hasCinematicsPlan(r)}
                  actions={rowActions}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignModal && (
        <AssignPlanModal
          assignModal={assignModal}
          onChange={setAssignModal}
          onClose={() => setAssignModal(null)}
          onSave={assignSlot}
        />
      )}
    </div>
  );
}
