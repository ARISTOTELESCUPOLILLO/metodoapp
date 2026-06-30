import { useEffect, type MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";
import { loadImageKit, loadImageKitAsync } from "../utils/imageKitStorage";
import { loadKitForUser } from "../services/brandKit";
import { loadForm } from "../utils/storage";
import { lsGet, lsRemove } from "../lib/storage/store";
import {
  RESULT_KEY,
  PU_IMG_KEY,
  PU_CAPTION_KEY,
  PU_STARTED_KEY,
  PU_VISUAL_KEY,
} from "../lib/storage/keys";
import type { BrandKit, ContentFormData, ImageKit, MethodOpResult, PostUnicoFormData, PostUnicoVisualSelection } from "../types";
import type { PostUnicoCaption, PostUnicoCopy } from "../services/postUnico";
import { loadPostUnico, defaultKit, defaultForm, defaultVisualSelection } from "../data/appDefaults";

interface Params {
  effectiveUserId: string | null;
  prevUserRef: MutableRefObject<string | null>;
  impersonation: { userId: string; nome: string } | null;
  loadKitServerFn: (args: { data: { userId: string } }) => Promise<BrandKit | null>;
  handleKitChange: (kit: BrandKit) => void;
  setForm: Dispatch<SetStateAction<ContentFormData>>;
  setPostUnico: Dispatch<SetStateAction<PostUnicoFormData>>;
  setKit: Dispatch<SetStateAction<BrandKit>>;
  setVisualSelection: Dispatch<SetStateAction<PostUnicoVisualSelection>>;
  setPostUnicoImg: Dispatch<SetStateAction<string | undefined>>;
  setCaption: Dispatch<SetStateAction<PostUnicoCaption | undefined>>;
  setPostUnicoStarted: Dispatch<SetStateAction<boolean>>;
  setImageKit: Dispatch<SetStateAction<ImageKit>>;
  setResult: Dispatch<SetStateAction<MethodOpResult | undefined>>;
  setPuCopy: Dispatch<SetStateAction<PostUnicoCopy | null>>;
  setPuCopyOriginal: Dispatch<SetStateAction<PostUnicoCopy | null>>;
}

export function useUserDataRestore({
  effectiveUserId,
  prevUserRef,
  impersonation,
  loadKitServerFn,
  handleKitChange,
  setForm,
  setPostUnico,
  setKit,
  setVisualSelection,
  setPostUnicoImg,
  setCaption,
  setPostUnicoStarted,
  setImageKit,
  setResult,
  setPuCopy,
  setPuCopyOriginal,
}: Params) {
  useEffect(() => {
    if (!effectiveUserId) return;
    const prevUser = prevUserRef.current;
    prevUserRef.current = effectiveUserId;

    const savedForm = loadForm(defaultForm, effectiveUserId);
    setForm({ ...savedForm, track: savedForm.track || "cinematica" });
    setPostUnico(loadPostUnico(effectiveUserId));

    if (prevUser !== null && prevUser !== effectiveUserId) {
      setKit(defaultKit);
      setVisualSelection(defaultVisualSelection);
      setPuCopy(null);
      setPuCopyOriginal(null);
    }

    const loadFn = impersonation
      ? () => loadKitServerFn({ data: { userId: effectiveUserId } })
      : () => loadKitForUser(effectiveUserId);

    loadFn().then((loaded) => {
      if (loaded) {
        handleKitChange(loaded);
      } else {
        lsRemove("metodo-op-kit-v1", effectiveUserId);
        lsRemove("metodo-op-logo-v1", effectiveUserId);
        handleKitChange(defaultKit);
      }
    });

    try {
      const r = lsGet(RESULT_KEY, effectiveUserId);
      setResult(r ? JSON.parse(r) : undefined);
    } catch {
      /* entrada corrompida */
    }
    try {
      const pImg = lsGet(PU_IMG_KEY, effectiveUserId);
      setPostUnicoImg(pImg ? JSON.parse(pImg) : undefined);
    } catch {
      /* entrada corrompida */
    }
    try {
      const pCap = lsGet(PU_CAPTION_KEY, effectiveUserId);
      setCaption(pCap ? JSON.parse(pCap) : undefined);
    } catch {
      /* entrada corrompida */
    }
    try {
      const pStarted = lsGet(PU_STARTED_KEY, effectiveUserId);
      setPostUnicoStarted(pStarted === "true");
    } catch {
      /* entrada corrompida */
    }
    try {
      const vSel = lsGet(PU_VISUAL_KEY, effectiveUserId);
      setVisualSelection(vSel ? JSON.parse(vSel) : defaultVisualSelection);
    } catch {
      /* entrada corrompida */
    }
    try {
      setImageKit(loadImageKit(effectiveUserId));
    } catch {
      /* cache local indisponível */
    }
    loadImageKitAsync(effectiveUserId)
      .then((remote) => setImageKit(remote))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);
}
