// Modal de criação/edição de plano — extraído de PlansTab.tsx (Fase 9).
import { overlay, modal, lbl, inp, Inp, btn } from "./primitives";
import type { Plan } from "./types";

export type EditingPlan = Plan | (Omit<Plan, "id"> & { id?: string });

export function PlanEditModal({
  editing,
  saving,
  msg,
  onChange,
  onCancel,
  onSave,
}: {
  editing: EditingPlan;
  saving: boolean;
  msg: string | null;
  onChange: (next: EditingPlan) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          {editing.id ? "Editar plano" : "Novo plano"}
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          <Inp
            label="Código"
            value={editing.codigo}
            onChange={(v) => onChange({ ...editing, codigo: v })}
          />
          <Inp
            label="Nome"
            value={editing.nome}
            onChange={(v) => onChange({ ...editing, nome: v })}
          />
          <label style={{ display: "grid", gap: 4 }}>
            <span style={lbl}>Tipo</span>
            <select
              value={editing.tipo}
              onChange={(e) => onChange({ ...editing, tipo: e.target.value })}
              style={inp}
            >
              <option value="mensal">mensal</option>
              <option value="anual">anual</option>
              <option value="trial">trial</option>
              <option value="vitalicio">vitalicio</option>
            </select>
          </label>
          <Inp
            label="Limite imagens (real / estendido)"
            type="number"
            value={String(editing.limite_imagens)}
            onChange={(v) => onChange({ ...editing, limite_imagens: Number(v) })}
          />
          <Inp
            label="Limite renders (real / estendido)"
            type="number"
            value={String(editing.limite_renders)}
            onChange={(v) => onChange({ ...editing, limite_renders: Number(v) })}
          />
          {/* "Limite gerações" saiu daqui (2026-08-06). O contador foi aposentado do
              bloqueio em 2026-07-03 (migration retire-geracoes-gate-fix-cron) e vale 0
              (= ilimitado) em todos os planos. Enquanto o campo era editável, digitar
              um número aqui religava um gate morto que soma MOP + PU no mesmo saldo e
              travaria o botão do Post Único pelo consumo do Método OP. Quem limita
              texto hoje são os três campos abaixo; imagem/render continuam acima. */}
          <Inp
            label={'Limite "Gerar outro" de bloco (0 = ilimitado)'}
            type="number"
            value={String(editing.limite_regen_texto ?? 0)}
            onChange={(v) => onChange({ ...editing, limite_regen_texto: Number(v) })}
          />
          <Inp
            label={'Limite "Sugestão" (0 = ilimitado)'}
            type="number"
            value={String(editing.limite_sugestoes ?? 0)}
            onChange={(v) => onChange({ ...editing, limite_sugestoes: Number(v) })}
          />
          <Inp
            label={'Limite "Primeira Geração" (0 = ilimitado)'}
            type="number"
            value={String(editing.limite_primeira_geracao ?? 0)}
            onChange={(v) => onChange({ ...editing, limite_primeira_geracao: Number(v) })}
          />

          <div
            style={{
              padding: "10px 12px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 2 }}>
              Limite de display — o que o cliente vê
            </div>
            <div style={{ fontSize: 11, color: "#78350f", marginBottom: 8 }}>
              Uso Normal (coluna 2 da tabela). Deixe vazio para mostrar o limite real.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={lbl}>Imgs display</span>
                <input
                  type="number"
                  value={editing.limite_imgs_display ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...editing,
                      limite_imgs_display: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="—"
                  style={inp}
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={lbl}>Renders display</span>
                <input
                  type="number"
                  value={editing.limite_renders_display ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...editing,
                      limite_renders_display: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="—"
                  style={inp}
                />
              </label>
            </div>
          </div>

          <Inp
            label="Preço máx. R$ (tabela de preços)"
            type="number"
            value={String(editing.preco_maximo_brl ?? 0)}
            onChange={(v) => onChange({ ...editing, preco_maximo_brl: Number(v) })}
          />

          <div
            style={{
              marginTop: 6,
              padding: "10px 12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--brand-primary)",
                marginBottom: 6,
              }}
            >
              ★ Personalizados base por tipo
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
              Quantidade que vem "de fábrica" neste plano. Soma com os outros planos do usuário +
              extras dele.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Inp
                label="Estático"
                type="number"
                value={String(editing.base_estatico ?? 0)}
                onChange={(v) => onChange({ ...editing, base_estatico: Number(v) })}
              />
              <Inp
                label="Carrossel"
                type="number"
                value={String(editing.base_carrossel ?? 0)}
                onChange={(v) => onChange({ ...editing, base_carrossel: Number(v) })}
              />
              <Inp
                label="Estático final"
                type="number"
                value={String(editing.base_estatico_final ?? 0)}
                onChange={(v) => onChange({ ...editing, base_estatico_final: Number(v) })}
              />
              <Inp
                label="Reels"
                type="number"
                value={String(editing.base_reels ?? 0)}
                onChange={(v) => onChange({ ...editing, base_reels: Number(v) })}
              />
            </div>
          </div>

          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={editing.ativo}
              onChange={(e) => onChange({ ...editing, ativo: e.target.checked })}
            />
            Ativo
          </label>
          {msg && <p style={{ fontSize: 13, color: "#b91c1c" }}>{msg}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onCancel} style={btn}>
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                background: "var(--brand-primary)",
                color: "#fff",
                border: "none",
                padding: "8px 14px",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 13,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
