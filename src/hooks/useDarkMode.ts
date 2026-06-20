import { useEffect, useState } from "react";

const DARK_KEY = "metodo-op-dark-mode";

function readPreference(): boolean {
  try {
    const v = localStorage.getItem(DARK_KEY);
    if (v !== null) return v === "true";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  } catch {
    return false;
  }
}

function applyDark(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const pref = readPreference();
    applyDark(pref);
    return pref;
  });

  useEffect(() => {
    applyDark(isDark);
    try {
      localStorage.setItem(DARK_KEY, String(isDark));
    } catch {
      /* preferência de tema não é crítica */
    }
  }, [isDark]);

  return [isDark, () => setIsDark((v) => !v)];
}
