// "Planos ativos — consumo, custo e preços" — extraído de CustosTab.tsx (Fase 9).
import { Section, Td, Th, tbl, tblWrap, tRow } from "./primitives";
import type { PlanRow } from "./types";

const margemColor = (m: number | null) =>
  m === null ? "#94a3b8" : m >= 50 ? "#16a34a" : m >= 0 ? "#d97706" : "#dc2626";

export function PlansSection({
  planRows,
  prevTotalFalai,
  prevTotalOpenai,
  prevTotalExtras,
  mesesFalai,
  mesesOpenai,
  editMax,
  savingMax,
  onEditMaxChange,
  onSaveMax,
  brl,
}: {
  planRows: PlanRow[];
  prevTotalFalai: number;
  prevTotalOpenai: number;
  prevTotalExtras: number;
  mesesFalai: string;
  mesesOpenai: string;
  editMax: Record<string, string>;
  savingMax: string | null;
  onEditMaxChange: (planId: string, val: string) => void;
  onSaveMax: (planId: string) => void;
  brl: (usd: number) => string;
}) {
  return (
    <Section title="Planos ativos — consumo, custo e preços">
      <div style={tblWrap}>
        <table style={tbl}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <Th>Plano</Th>
              <Th>Clientes</Th>
              <Th>Imgs</Th>
              <Th>Vídeos</Th>
              <Th>Conteúdos</Th>
              <Th>Gerar outro</Th>
              <Th>Sugestões</Th>
              <Th>Primeira Ger.</Th>
              <Th>fal.ai R$</Th>
              <Th>OpenAI R$</Th>
              <Th>Texto R$</Th>
              <Th>Custo real R$</Th>
              <Th>Custo proj. R$</Th>
              <Th>
                Preço mín. R$ <span style={{ fontWeight: 400, fontSize: 10 }}>(custo×3)</span>
              </Th>
              <Th>
                Preço méd. real{" "}
                <span style={{ fontWeight: 400, fontSize: 10 }}>(média cobrada)</span>
              </Th>
              <Th>Preço máx. R$</Th>
              <Th>Marg. mín.</Th>
              <Th>Marg. máx.</Th>
            </tr>
          </thead>
          <tbody>
            {planRows.map((r) => (
              <tr key={r.planId} style={tRow}>
                <Td>
                  <b>{r.codigo}</b> <span style={{ color: "#94a3b8", fontSize: 11 }}>{r.nome}</span>
                </Td>
                <Td>{r.totalClientes}</Td>
                <Td>{r.imgs}</Td>
                <Td>{r.renders}</Td>
                <Td>{r.geracoes}</Td>
                <Td>{r.regenTextoTotal}</Td>
                <Td>{r.sugestoesTotal}</Td>
                <Td>{r.primeiraGeracaoTotal}</Td>
                <Td>{brl(r.custoFalaiPrev)}</Td>
                <Td>{brl(r.custoOpenaiPrev)}</Td>
                <Td>{brl(r.custoExtrasPrev)}</Td>
                <Td>{brl(r.custoRealUsd)}</Td>
                <Td style={{ color: "#64748b" }}>{brl(r.projecaoUsd)}</Td>
                <Td style={{ color: "#15803d", fontWeight: 600 }}>R$ {r.precoMin.toFixed(2)}</Td>
                <Td style={{ color: "#0f172a" }}>
                  {r.precoMed !== null ? (
                    `R$ ${r.precoMed.toFixed(2)}`
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </Td>
                <Td>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editMax[r.planId] ?? (r.precoMax ? String(r.precoMax) : "")}
                    onChange={(e) => onEditMaxChange(r.planId, e.target.value)}
                    onBlur={() => editMax[r.planId] !== undefined && onSaveMax(r.planId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSaveMax(r.planId);
                    }}
                    disabled={savingMax === r.planId}
                    style={{
                      width: 70,
                      padding: "2px 4px",
                      fontSize: 12,
                      fontWeight: 600,
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                    }}
                  />
                </Td>
                <Td>
                  <span style={{ color: margemColor(r.margemMin), fontWeight: 700 }}>
                    {r.margemMin !== null ? `${r.margemMin.toFixed(0)}%` : "—"}
                  </span>
                </Td>
                <Td>
                  <span style={{ color: margemColor(r.margemMax), fontWeight: 700 }}>
                    {r.margemMax !== null ? `${r.margemMax.toFixed(0)}%` : "—"}
                  </span>
                </Td>
              </tr>
            ))}
            <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
              <Td>TOTAL</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>{brl(prevTotalFalai)}</Td>
              <Td>{brl(prevTotalOpenai)}</Td>
              <Td>{brl(prevTotalExtras)}</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>—</Td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
        Preço mín. = custo projetado R$ × 3 (automático). Preço méd. = média dos preços cobrados nos
        perfis dos clientes (automático). Preço máx. é editável aqui — clique e digite. Margem
        calculada sobre projeção de 100% de uso. Saldo cobre aprox. <b>{mesesFalai} ciclos</b>{" "}
        fal.ai · <b>{mesesOpenai} ciclos</b> OpenAI.
      </p>
    </Section>
  );
}
