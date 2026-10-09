import { create } from "zustand";

interface FeedbackDialogState {
  open: boolean;
  /** The screen the user was on (already translated), offered as context. */
  screen: string | null;
  openSuggest: (screen?: string | null) => void;
  close: () => void;
}

/** The "Suggest a feature" dialog (UI state only). */
export const useFeedbackStore = create<FeedbackDialogState>((set) => ({
  open: false,
  screen: null,
  openSuggest: (screen = null) => set({ open: true, screen }),
  close: () => set({ open: false }),
}));
