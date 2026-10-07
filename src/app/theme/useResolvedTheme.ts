import { useSyncExternalStore } from "react";
import { DARK_QUERY, resolveTheme, type ResolvedTheme } from "@/app/theme/theme";
import { useThemeStore } from "@/app/theme/themeStore";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** The theme actually on screen right now (resolves "Match system" against the OS). */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useThemeStore((state) => state.preference);
  const prefersDark = useSyncExternalStore(subscribe, systemPrefersDark);
  return resolveTheme(preference, prefersDark);
}
