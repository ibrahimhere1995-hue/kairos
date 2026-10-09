import { create } from "zustand";
import type { ItemFormValues } from "@/features/items/itemForm";

interface EditorState {
  open: boolean;
  /** null = creating a new item. */
  itemId: string | null;
  /** Starting values for a new item (e.g. the time range dragged on the calendar). */
  prefill: Partial<ItemFormValues> | null;
  /** Put the focus on the steps ("Break it into smaller steps", PRD R6). */
  focusSteps: boolean;
  openNew: (prefill?: Partial<ItemFormValues>) => void;
  openItem: (id: string, options?: { focusSteps?: boolean }) => void;
  close: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  open: false,
  itemId: null,
  prefill: null,
  focusSteps: false,
  openNew: (prefill) =>
    set({ open: true, itemId: null, prefill: prefill ?? null, focusSteps: false }),
  openItem: (id, options) =>
    set({ open: true, itemId: id, prefill: null, focusSteps: options?.focusSteps ?? false }),
  close: () => set({ open: false, prefill: null, focusSteps: false }),
}));
