import { create } from "zustand";
import type { ItemFormValues } from "@/features/items/itemForm";

interface EditorState {
  open: boolean;
  /** null = creating a new item. */
  itemId: string | null;
  /** Starting values for a new item (e.g. the time range dragged on the calendar). */
  prefill: Partial<ItemFormValues> | null;
  openNew: (prefill?: Partial<ItemFormValues>) => void;
  openItem: (id: string) => void;
  close: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  open: false,
  itemId: null,
  prefill: null,
  openNew: (prefill) => set({ open: true, itemId: null, prefill: prefill ?? null }),
  openItem: (id) => set({ open: true, itemId: id, prefill: null }),
  close: () => set({ open: false, prefill: null }),
}));
