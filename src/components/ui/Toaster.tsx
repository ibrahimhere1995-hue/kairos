import * as Toast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UNDO_MS, useToastStore } from "@/lib/toastStore";

/** Bottom-right toasts with an optional action (Undo) and a hairline showing time left. */
export function Toaster() {
  const { t } = useTranslation();
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <Toast.Provider duration={UNDO_MS} swipeDirection="right" label={t("common.notifications")}>
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          onOpenChange={(open) => !open && dismiss(toast.id)}
          className="toast-in relative flex items-center gap-3 overflow-hidden rounded-md border border-border bg-surface px-4 py-3 text-text shadow-lg"
        >
          <Toast.Title className="min-w-0 flex-1 text-body">{toast.message}</Toast.Title>
          {toast.actionLabel && toast.onAction && (
            <Toast.Action
              altText={toast.actionLabel}
              onClick={toast.onAction}
              className="h-9 rounded-md px-3 font-semibold text-accent-text hover:bg-surface-3"
            >
              {toast.actionLabel}
            </Toast.Action>
          )}
          <Toast.Close
            aria-label={t("common.close")}
            className="flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-3"
          >
            <X aria-hidden="true" className="size-4" />
          </Toast.Close>
          <span
            aria-hidden="true"
            className="toast-timer absolute bottom-0 left-0 h-0.5 w-full origin-left bg-accent"
            style={{ animationDuration: `${UNDO_MS}ms` }}
          />
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed right-4 bottom-4 z-[60] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
    </Toast.Provider>
  );
}
