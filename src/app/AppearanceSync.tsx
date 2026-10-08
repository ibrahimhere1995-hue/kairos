import { useEffect, useRef } from "react";
import { useThemeStore } from "@/app/theme/themeStore";
import { useAppSettings, useUpdateSettings } from "@/features/settings/api";

/**
 * Mirrors theme + text size into the settings table so they are part of backups. The local copy
 * (localStorage, applied by ThemeProvider before first paint) stays the instant source.
 */
export function AppearanceSync() {
  const preference = useThemeStore((state) => state.preference);
  const textSize = useThemeStore((state) => state.textSize);
  const { data: saved } = useAppSettings();
  const { mutate: save } = useUpdateSettings();
  // One attempt per combination: if saving fails, don't retry in a loop.
  const lastAttempt = useRef<string | null>(null);

  useEffect(() => {
    if (!saved || (saved.theme === preference && saved.textSize === textSize)) return;
    const attempt = `${preference}/${textSize}`;
    if (lastAttempt.current === attempt) return;
    lastAttempt.current = attempt;
    save({ theme: preference, textSize });
  }, [saved, preference, textSize, save]);

  return null;
}
