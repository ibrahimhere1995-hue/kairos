import { useEffect, useRef, type ReactNode } from "react";
import { applyTheme, DARK_QUERY, resolveTheme } from "@/app/theme/theme";
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

  return children;
}
