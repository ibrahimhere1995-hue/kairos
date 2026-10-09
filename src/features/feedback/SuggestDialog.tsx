import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { useFeedbackStore } from "@/features/feedback/feedbackStore";
import { SuggestForm } from "@/features/feedback/SuggestForm";

/** PRD R19: "Suggest a feature", from anywhere. Saved locally to the wishlist. */
export function SuggestDialog() {
  const { t } = useTranslation();
  const open = useFeedbackStore((s) => s.open);
  const screen = useFeedbackStore((s) => s.screen);
  const close = useFeedbackStore((s) => s.close);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-text/20" />
        <Dialog.Content className="capture-in fixed top-1/2 left-1/2 z-50 flex w-[32rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-surface p-6 text-text shadow-lg">
          <Dialog.Title className="text-h2">{t("feedback.dialogTitle")}</Dialog.Title>
          <Dialog.Description className="text-body text-text-muted">
            {t("feedback.dialogIntro")}
          </Dialog.Description>
          {/* Mounted only while open, so each suggestion starts empty. */}
          {open && <SuggestForm screen={screen} onDone={close} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
