import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFeedbackActions } from "@/features/feedback/api";
import { FeedbackForm } from "@/features/feedback/FeedbackForm";
import { useToastStore } from "@/lib/toastStore";

/** A new wishlist entry, optionally noting which screen the user was on. */
export function SuggestForm({ screen, onDone }: { screen: string | null; onDone: () => void }) {
  const { t } = useTranslation();
  const { create } = useFeedbackActions();
  const showToast = useToastStore((s) => s.show);
  const [withScreen, setWithScreen] = useState(true);

  return (
    <FeedbackForm
      submitLabel={t("feedback.save")}
      onCancel={onDone}
      onSubmit={async (kind, text) => {
        await create.mutateAsync({ kind, text, context: withScreen ? screen : null });
        showToast({ message: t("feedback.saved") });
        onDone();
      }}
      extra={
        screen && (
          <label className="inline-flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={withScreen}
              onChange={(e) => setWithScreen(e.target.checked)}
              className="size-4 accent-accent"
            />
            {t("feedback.includeScreen", { screen })}
          </label>
        )
      }
    />
  );
}
