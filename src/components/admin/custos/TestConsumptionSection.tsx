// "Consumo de contas de teste" — extraído de CustosTab.tsx (Fase 9).
import { Section, Td, Th, tbl, tblWrap, tRow } from "./primitives";
import type { TestRow } from "./types";

export function TestConsumptionSection({
  testRows,
  brl,
  usdFmt,
}: {
  testRows: TestRow[];
  brl: (usd: number) => string;
  usdFmt: (v: number) => string;
}) {
  if (!testRows.length) return null;
  return (
    <Section title="Consumo de contas de teste">
      <div style={tblWrap}>
        <table style={tbl}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <Th>Nome teste</Th>
              <Th>Imgs</Th>
              <Th>Vídeos</Th>
              <Th>Conteúdos</Th>
              <Th>USD</Th>
              <Th>R$</Th>
            </tr>
          </thead>
          <tbody>
            {testRows.map((r) => (
              <tr key={r.id} style={tRow}>
                <Td>{r.nome}</Td>
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
