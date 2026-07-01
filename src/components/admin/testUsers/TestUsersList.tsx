// Lista de usuários de teste (mobile + desktop) — extraído de TestUsersTab.tsx (Fase 9.1).
import { card, cardTitle, btn, Th, Td, MRow, SlotBar, SegSelect, PlanSelect } from "./primitives";
import type { Plan, Row, SlotKey } from "./types";

const Badge = () => (
  <span
    style={{
      background: "#7c3aed",
      color: "#fff",
      fontSize: 10,
      padding: "1px 6px",
      borderRadius: 4,
      fontWeight: 700,
    }}
  >
    TESTE
  </span>
);

export function TestUsersList({
  isMobile,
  loading,
  rows,
  mainPlans,
  bonusPlans,
  busy,
  onActAs,
  onChangeSeg,
  onChangeSlot,
  onResetCounters,
  onRemove,
}: {
  isMobile: boolean;
  loading: boolean;
  rows: Row[];
  mainPlans: Plan[];
  bonusPlans: Plan[];
  busy: string | null;
  onActAs: (r: Row) => void;
  onChangeSeg: (r: Row, seg: string) => void;
  onChangeSlot: (r: Row, slot: SlotKey, planId: string) => void;
  onResetCounters: (r: Row) => void;
  onRemove: (r: Row) => void;
}) {
  return (
    <section style={card}>
      <h3 style={cardTitle}>Usuários de teste ({rows.length})</h3>
      {loading ? (
        <p>Carregando…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 13 }}>Nenhum teste criado ainda.</p>
      ) : isMobile ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
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
                  {r.nome}
                  <Badge />
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
              <MRow k="Segmento">
                <SegSelect value={r.segmento} onChange={(v) => onChangeSeg(r, v)} />
              </MRow>
              <MRow k="Plano 1">
                <div>
                  <PlanSelect
                    value={r.plano1_id}
                    options={mainPlans}
                    onChange={(v) => onChangeSlot(r, "plano1", v)}
                  />
                  {r.plano1_id && (
                    <SlotBar
                      iu={r.plano1_imgs_usadas}
                      il={r.plano1_imgs_limite}
                      ru={r.plano1_renders_usados}
                      rl={r.plano1_renders_limite}
                      gu={r.plano1_geracoes_usadas}
                      gl={r.plano1_geracoes_limite}
                    />
                  )}
                </div>
              </MRow>
              <MRow k="Plano 2">
                <div>
                  <PlanSelect
                    value={r.plano2_id}
                    options={mainPlans}
                    onChange={(v) => onChangeSlot(r, "plano2", v)}
                  />
                  {r.plano2_id && (
                    <SlotBar
                      iu={r.plano2_imgs_usadas}
                      il={r.plano2_imgs_limite}
                      ru={r.plano2_renders_usados}
                      rl={r.plano2_renders_limite}
                      gu={r.plano2_geracoes_usadas}
                      gl={r.plano2_geracoes_limite}
                    />
                  )}
                </div>
              </MRow>
              <MRow k="Bônus">
                <div>
                  <PlanSelect
                    value={r.bonus_id}
                    options={bonusPlans}
                    onChange={(v) => onChangeSlot(r, "bonus", v)}
                  />
                  {r.bonus_id && (
                    <SlotBar
                      iu={r.bonus_imgs_usadas}
                      il={r.bonus_imgs_limite}
                      ru={r.bonus_renders_usados}
                      rl={r.bonus_renders_limite}
                      gu={r.bonus_geracoes_usadas}
                      gl={r.bonus_geracoes_limite}
                    />
                  )}
                </div>
              </MRow>
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}
              >
                <button
                  onClick={() => onActAs(r)}
                  style={{
                    ...btn,
                    background: "#7c3aed",
                    color: "#fff",
                    borderColor: "#7c3aed",
                    fontWeight: 700,
                  }}
                >
                  Atuar como
                </button>
                <button onClick={() => onResetCounters(r)} style={btn}>
                  Zerar
                </button>
                <button
                  onClick={() => onRemove(r)}
                  style={{ ...btn, color: "#b91c1c", borderColor: "#fecaca" }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Nome</Th>
                <Th>Segmento</Th>
                <Th>P1</Th>
                <Th>P2</Th>
                <Th>Bônus</Th>
                <Th>Criado</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderTop: "1px solid #e2e8f0", opacity: busy === r.id ? 0.5 : 1 }}
                >
                  <Td>
                    <div style={{ fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
                      {r.nome}
                      <Badge />
                    </div>
                    {r.client_code && (
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: 11,
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        }}
                      >
                        {r.client_code}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <SegSelect value={r.segmento} onChange={(v) => onChangeSeg(r, v)} />
                  </Td>
                  <Td>
                    <PlanSelect
                      value={r.plano1_id}
                      options={mainPlans}
                      onChange={(v) => onChangeSlot(r, "plano1", v)}
                    />
                    {r.plano1_id && (
                      <SlotBar
                        iu={r.plano1_imgs_usadas}
                        il={r.plano1_imgs_limite}
                        ru={r.plano1_renders_usados}
                        rl={r.plano1_renders_limite}
                        gu={r.plano1_geracoes_usadas}
                        gl={r.plano1_geracoes_limite}
                      />
                    )}
                  </Td>
                  <Td>
                    <PlanSelect
                      value={r.plano2_id}
                      options={mainPlans}
                      onChange={(v) => onChangeSlot(r, "plano2", v)}
                    />
                    {r.plano2_id && (
                      <SlotBar
                        iu={r.plano2_imgs_usadas}
                        il={r.plano2_imgs_limite}
                        ru={r.plano2_renders_usados}
                        rl={r.plano2_renders_limite}
                        gu={r.plano2_geracoes_usadas}
                        gl={r.plano2_geracoes_limite}
                      />
                    )}
                  </Td>
                  <Td>
                    <PlanSelect
                      value={r.bonus_id}
                      options={bonusPlans}
                      onChange={(v) => onChangeSlot(r, "bonus", v)}
                    />
                    {r.bonus_id && (
                      <SlotBar
                        iu={r.bonus_imgs_usadas}
                        il={r.bonus_imgs_limite}
                        ru={r.bonus_renders_usados}
                        rl={r.bonus_renders_limite}
                        gu={r.bonus_geracoes_usadas}
                        gl={r.bonus_geracoes_limite}
                      />
                    )}
                  </Td>
                  <Td style={{ color: "#64748b", fontSize: 12 }}>
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button
                        onClick={() => onActAs(r)}
                        style={{
                          ...btn,
                          background: "#7c3aed",
                          color: "#fff",
                          borderColor: "#7c3aed",
                          fontWeight: 700,
                        }}
                      >
                        Atuar como
                      </button>
                      <button onClick={() => onResetCounters(r)} style={btn}>
                        Zerar
                      </button>
                      <button
                        onClick={() => onRemove(r)}
                        style={{ ...btn, color: "#b91c1c", borderColor: "#fecaca" }}
                      >
                        Excluir
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
