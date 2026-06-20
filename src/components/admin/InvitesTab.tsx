import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useServerFn } from "@tanstack/react-start";
import { migrateImageKitFor } from "@/lib/imageKit.functions";

interface Invite {
  id: string;
  nome: string | null;
  email: string;
  status: string;
  plano1_id: string | null;
  plano2_id: string | null;
  bonus_id: string | null;
  accepted_at: string | null;
  created_at: string;
  source_test_profile_id: string | null;
  kit_migrated_at: string | null;
}
interface Plan {
  id: string;
  codigo: string;
  nome: string;
  elegivel_bonus: boolean;
}
interface TestProfile {
  id: string;
  nome: string | null;
  email: string;
}
interface ProfileSlots {
  email: string;
  plano1_id: string | null;
  plano2_id: string | null;
  bonus_id: string | null;
}
interface DirectProfile {
  id: string;
  email: string;
  nome: string | null;
  plano1_id: string | null;
  plano2_id: string | null;
  bonus_id: string | null;
}

export function InvitesTab() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<Invite[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [testProfiles, setTestProfiles] = useState<TestProfile[]>([]);
  const [profByEmail, setProfByEmail] = useState<Record<string, ProfileSlots>>({});
  const [directProfs, setDirectProfs] = useState<DirectProfile[]>([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState<"SERVIÇOS" | "VAREJO" | "MARCA" | "">("");
  const [plano1Id, setPlano1Id] = useState("");
  const [plano2Id, setPlano2Id] = useState("");
  const [bonusId, setBonusId] = useState("");
  const [sourceTestProfileId, setSourceTestProfileId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [migrating, setMigrating] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const migrateKitFn = useServerFn(migrateImageKitFor);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: inv }, { data: pls }, { data: tp }, { data: profs }] = await Promise.all([
      supabase.from("invited_emails").select("*").order("created_at", { ascending: false }),
      supabase
        .from("plans")
        .select("id,codigo,nome,elegivel_bonus")
        .eq("ativo", true)
        .order("nome"),
      supabase.from("profiles").select("id,nome,email").eq("is_test", true).order("nome"),
      supabase.from("profiles").select("id,nome,email,plano1_id,plano2_id,bonus_id"),
    ]);
    setRows((inv as Invite[]) || []);
    setPlans((pls as Plan[]) || []);
    setTestProfiles((tp as TestProfile[]) || []);
    const pbe: Record<string, ProfileSlots> = {};
    (profs || []).forEach((p) => {
      if (p.email) pbe[p.email.toLowerCase()] = p;
    });
    setProfByEmail(pbe);
    const invitedSet = new Set(((inv as Invite[]) || []).map((r: Invite) => r.email.toLowerCase()));
    const directs = (profs || []).filter(
      (p) =>
        p.email &&
        !invitedSet.has(p.email.toLowerCase()) &&
        (p.plano1_id || p.plano2_id || p.bonus_id),
    );
    setDirectProfs(directs as DirectProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanNome = nome.trim();
    if (!cleanEmail.includes("@")) {
      setMsg("E-mail inválido.");
      return;
    }
    if (!cleanNome) {
      setMsg("Informe o nome do cliente.");
      return;
    }
    if (!segment) {
      setMsg("Escolha o segmento do cliente.");
      return;
    }
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("invited_emails").insert({
      nome: cleanNome,
      email: cleanEmail,
      segment,
      plano1_id: plano1Id || null,
      plano2_id: plano2Id || null,
      bonus_id: bonusId || null,
      source_test_profile_id: sourceTestProfileId || null,
      invited_by: user?.id || null,
    });
    setBusy(false);
    if (error) {
      setMsg(error.code === "23505" ? "Este e-mail já foi convidado." : `Erro: ${error.message}`);
      return;
    }
    setNome("");
    setEmail("");
    setSegment("");
    setPlano1Id("");
    setPlano2Id("");
    setBonusId("");
    setSourceTestProfileId("");
    setMsg(`Convite criado. Envie o link de cadastro para ${cleanEmail}.`);
    load();
  }

  async function migrateKit(r: Invite) {
    if (!r.source_test_profile_id) return;
    if (
      !confirm(
        `Copiar o Kit Imagem do perfil de teste para ${r.nome || r.email}?\n\nOs arquivos do kit serão copiados para a conta do cliente.`,
      )
    )
      return;
    setMigrating(r.id);
    setMsg(null);
    try {
      const result = await migrateKitFn({
        data: { inviteId: r.id, sourceProfileId: r.source_test_profile_id },
      });
      const { copied } = result as any;
      const imgPart = copied.imageKitFound
        ? `${copied.avatar ? "1 avatar" : "sem avatar"}, ${copied.cenarios} cenário(s), ${copied.produtos} produto(s)`
        : "sem Kit Imagem no teste";
      const kitMarca = copied.brandKit
        ? ", kit de marca ✓"
        : copied.brandKitFound
          ? ", kit de marca encontrado mas falhou ao copiar — tente novamente"
          : ", kit de marca não encontrado no perfil de teste (salve o kit no teste antes de migrar)";
      setMsg(`Kit migrado: ${imgPart}${kitMarca}.`);
      load();
    } catch (e: any) {
      setMsg(`Erro na migração: ${e.message}`);
    }
    setMigrating(null);
  }

  async function setStatus(r: Invite, status: string) {
    if (!confirm(`${status === "revogado" ? "Revogar" : "Reativar"} convite de ${r.email}?`))
      return;
    await supabase.from("invited_emails").update({ status }).eq("id", r.id);
    load();
  }
  async function remove(r: Invite) {
    if (
      !confirm(
        `Excluir convite de ${r.email}?\n(Se já se cadastrou, exclua-o também na aba Usuários.)`,
      )
    )
      return;
    await supabase.from("invited_emails").delete().eq("id", r.id);
    load();
  }
  function copyLink(r: Invite) {
    const url = `${window.location.origin}/signup`;
    navigator.clipboard.writeText(url).then(
      () => alert(`Link copiado!\n\nEnvie para ${r.email}:\n${url}`),
      () => prompt("Copie o link:", url),
    );
  }

  const filtered = rows.filter((r) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (r.email || "").toLowerCase().includes(s) || (r.nome || "").toLowerCase().includes(s);
  });

  const bonusPlans = plans.filter((p) => p.elegivel_bonus);
  const mainPlans = plans.filter((p) => !p.elegivel_bonus);
  const labelFor = (id: string | null) =>
    id ? plans.find((p) => p.id === id)?.codigo || "—" : "—";
  const slotsFor = (r: Invite) => {
    const p = profByEmail[r.email.toLowerCase()];
    return {
      p1: p?.plano1_id ?? r.plano1_id,
      p2: p?.plano2_id ?? r.plano2_id,
      bonus: p?.bonus_id ?? r.bonus_id,
      synced: !!p,
    };
  };
  const testNameFor = (id: string | null) =>
    id
      ? testProfiles.find((t) => t.id === id)?.nome ||
        testProfiles.find((t) => t.id === id)?.email ||
        "—"
      : null;
  const statusColor = (s: string) =>
    s === "aceito" ? "#15803d" : s === "revogado" ? "#b91c1c" : "#0f213f";
  const statusLabel = (s: string) =>
    s === "aceito" ? "Ativo" : s === "revogado" ? "Bloqueado" : "Convidado";

  function KitBadge({ r }: { r: Invite }) {
    if (!r.source_test_profile_id) return null;
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
            onClick={() => migrateKit(r)}
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

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={card}>
        <h3 style={cardTitle}>＋ Pré-cadastro de Cliente</h3>
        <form
          onSubmit={invite}
          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}
        >
          <Field label="Nome">
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do cliente"
              style={inp}
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@cliente.com"
              style={inp}
            />
          </Field>
          <Field label="Segmento (obrigatório)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {(["SERVIÇOS", "VAREJO", "MARCA"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSegment(s)}
                  style={{
                    padding: "8px 4px",
                    borderRadius: 6,
                    border: `2px solid ${segment === s ? "#2563eb" : "#cbd5e1"}`,
                    background: segment === s ? "#eff6ff" : "#fff",
                    color: segment === s ? "#1d4ed8" : "#0f172a",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 4, marginBottom: 0 }}>
              Fixado após o cadastro — só admin pode alterar. Define o método de geração do
              conteúdo.
            </p>
          </Field>
          <Field label="Plano 1 (opcional)">
            <select
              value={plano1Id}
              onChange={(e) => setPlano1Id(e.target.value)}
              style={{ ...inp, background: "#fff" }}
            >
              <option value="">— Sem plano —</option>
              {mainPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plano 2 (opcional)">
            <select
              value={plano2Id}
              onChange={(e) => setPlano2Id(e.target.value)}
              style={{ ...inp, background: "#fff" }}
            >
              <option value="">— Sem plano —</option>
              {mainPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bônus (opcional)">
            <select
              value={bonusId}
              onChange={(e) => setBonusId(e.target.value)}
              style={{ ...inp, background: "#fff" }}
            >
              <option value="">— Sem bônus —</option>
              {bonusPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Migrar Kit Imagem de teste (opcional)">
            <select
              value={sourceTestProfileId}
              onChange={(e) => setSourceTestProfileId(e.target.value)}
              style={{ ...inp, background: "#fff" }}
            >
              <option value="">— Sem migração de kit —</option>
              {testProfiles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome || t.email}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                padding: "9px 18px",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
                opacity: busy ? 0.6 : 1,
                width: "100%",
              }}
            >
              {busy ? "Adicionando…" : "＋ Adicionar convite"}
            </button>
          </div>
        </form>
        {sourceTestProfileId && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "#fef9c3",
              border: "1px solid #fde68a",
              borderRadius: 6,
              fontSize: 12,
              color: "#713f12",
            }}
          >
            O Kit Imagem de <strong>{testNameFor(sourceTestProfileId)}</strong> será copiado para o
            novo cliente após o cadastro. O botão "Migrar Kit" aparecerá na lista abaixo assim que
            ele se cadastrar.
          </div>
        )}
        {msg && (
          <p
            style={{
              fontSize: 13,
              marginTop: 12,
              marginBottom: 0,
              color:
                msg.startsWith("Erro") ||
                msg.includes("inválid") ||
                msg.includes("já foi") ||
                msg.includes("Informe")
                  ? "#b91c1c"
                  : "#15803d",
            }}
          >
            {msg}
          </p>
        )}
      </section>

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
            onChange={(e) => setSearch(e.target.value)}
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
                    <KitBadge r={r} />
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
                  <button style={{ ...btn, flex: 1 }} onClick={() => copyLink(r)}>
                    Link
                  </button>
                  {r.status !== "revogado" ? (
                    <button style={{ ...btn, flex: 1 }} onClick={() => setStatus(r, "revogado")}>
                      Revogar
                    </button>
                  ) : (
                    <button style={{ ...btn, flex: 1 }} onClick={() => setStatus(r, "convidado")}>
                      Reativar
                    </button>
                  )}
                  <button style={{ ...btn, flex: 1 }} onClick={() => remove(r)}>
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
                        {(r as any).segment || "—"}
                      </span>
                    </Td>
                    <Td>{labelFor(slotsFor(r).p1)}</Td>
                    <Td>{labelFor(slotsFor(r).p2)}</Td>
                    <Td>{labelFor(slotsFor(r).bonus)}</Td>
                    <Td>
                      <KitBadge r={r} />
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
                        <button style={btn} onClick={() => copyLink(r)}>
                          Link
                        </button>
                        {r.status !== "revogado" ? (
                          <button style={btn} onClick={() => setStatus(r, "revogado")}>
                            Revogar
                          </button>
                        ) : (
                          <button style={btn} onClick={() => setStatus(r, "convidado")}>
                            Reativar
                          </button>
                        )}
                        <button style={btn} onClick={() => remove(r)}>
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
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 20,
};
const cardTitle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 16,
  fontWeight: 700,
  color: "#2563eb",
};
const inp: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  width: "100%",
};
const btn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #cbd5e1",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};
const Th = ({ children }: any) => (
  <th
    style={{
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 12,
      color: "#64748b",
      fontWeight: 600,
    }}
  >
    {children}
  </th>
);
const Td = ({ children, style }: any) => (
  <td style={{ padding: "10px", verticalAlign: "middle", ...style }}>{children}</td>
);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</span>
      {children}
    </label>
  );
}

const IRow = ({ k, v }: { k: string; v: string }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "4px 0",
      fontSize: 13,
      borderTop: "1px solid #f1f5f9",
    }}
  >
    <span style={{ color: "#64748b" }}>{k}</span>
    <span style={{ fontWeight: 600, color: "#0f172a" }}>{v}</span>
  </div>
);
