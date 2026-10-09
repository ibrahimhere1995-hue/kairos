import { invoke } from "@tauri-apps/api/core";
import type { ImportSummary } from "@/types/ImportSummary";

/** Typed wrappers for src-tauri/src/commands/data.rs (Settings › Your data). */
export const dataApi = {
  exportJson: (path: string) => invoke<null>("export_json", { path }),
  exportIcs: (path: string) => invoke<number>("export_ics", { path }),
  importIcs: (path: string) => invoke<ImportSummary>("import_ics", { path }),
};
