import { create } from "zustand";
import {
  readStoredPreference,
  writeStoredPreference,
  type ThemePreference,
} from "@/app/theme/theme";
import { readStoredTextSize, TEXT_SIZE_STORAGE_KEY } from "@/app/theme/textSize";
import type { TextSize } from "@/types/TextSize";

// Appearance lives here first (instant, and cached in localStorage for the pre-paint script),
// and is mirrored into the settings table by AppearanceSync so backups include it.
interface ThemeState {
  preference: ThemePreference;
  textSize: TextSize;
  setPreference: (preference: ThemePreference) => void;
  setTextSize: (size: TextSize) => void;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: readStoredPreference(safeLocalStorage()),
  textSize: readStoredTextSize(safeLocalStorage()),
  setPreference: (preference) => {
    writeStoredPreference(safeLocalStorage(), preference);
    set({ preference });
  },
  setTextSize: (textSize) => {
    try {
      safeLocalStorage()?.setItem(TEXT_SIZE_STORAGE_KEY, textSize);
    } catch {
      // Storage unavailable: the size still applies for this session.
    }
    set({ textSize });
  },
}));
