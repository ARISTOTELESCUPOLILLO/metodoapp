// Seção "Compras necessárias" da aba Projeção — extraído de ProjecaoTab.tsx (Fase 9).
import { SectionTitle, Th, Td, ProjCell, usd, SupplierLink } from "./primitives";

export function PurchaseSection({
  buy30fal,
  buy60fal,
  buy90fal,
  buy30oai,
  buy60oai,
  buy90oai,
  usdBrlRate,
  isMobile,
}: {
  buy30fal: number;
  buy60fal: number;
  buy90fal: number;
  buy30oai: number;
  buy60oai: number;
  buy90oai: number;
  usdBrlRate: number;
  isMobile: boolean;
}) {
  const windows = [
    { label: "Próximos 30 dias", fal: buy30fal, oai: buy30oai },
    { label: "Próximos 60 dias", fal: buy60fal, oai: buy60oai },
    { label: "Próximos 90 dias", fal: buy90fal, oai: buy90oai },
  ];

  return (
    <section>
      <SectionTitle>Compras necessárias (previsto − saldo atual)</SectionTitle>
      {isMobile ? (
        <div style={{ display: "grid", gap: 10 }}>
          {windows.map(({ label, fal, oai }) => {
            const tot = fal + oai;
            const ok = tot === 0;
            return (
              <div
                key={label}
                style={{
                  background: ok ? "#f0fdf4" : "#fff",
                  border: `1px solid ${ok ? "#bbf7d0" : "#e2e8f0"}`,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: ok ? 6 : 10,
                    color: ok ? "#15803d" : "var(--brand-primary)",
                  }}
                >
                  {label}
                </div>
                {ok ? (
                  <div style={{ color: "#15803d", fontWeight: 700, fontSize: 13 }}>
                    ✓ coberto pelo saldo atual
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <ProjCell
                      label="fal.ai"
                      value={fal === 0 ? "✓ coberto" : usd(fal)}
                      color={fal === 0 ? "#15803d" : "#dc2626"}
                    />
                    <ProjCell
                      label="OpenAI"
                      value={oai === 0 ? "✓ coberto" : usd(oai)}
                      color={oai === 0 ? "#15803d" : "#dc2626"}
                    />
                    <ProjCell label="Total USD" value={usd(tot)} color="#dc2626" />
                    <ProjCell label="Total R$" value={`R$ ${(tot * usdBrlRate).toFixed(2)}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <Th>Horizonte de cobertura</Th>
                <Th style={{ color: "#6d28d9" }}>fal.ai a comprar</Th>
                <Th style={{ color: "#0369a1" }}>OpenAI a comprar</Th>
                <Th>Total USD</Th>
                <Th>Total R$</Th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Cobrir próximos 30 dias", fal: buy30fal, oai: buy30oai },
                { label: "Cobrir próximos 60 dias", fal: buy60fal, oai: buy60oai },
                { label: "Cobrir próximos 90 dias", fal: buy90fal, oai: buy90oai },
              ].map(({ label, fal, oai }) => {
                const tot = fal + oai;
                const ok = tot === 0;
                return (
                  <tr
                    key={label}
                    style={{
                      borderTop: "1px solid #e2e8f0",
                      background: ok ? "#f0fdf4" : undefined,
                    }}
                  >
                    <Td style={{ fontWeight: 600 }}>{label}</Td>
                    <Td style={{ color: fal === 0 ? "#15803d" : "#dc2626", fontWeight: 700 }}>
                      {fal === 0 ? "✓ coberto" : usd(fal)}
                    </Td>
                    <Td style={{ color: oai === 0 ? "#15803d" : "#dc2626", fontWeight: 700 }}>
                      {oai === 0 ? "✓ coberto" : usd(oai)}
                    </Td>
                    <Td style={{ fontWeight: 700, color: ok ? "#15803d" : "#dc2626" }}>
                      {ok ? "✓ coberto" : usd(tot)}
                    </Td>
                    <Td style={{ color: "#64748b" }}>
                      {ok ? "—" : `R$ ${(tot * usdBrlRate).toFixed(2)}`}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <SupplierLink
          href="https://fal.ai/dashboard/billing"
          color="#6d28d9"
          label="Recarregar fal.ai ↗"
        />
        <SupplierLink
          href="https://platform.openai.com/settings/organization/billing"
          color="#0369a1"
          label="Recarregar OpenAI ↗"
        />
      </div>
    </section>
  );
}
