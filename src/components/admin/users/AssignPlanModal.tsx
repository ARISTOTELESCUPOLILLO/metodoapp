// Modal de atribuição de plano/bônus — extraído de UsersTab.tsx (Fase 9).
import { actionBtn, inp, lbl, modal, overlay } from "./styles";
import type { AssignModal } from "./types";

export function AssignPlanModal({
  assignModal,
  onChange,
  onClose,
  onSave,
}: {
  assignModal: AssignModal;
  onChange: (next: AssignModal) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div style={overlay} onClick={onClose}>
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
                onChange({
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
              onChange={(e) => onChange({ ...assignModal, dateVal: e.target.value })}
              style={inp}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={lbl}>Meses contratados</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={assignModal.mesesContrato}
                onChange={(e) =>
                  onChange({ ...assignModal, mesesContrato: Number(e.target.value) })
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
              onChange={(e) => onChange({ ...assignModal, resetCounters: e.target.checked })}
            />
            <span>Zerar contadores de consumo</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              {assignModal.selectedPlanId !== (assignModal.originalPlanId || "")
                ? "(plano diferente)"
                : "(mesmo plano)"}
            </span>
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={onClose} style={actionBtn}>
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={!assignModal.selectedPlanId || !assignModal.dateVal}
              style={{
                background: "var(--brand-primary)",
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
  );
}
