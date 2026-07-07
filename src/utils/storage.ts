import { lsGet, lsRemove, lsSetQuotaSafe } from "../lib/storage/store";
import { KIT_KEY, LOGO_KEY, FORM_KEY } from "../lib/storage/keys";

export function saveKit(kit: { logoDataUrl?: string } & object, userId?: string | null) {
  try {
    const { logoDataUrl, ...kitWithoutLogo } = kit;
    lsSetQuotaSafe(KIT_KEY, JSON.stringify(kitWithoutLogo), userId);
    if (logoDataUrl) {
      lsSetQuotaSafe(LOGO_KEY, logoDataUrl as string, userId);
    } else {
      lsRemove(LOGO_KEY, userId);
    }
  } catch (e) {
    console.error("saveKit: falha ao persistir kit, não sobrevive a reload", e);
  }
}

export function loadKit<T extends { logoDataUrl?: string }>(
  fallback: T,
  userId?: string | null,
): T {
  try {
    const raw = lsGet(KIT_KEY, userId);
    const kit: T = raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
    const logo = lsGet(LOGO_KEY, userId);
    if (logo) kit.logoDataUrl = logo;
    return kit;
  } catch {
    return fallback;
  }
}

export function saveForm(form: object, userId?: string | null) {
  try {
    lsSetQuotaSafe(FORM_KEY, JSON.stringify(form), userId);
  } catch (e) {
    console.error("saveForm: falha ao persistir formulário, não sobrevive a reload", e);
  }
}

export function loadForm<T extends object>(fallback: T, userId?: string | null): T {
  try {
    const raw = lsGet(FORM_KEY, userId);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return fallback;
  }
}

/** Remove todos os dados locais escopados do userId (kit, logo, form). */
export function clearStorage(userId?: string | null) {
  lsRemove(KIT_KEY, userId);
  lsRemove(LOGO_KEY, userId);
  lsRemove(FORM_KEY, userId);
}
