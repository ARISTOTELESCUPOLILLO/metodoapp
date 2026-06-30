import { BrandKit, ImageKit } from "../../../types";
import { ModeloOP } from "../../../core/personalizacaoMop";
import { useRefSelection } from "../UsoReferenciasDia";
import { kitHasRefsForFormat } from "./utils";

// Props comuns para o seletor de Imagens de Referência nos cards.
export interface RefSelectorProps {
  segmento: BrandKit["segment"];
  modelo: ModeloOP | null;
  imageKit?: ImageKit;
  extrasCarrossel: number;
}

// Botão "Gerar com refs" — só aparece se há seleção marcada E o kit tem imagens do tipo certo.
// Visível desde a primeira geração (não depende de já existir preview), pra
// que a referência do Kit entre também na 1ª imagem, não só na regeração.
export function RefsRegenButton({
  storageKey,
  fallbackKey,
  busy,
  onRun,
  imageKit,
  formato,
  segmento,
  modelo,
  hasPreview,
}: {
  storageKey: string;
  fallbackKey?: string;
  busy: boolean;
  onRun: () => void;
  imageKit?: ImageKit;
  formato?: "estatico" | "carrossel" | "estatico_final" | "reels";
  segmento: BrandKit["segment"];
  modelo: ModeloOP | null;
  hasPreview?: boolean;
}) {
  const sel = useRefSelection(storageKey);
  const selFb = useRefSelection(fallbackKey || storageKey);
  const has = sel.hasAny || selFb.hasAny;
  if (!has) return null;
  if (!kitHasRefsForFormat(imageKit, formato || "estatico", segmento, modelo)) return null;
  return (
    <button
      className="generateBtn"
      type="button"
      onClick={onRun}
      disabled={busy}
      title="Gerar usando as referências marcadas acima"
    >
      {busy ? "Gerando..." : hasPreview ? "↻ Gerar outra com refs" : "⬇ Gerar com refs"}
    </button>
  );
}
