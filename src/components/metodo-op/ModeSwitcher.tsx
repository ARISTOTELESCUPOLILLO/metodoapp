import type { Dispatch, SetStateAction } from "react";
import type { SlotInfo } from "../../hooks/useProfile";

type Modo = "metodo" | "postUnico" | "imageKit";

interface Props {
  modo: Modo;
  setModo: (m: Modo) => void;
  mopExhausted: boolean;
  puExhausted: boolean;
  bonusExhausted: boolean;
  bonusIsPuType: boolean;
  bonusSlotInfoObj: SlotInfo | undefined;
  selectedSlot: "plano1" | "plano2" | "bonus";
  setSelectedSlot: (s: "plano1" | "plano2" | "bonus") => void;
  setExhaustedHint: Dispatch<SetStateAction<"mop" | "pu" | "bonus" | null>>;
}

export function ModeSwitcher({
  modo,
  setModo,
  mopExhausted,
  puExhausted,
  bonusExhausted,
  bonusIsPuType,
  bonusSlotInfoObj,
  selectedSlot,
  setSelectedSlot,
  setExhaustedHint,
}: Props) {
  return (
    <>
      <div className="modoSwitch" role="tablist" aria-label="Modo de geração">
        <button
          type="button"
          role="tab"
          aria-selected={modo === "metodo"}
          className={`modoBtn${modo === "metodo" ? " active" : ""}`}
          onClick={() =>
            mopExhausted
              ? setExhaustedHint((h) => (h === "mop" ? null : "mop"))
              : setModo("metodo")
          }
          onMouseEnter={() => {
            if (mopExhausted) setExhaustedHint("mop");
          }}
          onMouseLeave={() => setExhaustedHint(null)}
          style={mopExhausted ? { opacity: 0.45, cursor: "default" } : undefined}
        >
          Método OP{mopExhausted ? " 🔒" : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "postUnico"}
          className={`modoBtn${modo === "postUnico" ? " active" : ""}`}
          onClick={() =>
            puExhausted
              ? setExhaustedHint((h) => (h === "pu" ? null : "pu"))
              : setModo("postUnico")
          }
          onMouseEnter={() => {
            if (puExhausted) setExhaustedHint("pu");
          }}
          onMouseLeave={() => setExhaustedHint(null)}
          style={puExhausted ? { opacity: 0.45, cursor: "default" } : undefined}
        >
          Post Único{puExhausted ? " 🔒" : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === "imageKit"}
          className={`modoBtn${modo === "imageKit" ? " active" : ""}`}
          onClick={() => setModo("imageKit")}
        >
          Kit Imagem
        </button>
      </div>
      {bonusSlotInfoObj && (
        <button
          type="button"
          onClick={() => {
            if (bonusExhausted) {
              setExhaustedHint((h) => (h === "bonus" ? null : "bonus"));
              return;
            }
            setSelectedSlot("bonus");
            if (bonusIsPuType) setModo("postUnico");
            else setModo("metodo");
          }}
          onMouseEnter={() => {
            if (bonusExhausted) setExhaustedHint("bonus");
          }}
          onMouseLeave={() => setExhaustedHint(null)}
          style={{
            width: "100%",
            marginTop: 6,
            background: selectedSlot === "bonus" ? "#f4b000" : "transparent",
            color: selectedSlot === "bonus" ? "#0f213f" : "#f4b000",
            border: "2px solid #f4b000",
            borderRadius: 12,
            padding: "7px 16px",
            fontWeight: 800,
            fontSize: 13,
            cursor: bonusExhausted ? "default" : "pointer",
            letterSpacing: 0.2,
            transition: "background .15s, color .15s",
            opacity: bonusExhausted ? 0.45 : 1,
          }}
        >
          ★ Bônus{selectedSlot === "bonus" ? " ativo" : ""}
          {bonusExhausted ? " 🔒" : ""}
        </button>
      )}
    </>
  );
}
