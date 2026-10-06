import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * The main window starts hidden (tauri.conf.json) and is shown after the first themed paint,
 * so the user never sees a blank or wrong-coloured frame. Rust shows it anyway after 3 s as a fallback.
 */
export async function showMainWindow(): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().show();
}
