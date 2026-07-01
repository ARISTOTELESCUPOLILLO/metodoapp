// Seção "Emails Autorizados" da aba Convites — extraído de InvitesTab.tsx (Fase 9).
import { card, cardTitle, inp, btn, Th, Td, IRow } from "./primitives";
import type { DirectProfile, Invite, Plan, ProfileSlots, TestProfile } from "./types";

function KitBadge({
  r,
  testProfiles,
  migrating,
  onMigrateKit,
}: {
  r: Invite;
  testProfiles: TestProfile[];
  migrating: string | null;
  onMigrateKit: (r: Invite) => void;
}) {
  if (!r.source_test_profile_id) return null;
  const testNameFor = (id: string | null) =>
    id
      ? testProfiles.find((t) => t.id === id)?.nome ||
        testProfiles.find((t) => t.id === id)?.email ||
        "—"
      : null;
  const testName = testNameFor(r.source_test_profile_id);
  if (r.status === "aceito") {
    return (
      <div>
        {r.kit_migrated_at && (
          <div
            style={{
              fontSize: 10,
              color: "#15803d",
              marginBottom: 3,
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <span>✓ Kit migrado</span>
            <span style={{ color: "#94a3b8" }}>
              ({new Date(r.kit_migrated_at).toLocaleDateString("pt-BR")})
            </span>
          </div>
        )}
        <button
          onClick={() => onMigrateKit(r)}
          disabled={migrating === r.id}
          style={{
            background: r.kit_migrated_at ? "transparent" : "#f59e0b",
            color: r.kit_migrated_at ? "#64748b" : "#fff",
            border: r.kit_migrated_at ? "1px solid #cbd5e1" : "none",
            borderRadius: 4,
            padding: "3px 8px",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            opacity: migrating === r.id ? 0.6 : 1,
            display: "block",
          }}
        >
          {migrating === r.id
            ? "Migrando…"
            : r.kit_migrated_at
              ? `↺ Re-migrar Kit (${testName})`
              : `⬆ Migrar Kit (${testName})`}
        </button>
      </div>
    );
  }
  return (
    <div style={{ fontSize: 10, color: "#d97706", marginTop: 3 }}>
      Kit de: {testName} — aguarda cadastro
    </div>
  );
}

const statusColor = (s: string) =>
  s === "aceito" ? "#15803d" : s === "revogado" ? "#b91c1c" : "var(--brand-primary)";
const statusLabel = (s: string) =>
  s === "aceito" ? "Ativo" : s === "revogado" ? "Bloqueado" : "Convidado";

export function InvitesListSection({
  isMobile,
  loading,
  search,
  filtered,
  directProfs,
  plans,
  profByEmail,
  testProfiles,
  migrating,
  onSearchChange,
  onCopyLink,
  onSetStatus,
  onRemove,
  onMigrateKit,
}: {
  isMobile: boolean;
  loading: boolean;
  search: string;
  filtered: Invite[];
  directProfs: DirectProfile[];
  plans: Plan[];
  profByEmail: Record<string, ProfileSlots>;
  testProfiles: TestProfile[];
  migrating: string | null;
  onSearchChange: (v: string) => void;
  onCopyLink: (r: Invite) => void;
  onSetStatus: (r: Invite, status: string) => void;
  onRemove: (r: Invite) => void;
  onMigrateKit: (r: Invite) => void;
}) {
  const labelFor = (id: string | null) =>
    id ? plans.find((p) => p.id === id)?.codigo || "—" : "—";
  const slotsFor = (r: Invite) => {
    const p = profByEmail[r.email.toLowerCase()];
    return {
      p1: p?.plano1_id ?? r.plano1_id,
      p2: p?.plano2_id ?? r.plano2_id,
      bonus: p?.bonus_id ?? r.bonus_id,
    };
  };

  return (
    <section style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 12,
        }}
      >
        <h3 style={cardTitle}>Emails Autorizados</h3>
        <input
          placeholder="Buscar nome ou e-mail"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ ...inp, maxWidth: 240 }}
        />
      </div>

      {loading ? (
        <p>Carregando…</p>
      ) : isMobile ? (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((r) => (
            <div
              key={r.id}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.nome || "—"}</div>
                  <div style={{ color: "#475569", fontSize: 12, wordBreak: "break-all" }}>
                    {r.email}
                  </div>
                  <KitBadge
                    r={r}
                    testProfiles={testProfiles}
                    migrating={migrating}
                    onMigrateKit={onMigrateKit}
                  />
                </div>
                <span
                  style={{
                    background: statusColor(r.status),
                    color: "#fff",
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    height: "fit-content",
                  }}
                >
                  {statusLabel(r.status)}
                </span>
              </div>
              <IRow k="P1" v={labelFor(slotsFor(r).p1)} />
              <IRow k="P2" v={labelFor(slotsFor(r).p2)} />
              <IRow k="Bônus" v={labelFor(slotsFor(r).bonus)} />
              <IRow k="Cadastrado" v={new Date(r.created_at).toLocaleDateString("pt-BR")} />
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button style={{ ...btn, flex: 1 }} onClick={() => onCopyLink(r)}>
                  Link
                </button>
                {r.status !== "revogado" ? (
                  <button style={{ ...btn, flex: 1 }} onClick={() => onSetStatus(r, "revogado")}>
                    Revogar
                  </button>
                ) : (
                  <button style={{ ...btn, flex: 1 }} onClick={() => onSetStatus(r, "convidado")}>
                    Reativar
                  </button>
                )}
                <button style={{ ...btn, flex: 1 }} onClick={() => onRemove(r)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && directProfs.length === 0 && (
            <p style={{ textAlign: "center", color: "#64748b" }}>Nenhum convite.</p>
          )}
          {directProfs.map((dp) => (
            <div
              key={dp.id}
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{dp.nome || "—"}</div>
                  <div style={{ color: "#475569", fontSize: 12, wordBreak: "break-all" }}>
                    {dp.email}
                  </div>
                </div>
                <span
                  style={{
                    background: "#15803d",
                    color: "#fff",
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    height: "fit-content",
                  }}
                >
                  Direto
                </span>
              </div>
              <IRow k="P1" v={labelFor(dp.plano1_id)} />
              <IRow k="P2" v={labelFor(dp.plano2_id)} />
              <IRow k="Bônus" v={labelFor(dp.bonus_id)} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#64748b", fontSize: 12 }}>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Seg.</Th>
                <Th>P1</Th>
                <Th>P2</Th>
                <Th>Bônus</Th>
                <Th>Kit</Th>
                <Th>Status</Th>
                <Th>Cadastrado em</Th>
                <Th>Ação</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <Td>
                    <strong>{r.nome || "—"}</strong>
                  </Td>
                  <Td style={{ color: "#475569" }}>{r.email}</Td>
                  <Td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>
                      {r.segment || "—"}
                    </span>
                  </Td>
                  <Td>{labelFor(slotsFor(r).p1)}</Td>
                  <Td>{labelFor(slotsFor(r).p2)}</Td>
                  <Td>{labelFor(slotsFor(r).bonus)}</Td>
                  <Td>
                    <KitBadge
                      r={r}
                      testProfiles={testProfiles}
                      migrating={migrating}
                      onMigrateKit={onMigrateKit}
                    />
                  </Td>
                  <Td>
                    <span
                      style={{
                        background: statusColor(r.status),
                        color: "#fff",
                        padding: "3px 12px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </Td>
                  <Td>{new Date(r.created_at).toLocaleDateString("pt-BR")}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button style={btn} onClick={() => onCopyLink(r)}>
                        Link
                      </button>
                      {r.status !== "revogado" ? (
                        <button style={btn} onClick={() => onSetStatus(r, "revogado")}>
                          Revogar
                        </button>
                      ) : (
                        <button style={btn} onClick={() => onSetStatus(r, "convidado")}>
                          Reativar
                        </button>
                      )}
                      <button style={btn} onClick={() => onRemove(r)}>
                        Excluir
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && directProfs.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>
                    Nenhum convite.
                  </td>
                </tr>
              )}
              {directProfs.map((dp) => (
                <tr key={dp.id} style={{ borderTop: "1px solid #e2e8f0", background: "#f0fdf4" }}>
                  <Td>
                    <strong>{dp.nome || "—"}</strong>
                  </Td>
                  <Td style={{ color: "#475569" }}>{dp.email}</Td>
                  <Td>—</Td>
                  <Td>{labelFor(dp.plano1_id)}</Td>
                  <Td>{labelFor(dp.plano2_id)}</Td>
                  <Td>{labelFor(dp.bonus_id)}</Td>
                  <Td>—</Td>
                  <Td>
                    <span
                      style={{
                        background: "#15803d",
                        color: "#fff",
                        padding: "3px 12px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      Direto
                    </span>
                  </Td>
                  <Td>—</Td>
                  <Td>—</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
