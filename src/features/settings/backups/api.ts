import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backupsApi } from "@/lib/api/backups";
import type { BackupLocation } from "@/types/BackupLocation";

export const backupKeys = {
  list: ["backups", "list"] as const,
  settings: ["backups", "settings"] as const,
};

export function useBackups() {
  return useQuery({ queryKey: backupKeys.list, queryFn: backupsApi.list });
}

export function useBackupSettings() {
  return useQuery({ queryKey: backupKeys.settings, queryFn: backupsApi.settings });
}

const refreshBackups = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ["backups"] });

export function useBackupNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: backupsApi.backupNow,
    onSettled: () => refreshBackups(queryClient),
  });
}

export function useSetBackupFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (folder: string | null) => backupsApi.setFolder(folder),
    onSettled: () => refreshBackups(queryClient),
  });
}

/** Restoring changes everything, so every query is refreshed afterwards. */
export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ location, fileName }: { location: BackupLocation; fileName: string }) =>
      backupsApi.restore(location, fileName),
    onSettled: () => queryClient.invalidateQueries(),
  });
}
