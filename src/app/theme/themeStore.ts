import { create } from "zustand";
import {
  readStoredPreference,
  writeStoredPreference,
  type ThemePreference,
} from "@/app/theme/theme";

// Cached in localStorage for now so the pre-paint script can read it.
// P1-T16 also persists it to the settings table (the source of truth from then on).
interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
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
  setPreference: (preference) => {
    writeStoredPreference(safeLocalStorage(), preference);
    set({ preference });
  },
}));
