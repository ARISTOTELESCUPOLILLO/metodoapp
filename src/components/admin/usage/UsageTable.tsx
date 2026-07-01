// Tabela desktop da aba Consumo — extraído de UsageTab.tsx (Fase 9).
import { Th, Td } from "./primitives";
import { UsuarioCell } from "./UsuarioCell";
import type { Log, ProfileInfo } from "./types";

export function UsageTable({
  logs,
  profiles,
  adminEmails,
  usdRate,
}: {
  logs: Log[];
  profiles: Record<string, ProfileInfo>;
  adminEmails: Record<string, string>;
  usdRate: number;
}) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "#f8fafc" }}>
          <tr>
            <Th>Data</Th>
            <Th>Usuário</Th>
            <Th>Evento</Th>
            <Th>Módulo</Th>
            <Th>Imgs</Th>
            <Th>Renders</Th>
            <Th>Ger.</Th>
            <Th>US$</Th>
            <Th>R$</Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} style={{ borderTop: "1px solid #e2e8f0" }}>
              <Td>{new Date(l.created_at).toLocaleString("pt-BR")}</Td>
              <Td>
                <UsuarioCell log={l} profiles={profiles} adminEmails={adminEmails} />
              </Td>
              <Td>{l.evento}</Td>
              <Td>{l.modulo || "—"}</Td>
              <Td>{l.qtd_imagens}</Td>
              <Td>{l.qtd_renders}</Td>
              <Td>{l.qtd_geracoes}</Td>
              <Td>{Number(l.custo_usd).toFixed(2)}</Td>
              <Td>{(Number(l.custo_usd) * usdRate).toFixed(2)}</Td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>
                Sem registros no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
