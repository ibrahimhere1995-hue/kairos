import { invoke } from "@tauri-apps/api/core";
import type { Area } from "@/types/Area";
import type { AreaInput } from "@/types/AreaInput";

/** Typed wrappers for src-tauri/src/commands/areas.rs. */
export const areasApi = {
  /** Every area, archived ones included (their items still show them). */
  list: () => invoke<Area[]>("list_areas"),
  create: (input: AreaInput) => invoke<Area>("create_area", { input }),
  update: (id: string, input: AreaInput) => invoke<Area>("update_area", { id, input }),
  archive: (id: string, archived: boolean) => invoke<Area>("archive_area", { id, archived }),
  reorder: (ids: string[]) => invoke<Area[]>("reorder_areas", { ids }),
};

/** Must match AREA_COLORS in src-tauri/src/services/areas.rs. */
export const AREA_COLORS = [
  "area.work",
  "area.home",
  "area.personal",
  "area.learning",
  "area.health",
] as const;

const AREA_TOKEN = /^area\.[a-z]+$/;

/**
 * CSS colour for an area's token key (`area.work` → `var(--area-work)`). Unknown keys fall
 * back to a neutral token, so stored data can never inject arbitrary CSS.
 */
export function areaColor(tokenKey: string | null | undefined): string {
  return tokenKey && AREA_TOKEN.test(tokenKey)
    ? `var(--${tokenKey.replace(".", "-")})`
    : "var(--text-subtle)";
}
