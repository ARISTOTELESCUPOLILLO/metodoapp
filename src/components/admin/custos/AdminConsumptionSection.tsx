// "Consumo de admins — hoje" — extraído de CustosTab.tsx (Fase 9).
import { Section, Td, Th, tbl, tblWrap, tRow } from "./primitives";
import type { AdminRow } from "./types";

export function AdminConsumptionSection({
  adminRows,
  brl,
  usdFmt,
}: {
  adminRows: AdminRow[];
  brl: (usd: number) => string;
  usdFmt: (v: number) => string;
}) {
  if (!adminRows.length) return null;
  return (
    <Section title="Consumo de admins — hoje">
      <div style={tblWrap}>
        <table style={tbl}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <Th>Admin</Th>
              <Th>Imgs</Th>
              <Th>Vídeos</Th>
              <Th>Conteúdos</Th>
              <Th>USD</Th>
              <Th>R$</Th>
            </tr>
          </thead>
          <tbody>
            {adminRows.map((r) => (
              <tr key={r.aid} style={tRow}>
                <Td>{r.email}</Td>
                <Td>{r.imgs}</Td>
                <Td>{r.renders}</Td>
                <Td>{r.geracoes}</Td>
                <Td>{usdFmt(r.custoUsd)}</Td>
                <Td>{brl(r.custoUsd)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
