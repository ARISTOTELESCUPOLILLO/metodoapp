// Estado editável do reels (hook/script/legenda + contadores), persistência
// em localStorage e resincronização com upstream (D2) — extraído de
// ReelsCard.tsx (PLANO_V2 Fase 9.1). Movido 1:1, sem mudança de
// comportamento.
import { useEffect, useMemo, useState } from "react";
import type { ReelsGuide } from "../../../types";
import { loadCopyEdit, saveCopyEdit } from "../../../utils/copyEditsStorage";
import { useSyncUpstream } from "./utils";

export function useReelsCopyEdit(
  reels: ReelsGuide,
  userId: string | null | undefined,
  dayNumber: number,
) {
  const reelsCopyKey = `reels:${dayNumber}`;
  const savedReelsCopyEdit = useMemo(
    () => loadCopyEdit(userId, reelsCopyKey),
    [userId, reelsCopyKey],
  );
  const [hook, setHook] = useState(savedReelsCopyEdit?.titulo ?? reels.hook);
  const [script, setScript] = useState(savedReelsCopyEdit?.texto ?? reels.script);
  const [legenda, setLegenda] = useState(
    savedReelsCopyEdit?.legenda ?? (reels.legenda || reels.script || "").trim(),
  );
  const [hCount, setHCount] = useState(savedReelsCopyEdit?.tCount ?? 0);
  const [sCount, setSCount] = useState(savedReelsCopyEdit?.xCount ?? 0);
  const [lCount, setLCount] = useState(savedReelsCopyEdit?.lCount ?? 0);
  useEffect(() => {
    saveCopyEdit(userId, reelsCopyKey, {
      titulo: hook,
      texto: script,
      legenda,
      tCount: hCount,
      xCount: sCount,
      lCount,
    });
  }, [userId, reelsCopyKey, hook, script, legenda, hCount, sCount, lCount]);
  useSyncUpstream(reels.hook, hook, setHook);
  useSyncUpstream(reels.script, script, setScript);
  useSyncUpstream((reels.legenda || reels.script || "").trim(), legenda, setLegenda);

  return {
    hook,
    setHook,
    script,
    setScript,
    legenda,
    setLegenda,
    hCount,
    setHCount,
    sCount,
    setSCount,
    lCount,
    setLCount,
  };
}
