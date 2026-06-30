import { createContext, useContext, type ReactNode } from "react";
import type { BrandKit } from "../types";

export interface BrandKitContextValue {
  kit: BrandKit;
  lockedSegment: BrandKit["segment"] | undefined;
  handleKitChange: (kit: BrandKit) => void;
}

const BrandKitContext = createContext<BrandKitContextValue | undefined>(undefined);

export function BrandKitProvider({
  value,
  children,
}: {
  value: BrandKitContextValue;
  children: ReactNode;
}) {
  return <BrandKitContext.Provider value={value}>{children}</BrandKitContext.Provider>;
}

export function useBrandKit(): BrandKitContextValue {
  const ctx = useContext(BrandKitContext);
  if (!ctx) throw new Error("useBrandKit deve ser usado dentro de BrandKitProvider");
  return ctx;
}
