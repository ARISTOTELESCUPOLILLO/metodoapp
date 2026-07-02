// Linha da tabela desktop da aba Usuários — extraído de UsersTab.tsx (Fase 9).
import { PlanCell } from "./PlanCell";
import { PlanPriceField } from "./PlanPriceField";
import { FaturamentoCell } from "./FaturamentoCell";
import { SegmentoSelect } from "./SegmentoSelect";
import { SlotsConsumption } from "./SlotsConsumption";
import { Td } from "./primitives";
import { actionBtn, dangerBtn, miniCancel, miniSave, pill } from "./styles";
import type { Costs, Plan, Row, UserRowActions } from "./types";

export function UserTableRow({
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
    <tr style={{ borderTop: "1px solid #e2e8f0", opacity: busy ? 0.5 : 1 }}>
      <Td>
        <div style={{ fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
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
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "2px 6px",
                  border: "1px solid var(--brand-primary)",
                  borderRadius: 4,
                  width: 130,
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
      </Td>
      <Td>
        <PlanCell
          planId={r.plano2_id}
          inicio={r.plano2_inicio}
          mesesContrato={r.plano2_meses_contrato}
          contratoFim={r.plano2_contrato_fim}
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
      </Td>
      <Td>
        <PlanCell
          planId={r.bonus_id}
          inicio={r.bonus_inicio}
          mesesContrato={r.bonus_meses_contrato}
          contratoFim={r.bonus_contrato_fim}
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
      </Td>
      <Td>
        {hasCinematicsPlan ? (
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
                onChange={() => actions.onToggleVoiceAvatar(r, 1)}
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
                onChange={() => actions.onToggleVoiceAvatar(r, 2)}
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
        <SegmentoSelect value={r.segmento} onChange={(v) => actions.onChangeSegmento(r, v)} />
      </Td>
      <Td>
        <SlotsConsumption
          row={r}
          onRenew={(slot) =>
            actions.onOpenAssignModal(r, slot, slot === "bonus" ? bonusPlans : mainPlans, true)
          }
          onZerarConsumo={(slot) => actions.onResetSlotUsage(r, slot)}
        />
      </Td>
      <Td>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => actions.onActAs(r)}
              style={{
                ...actionBtn,
                background: "var(--brand-primary)",
                color: "#fff",
                borderColor: "var(--brand-primary)",
                fontWeight: 700,
                fontSize: 11,
              }}
              disabled={r.is_admin}
              title={
                r.is_admin ? "Não é necessário para admin" : "Entrar no contexto deste usuário"
              }
            >
              Atuar como
            </button>
            <button
              onClick={() => actions.onVerGeracoes(r)}
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
              onClick={() => actions.onToggleStatus(r)}
              style={pill(r.status === "ativo" ? "#15803d" : "#b91c1c")}
            >
              {r.status === "ativo" ? "ativo" : "bloq."}
            </button>
            <button
              onClick={() => actions.onToggleAdmin(r)}
              style={pill(r.is_admin ? "var(--brand-primary)" : "#94a3b8")}
            >
              {r.is_admin ? "admin" : "user"}
            </button>
            <button
              onClick={() => actions.onResetCounters(r)}
              style={{ ...actionBtn, fontSize: 11 }}
            >
              Zerar
            </button>
            <button
              onClick={() => actions.onResetPassword(r)}
              style={{ ...actionBtn, fontSize: 11 }}
            >
              Senha
            </button>
          </div>
          <button
            onClick={() => actions.onDeleteUser(r)}
            style={{ ...dangerBtn, fontSize: 11 }}
            disabled={r.is_admin}
          >
            Excluir usuário
          </button>
        </div>
      </Td>
    </tr>
  );
}
