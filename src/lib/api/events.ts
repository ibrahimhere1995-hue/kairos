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

/** Must match `AREAS_CHANGED` in src-tauri/src/commands/areas.rs. */
export const AREAS_CHANGED = "areas:changed";

/** Calls `onChange` whenever any window changes life areas. */
export async function onAreasChanged(onChange: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen(AREAS_CHANGED, onChange);
}

/** Calls `onReload` after a backup has been restored: every piece of data may have changed. */
export async function onDataReloaded(onReload: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen(DATA_RELOADED, onReload);
}

/** Must match `OPEN_ITEM` / `NAVIGATE` in src-tauri/src/notify.rs (notification and tray clicks). */
export const OPEN_ITEM = "app:open-item";
export const NAVIGATE = "app:navigate";

/** A notification or the tray asked to open an item's editor. */
export async function onOpenItem(open: (itemId: string) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<string>(OPEN_ITEM, (event) => open(event.payload));
}

/** A notification asked to go to a screen (a route path such as "/"). */
export async function onNavigate(go: (path: string) => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<string>(NAVIGATE, (event) => go(event.payload));
}
