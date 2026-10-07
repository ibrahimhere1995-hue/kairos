import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { useCaptureStore } from "@/features/capture/captureStore";
import { captureToForm } from "@/features/capture/captureToForm";
import { QuickCapture } from "@/features/capture/QuickCapture";
import { useEditorStore } from "@/features/items/editorStore";
import { getDayContext } from "@/lib/dates/dayContext";

/** In-app Quick Capture behind "+ Add task": a floating bar near the top of the window. */
export function QuickCaptureDialog() {
  const { t } = useTranslation();
  const { open, closeCapture } = useCaptureStore();
  const openNew = useEditorStore((state) => state.openNew);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && closeCapture()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-text/10 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            const input = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
              "[data-autofocus]",
            );
            if (input) {
              event.preventDefault();
              input.focus();
            }
          }}
          className="capture-in fixed top-[15vh] left-1/2 z-50 flex w-[35rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-text shadow-lg"
        >
          <Dialog.Title className="sr-only">{t("capture.title")}</Dialog.Title>
          <QuickCapture
            onSaved={closeCapture}
            onCancel={closeCapture}
            onMoreDetails={(parsed) => {
              closeCapture();
              openNew(captureToForm(parsed, getDayContext().today));
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
