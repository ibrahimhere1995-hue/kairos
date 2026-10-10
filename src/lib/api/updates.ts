import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import type { UpdateInfo } from "@/types/UpdateInfo";

/** Sent by src-tauri/src/updates.rs when a background check finds a newer version. */
export const UPDATE_AVAILABLE = "update:available";

/** Typed wrappers for src-tauri/src/commands/updates.rs. */
export const updatesApi = {
  version: () => getVersion(),
  /** `null` = up to date. */
  check: () => invoke<UpdateInfo | null>("check_for_update"),
  /** Downloads, installs and restarts Kairos. */
  install: () => invoke<null>("install_update"),
};
