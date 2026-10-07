import { create } from "zustand";

export interface ToastMessage {
  id: number;
  /** Already-translated text. */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState {
  toasts: ToastMessage[];
  show: (toast: Omit<ToastMessage, "id">) => number;
  dismiss: (id: number) => void;
}

/** How long an Undo stays available (DESIGN_SYSTEM §2.4). */
export const UNDO_MS = 8000;

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = nextId++;
    // Newest last; keep at most three on screen.
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-3) }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
