import { Download, Lightbulb, Mail, Plus, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFeedback } from "@/features/feedback/api";
import { FeedbackCard } from "@/features/feedback/FeedbackCard";
import { useFeedbackStore } from "@/features/feedback/feedbackStore";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { toErrorPayload } from "@/lib/api/errors";
import { feedbackApi, type FeedbackStatus } from "@/lib/api/feedback";
import { pickSavePath } from "@/lib/api/files";
import { useToastStore } from "@/lib/toastStore";

const COLUMNS: FeedbackStatus[] = ["open", "planned", "done"];

/** PRD R19: the personal wishlist board, kept locally; sent only when the user chooses. */
export function WishlistPage() {
  const { t } = useTranslation();
  const entries = useFeedback();
  const openSuggest = useFeedbackStore((s) => s.openSuggest);
  const showToast = useToastStore((s) => s.show);
  const fail = (err: unknown) => showToast({ message: t(toErrorPayload(err).message) });

  const exportFile = async () => {
    const path = await pickSavePath(t("feedback.exportDialog"), "kairos-wishlist.txt", "txt");
    if (!path) return;
    await feedbackApi
      .exportTo(path)
      .then(() => showToast({ message: t("feedback.exported") }))
      .catch(fail);
  };

  let body;
  if (entries.isPending) {
    body = (
      <div aria-busy="true" className="grid gap-4 md:grid-cols-3">
        <div className="skeleton h-24 rounded-md" />
        <div className="skeleton h-24 rounded-md" />
        <div className="skeleton h-24 rounded-md" />
      </div>
    );
  } else if (entries.isError) {
    body = (
      <EmptyState
        icon={RotateCcw}
        message={t("errors.database")}
        action={<Button onClick={() => void entries.refetch()}>{t("common.tryAgain")}</Button>}
      />
    );
  } else if (entries.data.length === 0) {
    body = <EmptyState icon={Lightbulb} message={t("feedback.empty")} />;
  } else {
    body = (
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((status) => {
          const inColumn = entries.data.filter((e) => e.status === status);
          return (
            <section
              key={status}
              aria-labelledby={`wish-${status}`}
              className="flex flex-col gap-2"
            >
              <h2 id={`wish-${status}`} className="text-h3">
                {t(`feedback.statuses.${status}`)}{" "}
                <span className="text-text-muted">({inColumn.length})</span>
              </h2>
              {inColumn.length === 0 ? (
                <p className="text-small text-text-muted">{t("feedback.columnEmpty")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {inColumn.map((entry) => (
                    <FeedbackCard key={entry.id} entry={entry} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1">{t("nav.wishlist")}</h1>
        <p className="text-text-muted">{t("feedback.intro")}</p>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => openSuggest(null)}>
          <Plus aria-hidden="true" />
          {t("feedback.suggest")}
        </Button>
        <Button variant="secondary" onClick={() => void exportFile()}>
          <Download aria-hidden="true" />
          {t("feedback.export")}
        </Button>
        <Button variant="secondary" onClick={() => void feedbackApi.email().catch(fail)}>
          <Mail aria-hidden="true" />
          {t("feedback.email")}
        </Button>
      </div>
      <p className="text-small text-text-muted">{t("feedback.emailNote")}</p>
      {body}
    </div>
  );
}
