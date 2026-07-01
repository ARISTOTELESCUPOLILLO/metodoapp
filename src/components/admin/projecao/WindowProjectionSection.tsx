// Seção "Gastos previstos por vencimento" da aba Projeção — extraído de ProjecaoTab.tsx (Fase 9).
import { BUCKETS, BUCKET_LABEL, type Bucket, type BucketTotals } from "./types";
import { SectionTitle, Th, Td, ProjCell, usd } from "./primitives";

export function WindowProjectionSection({
  agg,
  totalFal,
  totalOai,
  totalRev,
  totalSlots,
  usdBrlRate,
  isMobile,
  onRefresh,
}: {
  agg: Record<Bucket, BucketTotals>;
  totalFal: number;
  totalOai: number;
  totalRev: number;
  totalSlots: number;
  usdBrlRate: number;
  isMobile: boolean;
  onRefresh: () => void;
}) {
  const brl = (v: number) => `R$ ${v.toFixed(2)}`;
  const totalCustoBrl = (totalFal + totalOai) * usdBrlRate;
  const totalLucro = totalRev - totalCustoBrl;
  const totalLucroColor = totalLucro >= 0 ? "#15803d" : "#dc2626";

  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <SectionTitle style={{ margin: 0 }}>
          Gastos previstos — por vencimento de plano
        </SectionTitle>
        <button
          onClick={onRefresh}
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
      {isMobile ? (
        <div style={{ display: "grid", gap: 10 }}>
          {BUCKETS.map((b) => {
            const t = agg[b];
            if (t.slots === 0) return null;
            const tot = t.fal + t.openai;
            const custoBrl = tot * usdBrlRate;
            const lucro = t.revenue - custoBrl;
            return (
              <div
                key={b}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                  {BUCKET_LABEL[b]}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <ProjCell label="fal.ai" value={usd(t.fal)} color="#6d28d9" />
                  <ProjCell label="OpenAI" value={usd(t.openai)} color="#0369a1" />
                  <ProjCell label="Custo R$" value={brl(custoBrl)} />
                  <ProjCell
                    label="Receita R$"
                    value={t.revenue > 0 ? brl(t.revenue) : "—"}
                    color="#15803d"
                  />
                  <ProjCell
                    label="Lucro R$"
                    value={t.revenue > 0 ? brl(lucro) : "—"}
                    color={lucro >= 0 ? "#15803d" : "#dc2626"}
                  />
                  <ProjCell label="Planos" value={String(t.slots)} />
                </div>
              </div>
            );
          })}
          <div
            style={{
              background: "#f8fafc",
              border: "2px solid #e2e8f0",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: "var(--brand-primary)",
                marginBottom: 10,
              }}
            >
              TOTAL PREVISTO
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <ProjCell label="fal.ai" value={usd(totalFal)} color="#6d28d9" />
              <ProjCell label="OpenAI" value={usd(totalOai)} color="#0369a1" />
              <ProjCell label="Custo R$" value={brl(totalCustoBrl)} />
              <ProjCell
                label="Receita R$"
                value={totalRev > 0 ? brl(totalRev) : "—"}
                color="#15803d"
              />
              <ProjCell
                label="Lucro R$"
                value={totalRev > 0 ? brl(totalLucro) : "—"}
                color={totalLucroColor}
              />
              <ProjCell label="Planos" value={String(totalSlots)} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Janela de vencimento</Th>
                <Th style={{ color: "#6d28d9" }}>fal.ai (imgs + renders)</Th>
                <Th style={{ color: "#0369a1" }}>OpenAI (conteúdo)</Th>
                <Th>Custo USD</Th>
                <Th>Custo R$</Th>
                <Th style={{ color: "#15803d" }}>Receita R$</Th>
                <Th style={{ color: "var(--brand-primary)" }}>Lucro R$</Th>
                <Th style={{ fontSize: 11, color: "#94a3b8" }}>Planos</Th>
              </tr>
            </thead>
            <tbody>
              {BUCKETS.map((b) => {
                const t = agg[b];
                const tot = t.fal + t.openai;
                const custoBrl = tot * usdBrlRate;
                const lucro = t.revenue - custoBrl;
                if (t.slots === 0) return null;
                return (
                  <tr key={b} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <Td style={{ fontWeight: 600 }}>{BUCKET_LABEL[b]}</Td>
                    <Td style={{ color: "#6d28d9", fontWeight: 600 }}>{usd(t.fal)}</Td>
                    <Td style={{ color: "#0369a1", fontWeight: 600 }}>{usd(t.openai)}</Td>
                    <Td style={{ fontWeight: 700 }}>{usd(tot)}</Td>
                    <Td style={{ color: "#64748b" }}>{brl(custoBrl)}</Td>
                    <Td style={{ color: "#15803d", fontWeight: 600 }}>
                      {t.revenue > 0 ? brl(t.revenue) : "—"}
                    </Td>
                    <Td style={{ fontWeight: 700, color: lucro >= 0 ? "#15803d" : "#dc2626" }}>
                      {t.revenue > 0 ? brl(lucro) : "—"}
                    </Td>
                    <Td style={{ color: "#94a3b8", fontSize: 11 }}>{t.slots}</Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
              <tr>
                <Td style={{ fontWeight: 700, color: "var(--brand-primary)" }}>TOTAL PREVISTO</Td>
                <Td style={{ fontWeight: 700, color: "#6d28d9" }}>{usd(totalFal)}</Td>
                <Td style={{ fontWeight: 700, color: "#0369a1" }}>{usd(totalOai)}</Td>
                <Td style={{ fontWeight: 700 }}>{usd(totalFal + totalOai)}</Td>
                <Td style={{ fontWeight: 600, color: "#64748b" }}>{brl(totalCustoBrl)}</Td>
                <Td style={{ fontWeight: 700, color: "#15803d" }}>
                  {totalRev > 0 ? brl(totalRev) : "—"}
                </Td>
                <Td style={{ fontWeight: 700, color: totalLucroColor }}>
                  {totalRev > 0 ? brl(totalLucro) : "—"}
                </Td>
                <Td style={{ color: "#94a3b8", fontSize: 11 }}>{totalSlots}</Td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
