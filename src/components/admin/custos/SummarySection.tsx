// "Resumo do período" — extraído de CustosTab.tsx (Fase 9).
import { Section, SummaryCard } from "./primitives";

export function SummarySection({
  totalUsd,
  totalImgs,
  totalRenders,
  totalGeracoes,
  custoImgBase,
  custoImgEdit,
  custoVideo,
  custoConteudo,
  brl,
  usdFmt,
}: {
  totalUsd: number;
  totalImgs: number;
  totalRenders: number;
  totalGeracoes: number;
  custoImgBase: number;
  custoImgEdit: number;
  custoVideo: number;
  custoConteudo: number;
  brl: (usd: number) => string;
  usdFmt: (v: number) => string;
}) {
  return (
    <Section title="Resumo do período">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10,
        }}
      >
        <SummaryCard label="Custo total" value={usdFmt(totalUsd)} sub={brl(totalUsd)} dark />
        <SummaryCard
          label="Imagens"
          value={String(totalImgs)}
          sub={usdFmt(custoImgBase + custoImgEdit)}
        />
        <SummaryCard
          label="Vídeos + render"
          value={String(totalRenders)}
          sub={usdFmt(custoVideo)}
        />
        <SummaryCard label="Conteúdos" value={String(totalGeracoes)} sub={usdFmt(custoConteudo)} />
      </div>
    </Section>
  );
}
