// Lista de planos (mobile + desktop) da aba Planos — extraído de PlansTab.tsx (Fase 9).
import { Th, Td, btn, mCard, Row } from "./primitives";
import { calcCusto, type Costs, type Plan } from "./types";

export function PlansList({
  isMobile,
  plans,
  costs,
  usdRate,
  onEdit,
  onRemove,
}: {
  isMobile: boolean;
  plans: Plan[];
  costs: Costs;
  usdRate: number;
  onEdit: (p: Plan) => void;
  onRemove: (p: Plan) => void;
}) {
  if (isMobile) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {plans.map((p) => (
          <div key={p.id} style={mCard}>
            <div
              style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}
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
            <Row k="Gerar outro" v={String(p.limite_regen_texto ?? 0)} />
            <Row k="Sugestões" v={String(p.limite_sugestoes ?? 0)} />
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={() => onEdit(p)} style={{ ...btn, flex: 1 }}>
                Editar
              </button>
              <button onClick={() => onRemove(p)} style={{ ...btn, flex: 1, color: "#b91c1c" }}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
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
            <Th title='Limite do botão "Gerar outro" de bloco'>Gerar outro</Th>
            <Th title='Limite do botão "Sugestão"'>Sugestões</Th>
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
                <Td>{p.limite_regen_texto ?? 0}</Td>
                <Td>{p.limite_sugestoes ?? 0}</Td>
                <Td>{p.ativo ? "sim" : "não"}</Td>
                <Td>
                  <button onClick={() => onEdit(p)} style={btn}>
                    Editar
                  </button>{" "}
                  <button onClick={() => onRemove(p)} style={{ ...btn, color: "#b91c1c" }}>
                    Excluir
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
