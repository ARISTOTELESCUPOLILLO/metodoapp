// "Breakdown por tipo de operação" — extraído de CustosTab.tsx (Fase 9).
import { Section, Td, Th, tbl, tblWrap, tRow } from "./primitives";
import type { AppSettings } from "./types";

export function BreakdownSection({
  settings,
  imgBaseCount,
  imgEditCount,
  totalRenders,
  totalGeracoes,
  totalUsd,
  custoImgBase,
  custoImgEdit,
  custoVideo,
  custoConteudo,
  brl,
  usdFmt,
}: {
  settings: AppSettings;
  imgBaseCount: number;
  imgEditCount: number;
  totalRenders: number;
  totalGeracoes: number;
  totalUsd: number;
  custoImgBase: number;
  custoImgEdit: number;
  custoVideo: number;
  custoConteudo: number;
  brl: (usd: number) => string;
  usdFmt: (v: number) => string;
}) {
  return (
    <Section title="Breakdown por tipo de operação">
      <div style={tblWrap}>
        <table style={tbl}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <Th>Tipo</Th>
              <Th>Qtd</Th>
              <Th>Custo unit.</Th>
              <Th>USD</Th>
              <Th>R$</Th>
            </tr>
          </thead>
          <tbody>
            <tr style={tRow}>
              <Td>
                <b>fal.ai</b> — Imagem base
              </Td>
              <Td>{imgBaseCount}</Td>
              <Td>${settings.image_base_price_usd.toFixed(4)}</Td>
              <Td>{usdFmt(custoImgBase)}</Td>
              <Td>{brl(custoImgBase)}</Td>
            </tr>
            <tr style={tRow}>
              <Td>
                <b>fal.ai</b> — Imagem c/ refs
              </Td>
              <Td>{imgEditCount}</Td>
              <Td>${settings.image_price_usd.toFixed(4)}</Td>
              <Td>{usdFmt(custoImgEdit)}</Td>
              <Td>{brl(custoImgEdit)}</Td>
            </tr>
            <tr style={tRow}>
              <Td>
                <b>fal.ai</b> — Vídeo + render
              </Td>
              <Td>{totalRenders}</Td>
              <Td>${settings.render_price_usd.toFixed(3)}</Td>
              <Td>{usdFmt(custoVideo)}</Td>
              <Td>{brl(custoVideo)}</Td>
            </tr>
            <tr style={tRow}>
              <Td>
                <b>OpenAI</b> — Conteúdo
              </Td>
              <Td>{totalGeracoes}</Td>
              <Td>${settings.geracao_price_usd.toFixed(4)}</Td>
              <Td>{usdFmt(custoConteudo)}</Td>
              <Td>{brl(custoConteudo)}</Td>
            </tr>
            <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
              <Td>TOTAL</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td>{usdFmt(totalUsd)}</Td>
              <Td>{brl(totalUsd)}</Td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}
