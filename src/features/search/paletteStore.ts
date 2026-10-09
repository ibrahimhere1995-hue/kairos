import { create } from "zustand";

interface PaletteState {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
}

/** The Ctrl/⌘+K search and command palette (P2-T09). */
export const usePaletteStore = create<PaletteState>((set) => ({
  open: false,
  openPalette: () => set({ open: true }),
  closePalette: () => set({ open: false }),
}));
