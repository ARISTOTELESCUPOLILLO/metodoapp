import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeCycle, cycleLabel, cycleColor, type CycleInfo } from "@/lib/cycle";

interface Row {
  id: string;
  nome: string | null;
  email: string;
  client_code: string | null;
  plano1_id: string | null;
  plano1_inicio: string | null;
  plano1_last_charged_at: string | null;
  plano2_id: string | null;
  plano2_inicio: string | null;
  plano2_last_charged_at: string | null;
  bonus_id: string | null;
  bonus_inicio: string | null;
  bonus_last_charged_at: string | null;
}
interface Plan {
  id: string;
  codigo: string;
}

type SlotKey = "plano1" | "plano2" | "bonus";

interface Item {
  user: Row;
  slot: SlotKey;
  label: "P1" | "P2" | "B";
  planCodigo: string;
  inicio: string;
  lastChargedAt: string | null;
  cycle: CycleInfo;
}

export function CobrancasTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: pls }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,nome,email,client_code,plano1_id,plano1_inicio,plano1_last_charged_at,plano2_id,plano2_inicio,plano2_last_charged_at,bonus_id,bonus_inicio,bonus_last_charged_at",
        )
        .eq("is_test", false),
      supabase.from("plans").select("id,codigo"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const planMap: Record<string, string> = Object.fromEntries(
      ((pls as Plan[]) || []).map((p) => [p.id, p.codigo]),
    );
    const admins = new Set(
      (roles || []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id),
    );
    const all: Item[] = [];
    for (const r of (profs as Row[]) || []) {
      if (admins.has(r.id)) continue;
      const slots: Array<{
        key: SlotKey;
        label: "P1" | "P2" | "B";
        planId: string | null;
        inicio: string | null;
        charged: string | null;
      }> = [
        {
          key: "plano1",
          label: "P1",
          planId: r.plano1_id,
          inicio: r.plano1_inicio,
          charged: r.plano1_last_charged_at,
        },
        {
          key: "plano2",
          label: "P2",
          planId: r.plano2_id,
          inicio: r.plano2_inicio,
          charged: r.plano2_last_charged_at,
        },
        {
          key: "bonus",
          label: "B",
          planId: r.bonus_id,
          inicio: r.bonus_inicio,
          charged: r.bonus_last_charged_at,
        },
      ];
      for (const s of slots) {
        if (!s.planId || !s.inicio) continue;
        const cycle = computeCycle(s.inicio);
        if (cycle.status !== "due_soon" && cycle.status !== "overdue") continue;
        all.push({
          user: r,
          slot: s.key,
          label: s.label,
          planCodigo: planMap[s.planId] || "?",
          inicio: s.inicio,
          lastChargedAt: s.charged,
          cycle,
        });
      }
    }
    all.sort((a, b) => a.cycle.daysLeft - b.cycle.daysLeft);
    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markCharged(it: Item) {
    setBusy(`${it.user.id}:${it.slot}`);
    const col = `${it.slot}_last_charged_at`;
    await supabase
      .from("profiles")
      .update({ [col]: new Date().toISOString() } as any)
      .eq("id", it.user.id);
    await load();
    setBusy(null);
  }
  async function renewCycle(it: Item) {
    if (
      !confirm(
        `Renovar ciclo de ${it.label} (${it.user.nome || it.user.email})? Isso atualiza apenas a data de início — contadores não são alterados.`,
      )
    )
      return;
    setBusy(`${it.user.id}:${it.slot}`);
    const col = `${it.slot}_inicio`;
    await supabase
      .from("profiles")
      .update({ [col]: new Date().toISOString() } as any)
      .eq("id", it.user.id);
    await load();
    setBusy(null);
  }

  if (loading) return <p>Carregando cobranças…</p>;

  return (
    <div>
      <div style={{ marginBottom: 12, color: "#64748b", fontSize: 13 }}>
        {items.length === 0
          ? "Nenhum slot vencendo ou vencido no momento."
          : `${items.length} slot(s) vencendo ou vencidos.`}
      </div>
      {items.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Cliente</Th>
                <Th>Slot</Th>
                <Th>Plano</Th>
                <Th>Início</Th>
                <Th>Vencimento</Th>
                <Th>Status</Th>
                <Th>Última cobrança</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const c = cycleColor(it.cycle);
                const busyKey = `${it.user.id}:${it.slot}`;
                return (
                  <tr
                    key={busyKey}
                    style={{ borderTop: "1px solid #e2e8f0", opacity: busy === busyKey ? 0.5 : 1 }}
                  >
                    <Td>
                      <div style={{ fontWeight: 600 }}>{it.user.nome || "—"}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{it.user.email}</div>
                      {it.user.client_code && (
                        <div
                          style={{
                            color: "#94a3b8",
                            fontSize: 11,
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          {it.user.client_code}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <strong>{it.label}</strong>
                    </Td>
                    <Td>{it.planCodigo}</Td>
                    <Td>{new Date(it.inicio).toLocaleDateString("pt-BR")}</Td>
                    <Td>{it.cycle.dueAt?.toLocaleDateString("pt-BR") || "—"}</Td>
                    <Td>
                      {c && (
                        <span
                          style={{
                            background: c.bg,
                            color: c.fg,
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {cycleLabel(it.cycle)}
                        </span>
                      )}
                    </Td>
                    <Td style={{ fontSize: 12, color: "#64748b" }}>
                      {it.lastChargedAt
                        ? new Date(it.lastChargedAt).toLocaleDateString("pt-BR")
                        : "—"}
                    </Td>
                    <Td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button onClick={() => markCharged(it)} style={actionBtn}>
                          Marcar cobrado
                        </button>
                        <button onClick={() => renewCycle(it)} style={actionBtn}>
                          Renovar ciclo
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Th = ({ children }: any) => (
  <th
    style={{
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 12,
      color: "#475569",
      fontWeight: 600,
    }}
  >
    {children}
  </th>
);
const Td = ({ children, style }: any) => (
  <td style={{ padding: "8px 10px", verticalAlign: "middle", ...style }}>{children}</td>
);
const actionBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #cbd5e1",
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
};
