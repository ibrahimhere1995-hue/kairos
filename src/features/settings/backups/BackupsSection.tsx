import { useState } from "react";
import { Archive, CircleAlert, HardDriveDownload, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNow } from "@/features/dashboard/useNow";
import {
  useBackupNow,
  useBackups,
  useBackupSettings,
  useRestoreBackup,
} from "@/features/settings/backups/api";
import { BackupFolderCard } from "@/features/settings/backups/BackupFolderCard";
import { BackupRow } from "@/features/settings/backups/BackupRow";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toErrorPayload } from "@/lib/api/errors";
import { formatWhen } from "@/lib/format";
import { useToastStore } from "@/lib/toastStore";
import type { BackupInfo } from "@/types/BackupInfo";

/** Settings › Backups (P1-T14): status, Back up now, extra folder, and Restore. */
export function BackupsSection() {
  const { t } = useTranslation();
  const now = useNow();
  const backups = useBackups();
  const settings = useBackupSettings();
  const backupNow = useBackupNow();
  const restore = useRestoreBackup();
  const showToast = useToastStore((state) => state.show);
  const [restoring, setRestoring] = useState<BackupInfo | null>(null);

  const last = settings.data?.lastBackupAt;
  const failed = settings.data?.lastFailureAt;

  const runBackup = () =>
    backupNow.mutate(undefined, {
      onSuccess: () => showToast({ message: t("backups.saved") }),
      onError: (e) => showToast({ message: t(toErrorPayload(e).message) }),
    });

  const confirmRestore = () => {
    if (!restoring) return;
    const when = formatWhen(restoring.createdAt, now, t);
    restore.mutate(
      { location: restoring.location, fileName: restoring.fileName },
      {
        onSuccess: () => showToast({ message: t("backups.restored", { when }) }),
        onError: (e) => showToast({ message: t(toErrorPayload(e).message) }),
        onSettled: () => setRestoring(null),
      },
    );
  };

  return (
    <section aria-labelledby="backups-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="backups-heading" className="text-h2">
            {t("backups.title")}
          </h2>
          <p className="text-text-muted">
            {last
              ? t("backups.lastBackup", { when: formatWhen(last, now, t) })
              : t("backups.never")}
          </p>
        </div>
        <Button onClick={runBackup} disabled={backupNow.isPending}>
          <HardDriveDownload aria-hidden="true" />
          {t("backups.now")}
        </Button>
      </div>

      {failed && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-border-strong bg-surface-2 p-3 text-body"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
          {t("backups.failed", { when: formatWhen(failed, now, t) })}
        </p>
      )}

      <BackupFolderCard folder={settings.data?.folder ?? null} />

      <h3 className="text-h3">{t("backups.listTitle")}</h3>
      {backups.isPending && (
        <div className="flex flex-col gap-2" aria-busy="true">
          <div className="skeleton h-14 rounded-md" />
          <div className="skeleton h-14 rounded-md" />
        </div>
      )}
      {backups.isError && (
        <EmptyState
          icon={RotateCcw}
          message={t("errors.file")}
          action={<Button onClick={() => void backups.refetch()}>{t("common.tryAgain")}</Button>}
        />
      )}
      {backups.isSuccess && backups.data.length === 0 && (
        <EmptyState icon={Archive} message={t("backups.empty")} />
      )}
      {backups.isSuccess && backups.data.length > 0 && (
        <ul aria-label={t("backups.listTitle")} className="flex flex-col gap-2">
          {backups.data.map((b) => (
            <BackupRow
              key={`${b.location}-${b.fileName}`}
              backup={b}
              now={now}
              onRestore={setRestoring}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={restoring !== null}
        title={t("backups.confirmTitle")}
        description={t("backups.confirmBody", {
          when: restoring ? formatWhen(restoring.createdAt, now, t) : "",
        })}
        confirmLabel={t("backups.restore")}
        pending={restore.isPending}
        onCancel={() => setRestoring(null)}
        onConfirm={confirmRestore}
      />
    </section>
  );
}
