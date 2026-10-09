import { useNavigate } from "@tanstack/react-router";
import { NotebookPen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { weekdayOf } from "@/features/review/review";
import { useAppSettings } from "@/features/settings/api";
import { Button } from "@/components/ui/Button";

/** On the chosen review day (Sunday by default), a calm invitation to look back (PRD R17). */
export function ReviewNudge({ now }: { now: Date }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: settings } = useAppSettings();
  if (!settings || weekdayOf(now) !== settings.reviewDay) return null;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-4">
      <NotebookPen aria-hidden="true" className="size-5 text-accent-text" />
      <p className="flex-1 text-body">{t("review.nudge")}</p>
      <Button variant="secondary" onClick={() => void navigate({ to: "/review" })}>
        {t("review.open")}
      </Button>
    </section>
  );
}
