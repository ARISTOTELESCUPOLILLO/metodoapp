import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface Plan {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  limite_imgs_display: number | null;
  limite_renders_display: number | null;
  limite_geracoes_display: number | null;
  preco_maximo_brl: number;
  ativo: boolean;
  base_estatico: number;
  base_carrossel: number;
  base_estatico_final: number;
  base_reels: number;
}

interface Costs {
  imageRef: number;
  video: number;
  content: number;
}

const empty: Omit<Plan, "id"> = {
  codigo: "",
  nome: "",
  tipo: "mensal",
  limite_imagens: 0,
  limite_renders: 0,
  limite_geracoes: 0,
  limite_imgs_display: null,
  limite_renders_display: null,
  limite_geracoes_display: null,
  preco_maximo_brl: 0,
  ativo: true,
  base_estatico: 0,
  base_carrossel: 0,
  base_estatico_final: 0,
  base_reels: 0,
};

function calcCusto(
  p: Pick<Plan, "limite_imagens" | "limite_renders" | "limite_geracoes">,
  costs: Costs,
) {
  return (
    p.limite_imagens * costs.imageRef +
    p.limite_renders * costs.video +
    p.limite_geracoes * costs.content
  );
}

export function PlansTab() {
  const isMobile = useIsMobile();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usdRate, setUsdRate] = useState(5.8);
  const [costs, setCosts] = useState<Costs>({ imageRef: 0.058, video: 1.6, content: 0.013 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Plan | (Omit<Plan, "id"> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("plans").select("*").order("nome"),
      supabase
        .from("app_settings")
        .select("usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd")
        .eq("id", true)
        .maybeSingle(),
    ]);
    setPlans((p as Plan[]) || []);
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

  async function save() {
    if (!editing) return;
    setSaving(true);
    setMsg(null);
    const payload = {
      codigo: editing.codigo,
      nome: editing.nome,
      tipo: editing.tipo,
      limite_imagens: Number(editing.limite_imagens),
      limite_renders: Number(editing.limite_renders),
      limite_geracoes: Number(editing.limite_geracoes),
      limite_imgs_display:
        editing.limite_imgs_display !== null ? Number(editing.limite_imgs_display) : null,
      limite_renders_display:
        editing.limite_renders_display !== null ? Number(editing.limite_renders_display) : null,
      limite_geracoes_display: null,
      preco_maximo_brl: Number(editing.preco_maximo_brl || 0),
      ativo: editing.ativo,
      base_estatico: Number(editing.base_estatico || 0),
      base_carrossel: Number(editing.base_carrossel || 0),
      base_estatico_final: Number(editing.base_estatico_final || 0),
      base_reels: Number(editing.base_reels || 0),
    };
    const { error } = editing.id
      ? await supabase.from("plans").update(payload).eq("id", editing.id)
      : await supabase.from("plans").insert(payload);
    setSaving(false);
    if (error) {
      setMsg(`Erro: ${error.message}`);
      return;
    }
    setEditing(null);
    await load();
  }

  async function remove(p: Plan) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plano_id", p.id);
    if (count && count > 0) {
      alert(`Não é possível excluir: ${count} usuário(s) usando este plano.`);
      return;
    }
    if (!confirm(`Excluir plano "${p.nome}"?`)) return;
    await supabase.from("plans").delete().eq("id", p.id);
    await load();
  }

  if (loading) return <p>Carregando planos…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Planos</h2>
        <button
          onClick={() => setEditing({ ...empty })}
          style={{
            background: "var(--brand-primary)",
            color: "#fff",
            border: "none",
            padding: "8px 14px",
            borderRadius: 6,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          + Novo plano
        </button>
      </div>

      {isMobile ? (
        <div style={{ display: "grid", gap: 10 }}>
          {plans.map((p) => (
            <div key={p.id} style={mCard}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.nome}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{p.codigo}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: p.ativo ? "#dcfce7" : "#fee2e2",
                    color: p.ativo ? "#166534" : "#991b1b",
                    height: "fit-content",
                  }}
                >
                  {p.ativo ? "ativo" : "inativo"}
                </span>
              </div>
              <Row k="Tipo" v={p.tipo} />
              <Row k="Imagens" v={String(p.limite_imagens)} />
              <Row k="Renders" v={String(p.limite_renders)} />
              <Row k="Gerações" v={String(p.limite_geracoes)} />
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => setEditing(p)} style={{ ...btn, flex: 1 }}>
                  Editar
                </button>
                <button onClick={() => remove(p)} style={{ ...btn, flex: 1, color: "#b91c1c" }}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Código</Th>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th title="imgs × ref + renders × vídeo + conteúdos × text">Custo calc. USD</Th>
                <Th>Custo R$</Th>
                <Th>Preço mín. R$ (×3)</Th>
                <Th>Preço máx. R$</Th>
                <Th>Imgs</Th>
                <Th>Renders</Th>
                <Th>Gerações</Th>
                <Th>Ativo</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const custoUsd = calcCusto(p, costs);
                const custoBrl = custoUsd * usdRate;
                const precoMin = custoBrl * 3;
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <Td>{p.codigo}</Td>
                    <Td>{p.nome}</Td>
                    <Td>{p.tipo}</Td>
                    <Td style={{ color: "#b45309", fontWeight: 600 }}>US$ {custoUsd.toFixed(3)}</Td>
                    <Td style={{ color: "#0369a1", fontWeight: 600 }}>R$ {custoBrl.toFixed(2)}</Td>
                    <Td style={{ color: "#15803d", fontWeight: 600 }}>R$ {precoMin.toFixed(2)}</Td>
                    <Td style={{ color: "#0f172a", fontWeight: 600 }}>
                      {p.preco_maximo_brl ? (
                        `R$ ${Number(p.preco_maximo_brl).toFixed(2)}`
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </Td>
                    <Td>{p.limite_imagens}</Td>
                    <Td>{p.limite_renders}</Td>
                    <Td>{p.limite_geracoes}</Td>
                    <Td>{p.ativo ? "sim" : "não"}</Td>
                    <Td>
                      <button onClick={() => setEditing(p)} style={btn}>
                        Editar
                      </button>{" "}
                      <button onClick={() => remove(p)} style={{ ...btn, color: "#b91c1c" }}>
                        Excluir
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div style={overlay} onClick={() => setEditing(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              {editing.id ? "Editar plano" : "Novo plano"}
            </h3>
            <div style={{ display: "grid", gap: 10 }}>
              <Inp
                label="Código"
                value={editing.codigo}
                onChange={(v) => setEditing({ ...editing, codigo: v })}
              />
              <Inp
                label="Nome"
                value={editing.nome}
                onChange={(v) => setEditing({ ...editing, nome: v })}
              />
              <label style={{ display: "grid", gap: 4 }}>
                <span style={lbl}>Tipo</span>
                <select
                  value={editing.tipo}
                  onChange={(e) => setEditing({ ...editing, tipo: e.target.value })}
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
                onChange={(v) => setEditing({ ...editing, limite_imagens: Number(v) })}
              />
              <Inp
                label="Limite renders (real / estendido)"
                type="number"
                value={String(editing.limite_renders)}
                onChange={(v) => setEditing({ ...editing, limite_renders: Number(v) })}
              />
              <Inp
                label="Limite gerações (real / estendido)"
                type="number"
                value={String(editing.limite_geracoes)}
                onChange={(v) => setEditing({ ...editing, limite_geracoes: Number(v) })}
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
                        setEditing({
                          ...editing,
                          limite_imgs_display:
                            e.target.value === "" ? null : Number(e.target.value),
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
                        setEditing({
                          ...editing,
                          limite_renders_display:
                            e.target.value === "" ? null : Number(e.target.value),
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
                onChange={(v) => setEditing({ ...editing, preco_maximo_brl: Number(v) })}
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
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-primary)", marginBottom: 6 }}>
                  ★ Personalizados base por tipo
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
                  Quantidade que vem "de fábrica" neste plano. Soma com os outros planos do usuário
                  + extras dele.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Inp
                    label="Estático"
                    type="number"
                    value={String(editing.base_estatico ?? 0)}
                    onChange={(v) => setEditing({ ...editing, base_estatico: Number(v) })}
                  />
                  <Inp
                    label="Carrossel"
                    type="number"
                    value={String(editing.base_carrossel ?? 0)}
                    onChange={(v) => setEditing({ ...editing, base_carrossel: Number(v) })}
                  />
                  <Inp
                    label="Estático final"
                    type="number"
                    value={String(editing.base_estatico_final ?? 0)}
                    onChange={(v) => setEditing({ ...editing, base_estatico_final: Number(v) })}
                  />
                  <Inp
                    label="Reels"
                    type="number"
                    value={String(editing.base_reels ?? 0)}
                    onChange={(v) => setEditing({ ...editing, base_reels: Number(v) })}
                  />
                </div>
              </div>

              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={editing.ativo}
                  onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })}
                />
                Ativo
              </label>
              {msg && <p style={{ fontSize: 13, color: "#b91c1c" }}>{msg}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => setEditing(null)} style={btn}>
                  Cancelar
                </button>
                <button
                  onClick={save}
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
      )}
    </div>
  );
}

// title/style são aceitos nas chamadas mas a renderização permanece igual à
// versão anterior (que tipava as props como `any` e descartava esses campos) —
// preserva o comportamento, só remove o `any`.
const Th = ({ children }: { children: React.ReactNode; title?: string }) => (
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
const Td = ({ children }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{ padding: "8px 10px" }}>{children}</td>
);
const btn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #cbd5e1",
  padding: "4px 10px",
  borderRadius: 4,
  fontSize: 12,
  cursor: "pointer",
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
  maxWidth: 420,
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
const Inp = ({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) => (
  <label style={{ display: "grid", gap: 4 }}>
    <span style={lbl}>{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inp} />
  </label>
);

const mCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
};
const Row = ({ k, v }: { k: string; v: string }) => (
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
