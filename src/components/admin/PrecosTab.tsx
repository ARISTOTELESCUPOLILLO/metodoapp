import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface Plan {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  preco_maximo_brl: number;
}

interface Settings {
  usd_brl_rate: number;
  image_price_usd: number;
  render_price_usd: number;
  geracao_price_usd: number;
}

const USO_NORMAL: Record<string, { imgs: number; renders: number }> = {
  EX01: { imgs: 7, renders: 0 },
  PU2: { imgs: 2, renders: 0 },
  PU4: { imgs: 4, renders: 0 },
  PU8: { imgs: 8, renders: 0 },
  S3V: { imgs: 28, renders: 0 },
  S3C: { imgs: 32, renders: 4 },
  S6V: { imgs: 56, renders: 0 },
  S6C: { imgs: 64, renders: 8 },
  S9V: { imgs: 42, renders: 0 },
  S9C: { imgs: 48, renders: 6 },
};

function capacidade(codigo: string, imgs: number, renders: number, geracoes: number): string {
  let seqs = "";
  if (codigo.startsWith("S3")) seqs = `${Math.floor(imgs / 7)} seq. de 3 posts`;
  else if (codigo.startsWith("S6")) seqs = `${Math.floor(imgs / 14)} seq. de 6 posts`;
  else if (codigo.startsWith("S9")) seqs = `${Math.floor(imgs / 21)} seq. de 9 posts`;
  else seqs = `${imgs} imagem${imgs !== 1 ? "s" : ""}`;
  const parts = [seqs];
  if (renders > 0) parts.push(`${renders} renders`);
  if (geracoes > 0) parts.push(`${geracoes} conteúdos`);
  return parts.join(" · ");
}

function calcCusto(plan: Plan, s: Settings) {
  return (
    plan.limite_imagens * s.image_price_usd +
    plan.limite_renders * s.render_price_usd +
    plan.limite_geracoes * s.geracao_price_usd
  );
}

export function PrecosTab() {
  const isMobile = useIsMobile();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [settings, setSettings] = useState<Settings>({
    usd_brl_rate: 5.8,
    image_price_usd: 0.058,
    render_price_usd: 1.6,
    geracao_price_usd: 0.013,
  });
  const [editMax, setEditMax] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase
        .from("plans")
        .select(
          "id,codigo,nome,tipo,ativo,limite_imagens,limite_renders,limite_geracoes,preco_maximo_brl",
        )
        .order("codigo"),
      supabase
        .from("app_settings")
        .select("usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd")
        .eq("id", true)
        .maybeSingle(),
    ]);
    setPlans((p as Plan[]) || []);
    if (s)
      setSettings({
        usd_brl_rate: Number(s.usd_brl_rate ?? 5.8),
        image_price_usd: Number(s.image_price_usd ?? 0.058),
        render_price_usd: Number(s.render_price_usd ?? 1.6),
        geracao_price_usd: Number(s.geracao_price_usd ?? 0.013),
      });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveMax(plan: Plan) {
    const val = parseFloat(editMax[plan.id] ?? "");
    if (isNaN(val)) return;
    setSaving(plan.id);
    await supabase.from("plans").update({ preco_maximo_brl: val }).eq("id", plan.id);
    setSaving(null);
    setEditMax((m) => {
      const n = { ...m };
      delete n[plan.id];
      return n;
    });
    await load();
  }

  if (loading) return <p style={{ color: "#64748b" }}>Carregando…</p>;

  const usd = (v: number) => `US$ ${v.toFixed(3)}`;
  const brl = (v: number) => `R$ ${v.toFixed(2)}`;
  const mult = (price: number, cost: number) =>
    cost > 0 ? `${(price / cost).toFixed(1)}× custo` : "—";

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Tabela de Preços</h2>
        <button
          onClick={load}
          style={{
            fontSize: 12,
            background: "none",
            border: "1px solid #cbd5e1",
            padding: "4px 10px",
            borderRadius: 4,
            cursor: "pointer",
            color: "#475569",
          }}
        >
          ↻ Atualizar
        </button>
      </div>

      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "10px 14px",
          lineHeight: 1.7,
        }}
      >
        <strong>Custos unitários:</strong> imagem ref US$ {settings.image_price_usd.toFixed(4)} ·
        render US$ {settings.render_price_usd.toFixed(2)} · conteúdo US${" "}
        {settings.geracao_price_usd.toFixed(4)} · câmbio R$ {settings.usd_brl_rate.toFixed(2)}/US$
        <br />
        <span style={{ color: "#94a3b8" }}>
          Altere em <strong>Ajustes de custo</strong> — esta tabela recalcula automaticamente.
        </span>
      </div>

      {isMobile ? (
        <div style={{ display: "grid", gap: 12 }}>
          {plans.map((p) => {
            const custoUsd = calcCusto(p, settings);
            const custoBrl = custoUsd * settings.usd_brl_rate;
            const minBrl = custoBrl * 3;
            const maxBrl = p.preco_maximo_brl || 0;
            const isEditing = editMax[p.id] !== undefined;
            const uso = USO_NORMAL[p.codigo];
            return (
              <div
                key={p.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 14,
                  opacity: p.ativo ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 14,
                      }}
                    >
                      {p.codigo}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        background: "#f1f5f9",
                        padding: "2px 6px",
                        borderRadius: 4,
                        color: "#475569",
                      }}
                    >
                      {p.tipo}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: p.ativo ? "#15803d" : "#94a3b8",
                    }}
                  >
                    {p.ativo ? "ativo" : "inativo"}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 3 }}>
                  {p.nome}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: uso ? 2 : 10 }}>
                  {capacidade(p.codigo, p.limite_imagens, p.limite_renders, p.limite_geracoes)}
                </div>
                {uso && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
                    Uso normal: {uso.imgs} imgs{uso.renders > 0 ? ` · ${uso.renders} renders` : ""}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <PCell label="Custo USD" value={usd(custoUsd)} color="#b45309" />
                  <PCell label="Custo R$" value={brl(custoBrl)} color="#0369a1" />
                  <PCell label="Preço mín (×3)" value={brl(minBrl)} color="#15803d" />
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px" }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Preço máx
                    </div>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editMax[p.id]}
                          autoFocus
                          onChange={(e) => setEditMax((m) => ({ ...m, [p.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveMax(p);
                            if (e.key === "Escape")
                              setEditMax((m) => {
                                const n = { ...m };
                                delete n[p.id];
                                return n;
                              });
                          }}
                          style={{
                            width: 72,
                            padding: "3px 5px",
                            fontSize: 12,
                            border: "1px solid #0f213f",
                            borderRadius: 4,
                          }}
                        />
                        <button
                          onClick={() => saveMax(p)}
                          disabled={saving === p.id}
                          style={{
                            background: "#0f213f",
                            color: "#fff",
                            border: "none",
                            padding: "3px 7px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {saving === p.id ? "…" : "✓"}
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => setEditMax((m) => ({ ...m, [p.id]: String(maxBrl || "") }))}
                        style={{
                          cursor: "pointer",
                          fontWeight: maxBrl > 0 ? 700 : 400,
                          color: maxBrl > 0 ? "#7c3aed" : "#94a3b8",
                          fontSize: 13,
                        }}
                      >
                        {maxBrl > 0 ? brl(maxBrl) : "— definir"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Código</Th>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Capacidade de produção</Th>
                <Th title="Imagens e renders por mês — uso normal liberado (PDF col. 2)">
                  Uso Normal
                </Th>
                <Th title="Custo de API para produzir o plano completo">Custo USD</Th>
                <Th>Custo R$</Th>
                <Th title="Custo × câmbio × 3 — ponto de entrada mínimo">Preço mín R$ (×3)</Th>
                <Th title="Clique para editar">Preço máx R$</Th>
                <Th>Margem mín</Th>
                <Th>Ativo</Th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const custoUsd = calcCusto(p, settings);
                const custoBrl = custoUsd * settings.usd_brl_rate;
                const minBrl = custoBrl * 3;
                const maxBrl = p.preco_maximo_brl || 0;
                const isEditing = editMax[p.id] !== undefined;
                return (
                  <tr
                    key={p.id}
                    style={{ borderTop: "1px solid #e2e8f0", opacity: p.ativo ? 1 : 0.5 }}
                  >
                    <Td>
                      <span
                        style={{
                          fontWeight: 700,
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 12,
                        }}
                      >
                        {p.codigo}
                      </span>
                    </Td>
                    <Td>{p.nome}</Td>
                    <Td>
                      <span
                        style={{
                          fontSize: 11,
                          background: "#f1f5f9",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {p.tipo}
                      </span>
                    </Td>
                    <Td style={{ color: "#475569", fontSize: 12 }}>
                      {capacidade(p.codigo, p.limite_imagens, p.limite_renders, p.limite_geracoes)}
                    </Td>
                    <Td style={{ color: "#475569", fontSize: 12 }}>
                      {(() => {
                        const u = USO_NORMAL[p.codigo];
                        if (!u) return "—";
                        return u.renders > 0
                          ? `${u.imgs} imgs · ${u.renders} renders`
                          : `${u.imgs} imgs`;
                      })()}
                    </Td>
                    <Td style={{ color: "#b45309", fontWeight: 600 }}>{usd(custoUsd)}</Td>
                    <Td style={{ color: "#0369a1" }}>{brl(custoBrl)}</Td>
                    <Td style={{ color: "#15803d", fontWeight: 700 }}>{brl(minBrl)}</Td>
                    <Td>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={editMax[p.id]}
                            onChange={(e) => setEditMax((m) => ({ ...m, [p.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveMax(p);
                              if (e.key === "Escape")
                                setEditMax((m) => {
                                  const n = { ...m };
                                  delete n[p.id];
                                  return n;
                                });
                            }}
                            autoFocus
                            style={{
                              width: 80,
                              padding: "2px 6px",
                              fontSize: 12,
                              border: "1px solid #0f213f",
                              borderRadius: 4,
                            }}
                          />
                          <button
                            onClick={() => saveMax(p)}
                            disabled={saving === p.id}
                            style={{
                              background: "#0f213f",
                              color: "#fff",
                              border: "none",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {saving === p.id ? "…" : "✓"}
                          </button>
                          <button
                            onClick={() =>
                              setEditMax((m) => {
                                const n = { ...m };
                                delete n[p.id];
                                return n;
                              })
                            }
                            style={{
                              background: "none",
                              border: "1px solid #cbd5e1",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() =>
                            setEditMax((m) => ({ ...m, [p.id]: String(maxBrl || "") }))
                          }
                          title="Clique para editar"
                          style={{
                            cursor: "pointer",
                            fontWeight: maxBrl > 0 ? 700 : 400,
                            color: maxBrl > 0 ? "#7c3aed" : "#94a3b8",
                            borderBottom: "1px dashed #cbd5e1",
                          }}
                        >
                          {maxBrl > 0 ? brl(maxBrl) : "— definir"}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: "#15803d", fontWeight: 600 }}>
                          {mult(minBrl, custoBrl)}
                        </span>
                        {maxBrl > 0 && (
                          <span style={{ color: "#7c3aed", fontSize: 11, marginLeft: 6 }}>
                            até {mult(maxBrl, custoBrl)}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: p.ativo ? "#15803d" : "#94a3b8",
                        }}
                      >
                        {p.ativo ? "sim" : "não"}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 12, color: "#64748b" }}>
        Clique no valor de <strong>Preço máx</strong> para editar diretamente na tabela. O preço
        mínimo é calculado automaticamente como <strong>3× o custo de API</strong>.
      </div>
    </div>
  );
}

const Th = ({
  children,
  title,
  style,
}: {
  children: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
}) => (
  <th
    title={title}
    style={{
      padding: "8px 10px",
      textAlign: "left",
      fontSize: 12,
      color: "#475569",
      fontWeight: 600,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </th>
);
const Td = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <td style={{ padding: "8px 10px", verticalAlign: "middle", ...style }}>{children}</td>
);
function PCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px" }}>
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color ?? "#111827" }}>{value}</div>
    </div>
  );
}
