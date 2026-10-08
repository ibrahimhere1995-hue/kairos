import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";

/**
 * Asks before an action that cannot be undone (DESIGN_SYSTEM §2.4: confirm only irreversible
 * actions, like emptying the Trash or restoring a backup). Cancel has focus by default.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-text/20" />
        <Dialog.Content
          role="alertdialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
          className="capture-in fixed top-1/2 left-1/2 z-50 flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-surface p-6 text-text shadow-lg"
        >
          <Dialog.Title className="text-h2">{title}</Dialog.Title>
          <Dialog.Description className="text-body text-text-muted">
            {description}
          </Dialog.Description>
          <div className="flex justify-end gap-2">
            <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={destructive ? "destructive" : "primary"}
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
