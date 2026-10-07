import { invoke } from "@tauri-apps/api/core";
import type { Area } from "@/types/Area";

export const areasApi = {
  list: () => invoke<Area[]>("list_areas"),
};

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
