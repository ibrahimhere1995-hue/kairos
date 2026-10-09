import { invoke } from "@tauri-apps/api/core";
import type { FocusSession } from "@/types/FocusSession";
import type { FocusTotal } from "@/types/FocusTotal";

/** Typed wrappers for src-tauri/src/commands/focus.rs. */
export const focusApi = {
  /** Full screen + notifications held while on (PRD R16). */
  setMode: (active: boolean) => invoke<null>("set_focus_mode", { active }),
  start: (itemId: string | null, plannedMinutes: number) =>
    invoke<FocusSession>("start_focus", { itemId, plannedMinutes }),
  stop: (id: string) => invoke<null>("stop_focus", { id }),
  totals: (start: string, end: string) => invoke<FocusTotal[]>("focus_totals", { start, end }),
};
