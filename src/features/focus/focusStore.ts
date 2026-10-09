import { create } from "zustand";
import type { Item } from "@/types/Item";
import { POMODORO, type FocusPlan } from "@/features/focus/timer";

/** The task being focused on. */
export type FocusTask = Item;

/** A work stretch or a break. `endsAt` null = paused, or waiting to start the next stretch. */
export interface FocusRun {
  phase: "work" | "break";
  phaseMs: number;
  leftMs: number;
  endsAt: number | null;
  /** The logged session while work is running. */
  sessionId: string | null;
}

interface FocusState {
  open: boolean;
  task: FocusTask | null;
  plan: FocusPlan;
  /** null = still choosing the task and the timer. */
  run: FocusRun | null;
  openFocus: (task?: FocusTask) => void;
  setTask: (task: FocusTask | null) => void;
  setPlan: (plan: FocusPlan) => void;
  setRun: (run: FocusRun | null) => void;
  close: () => void;
}

/** Focus mode (PRD R16), UI state only; the log lives in the database. */
export const useFocusStore = create<FocusState>((set) => ({
  open: false,
  task: null,
  plan: POMODORO,
  run: null,
  openFocus: (task) => set({ open: true, task: task ?? null, run: null }),
  setTask: (task) => set({ task }),
  setPlan: (plan) => set({ plan }),
  setRun: (run) => set({ run }),
  close: () => set({ open: false, run: null }),
}));
