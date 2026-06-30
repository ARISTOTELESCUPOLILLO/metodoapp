import { useState, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { defaultVoice } from "../data/brandVoice";
import { saveKit, saveForm, clearStorage } from "../utils/storage";
import { loadKitForUser, saveKitForUser } from "../services/brandKit";
import type { BrandKit, ContentFormData, PostUnicoFormData } from "../types";
import type { Profile } from "./useProfile";
import { lsRemove } from "../lib/storage/store";
import { POSTUNICO_FORM_KEY } from "../lib/storage/keys";

interface Params {
  kit: BrandKit;
  setKit: Dispatch<SetStateAction<BrandKit>>;
  form: ContentFormData;
  setForm: Dispatch<SetStateAction<ContentFormData>>;
  setPostUnico: Dispatch<SetStateAction<PostUnicoFormData>>;
  effectiveUserId: string | null;
  impersonation: { userId: string; nome: string } | null;
  loadKitServerFn: (args: { data: { userId: string } }) => Promise<BrandKit | null>;
  saveKitServerFn: (args: { data: object }) => Promise<BrandKit>;
  askConfirm: (title: string, message?: string) => Promise<boolean>;
  profile: Profile | null;
  defaultKit: BrandKit;
  defaultForm: ContentFormData;
  defaultPostUnico: PostUnicoFormData;
}

export function useBrandKitActions({
  kit,
  setKit,
  form,
  setForm,
  setPostUnico,
  effectiveUserId,
  impersonation,
  loadKitServerFn,
  saveKitServerFn,
  askConfirm,
  profile,
  defaultKit,
  defaultForm,
  defaultPostUnico,
}: Params) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingKit, setLoadingKit] = useState(false);

  const lockedSegment = profile?.segmento
    ? (profile.segmento as typeof defaultKit.segment)
    : undefined;

  // Persistência do kit/form no localStorage
  useEffect(() => {
    if (effectiveUserId) saveKit(kit, effectiveUserId);
  }, [kit, effectiveUserId]);

  useEffect(() => {
    if (effectiveUserId) saveForm(form, effectiveUserId);
  }, [form, effectiveUserId]);

  // Quando o profile chega, sincroniza o segment do kit com o do perfil
  useEffect(() => {
    if (!lockedSegment) return;
    if (kit.segment === lockedSegment) return;
    const voice = defaultVoice(lockedSegment);
    setKit((prev) => ({ ...prev, segment: lockedSegment, brandVoice: voice }));
    setForm((prev) => ({ ...prev, segment: lockedSegment, brandVoice: voice }));
  }, [lockedSegment]); // eslint-disable-line react-hooks/exhaustive-deps

  // Espelha dados do Kit de Marca no Post Único (campos travados)
  useEffect(() => {
    setPostUnico((prev) => ({
      ...prev,
      companyName: kit.companyName || "",
      mainActivity: kit.mainActivity || "",
    }));
  }, [kit.companyName, kit.mainActivity]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleKitChange(next: BrandKit) {
    setKit(next);
    setForm((prev) => ({
      ...prev,
      companyName: next.companyName,
      segment: next.segment,
      brandVoice: next.brandVoice,
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (effectiveUserId) {
        saveKit(kit, effectiveUserId);
        saveForm(form, effectiveUserId);
      }
      if (effectiveUserId) {
        let savedKit: BrandKit;
        if (impersonation) {
          savedKit = await saveKitServerFn({
            data: {
              userId: effectiveUserId,
              companyName: kit.companyName,
              segment: kit.segment,
              primaryColor: kit.primaryColor,
              secondaryColor: kit.secondaryColor,
              accentColor: kit.accentColor,
              fontPair: kit.fontPair,
              secondaryFont: kit.secondaryFont,
              brandVoice: kit.brandVoice,
              logoHasName: kit.logoHasName ?? false,
              logoDataUrl: kit.logoDataUrl,
              mainActivity: kit.mainActivity,
              logoPosition: kit.logoPosition || "bottom-right",
              assinatura: kit.assinatura,
              uniformeDataUrl: kit.uniformeDataUrl,
              products: kit.products ?? [],
              isPersonalBrand: kit.isPersonalBrand ?? false,
            },
          });
        } else {
          savedKit = await saveKitForUser(kit, effectiveUserId);
        }
        handleKitChange(savedKit);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(`Erro ao salvar Kit: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (
      !(await askConfirm(
        "Limpar Kit de Marca",
        "Isso vai apagar o Kit de Marca e todos os dados locais. Deseja continuar?",
      ))
    )
      return;
    clearStorage(effectiveUserId);
    lsRemove(POSTUNICO_FORM_KEY, effectiveUserId);
    setKit(defaultKit);
    setForm(defaultForm);
    setPostUnico(defaultPostUnico);
  }

  async function handleLoadKit() {
    if (!effectiveUserId) return;
    setLoadingKit(true);
    try {
      const loaded = impersonation
        ? await loadKitServerFn({ data: { userId: effectiveUserId } })
        : await loadKitForUser(effectiveUserId);
      if (loaded) {
        handleKitChange(loaded);
      } else {
        alert('Você ainda não tem um Kit salvo. Preencha e clique em "Salvar Kit".');
      }
    } catch (e) {
      alert(`Erro ao carregar Kit: ${(e as Error).message}`);
    } finally {
      setLoadingKit(false);
    }
  }

  return {
    saving,
    saved,
    loadingKit,
    lockedSegment,
    handleKitChange,
    handleSave,
    handleClear,
    handleLoadKit,
  };
}
