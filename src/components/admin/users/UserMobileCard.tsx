// Card mobile da aba Usuários — extraído de UsersTab.tsx (Fase 9).
import { PlanCell } from "./PlanCell";
import { PlanPriceField } from "./PlanPriceField";
import { FaturamentoCell } from "./FaturamentoCell";
import { SegmentoSelect } from "./SegmentoSelect";
import { SlotsConsumption } from "./SlotsConsumption";
import { MRow } from "./primitives";
import { actionBtn, dangerBtn, miniCancel, miniSave, pill } from "./styles";
import type { Costs, Plan, Row, UserRowActions } from "./types";

export function UserMobileCard({
  r,
  busy,
  editNome,
  setEditNome,
  mainPlans,
  bonusPlans,
  costs,
  usdRate,
  hasCinematicsPlan,
  actions,
}: {
  r: Row;
  busy: boolean;
  editNome: { id: string; val: string } | null;
  setEditNome: (v: { id: string; val: string } | null) => void;
  mainPlans: Plan[];
  bonusPlans: Plan[];
  costs: Costs;
  usdRate: number;
  hasCinematicsPlan: boolean;
  actions: UserRowActions;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 14,
        opacity: busy ? 0.5 : 1,
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
                  if (e.key === "Enter") actions.onChangeNome(r.id, editNome.val);
                  if (e.key === "Escape") setEditNome(null);
                }}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "2px 6px",
                  border: "1px solid var(--brand-primary)",
                  borderRadius: 4,
                  width: 140,
                }}
              />
              <button onClick={() => actions.onChangeNome(r.id, editNome.val)} style={miniSave}>
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
                background: "var(--brand-primary)",
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
        <div style={{ color: "#64748b", fontSize: 12, wordBreak: "break-all" }}>{r.email}</div>
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
            cicloAte={r.plano1_expira_em}
            options={mainPlans}
            onAssign={() => actions.onOpenAssignModal(r, "plano1", mainPlans)}
            onRemove={() => actions.onRemoveSlot(r.id, "plano1")}
          />
          {r.plano1_id && (
            <PlanPriceField
              planId={r.plano1_id}
              plans={mainPlans}
              costs={costs}
              usdRate={usdRate}
              value={r.plano1_preco_brl}
              onChange={(v) => actions.onChangePreco(r.id, "plano1", v)}
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
            cicloAte={r.plano2_expira_em}
            options={mainPlans}
            onAssign={() => actions.onOpenAssignModal(r, "plano2", mainPlans)}
            onRemove={() => actions.onRemoveSlot(r.id, "plano2")}
          />
          {r.plano2_id && (
            <PlanPriceField
              planId={r.plano2_id}
              plans={mainPlans}
              costs={costs}
              usdRate={usdRate}
              value={r.plano2_preco_brl}
              onChange={(v) => actions.onChangePreco(r.id, "plano2", v)}
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
            cicloAte={r.bonus_expira_em}
            options={bonusPlans}
            onAssign={() => actions.onOpenAssignModal(r, "bonus", bonusPlans)}
            onRemove={() => actions.onRemoveSlot(r.id, "bonus")}
          />
          {r.bonus_id && (
            <PlanPriceField
              planId={r.bonus_id}
              plans={bonusPlans}
              costs={costs}
              usdRate={usdRate}
              value={r.bonus_preco_brl}
              onChange={(v) => actions.onChangePreco(r.id, "bonus", v)}
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
        <SegmentoSelect value={r.segmento} onChange={(v) => actions.onChangeSegmento(r, v)} />
      </MRow>
      <MRow k="Status">
        <button
          onClick={() => actions.onToggleStatus(r)}
          style={pill(r.status === "ativo" ? "#15803d" : "#b91c1c")}
        >
          {r.status === "ativo" ? "bloquear" : "desbloquear"}
        </button>
      </MRow>
      <MRow k="Admin">
        <button
          onClick={() => actions.onToggleAdmin(r)}
          style={pill(r.is_admin ? "var(--brand-primary)" : "#94a3b8")}
        >
          {r.is_admin ? "admin" : "user"}
        </button>
      </MRow>
      {hasCinematicsPlan && (
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
                onChange={() => actions.onToggleVoiceAvatar(r, 1)}
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
                onChange={() => actions.onToggleVoiceAvatar(r, 2)}
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
            actions.onOpenAssignModal(r, slot, slot === "bonus" ? bonusPlans : mainPlans, true)
          }
          onZerarConsumo={(slot) => actions.onResetSlotUsage(r, slot)}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
        <button
          onClick={() => actions.onActAs(r)}
          style={{
            ...actionBtn,
            background: "var(--brand-primary)",
            color: "#fff",
            borderColor: "var(--brand-primary)",
            fontWeight: 700,
          }}
          disabled={r.is_admin}
        >
          Atuar como
        </button>
        <button
          onClick={() => actions.onVerGeracoes(r)}
          style={{ ...actionBtn, background: "#0f172a", color: "#fff", borderColor: "#0f172a" }}
        >
          Gerações
        </button>
        <button
          onClick={() => actions.onResetCounters(r)}
          style={actionBtn}
          title="Zera o consumo de TODOS os slots (P1, P2 e Bônus) — para zerar só um slot, use o botão ao lado do slot em Consumo"
        >
          Zerar tudo
        </button>
        <button onClick={() => actions.onResetPassword(r)} style={actionBtn}>
          Senha
        </button>
        <button
          onClick={() => actions.onDeleteUser(r)}
          style={{ ...dangerBtn, gridColumn: "1 / -1" }}
          disabled={r.is_admin}
        >
          Excluir usuário
        </button>
      </div>
    </div>
  );
}
