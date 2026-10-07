import { create } from "zustand";

interface EditorState {
  open: boolean;
  /** null = creating a new item. */
  itemId: string | null;
  openNew: () => void;
  openItem: (id: string) => void;
  close: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  open: false,
  itemId: null,
  openNew: () => set({ open: true, itemId: null }),
  openItem: (id) => set({ open: true, itemId: id }),
  close: () => set({ open: false }),
}));
