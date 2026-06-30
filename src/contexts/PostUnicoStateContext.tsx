import { createContext, useContext, type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { PostUnicoVisualSelection } from "../types";
import type { PostUnicoCopy } from "../services/postUnico";

export interface PostUnicoStateContextValue {
  visualSelection: PostUnicoVisualSelection;
  setVisualSelection: Dispatch<SetStateAction<PostUnicoVisualSelection>>;
  puCopy: PostUnicoCopy | null;
  setPuCopy: Dispatch<SetStateAction<PostUnicoCopy | null>>;
  puCopyOriginal: PostUnicoCopy | null;
  setPuCopyOriginal: Dispatch<SetStateAction<PostUnicoCopy | null>>;
  puTituloRegen: number;
  setPuTituloRegen: Dispatch<SetStateAction<number>>;
  puTextoRegen: number;
  setPuTextoRegen: Dispatch<SetStateAction<number>>;
  onTituloRegen: () => void;
  onTextoRegen: () => void;
  onResetCopyRegen: () => void;
}

const PostUnicoStateContext = createContext<PostUnicoStateContextValue | undefined>(undefined);

export function PostUnicoStateProvider({
  value,
  children,
}: {
  value: PostUnicoStateContextValue;
  children: ReactNode;
}) {
  return (
    <PostUnicoStateContext.Provider value={value}>{children}</PostUnicoStateContext.Provider>
  );
}

export function usePostUnicoState(): PostUnicoStateContextValue {
  const ctx = useContext(PostUnicoStateContext);
  if (!ctx) throw new Error("usePostUnicoState deve ser usado dentro de PostUnicoStateProvider");
  return ctx;
}
