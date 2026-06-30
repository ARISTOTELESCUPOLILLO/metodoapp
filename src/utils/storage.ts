const KIT_KEY = "metodo-op-kit-v1";
const FORM_KEY = "metodo-op-form-v1";
const LOGO_KEY = "metodo-op-logo-v1";
// Rastreia qual userId produziu o form global — detecta troca de usuário no mount.
const FORM_OWNER_KEY = "metodo-op-form-owner-v1";

export function saveKit(kit: { logoDataUrl?: string } & object) {
  try {
    const { logoDataUrl, ...kitWithoutLogo } = kit;
    localStorage.setItem(KIT_KEY, JSON.stringify(kitWithoutLogo));
    if (logoDataUrl) {
      try {
        localStorage.setItem(LOGO_KEY, logoDataUrl as string);
      } catch {
        /* logo muito grande, ignora */
      }
    } else {
      localStorage.removeItem(LOGO_KEY);
    }
  } catch (e) {
    console.error("saveKit: falha ao persistir kit, não sobrevive a reload", e);
  }
}

export function loadKit<T extends { logoDataUrl?: string }>(fallback: T): T {
  try {
    const raw = localStorage.getItem(KIT_KEY);
    const kit: T = raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
    const logo = localStorage.getItem(LOGO_KEY);
    if (logo) kit.logoDataUrl = logo;
    return kit;
  } catch {
    return fallback;
  }
}

export function saveForm(form: object) {
  try {
    localStorage.setItem(FORM_KEY, JSON.stringify(form));
  } catch (e) {
    console.error("saveForm: falha ao persistir formulário, não sobrevive a reload", e);
  }
}

export function loadForm<T extends object>(fallback: T): T {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return fallback;
  }
}

export function saveFormOwner(userId: string) {
  try {
    localStorage.setItem(FORM_OWNER_KEY, userId);
  } catch {
    /* best-effort */
  }
}

export function loadFormOwner(): string | null {
  try {
    return localStorage.getItem(FORM_OWNER_KEY);
  } catch {
    return null;
  }
}

export function clearAll() {
  [KIT_KEY, FORM_KEY, LOGO_KEY, FORM_OWNER_KEY].forEach((k) => localStorage.removeItem(k));
}
