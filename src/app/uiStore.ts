import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// UI-only state (PROJECT_RULES: Zustand for UI state; server data lives in the Query cache).
interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** Calendar Day/Week: the "To schedule" list of Inbox tasks (time-blocking). */
  toScheduleOpen: boolean;
  toggleToSchedule: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toScheduleOpen: false,
      toggleToSchedule: () => set((state) => ({ toScheduleOpen: !state.toScheduleOpen })),
    }),
    { name: "kairos.ui", storage: createJSONStorage(() => localStorage) },
  ),
);
