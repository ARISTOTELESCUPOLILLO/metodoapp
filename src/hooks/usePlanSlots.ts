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

const isPuPlan = (s: SlotInfo) => /^PU\d+$/i.test(s.plan.codigo);

/** Slot PU utilizável: não expirado e com imagem sobrando.
 *  Limite 0 = ilimitado, mesma convenção do backend (fits, usage.server.ts) e
 *  do puExhausted. Slot expirado não serve: o servidor o rejeitaria depois
 *  (checkBalance → notExpired), com o clique do usuário já gasto. */
function slotUtilizavel(s: SlotInfo): boolean {
  if (s.expiraEm && new Date(s.expiraEm) <= new Date()) return false;
  const limite = s.imgsLimite ?? 0;
  return limite === 0 || (s.imgsUsadas ?? 0) < limite;
}

/** Escolhe o slot que o Post Único deve usar: o primeiro slot PU COM SALDO —
 *  e não simplesmente o primeiro slot PU da lista.
 *
 *  Achado real 06/08/2026 (conta Atrevidinha, relatado pelo Ari): plano1 = PU4
 *  esgotado (6/6 imagens) + bônus = PU2 novo (0/3). O `find` antigo parava no
 *  PU4 esgotado, então puImgsRestantes vinha 0, o PostUnicoForm calculava
 *  `semImagens` e desabilitava o botão "Gerar título e texto" — com o bônus PU2
 *  intacto ao lado. O auto-switch de slot tinha o mesmo problema: só caía no
 *  bônus quando NÃO existia nenhum outro slot PU, ou seja, o bônus nunca era
 *  usado justamente no caso em que ele existe para socorrer.
 *
 *  Sem nenhum slot com saldo, devolve o primeiro: a UI precisa continuar
 *  mostrando o plano esgotado (régua, aviso) em vez de ficar sem slot nenhum e
 *  parecer que o cliente não tem plano de Post Único. */
export function pickPuSlot(slots: SlotInfo[]): SlotInfo | undefined {
  const puSlots = slots.filter(isPuPlan);
  return puSlots.find(slotUtilizavel) ?? puSlots[0];
}

export function usePlanSlots(
  slots: SlotInfo[],
  planAccess: PlanAccess,
  modo: Modo,
  effectiveUserId: string | null,
): UsePlanSlotsResult {
  // Slot do Post Único — o primeiro PU com saldo (ver pickPuSlot).
  const puSlotInfoObj = pickPuSlot(slots);
  const puSlotKey = puSlotInfoObj?.key as "plano1" | "plano2" | "bonus" | undefined;
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
