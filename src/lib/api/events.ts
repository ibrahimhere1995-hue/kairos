import { isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Must match `ITEMS_CHANGED` in src-tauri/src/commands/mod.rs. */
export const ITEMS_CHANGED = "items:changed";
/** Must match `DATA_RELOADED` in src-tauri/src/commands/backups.rs (sent after a restore). */
export const DATA_RELOADED = "data:reloaded";

/** Calls `onChange` whenever any window changes items (e.g. Quick Capture adds one). */
export async function onItemsChanged(onChange: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen(ITEMS_CHANGED, onChange);
}

/** Calls `onReload` after a backup has been restored: every piece of data may have changed. */
export async function onDataReloaded(onReload: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen(DATA_RELOADED, onReload);
}
