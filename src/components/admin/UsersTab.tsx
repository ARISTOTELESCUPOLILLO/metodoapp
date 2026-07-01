import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUsersData } from "./users/useUsersData";
import { useUserRowActions } from "./users/useUserRowActions";
import { AssignPlanModal } from "./users/AssignPlanModal";
import { UserMobileCard } from "./users/UserMobileCard";
import { UserTableRow } from "./users/UserTableRow";
import { Th } from "./users/primitives";

export function UsersTab() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const { rows, plans, loading, costs, usdRate, load } = useUsersData();
  const {
    busy,
    editNome,
    setEditNome,
    assignModal,
    setAssignModal,
    assignSlot,
    hasCinematicsPlan,
    rowActions,
    dialog,
  } = useUserRowActions(plans, load);

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
