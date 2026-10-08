import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { BackupInfo } from "@/types/BackupInfo";
import type { BackupLocation } from "@/types/BackupLocation";
import type { BackupSettings } from "@/types/BackupSettings";
import type { Item } from "@/types/Item";
import type { StartupNotice } from "@/types/StartupNotice";

/** Typed wrappers for src-tauri/src/commands/{backups,trash}.rs. */
export const backupsApi = {
  list: () => invoke<BackupInfo[]>("list_backups"),
  backupNow: () => invoke<BackupInfo>("backup_now"),
  restore: (location: BackupLocation, fileName: string) =>
    invoke<null>("restore_backup", { location, fileName }),
  settings: () => invoke<BackupSettings>("get_backup_settings"),
  setFolder: (folder: string | null) => invoke<BackupSettings>("set_backup_folder", { folder }),
  takeStartupNotice: () => invoke<StartupNotice | null>("take_startup_notice"),
};

export const trashApi = {
  list: () => invoke<Item[]>("list_trash"),
  empty: () => invoke<number>("empty_trash"),
};

/** Opens the system "choose folder" window. Resolves to null if the user cancels. */
export async function pickFolder(title: string): Promise<string | null> {
  if (!isTauri()) return null;
  const chosen = await open({ directory: true, multiple: false, title });
  return typeof chosen === "string" ? chosen : null;
}
