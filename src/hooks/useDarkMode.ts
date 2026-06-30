import { useEffect, useState } from "react";
import { lsGetRaw, lsSetRaw } from "../lib/storage/store";
import { DARK_MODE_KEY } from "../lib/storage/keys";

function readPreference(): boolean {
  try {
    const v = lsGetRaw(DARK_MODE_KEY);
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
    lsSetRaw(DARK_MODE_KEY, String(isDark));
  }, [isDark]);

  return [isDark, () => setIsDark((v) => !v)];
}
