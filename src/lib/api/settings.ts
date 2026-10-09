import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/types/AppSettings";

/** Typed wrappers for src-tauri/src/commands/settings.rs. */
export const settingsApi = {
  get: () => invoke<AppSettings>("get_settings"),
  update: (settings: AppSettings) => invoke<AppSettings>("update_settings", { settings }),
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  textSize: "default",
  weekStartsOn: "monday",
  defaultReminderTime: "09:00",
  dailySummaryEnabled: true,
  dailySummaryTime: "08:00",
  launchAtLogin: true,
};
