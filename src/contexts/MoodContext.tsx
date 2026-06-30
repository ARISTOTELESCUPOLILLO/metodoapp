import { createContext, useContext, type ReactNode } from "react";
import type { MoodCode } from "../types";

export interface MoodContextValue {
  mood: MoodCode | null;
  setMood: (m: MoodCode | null) => void;
}

const MoodContext = createContext<MoodContextValue | undefined>(undefined);

export function MoodProvider({
  value,
  children,
}: {
  value: MoodContextValue;
  children: ReactNode;
}) {
  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>;
}

export function useMood(): MoodContextValue {
  const ctx = useContext(MoodContext);
  if (!ctx) throw new Error("useMood deve ser usado dentro de MoodProvider");
  return ctx;
}
