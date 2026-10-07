import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";

/**
 * Right-side panel (DESIGN_SYSTEM §7 item editor): focus is trapped inside, Esc and the
 * close button call `onRequestClose` so the owner can guard unsaved changes.
 */
export function SidePanel({
  open,
  title,
  onRequestClose,
  children,
}: {
  open: boolean;
  title: string;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onRequestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-text/10" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            // Focus the field marked `data-autofocus` (e.g. the title) instead of Radix's default,
            // which is the first button in the panel: the close button.
            const target = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
              "[data-autofocus]",
            );
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          className="panel-in fixed inset-y-0 right-0 z-50 flex w-full max-w-[30rem] flex-col border-l border-border bg-surface text-text shadow-lg"
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-3">
            <Dialog.Title className="text-h3">{title}</Dialog.Title>
            <IconButton icon={X} label={t("common.close")} onClick={onRequestClose} />
          </header>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
