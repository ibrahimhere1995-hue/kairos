import { FileText, FolderOpen, Paperclip, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAttachmentActions, useAttachments } from "@/features/items/attachmentsApi";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { IconButton } from "@/components/ui/IconButton";
import { toErrorPayload } from "@/lib/api/errors";
import type { Attachment } from "@/types/Attachment";

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Files on an item (P2-T11): copied into Kairos' own folder, opened with the usual app.
 * Removing takes a file off the item (the copy stays for backups).
 */
export function AttachmentsSection({ itemId }: { itemId: string | null }) {
  const { t } = useTranslation();
  const list = useAttachments(itemId);
  const { add, remove, open, reveal } = useAttachmentActions(itemId);
  const error = add.error ?? remove.error ?? open.error ?? reveal.error;

  return (
    <section aria-labelledby="attachments-heading" className="flex flex-col gap-2">
      <h3 id="attachments-heading" className="text-small text-text-muted">
        {t("editor.attachments")}
      </h3>
      {itemId === null ? (
        <p className="text-small text-text-muted">{t("editor.attachAfterSave")}</p>
      ) : (
        <>
          {list.data && list.data.length === 0 && (
            <p className="text-small text-text-muted">{t("editor.noAttachments")}</p>
          )}
          <ul className="flex flex-col gap-1">
            {list.data?.map((file: Attachment) => (
              <li
                key={file.id}
                className="flex items-center gap-2 rounded-sm bg-surface-2 py-1 pr-1 pl-2"
              >
                <FileText aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
                <button
                  type="button"
                  onClick={() => open.mutate(file.id)}
                  aria-label={t("editor.openFile", { name: file.fileName })}
                  className="min-w-0 flex-1 truncate rounded-sm text-left text-body"
                >
                  {file.fileName}
                </button>
                <span className="shrink-0 text-caption text-text-muted">
                  {size(file.sizeBytes)}
                </span>
                <IconButton
                  icon={FolderOpen}
                  label={t("editor.showFile", { name: file.fileName })}
                  onClick={() => reveal.mutate(file.id)}
                />
                <IconButton
                  icon={X}
                  label={t("editor.removeFile", { name: file.fileName })}
                  onClick={() => remove.mutate(file.id)}
                />
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            disabled={add.isPending}
            onClick={() => add.mutate(t("editor.chooseFiles"))}
          >
            <Paperclip aria-hidden="true" />
            {t("editor.addFiles")}
          </Button>
          {error && <FieldError message={t(toErrorPayload(error).message)} />}
        </>
      )}
    </section>
  );
}
