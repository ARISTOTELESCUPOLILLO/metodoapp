// Cabeçalho do app raiz (saudação, cotas, seletor de modo, banner de
// esgotado, botão de sair de impersonação) — extraído de MetodoOpApp.tsx
// (PLANO_V2 Fase 9.1). JSX + cálculo de exibição movidos 1:1, sem mudança de
// comportamento.
import type { Dispatch, SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import type { SlotInfo } from "../../hooks/useProfile";
import type { Impersonation } from "../../hooks/useImpersonation";
import type { Profile } from "../../repository/profile.repo";
import type { Modo } from "../../data/appDefaults";
import { PlanSlotsBar } from "./PlanSlotsBar";
import { ModeSwitcher } from "./ModeSwitcher";
import { ExhaustedBanner } from "./ExhaustedBanner";

interface Props {
  profile: Profile | null;
  user: User | null;
  impersonation: Impersonation | null;
  onStopImpersonation: () => void;
  profileLoading: boolean;
  slots: SlotInfo[];
  effectiveAdmin: boolean;
  modo: Modo;
  setModo: (m: Modo) => void;
  mopExhausted: boolean;
  puExhausted: boolean;
  bonusExhausted: boolean;
  bonusIsPuType: boolean;
  bonusSlotInfoObj: SlotInfo | undefined;
  selectedSlot: "plano1" | "plano2" | "bonus";
  setSelectedSlot: (s: "plano1" | "plano2" | "bonus") => void;
  exhaustedHint: "mop" | "pu" | "bonus" | null;
  setExhaustedHint: Dispatch<SetStateAction<"mop" | "pu" | "bonus" | null>>;
}

export function AppHeader({
  profile,
  user,
  impersonation,
  onStopImpersonation,
  profileLoading,
  slots,
  effectiveAdmin,
  modo,
  setModo,
  mopExhausted,
  puExhausted,
  bonusExhausted,
  bonusIsPuType,
  bonusSlotInfoObj,
  selectedSlot,
  setSelectedSlot,
  exhaustedHint,
  setExhaustedHint,
}: Props) {
  const greetingName = impersonation?.nome || profile?.nome || user?.email || "";
  const ultimoLoginFmt = profile?.ultimo_login
    ? new Date(profile.ultimo_login).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "primeiro acesso";

  return (
    <header className="hero">
      <span className="eyebrow mb-0 mt-[10px]">
        Organiza o conteúdo, gera a imagem e a legenda no app.
      </span>
      <h1 style={{ fontWeight: 900 }}>
        <span style={{ color: "#ffffff" }}>MÉTODO</span>{" "}
        <span style={{ color: "var(--brand-accent)" }}>OP</span>
      </h1>
      {greetingName && (
        <div
          style={{ color: "rgba(255,255,255,.78)", fontSize: 13, marginTop: 4, fontWeight: 500 }}
        >
          Olá, <strong style={{ color: "#fff" }}>{greetingName}</strong> · Último acesso:{" "}
          {ultimoLoginFmt}
        </div>
      )}
      <PlanSlotsBar profileLoading={profileLoading} slots={slots} effectiveAdmin={effectiveAdmin} />
      <ModeSwitcher
        modo={modo}
        setModo={setModo}
        mopExhausted={mopExhausted}
        puExhausted={puExhausted}
        bonusExhausted={bonusExhausted}
        bonusIsPuType={bonusIsPuType}
        bonusSlotInfoObj={bonusSlotInfoObj}
        selectedSlot={selectedSlot}
        setSelectedSlot={setSelectedSlot}
        setExhaustedHint={setExhaustedHint}
      />
      <ExhaustedBanner exhaustedHint={exhaustedHint} />
      {impersonation && (
        <div className="heroActions">
          <button
            className="clientBtn"
            type="button"
            onClick={onStopImpersonation}
            style={{ background: "#fde68a", color: "#78350f", borderColor: "#f59e0b" }}
            title="Sair do modo Atuar como"
          >
            ⏻ Sair de "atuando como {impersonation.nome}"
          </button>
        </div>
      )}
    </header>
  );
}
