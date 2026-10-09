import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * The main window starts hidden (tauri.conf.json). Once the first themed frame has painted,
 * Rust shows it (unless Kairos started quietly in the tray at sign-in). Rust also shows it
 * after 3 s as a fallback.
 */
export async function showMainWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("main_window_ready");
}

/** Hides the window this code runs in (the Quick Capture bar after saving or Esc). */
export async function hideCurrentWindow(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().hide();
}
