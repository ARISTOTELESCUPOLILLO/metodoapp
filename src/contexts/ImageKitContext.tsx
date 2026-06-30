import { createContext, useContext, type ReactNode } from "react";
import type { ImageKit } from "../types";

export interface ImageKitContextValue {
  imageKit: ImageKit;
  setImageKit: (kit: ImageKit) => void;
}

const ImageKitContext = createContext<ImageKitContextValue | undefined>(undefined);

export function ImageKitProvider({
  value,
  children,
}: {
  value: ImageKitContextValue;
  children: ReactNode;
}) {
  return <ImageKitContext.Provider value={value}>{children}</ImageKitContext.Provider>;
}

export function useImageKit(): ImageKitContextValue {
  const ctx = useContext(ImageKitContext);
  if (!ctx) throw new Error("useImageKit deve ser usado dentro de ImageKitProvider");
  return ctx;
}
