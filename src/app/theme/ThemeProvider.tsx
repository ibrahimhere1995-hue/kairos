import { useEffect, useRef, type ReactNode } from "react";
import {
  applyTheme,
  DARK_QUERY,
  isThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from "@/app/theme/theme";
import { applyTextSize, isTextSize, TEXT_SIZE_STORAGE_KEY } from "@/app/theme/textSize";
import { useThemeStore } from "@/app/theme/themeStore";

/**
 * Keeps `<html data-theme>` (with "Match system" following the OS) and `<html data-text-size>`
 * in sync with the appearance settings, in every window.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useThemeStore((state) => state.preference);
  const textSize = useThemeStore((state) => state.textSize);
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

  useEffect(() => applyTextSize(textSize), [textSize]);

  // Keep every window in step: a change in the main window updates Quick Capture too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY && isThemePreference(event.newValue)) {
        useThemeStore.setState({ preference: event.newValue });
      }
      if (event.key === TEXT_SIZE_STORAGE_KEY && isTextSize(event.newValue)) {
        useThemeStore.setState({ textSize: event.newValue });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return children;
}
