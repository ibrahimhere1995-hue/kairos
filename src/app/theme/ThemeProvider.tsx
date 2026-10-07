import { useEffect, useRef, type ReactNode } from "react";
import {
  applyTheme,
  DARK_QUERY,
  isThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "@/app/theme/theme";
import { useThemeStore } from "@/app/theme/themeStore";

/** Keeps `<html data-theme>` in sync with the preference and, for "Match system", the OS setting. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemeStore((state) => state.preference);
  const isFirstApply = useRef(true);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const update = () => {
      applyTheme(resolveTheme(preference, media.matches), undefined, !isFirstApply.current);
      isFirstApply.current = false;
    };
    update();
    if (preference !== "system") return;
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [preference]);

  // Keep every window in step: a theme change in the main window updates Quick Capture too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && isThemePreference(event.newValue)) {
        useThemeStore.setState({ preference: event.newValue });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return children;
}
