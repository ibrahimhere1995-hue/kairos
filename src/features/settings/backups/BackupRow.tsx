import { Archive, HardDrive, RotateCcw, ShieldCheck, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { formatBytes, formatWhen } from "@/lib/format";
import type { BackupInfo } from "@/types/BackupInfo";
import type { BackupKind } from "@/types/BackupKind";

const KIND_ICON: Record<BackupKind, LucideIcon> = {
  automatic: Archive,
  manual: HardDrive,
  safety: ShieldCheck,
};

/** One backup: when, what kind, where, size, item count, and Restore. */
export function BackupRow({
  backup,
  now,
  onRestore,
}: {
  backup: BackupInfo;
  now: Date;
  onRestore: (backup: BackupInfo) => void;
}) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[backup.kind];
  const when = formatWhen(backup.createdAt, now, t);
  const readable = backup.itemCount !== null;

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-2">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body">{when}</span>
        <span className="truncate text-small text-text-muted">
          {[
            t(`backups.kind.${backup.kind}`),
            t(`backups.location.${backup.location}`),
            formatBytes(backup.sizeBytes, t),
            readable
              ? t("backups.items", { count: backup.itemCount ?? 0 })
              : t("backups.unreadable"),
          ].join(" · ")}
        </span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={!readable}
        onClick={() => onRestore(backup)}
        aria-label={t("backups.restoreFrom", { when })}
      >
        <RotateCcw aria-hidden="true" />
        {t("backups.restore")}
      </Button>
    </li>
  );
}
