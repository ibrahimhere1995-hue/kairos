import { create } from "zustand";
import type { PlanSpan } from "@/features/ai/plan/planRequest";

interface PlanState {
  open: boolean;
  span: PlanSpan;
  openPlan: (span: PlanSpan) => void;
  close: () => void;
}

/** The "Plan my day / week" dialog (UI state only). */
export const usePlanStore = create<PlanState>((set) => ({
  open: false,
  span: "day",
  openPlan: (span) => set({ open: true, span }),
  close: () => set({ open: false }),
}));
