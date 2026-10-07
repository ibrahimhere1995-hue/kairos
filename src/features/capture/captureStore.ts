import { create } from "zustand";

interface CaptureState {
  open: boolean;
  openCapture: () => void;
  closeCapture: () => void;
}

/** The in-app Quick Capture dialog behind "+ Add task" (UI state only). */
export const useCaptureStore = create<CaptureState>((set) => ({
  open: false,
  openCapture: () => set({ open: true }),
  closeCapture: () => set({ open: false }),
}));
