// Hook com as ações de linha da aba Usuários — extraído de UsersTab.tsx (Fase 9.1).
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startImpersonation } from "@/hooks/useImpersonation";
import { useConfirm } from "@/hooks/useConfirm";
import { assignPlanSlot, removePlanSlot, resetSlotUsage } from "@/lib/planHistory.functions";
import {
  deleteUser,
  updateUserNome,
  updateUserSlotPreco,
  setUserStatus,
  setUserAdmin,
  updateUserSegmento,
  resetUserCounters,
  setUserVoiceAvatar,
} from "@/lib/users.functions";
import type { AssignModal, Plan, Row, SlotKey, UserRowActions } from "./types";

export function useUserRowActions(
  plans: Plan[],
  load: (opts?: { silent?: boolean }) => Promise<void>,
) {
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();

  const assignPlanSlotFn = useServerFn(assignPlanSlot);
  const removePlanSlotFn = useServerFn(removePlanSlot);
  const resetSlotUsageFn = useServerFn(resetSlotUsage);
  const deleteUserFn = useServerFn(deleteUser);
  const updateUserNomeFn = useServerFn(updateUserNome);
  const updateUserSlotPrecoFn = useServerFn(updateUserSlotPreco);
  const setUserStatusFn = useServerFn(setUserStatus);
  const setUserAdminFn = useServerFn(setUserAdmin);
  const updateUserSegmentoFn = useServerFn(updateUserSegmento);
  const resetUserCountersFn = useServerFn(resetUserCounters);
  const setUserVoiceAvatarFn = useServerFn(setUserVoiceAvatar);

  const [busy, setBusy] = useState<string | null>(null);
  const [editNome, setEditNome] = useState<{ id: string; val: string } | null>(null);
  const [assignModal, setAssignModal] = useState<AssignModal | null>(null);

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

  async function resetSlotUsageAction(r: Row, slot: SlotKey) {
    if (
      !(await confirm(
        `Zerar o consumo de ${slot === "plano1" ? "Plano 1" : slot === "plano2" ? "Plano 2" : "Bônus"} de ${r.email}? A data de início e a validade do plano NÃO mudam — é só uma folga pontual dentro do ciclo atual.`,
      ))
    )
      return;
    setBusy(r.id);
    try {
      await resetSlotUsageFn({ data: { userId: r.id, slot } });
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
    onResetSlotUsage: resetSlotUsageAction,
    onResetPassword: resetPassword,
    onDeleteUser: handleDeleteUser,
    onToggleVoiceAvatar: toggleVoiceAvatar,
  };

  return {
    busy,
    editNome,
    setEditNome,
    assignModal,
    setAssignModal,
    assignSlot,
    hasCinematicsPlan,
    rowActions,
    dialog,
  };
}
