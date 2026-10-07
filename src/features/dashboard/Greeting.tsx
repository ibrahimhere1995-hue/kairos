import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import type { DaySummary } from "@/features/dashboard/groupDashboard";

function greetingKey(hour: number): string {
  if (hour < 12) return "myDay.goodMorning";
  if (hour < 18) return "myDay.goodAfternoon";
  return "myDay.goodEvening";
}

/** "Good morning." + date + one-line summary (PRD R2). */
export function Greeting({ now, summary }: { now: Date; summary: DaySummary }) {
  const { t } = useTranslation();
  const parts = [
    summary.tasks > 0 && t("myDay.summaryTasks", { count: summary.tasks }),
    summary.meetings > 0 && t("myDay.summaryMeetings", { count: summary.meetings }),
    summary.slipped > 0 && t("myDay.summarySlipped", { count: summary.slipped }),
  ].filter(Boolean);

  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-display">{t(greetingKey(now.getHours()))}</h1>
      <p className="text-h3 text-text-muted">{format(now, "EEEE d MMMM")}</p>
      <p className="text-body">
        {parts.length > 0 ? parts.join(", ") + "." : t("myDay.summaryClear")}
      </p>
    </header>
  );
}
