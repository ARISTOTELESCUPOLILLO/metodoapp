const KIT_KEY = 'metodo-op-kit-v1';
const FORM_KEY = 'metodo-op-form-v1';
const LOGO_KEY = 'metodo-op-logo-v1';

export function saveKit(kit: Record<string, unknown>) {
  try {
    const { logoDataUrl, ...kitWithoutLogo } = kit;
    localStorage.setItem(KIT_KEY, JSON.stringify(kitWithoutLogo));
    if (logoDataUrl) {
      try { localStorage.setItem(LOGO_KEY, logoDataUrl as string); }
      catch { /* logo muito grande, ignora */ }
    } else {
      localStorage.removeItem(LOGO_KEY);
    }
  } catch {}
}

export function loadKit(fallback: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(KIT_KEY);
    const kit = raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
    const logo = localStorage.getItem(LOGO_KEY);
    if (logo) kit.logoDataUrl = logo;
    return kit;
  } catch { return fallback; }
}

export function saveForm(form: Record<string, unknown>) {
  try { localStorage.setItem(FORM_KEY, JSON.stringify(form)); } catch {}
}

export function loadForm(fallback: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch { return fallback; }
}

export function clearAll() {
  [KIT_KEY, FORM_KEY, LOGO_KEY].forEach(k => localStorage.removeItem(k));
}
