import { FolderOpen, FolderX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSetBackupFolder } from "@/features/settings/backups/api";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { pickFolder } from "@/lib/api/backups";
import { toErrorPayload } from "@/lib/api/errors";

/** PRD R5: an extra folder (OneDrive, Dropbox, USB drive…) that gets a copy of every backup. */
export function BackupFolderCard({ folder }: { folder: string | null }) {
  const { t } = useTranslation();
  const setFolder = useSetBackupFolder();
  const error = setFolder.error ? toErrorPayload(setFolder.error).message : null;

  const choose = async () => {
    const chosen = await pickFolder(t("backups.folder.pickerTitle"));
    if (chosen) setFolder.mutate(chosen);
  };

  return (
    <section
      aria-labelledby="backup-folder-heading"
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <h3 id="backup-folder-heading" className="text-h3">
          {t("backups.folder.title")}
        </h3>
        <p className="text-small text-text-muted">{t("backups.folder.intro")}</p>
      </div>
      <p className="text-body break-all">
        {folder ?? <span className="text-text-muted">{t("backups.folder.notSet")}</span>}
      </p>
      {error && <FieldError message={t(error)} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={setFolder.isPending} onClick={() => void choose()}>
          <FolderOpen aria-hidden="true" />
          {t(folder ? "backups.folder.change" : "backups.folder.choose")}
        </Button>
        {folder && (
          <Button
            variant="ghost"
            disabled={setFolder.isPending}
            onClick={() => setFolder.mutate(null)}
          >
            <FolderX aria-hidden="true" />
            {t("backups.folder.stop")}
          </Button>
        )}
      </div>
    </section>
  );
}
