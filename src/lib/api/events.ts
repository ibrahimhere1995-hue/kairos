import { isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Must match `ITEMS_CHANGED` in src-tauri/src/commands/mod.rs. */
export const ITEMS_CHANGED = "items:changed";

/** Calls `onChange` whenever any window changes items (e.g. Quick Capture adds one). */
export async function onItemsChanged(onChange: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen(ITEMS_CHANGED, onChange);
}
