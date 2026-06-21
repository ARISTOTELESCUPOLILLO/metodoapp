import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { startImpersonation } from "@/hooks/useImpersonation";
import { useIsMobile } from "@/hooks/use-mobile";
import { assignPlanSlot, removePlanSlot } from "@/lib/planHistory.functions";
import { deleteUser } from "@/lib/users.functions";

import { computeCycle, cycleLabel, cycleColor } from "@/lib/cycle";
import { mopMonthlyCost, mopSequenceSize } from "@/lib/costs";

interface Row {
  id: string;
  nome: string | null;
  email: string;
  client_code: string | null;
  status: string;
  segmento: "SERVIÇOS" | "VAREJO" | "MARCA" | null;
  ultimo_login: string | null;
  is_admin: boolean;
  plano1_id: string | null;
  plano1_inicio: string | null;
  plano1_meses_contrato: number;
  plano1_contrato_fim: string | null;
  plano1_imgs_usadas: number;
  plano1_imgs_limite: number;
  plano1_renders_usados: number;
  plano1_renders_limite: number;
  plano1_preco_brl: number | null;
  plano2_id: string | null;
  plano2_inicio: string | null;
  plano2_meses_contrato: number;
  plano2_contrato_fim: string | null;
  plano2_imgs_usadas: number;
  plano2_imgs_limite: number;
  plano2_renders_usados: number;
  plano2_renders_limite: number;
  plano2_preco_brl: number | null;
  bonus_id: string | null;
  bonus_inicio: string | null;
  bonus_meses_contrato: number;
  bonus_contrato_fim: string | null;
  bonus_imgs_usadas: number;
  bonus_imgs_limite: number;
  bonus_renders_usados: number;
  bonus_renders_limite: number;
  bonus_preco_brl: number | null;
  voice_avatar1_enabled: boolean;
  voice_avatar2_enabled: boolean;
}
interface Plan {
  id: string;
  nome: string;
  codigo: string;
  elegivel_bonus: boolean;
  tipo: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  preco_maximo_brl: number;
}
interface Costs {
  imageRef: number;
  video: number;
  content: number;
}

interface AssignModal {
  userId: string;
  userName: string;
  slot: SlotKey;
  originalPlanId: string | null;
  options: Plan[];
  selectedPlanId: string;
  dateVal: string;
  mesesContrato: number;
  resetCounters: boolean;
}

function planPeriodo(
  inicio: string | null,
  tipo: string,
  mesesContrato?: number,
  contratoFim?: string | null,
): string {
  if (!inicio) return "";
  const start = new Date(inicio);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  if (tipo === "vitalicio") return `${fmt(start)} · vitalício`;
  if (tipo === "anual") {
    const end = contratoFim
      ? new Date(contratoFim)
      : (() => {
          const d = new Date(start);
          d.setFullYear(d.getFullYear() + 1);
          return d;
        })();
    return `${fmt(start)} → ${fmt(end)} · 12 meses`;
  }
  // mensal ou outros: usa mesesContrato e contratoFim
  const meses = mesesContrato && mesesContrato > 0 ? mesesContrato : 1;
  const endDate = contratoFim
    ? new Date(contratoFim)
    : (() => {
        const d = new Date(start);
        d.setMonth(d.getMonth() + meses);
        return d;
      })();
  const label = meses === 1 ? "1 mês" : `${meses} meses`;
  return `${fmt(start)} → ${fmt(endDate)} · ${label}`;
}

type SlotKey = "plano1" | "plano2" | "bonus";

export function UsersTab() {
  const isMobile = useIsMobile();
  const assignPlanSlotFn = useServerFn(assignPlanSlot);
  const removePlanSlotFn = useServerFn(removePlanSlot);
  const deleteUserFn = useServerFn(deleteUser);
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

  function actAs(r: Row) {
    if (!confirm(`Atuar como ${r.nome || r.email}? Você poderá editar o Kit de Marca dele.`))
      return;
    startImpersonation({ userId: r.id, nome: r.nome || r.email, email: r.email });
    navigate({ to: "/app" });
  }

  function verGeracoes(r: Row) {
    startImpersonation({ userId: r.id, nome: r.nome || r.email, email: r.email });
    navigate({ to: "/historico" });
  }

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const [{ data: profs }, { data: pls }, { data: roles }, { data: s }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("is_test", false)
        .order("ultimo_login", { ascending: false, nullsFirst: false }),
      supabase
        .from("plans")
        .select(
          "id,nome,codigo,elegivel_bonus,tipo,limite_imagens,limite_renders,limite_geracoes,preco_maximo_brl",
        )
        .eq("ativo", true)
        .order("nome"),
      supabase.from("user_roles").select("user_id,role"),
      supabase
        .from("app_settings")
        .select("usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd")
        .eq("id", true)
        .maybeSingle(),
    ]);
    const adminSet = new Set((roles || []).filter((r) => r.role === "admin").map((r) => r.user_id));
    setRows(
      (profs || []).map((p) => ({
        ...p,
        segmento: p.segmento as Row["segmento"],
        is_admin: adminSet.has(p.id),
      })),
    );
    setPlans((pls as Plan[]) || []);
    if (s) {
      setUsdRate(Number(s.usd_brl_rate) || 5.8);
      setCosts({
        imageRef: Number(s.image_price_usd) || 0.058,
        video: Number(s.render_price_usd) || 1.6,
        content: Number(s.geracao_price_usd) || 0.013,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeNome(userId: string, nome: string) {
    setBusy(userId);
    await supabase
      .from("profiles")
      .update({ nome: nome.trim() || null })
      .eq("id", userId);
    setEditNome(null);
    await load({ silent: true });
    setBusy(null);
  }

  async function changePreco(userId: string, slot: SlotKey, val: number | null) {
    const col = slot === "bonus" ? "bonus_preco_brl" : `${slot}_preco_brl`;
    await supabase
      .from("profiles")
      .update({ [col]: val } as any)
      .eq("id", userId);
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
    if (!confirm(`Remover ${label}? Isso vai zerar os contadores deste slot.`)) return;
    setBusy(userId);
    const extraPrefix = slot === "plano1" ? "p1" : slot === "plano2" ? "p2" : "b";
    try {
      await removePlanSlotFn({ data: { userId, slot, extraPrefix } });
    } catch (e) {
      alert(`Erro ao remover slot: ${(e as Error).message}`);
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
      alert(`Erro: ${(e as Error).message}`);
    }
    setAssignModal(null);
    await load({ silent: true });
    setBusy(null);
  }

  async function toggleStatus(r: Row) {
    const blocking = r.status === "ativo";
    if (blocking) {
      if (!confirm(`Bloquear ${r.email}? O usuário não poderá mais usar o app.`)) return;
      const typed = prompt(
        `Confirmação dupla — digite BLOQUEAR para confirmar o bloqueio de ${r.email}:`,
      );
      if (typed !== "BLOQUEAR") {
        alert("Confirmação inválida. Bloqueio cancelado.");
        return;
      }
    } else {
      if (!confirm(`Desbloquear ${r.email}?`)) return;
    }
    setBusy(r.id);
    await supabase
      .from("profiles")
      .update({ status: blocking ? "bloqueado" : "ativo" })
      .eq("id", r.id);
    await load({ silent: true });
    setBusy(null);
  }
  async function toggleAdmin(r: Row) {
    setBusy(r.id);
    if (r.is_admin)
      await supabase.from("user_roles").delete().eq("user_id", r.id).eq("role", "admin");
    else await supabase.from("user_roles").insert({ user_id: r.id, role: "admin" });
    await load({ silent: true });
    setBusy(null);
  }
  async function changeSegmento(r: Row, seg: string) {
    setBusy(r.id);
    await supabase
      .from("profiles")
      .update({ segmento: seg || null })
      .eq("id", r.id);
    await load({ silent: true });
    setBusy(null);
  }
  async function resetCounters(r: Row) {
    if (!confirm(`Zerar contadores de ${r.email} (todos os slots)?`)) return;
    setBusy(r.id);
    await supabase
      .from("profiles")
      .update({
        plano1_imgs_usadas: 0,
        plano1_renders_usados: 0,
        plano1_geracoes_usadas: 0,
        plano2_imgs_usadas: 0,
        plano2_renders_usados: 0,
        plano2_geracoes_usadas: 0,
        bonus_imgs_usadas: 0,
        bonus_renders_usados: 0,
        bonus_geracoes_usadas: 0,
      })
      .eq("id", r.id);
    await load({ silent: true });
    setBusy(null);
  }
  async function handleDeleteUser(r: Row) {
    if (r.is_admin) {
      alert("Não é possível excluir um administrador. Remova o papel de admin antes.");
      return;
    }
    if (
      !confirm(
        `Excluir PERMANENTEMENTE ${r.email}?\n\nIsso remove gerações, kit de marca, voz clonada e a conta do usuário. Esta ação NÃO PODE ser desfeita.`,
      )
    )
      return;
    const typed = prompt(
      `Confirmação dupla — digite EXCLUIR para confirmar a exclusão de ${r.email}:`,
    );
    if (typed !== "EXCLUIR") {
      alert("Confirmação inválida. Exclusão cancelada.");
      return;
    }
    setBusy(r.id);
    try {
      await deleteUserFn({ data: { id: r.id } });
      await load({ silent: true });
    } catch (e) {
      alert(`Erro ao excluir: ${(e as Error).message}`);
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
    const col = slot === 1 ? "voice_avatar1_enabled" : "voice_avatar2_enabled";
    const next = slot === 1 ? !r.voice_avatar1_enabled : !r.voice_avatar2_enabled;
    setBusy(r.id);
    await supabase
      .from("profiles")
      .update({ [col]: next } as any)
      .eq("id", r.id);
    await load({ silent: true });
    setBusy(null);
  }

  async function resetPassword(r: Row) {
    if (!confirm(`Enviar e-mail de redefinição de senha para ${r.email}?`)) return;
    setBusy(r.id);
    const { error } = await supabase.auth.resetPasswordForEmail(r.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(null);
    alert(error ? `Erro: ${error.message}` : `E-mail de redefinição enviado para ${r.email}.`);
  }

  const bonusPlans = plans.filter((p) => p.elegivel_bonus);
  const mainPlans = plans.filter((p) => !p.elegivel_bonus);
  const filtered = rows.filter((r) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (r.email || "").toLowerCase().includes(s) || (r.nome || "").toLowerCase().includes(s);
  });

  if (loading) return <p>Carregando usuários…</p>;

  return (
    <div>
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
            <div
              key={r.id}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 14,
                opacity: busy === r.id ? 0.5 : 1,
              }}
            >
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {editNome?.id === r.id ? (
                    <>
                      <input
                        autoFocus
                        value={editNome.val}
                        onChange={(e) => setEditNome({ id: r.id, val: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") changeNome(r.id, editNome.val);
                          if (e.key === "Escape") setEditNome(null);
                        }}
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          padding: "2px 6px",
                          border: "1px solid #0f213f",
                          borderRadius: 4,
                          width: 140,
                        }}
                      />
                      <button onClick={() => changeNome(r.id, editNome.val)} style={miniSave}>
                        ✓
                      </button>
                      <button onClick={() => setEditNome(null)} style={miniCancel}>
                        ✕
                      </button>
                    </>
                  ) : (
                    <span
                      onClick={() => setEditNome({ id: r.id, val: r.nome || "" })}
                      title="Clique para editar nome"
                      style={{ cursor: "pointer", borderBottom: "1px dashed #cbd5e1" }}
                    >
                      {r.nome || "—"}
                    </span>
                  )}
                  {r.is_admin && (
                    <span
                      style={{
                        background: "#0f213f",
                        color: "#fff",
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontWeight: 700,
                      }}
                    >
                      ADMIN
                    </span>
                  )}
                </div>
                <div style={{ color: "#64748b", fontSize: 12, wordBreak: "break-all" }}>
                  {r.email}
                </div>
                {r.client_code && (
                  <div
                    style={{
                      color: "#94a3b8",
                      fontSize: 11,
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      marginTop: 2,
                    }}
                  >
                    {r.client_code}
                  </div>
                )}
              </div>
              <MRow k="Plano 1">
                <div>
                  <PlanCell
                    planId={r.plano1_id}
                    inicio={r.plano1_inicio}
                    mesesContrato={r.plano1_meses_contrato}
                    contratoFim={r.plano1_contrato_fim}
                    options={mainPlans}
                    onAssign={() => openAssignModal(r, "plano1", mainPlans)}
                    onRemove={() => removeSlot(r.id, "plano1")}
                  />
                  {r.plano1_id && (
                    <PlanPriceField
                      planId={r.plano1_id}
                      plans={mainPlans}
                      costs={costs}
                      usdRate={usdRate}
                      value={r.plano1_preco_brl}
                      onChange={(v) => changePreco(r.id, "plano1", v)}
                    />
                  )}
                </div>
              </MRow>
              <MRow k="Plano 2">
                <div>
                  <PlanCell
                    planId={r.plano2_id}
                    inicio={r.plano2_inicio}
                    mesesContrato={r.plano2_meses_contrato}
                    contratoFim={r.plano2_contrato_fim}
                    options={mainPlans}
                    onAssign={() => openAssignModal(r, "plano2", mainPlans)}
                    onRemove={() => removeSlot(r.id, "plano2")}
                  />
                  {r.plano2_id && (
                    <PlanPriceField
                      planId={r.plano2_id}
                      plans={mainPlans}
                      costs={costs}
                      usdRate={usdRate}
                      value={r.plano2_preco_brl}
                      onChange={(v) => changePreco(r.id, "plano2", v)}
                    />
                  )}
                </div>
              </MRow>
              <MRow k="Bônus">
                <div>
                  <PlanCell
                    planId={r.bonus_id}
                    inicio={r.bonus_inicio}
                    mesesContrato={r.bonus_meses_contrato}
                    contratoFim={r.bonus_contrato_fim}
                    options={bonusPlans}
                    onAssign={() => openAssignModal(r, "bonus", bonusPlans)}
                    onRemove={() => removeSlot(r.id, "bonus")}
                  />
                  {r.bonus_id && (
                    <PlanPriceField
                      planId={r.bonus_id}
                      plans={bonusPlans}
                      costs={costs}
                      usdRate={usdRate}
                      value={r.bonus_preco_brl}
                      onChange={(v) => changePreco(r.id, "bonus", v)}
                    />
                  )}
                </div>
              </MRow>
              <MRow k="Faturamento">
                <FaturamentoCell
                  row={r}
                  plans={[...mainPlans, ...bonusPlans]}
                  costs={costs}
                  usdRate={usdRate}
                />
              </MRow>
              <MRow k="Segmento">
                <SegmentoSelect value={r.segmento} onChange={(v) => changeSegmento(r, v)} />
              </MRow>
              <MRow k="Status">
                <button
                  onClick={() => toggleStatus(r)}
                  style={pill(r.status === "ativo" ? "#15803d" : "#b91c1c")}
                >
                  {r.status === "ativo" ? "bloquear" : "desbloquear"}
                </button>
              </MRow>
              <MRow k="Admin">
                <button
                  onClick={() => toggleAdmin(r)}
                  style={pill(r.is_admin ? "#0f213f" : "#94a3b8")}
                >
                  {r.is_admin ? "admin" : "user"}
                </button>
              </MRow>
              {hasCinematicsPlan(r) && (
                <MRow k="🎙 Voz Cine">
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={r.voice_avatar1_enabled}
                        onChange={() => toggleVoiceAvatar(r, 1)}
                      />
                      Avatar 1
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={r.voice_avatar2_enabled}
                        onChange={() => toggleVoiceAvatar(r, 2)}
                      />
                      Avatar 2
                    </label>
                  </div>
                </MRow>
              )}
              <div style={{ padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>
                  CONSUMO
                </div>
                <SlotsConsumption
                  row={r}
                  onRenew={(slot) =>
                    openAssignModal(r, slot, slot === "bonus" ? bonusPlans : mainPlans, true)
                  }
                />
              </div>
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}
              >
                <button
                  onClick={() => actAs(r)}
                  style={{
                    ...actionBtn,
                    background: "#0f213f",
                    color: "#fff",
                    borderColor: "#0f213f",
                    fontWeight: 700,
                  }}
                  disabled={r.is_admin}
                >
                  Atuar como
                </button>
                <button
                  onClick={() => verGeracoes(r)}
                  style={{
                    ...actionBtn,
                    background: "#0f172a",
                    color: "#fff",
                    borderColor: "#0f172a",
                  }}
                >
                  Gerações
                </button>
                <button onClick={() => resetCounters(r)} style={actionBtn}>
                  Zerar
                </button>
                <button onClick={() => resetPassword(r)} style={actionBtn}>
                  Senha
                </button>
                <button
                  onClick={() => handleDeleteUser(r)}
                  style={{ ...dangerBtn, gridColumn: "1 / -1" }}
                  disabled={r.is_admin}
                >
                  Excluir usuário
                </button>
              </div>
            </div>
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
                <tr
                  key={r.id}
                  style={{ borderTop: "1px solid #e2e8f0", opacity: busy === r.id ? 0.5 : 1 }}
                >
                  <Td>
                    <div style={{ fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
                      {editNome?.id === r.id ? (
                        <>
                          <input
                            autoFocus
                            value={editNome.val}
                            onChange={(e) => setEditNome({ id: r.id, val: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") changeNome(r.id, editNome.val);
                              if (e.key === "Escape") setEditNome(null);
                            }}
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              padding: "2px 6px",
                              border: "1px solid #0f213f",
                              borderRadius: 4,
                              width: 130,
                            }}
                          />
                          <button onClick={() => changeNome(r.id, editNome.val)} style={miniSave}>
                            ✓
                          </button>
                          <button onClick={() => setEditNome(null)} style={miniCancel}>
                            ✕
                          </button>
                        </>
                      ) : (
                        <span
                          onClick={() => setEditNome({ id: r.id, val: r.nome || "" })}
                          title="Clique para editar nome"
                          style={{ cursor: "pointer", borderBottom: "1px dashed #cbd5e1" }}
                        >
                          {r.nome || "—"}
                        </span>
                      )}
                      {r.is_admin && (
                        <span
                          style={{
                            background: "#0f213f",
                            color: "#fff",
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontWeight: 700,
                          }}
                        >
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{r.email}</div>
                    {r.client_code && (
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: 11,
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          marginTop: 2,
                        }}
                      >
                        {r.client_code}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <PlanCell
                      planId={r.plano1_id}
                      inicio={r.plano1_inicio}
                      mesesContrato={r.plano1_meses_contrato}
                      contratoFim={r.plano1_contrato_fim}
                      options={mainPlans}
                      onAssign={() => openAssignModal(r, "plano1", mainPlans)}
                      onRemove={() => removeSlot(r.id, "plano1")}
                    />
                    {r.plano1_id && (
                      <PlanPriceField
                        planId={r.plano1_id}
                        plans={mainPlans}
                        costs={costs}
                        usdRate={usdRate}
                        value={r.plano1_preco_brl}
                        onChange={(v) => changePreco(r.id, "plano1", v)}
                      />
                    )}
                  </Td>
                  <Td>
                    <PlanCell
                      planId={r.plano2_id}
                      inicio={r.plano2_inicio}
                      mesesContrato={r.plano2_meses_contrato}
                      contratoFim={r.plano2_contrato_fim}
                      options={mainPlans}
                      onAssign={() => openAssignModal(r, "plano2", mainPlans)}
                      onRemove={() => removeSlot(r.id, "plano2")}
                    />
                    {r.plano2_id && (
                      <PlanPriceField
                        planId={r.plano2_id}
                        plans={mainPlans}
                        costs={costs}
                        usdRate={usdRate}
                        value={r.plano2_preco_brl}
                        onChange={(v) => changePreco(r.id, "plano2", v)}
                      />
                    )}
                  </Td>
                  <Td>
                    <PlanCell
                      planId={r.bonus_id}
                      inicio={r.bonus_inicio}
                      mesesContrato={r.bonus_meses_contrato}
                      contratoFim={r.bonus_contrato_fim}
                      options={bonusPlans}
                      onAssign={() => openAssignModal(r, "bonus", bonusPlans)}
                      onRemove={() => removeSlot(r.id, "bonus")}
                    />
                    {r.bonus_id && (
                      <PlanPriceField
                        planId={r.bonus_id}
                        plans={bonusPlans}
                        costs={costs}
                        usdRate={usdRate}
                        value={r.bonus_preco_brl}
                        onChange={(v) => changePreco(r.id, "bonus", v)}
                      />
                    )}
                  </Td>
                  <Td>
                    {hasCinematicsPlan(r) ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 12,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={r.voice_avatar1_enabled}
                            onChange={() => toggleVoiceAvatar(r, 1)}
                          />
                          Av1
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 12,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={r.voice_avatar2_enabled}
                            onChange={() => toggleVoiceAvatar(r, 2)}
                          />
                          Av2
                        </label>
                      </div>
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>—</span>
                    )}
                  </Td>
                  <Td>
                    <FaturamentoCell
                      row={r}
                      plans={[...mainPlans, ...bonusPlans]}
                      costs={costs}
                      usdRate={usdRate}
                    />
                  </Td>
                  <Td>
                    <SegmentoSelect value={r.segmento} onChange={(v) => changeSegmento(r, v)} />
                  </Td>
                  <Td>
                    <SlotsConsumption
                      row={r}
                      onRenew={(slot) =>
                        openAssignModal(r, slot, slot === "bonus" ? bonusPlans : mainPlans, true)
                      }
                    />
                  </Td>
                  <Td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => actAs(r)}
                          style={{
                            ...actionBtn,
                            background: "#0f213f",
                            color: "#fff",
                            borderColor: "#0f213f",
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                          disabled={r.is_admin}
                          title={
                            r.is_admin
                              ? "Não é necessário para admin"
                              : "Entrar no contexto deste usuário"
                          }
                        >
                          Atuar como
                        </button>
                        <button
                          onClick={() => verGeracoes(r)}
                          style={{
                            ...actionBtn,
                            background: "#0f172a",
                            color: "#fff",
                            borderColor: "#0f172a",
                            fontSize: 11,
                          }}
                        >
                          Gerações
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button
                          onClick={() => toggleStatus(r)}
                          style={pill(r.status === "ativo" ? "#15803d" : "#b91c1c")}
                        >
                          {r.status === "ativo" ? "ativo" : "bloq."}
                        </button>
                        <button
                          onClick={() => toggleAdmin(r)}
                          style={pill(r.is_admin ? "#0f213f" : "#94a3b8")}
                        >
                          {r.is_admin ? "admin" : "user"}
                        </button>
                        <button
                          onClick={() => resetCounters(r)}
                          style={{ ...actionBtn, fontSize: 11 }}
                        >
                          Zerar
                        </button>
                        <button
                          onClick={() => resetPassword(r)}
                          style={{ ...actionBtn, fontSize: 11 }}
                        >
                          Senha
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteUser(r)}
                        style={{ ...dangerBtn, fontSize: 11 }}
                        disabled={r.is_admin}
                      >
                        Excluir usuário
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignModal && (
        <div style={overlay} onClick={() => setAssignModal(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              Atribuir{" "}
              {assignModal.slot === "plano1"
                ? "Plano 1"
                : assignModal.slot === "plano2"
                  ? "Plano 2"
                  : "Bônus"}
            </h3>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
              {assignModal.userName}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={lbl}>Plano</span>
                <select
                  value={assignModal.selectedPlanId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setAssignModal({
                      ...assignModal,
                      selectedPlanId: newId,
                      resetCounters: newId !== (assignModal.originalPlanId || ""),
                    });
                  }}
                  style={inp}
                >
                  <option value="">— selecione —</option>
                  {assignModal.options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} — {p.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={lbl}>Data de início</span>
                <input
                  type="date"
                  value={assignModal.dateVal}
                  onChange={(e) => setAssignModal({ ...assignModal, dateVal: e.target.value })}
                  style={inp}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={lbl}>Meses contratados</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={assignModal.mesesContrato}
                    onChange={(e) =>
                      setAssignModal({ ...assignModal, mesesContrato: Number(e.target.value) })
                    }
                    style={inp}
                  >
                    {[1, 2, 3, 4, 5, 6, 9, 12].map((m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? "mês" : "meses"}
                      </option>
                    ))}
                  </select>
                  {assignModal.dateVal && (
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      até{" "}
                      {(() => {
                        const d = new Date(assignModal.dateVal + "T12:00:00");
                        d.setMonth(d.getMonth() + assignModal.mesesContrato);
                        return d.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        });
                      })()}
                    </span>
                  )}
                </div>
              </label>
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={assignModal.resetCounters}
                  onChange={(e) =>
                    setAssignModal({ ...assignModal, resetCounters: e.target.checked })
                  }
                />
                <span>Zerar contadores de consumo</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  {assignModal.selectedPlanId !== (assignModal.originalPlanId || "")
                    ? "(plano diferente)"
                    : "(mesmo plano)"}
                </span>
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setAssignModal(null)} style={actionBtn}>
                  Cancelar
                </button>
                <button
                  onClick={assignSlot}
                  disabled={!assignModal.selectedPlanId || !assignModal.dateVal}
                  style={{
                    background: "#0f213f",
                    color: "#fff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                    opacity: !assignModal.selectedPlanId || !assignModal.dateVal ? 0.5 : 1,
                  }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentoSelect({
  value,
  onChange,
}: {
  value: "SERVIÇOS" | "VAREJO" | "MARCA" | null;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "4px 6px",
        borderRadius: 4,
        border: "1px solid #cbd5e1",
        fontSize: 12,
        maxWidth: 130,
      }}
    >
      <option value="">— vazio —</option>
      <option value="SERVIÇOS">SERVIÇOS</option>
      <option value="VAREJO">VAREJO</option>
      <option value="MARCA">MARCA</option>
    </select>
  );
}

function PlanCell({
  planId,
  inicio,
  mesesContrato,
  contratoFim,
  options,
  onAssign,
  onRemove,
}: {
  planId: string | null;
  inicio: string | null;
  mesesContrato?: number;
  contratoFim?: string | null;
  options: Plan[];
  onAssign: () => void;
  onRemove: () => void;
}) {
  const plan = options.find((p) => p.id === planId);
  const periodo = plan ? planPeriodo(inicio, plan.tipo, mesesContrato, contratoFim) : "";
  return (
    <div>
      {plan ? (
        <>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button
              onClick={onAssign}
              style={{
                background: "none",
                border: "1px solid #cbd5e1",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
                color: "#0f213f",
                fontWeight: 600,
              }}
            >
              {plan.codigo}
            </button>
            <button
              onClick={onRemove}
              title="Remover plano"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: 12,
                padding: "0 2px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          {periodo && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, lineHeight: 1.3 }}>
              {periodo}
            </div>
          )}
        </>
      ) : (
        <button
          onClick={onAssign}
          style={{
            fontSize: 11,
            color: "#2563eb",
            background: "none",
            border: "1px dashed #cbd5e1",
            padding: "2px 8px",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          + Atribuir
        </button>
      )}
    </div>
  );
}

function SlotsConsumption({ row, onRenew }: { row: Row; onRenew?: (slot: SlotKey) => void }) {
  const slots = [
    {
      label: "P1",
      key: "plano1" as SlotKey,
      planId: row.plano1_id,
      inicio: row.plano1_inicio,
      iu: row.plano1_imgs_usadas,
      il: row.plano1_imgs_limite,
      ru: row.plano1_renders_usados,
      rl: row.plano1_renders_limite,
    },
    {
      label: "P2",
      key: "plano2" as SlotKey,
      planId: row.plano2_id,
      inicio: row.plano2_inicio,
      iu: row.plano2_imgs_usadas,
      il: row.plano2_imgs_limite,
      ru: row.plano2_renders_usados,
      rl: row.plano2_renders_limite,
    },
    {
      label: "B",
      key: "bonus" as SlotKey,
      planId: row.bonus_id,
      inicio: row.bonus_inicio,
      iu: row.bonus_imgs_usadas,
      il: row.bonus_imgs_limite,
      ru: row.bonus_renders_usados,
      rl: row.bonus_renders_limite,
    },
  ].filter((s) => s.planId);
  if (!slots.length) {
    if (row.is_admin)
      return (
        <span style={{ color: "#f4b000", fontWeight: 600, fontSize: 12 }}>Ilimitado (admin)</span>
      );
    return <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>;
  }
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {slots.map((s, i) => {
        const pct = s.il > 0 ? Math.min(100, Math.round((s.iu / s.il) * 100)) : 0;
        const color = pct >= 100 ? "#dc2626" : pct >= 90 ? "#d97706" : "#2563eb";
        const cycle = computeCycle(s.inicio);
        const cColor = cycleColor(cycle);
        return (
          <div key={i}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#475569",
                gap: 4,
                alignItems: "center",
              }}
            >
              <span>
                <strong>{s.label}</strong> {s.iu}/{s.il}
                {s.rl > 0 ? ` · r ${s.ru}/${s.rl}` : ""}
              </span>
              <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {cColor && (
                  <span
                    style={{
                      background: cColor.bg,
                      color: cColor.fg,
                      padding: "1px 5px",
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {cycleLabel(cycle)}
                  </span>
                )}
                <span style={{ color: "#94a3b8" }}>
                  {s.inicio ? new Date(s.inicio).toLocaleDateString("pt-BR") : "—"}
                </span>
                {onRenew && (
                  <button
                    type="button"
                    onClick={() => onRenew(s.key)}
                    title="Atribuir plano / renovar ciclo"
                    style={{
                      background: "#0f213f",
                      color: "#fff",
                      border: "none",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "lowercase",
                    }}
                  >
                    renovar
                  </button>
                )}
              </span>
            </div>
            <div
              style={{ height: 4, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}
            >
              <div style={{ width: `${pct}%`, height: "100%", background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Th = ({ children, title }: { children: React.ReactNode; title?: string }) => (
  <th
    title={title}
    style={{
      padding: "6px 8px",
      textAlign: "left",
      fontSize: 12,
      color: "#475569",
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </th>
);
const Td = ({ children }: { children: React.ReactNode }) => (
  <td style={{ padding: "6px 8px", verticalAlign: "middle" }}>{children}</td>
);
const actionBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #cbd5e1",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};
const pill = (color: string): React.CSSProperties => ({
  background: color,
  color: "#fff",
  border: "none",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  textTransform: "lowercase",
});
const dangerBtn: React.CSSProperties = {
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
};
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: 16,
};
const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  width: "100%",
  maxWidth: 380,
  maxHeight: "90vh",
  overflowY: "auto",
};
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#0f172a" };
const inp: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  background: "#fff",
};

function PlanPriceField({
  planId,
  plans,
  costs,
  usdRate,
  value,
  onChange,
}: {
  planId: string | null;
  plans: Plan[];
  costs: Costs;
  usdRate: number;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [inp2, setInp2] = useState(value != null ? String(value) : "");
  useEffect(() => {
    setInp2(value != null ? String(value) : "");
  }, [value]);
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;
  const seqSize = mopSequenceSize(plan.codigo);
  const custoOpenai = seqSize ? mopMonthlyCost(seqSize) : plan.limite_geracoes * costs.content;
  const costUsd =
    plan.limite_imagens * costs.imageRef + plan.limite_renders * costs.video + custoOpenai;
  // Arredonda pra cima — o mínimo exibido nunca pode ficar abaixo do piso
  // real de custo (senão um preço que bate com o número mostrado ainda
  // aparece como "abaixo do mínimo").
  const minBrl = Math.ceil(costUsd * usdRate * 3);
  const maxBrl = plan.preco_maximo_brl || 0;
  const applied = parseFloat(inp2);
  const belowMin = !isNaN(applied) && applied > 0 && applied < minBrl;
  function commit() {
    const v = parseFloat(inp2);
    onChange(isNaN(v) || inp2.trim() === "" ? null : v);
  }
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>R$</span>
        <input
          type="number"
          min="0"
          step="1"
          value={inp2}
          onChange={(e) => setInp2(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
          placeholder={String(minBrl)}
          style={{
            width: 60,
            padding: "2px 4px",
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${belowMin ? "#dc2626" : "#cbd5e1"}`,
            borderRadius: 4,
            color: belowMin ? "#dc2626" : "#0f172a",
            background: belowMin ? "#fef2f2" : "#fff",
          }}
        />
        {belowMin && (
          <span
            title={`Abaixo do mínimo (R$ ${minBrl})`}
            style={{ color: "#dc2626", fontSize: 12, fontWeight: 800 }}
          >
            ⚠
          </span>
        )}
      </div>
      <div style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1.3, marginTop: 1 }}>
        mín R$ {minBrl}
        {maxBrl > 0 ? ` · máx R$ ${maxBrl.toFixed(0)}` : ""}
      </div>
    </div>
  );
}

function FaturamentoCell({
  row,
  plans,
  costs,
  usdRate,
}: {
  row: Row;
  plans: Plan[];
  costs: Costs;
  usdRate: number;
}) {
  if (row.is_admin) return <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>;
  let totalMensal = 0;
  let hasWarning = false;
  const slots = [
    { planId: row.plano1_id, preco: row.plano1_preco_brl, meses: row.plano1_meses_contrato || 1 },
    { planId: row.plano2_id, preco: row.plano2_preco_brl, meses: row.plano2_meses_contrato || 1 },
    { planId: row.bonus_id, preco: row.bonus_preco_brl, meses: row.bonus_meses_contrato || 1 },
  ];
  // Meses máximos do contrato ativo (para mostrar total do contrato)
  const maxMeses = slots.filter((s) => s.planId).reduce((mx, s) => Math.max(mx, s.meses), 1);
  for (const s of slots) {
    if (!s.planId) continue;
    const plan = plans.find((p) => p.id === s.planId);
    if (!plan) continue;
    const seqSize = mopSequenceSize(plan.codigo);
    const custoOpenai = seqSize ? mopMonthlyCost(seqSize) : plan.limite_geracoes * costs.content;
    const cost =
      plan.limite_imagens * costs.imageRef + plan.limite_renders * costs.video + custoOpenai;
    const min = Math.ceil(cost * usdRate * 3);
    const preco = s.preco || 0;
    totalMensal += preco;
    if (preco > 0 && preco < min) hasWarning = true;
  }
  if (totalMensal === 0) return <span style={{ color: "#94a3b8", fontSize: 11 }}>sem preço</span>;
  const totalContrato = totalMensal * maxMeses;
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13, color: hasWarning ? "#dc2626" : "#15803d" }}>
        {hasWarning && "⚠ "}
        {maxMeses > 1 && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginRight: 4 }}>
            {maxMeses} meses ·
          </span>
        )}
        R$ {maxMeses > 1 ? totalContrato.toFixed(0) : totalMensal.toFixed(0)}
        <span style={{ fontSize: 10, fontWeight: 400, color: "#64748b" }}>
          {maxMeses > 1 ? " total" : "/mês"}
        </span>
      </div>
      {maxMeses > 1 && (
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
          R$ {totalMensal.toFixed(0)}/mês
        </div>
      )}
    </div>
  );
}

const miniSave: React.CSSProperties = {
  background: "#15803d",
  color: "#fff",
  border: "none",
  padding: "1px 6px",
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
const miniCancel: React.CSSProperties = {
  background: "#94a3b8",
  color: "#fff",
  border: "none",
  padding: "1px 6px",
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const MRow = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 0",
      borderTop: "1px solid #f1f5f9",
      fontSize: 13,
      gap: 8,
    }}
  >
    <span style={{ color: "#64748b" }}>{k}</span>
    <span style={{ textAlign: "right" }}>{children}</span>
  </div>
);
