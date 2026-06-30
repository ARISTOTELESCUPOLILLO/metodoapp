import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import type { SlotInfo } from "./useProfile";
import type { PlanAccess } from "../lib/planAccess";
import { setCurrentDebitSlot } from "../services/imageGeneration";

type Modo = "metodo" | "postUnico" | "imageKit";

export interface UsePlanSlotsResult {
  puSlot: "plano1" | "plano2" | "bonus" | undefined;
  puImgsTotal: number;
  puImgsReal: number;
  puImgsRestantes: number;
  puExhausted: boolean;
  mopSlot: "plano1" | "plano2" | "bonus" | undefined;
  mopImgsTotal: number;
  mopImgsReal: number;
  mopImgsRestantes: number;
  mopExhausted: boolean;
  bonusSlotInfoObj: SlotInfo | undefined;
  bonusImgsTotal: number;
  bonusImgsReal: number;
  bonusExhausted: boolean;
  bonusIsPuType: boolean;
  selectedSlot: "plano1" | "plano2" | "bonus";
  setSelectedSlot: Dispatch<SetStateAction<"plano1" | "plano2" | "bonus">>;
  exhaustedHint: "mop" | "pu" | "bonus" | null;
  setExhaustedHint: Dispatch<SetStateAction<"mop" | "pu" | "bonus" | null>>;
}

export function usePlanSlots(
  slots: SlotInfo[],
  planAccess: PlanAccess,
  modo: Modo,
  effectiveUserId: string | null,
): UsePlanSlotsResult {
  // Slot com plano PU explícito
  const puSlotKey = slots.find((s) => /^PU\d+/i.test(s.plan.codigo))?.key as
    | "plano1"
    | "plano2"
    | "bonus"
    | undefined;
  const puSlotInfoObj = slots.find((s) => /^PU\d+$/i.test(s.plan.codigo));
  const puImgsTotal = puSlotInfoObj
    ? puSlotInfoObj.imgsLimiteDisplay || puSlotInfoObj.imgsLimite || 0
    : 0;
  const puImgsReal = puSlotInfoObj?.imgsLimite ?? 0;
  const puImgsUsadas = puSlotInfoObj?.imgsUsadas ?? 0;
  const puImgsRestantes = Math.max(0, puImgsReal - puImgsUsadas);
  const puExhausted = planAccess.hasPostUnico && puImgsReal > 0 && puImgsUsadas >= puImgsReal;

  // Slot Bônus
  const bonusSlotInfoObj = slots.find((s) => s.key === "bonus");
  const bonusImgsTotal = bonusSlotInfoObj
    ? bonusSlotInfoObj.imgsLimiteDisplay || bonusSlotInfoObj.imgsLimite || 0
    : 0;
  const bonusImgsReal = bonusSlotInfoObj?.imgsLimite ?? 0;
  const bonusImgsUsadas = bonusSlotInfoObj?.imgsUsadas ?? 0;
  const bonusExhausted =
    !!bonusSlotInfoObj && bonusImgsReal > 0 && bonusImgsUsadas >= bonusImgsReal;
  const bonusIsPuType = !!(bonusSlotInfoObj && /^PU\d+$/i.test(bonusSlotInfoObj.plan.codigo));

  // Slot MOP
  const hasMopPlan =
    planAccess.tracks.cinematica || planAccess.tracks.visual || planAccess.tracks.experimentacao;
  const mopSlotInfoObj =
    slots.find((s) => s.key !== "bonus" && !/^PU\d+$/i.test(s.plan.codigo)) ??
    (bonusSlotInfoObj && !/^PU\d+$/i.test(bonusSlotInfoObj.plan.codigo)
      ? bonusSlotInfoObj
      : undefined);
  const mopSlotKey = mopSlotInfoObj?.key as "plano1" | "plano2" | "bonus" | undefined;
  const mopImgsTotal = mopSlotInfoObj
    ? mopSlotInfoObj.imgsLimiteDisplay || mopSlotInfoObj.imgsLimite || 0
    : 0;
  const mopImgsReal = mopSlotInfoObj?.imgsLimite ?? 0;
  const mopImgsUsadas = mopSlotInfoObj?.imgsUsadas ?? 0;
  const mopImgsRestantes = Math.max(0, mopImgsReal - mopImgsUsadas);
  const allMopSizes = [
    ...planAccess.sizesByTrack.cinematica,
    ...planAccess.sizesByTrack.visual,
    ...(planAccess.tracks.experimentacao ? [3] : []),
  ];
  const mopMinSize = allMopSizes.length > 0 ? Math.min(...allMopSizes) : 3;
  const mopExhausted = hasMopPlan && mopImgsReal > 0 && mopImgsRestantes < mopMinSize;

  const defaultSlot = mopSlotKey ?? puSlotKey ?? slots[0]?.key ?? "plano1";
  const [selectedSlot, setSelectedSlot] = useState<"plano1" | "plano2" | "bonus">("plano1");
  const [exhaustedHint, setExhaustedHint] = useState<"mop" | "pu" | "bonus" | null>(null);
  const slotInitRef = useRef<string | null>(null);

  // Inicializa slot ao primeiro login / troca de usuário
  useEffect(() => {
    if (effectiveUserId && effectiveUserId !== slotInitRef.current && defaultSlot) {
      slotInitRef.current = effectiveUserId;
      setSelectedSlot(defaultSlot as "plano1" | "plano2" | "bonus");
    }
  }, [effectiveUserId, defaultSlot]);

  // Auto-switch slot quando modo muda para garantir débito no plano correto
  useEffect(() => {
    if (modo === "postUnico") {
      if (puSlotKey) setSelectedSlot(puSlotKey);
      else if (bonusIsPuType) setSelectedSlot("bonus");
    } else if (modo === "metodo" && mopSlotKey) {
      setSelectedSlot(mopSlotKey);
    }
  }, [modo, puSlotKey, mopSlotKey, bonusIsPuType]);

  // Propaga slot selecionado para o serviço de geração
  useEffect(() => {
    setCurrentDebitSlot(selectedSlot);
  }, [selectedSlot]);

  return {
    puSlot: puSlotKey,
    puImgsTotal,
    puImgsReal,
    puImgsRestantes,
    puExhausted,
    mopSlot: mopSlotKey,
    mopImgsTotal,
    mopImgsReal,
    mopImgsRestantes,
    mopExhausted,
    bonusSlotInfoObj,
    bonusImgsTotal,
    bonusImgsReal,
    bonusExhausted,
    bonusIsPuType,
    selectedSlot,
    setSelectedSlot,
    exhaustedHint,
    setExhaustedHint,
  };
}
