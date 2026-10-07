import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// UI-only state (PROJECT_RULES: Zustand for UI state; server data lives in the Query cache).
interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: "kairos.ui", storage: createJSONStorage(() => localStorage) },
  ),
);
