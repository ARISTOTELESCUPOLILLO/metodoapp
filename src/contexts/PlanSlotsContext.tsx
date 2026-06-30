import { createContext, useContext, type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { SlotInfo } from "../hooks/useProfile";

export interface PlanSlotsContextValue {
  selectedSlot: "plano1" | "plano2" | "bonus";
  setSelectedSlot: Dispatch<SetStateAction<"plano1" | "plano2" | "bonus">>;
  puImgsTotal: number;
  puImgsRestantes: number;
  puExhausted: boolean;
  mopExhausted: boolean;
  exhaustedHint: "mop" | "pu" | "bonus" | null;
  setExhaustedHint: Dispatch<SetStateAction<"mop" | "pu" | "bonus" | null>>;
  bonusSlotInfoObj: SlotInfo | undefined;
  bonusExhausted: boolean;
  bonusIsPuType: boolean;
  hasPostPlano: boolean | undefined;
}

const PlanSlotsContext = createContext<PlanSlotsContextValue | undefined>(undefined);

export function PlanSlotsProvider({
  value,
  children,
}: {
  value: PlanSlotsContextValue;
  children: ReactNode;
}) {
  return <PlanSlotsContext.Provider value={value}>{children}</PlanSlotsContext.Provider>;
}

export function usePlanSlotsCtx(): PlanSlotsContextValue {
  const ctx = useContext(PlanSlotsContext);
  if (!ctx) throw new Error("usePlanSlotsCtx deve ser usado dentro de PlanSlotsProvider");
  return ctx;
}
