import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import type { DaySummary } from "@/features/dashboard/groupDashboard";
import { useAppSettings } from "@/features/settings/api";

function greetingKey(hour: number, named: boolean): string {
  const part = hour < 12 ? "goodMorning" : hour < 18 ? "goodAfternoon" : "goodEvening";
  return `myDay.${part}${named ? "Name" : ""}`;
}

/** "Good morning, Zack." + date + one-line summary (PRD R2). */
export function Greeting({ now, summary }: { now: Date; summary: DaySummary }) {
  const { t } = useTranslation();
  const name = useAppSettings().data?.name.trim() ?? "";
  const parts = [
    summary.tasks > 0 && t("myDay.summaryTasks", { count: summary.tasks }),
    summary.meetings > 0 && t("myDay.summaryMeetings", { count: summary.meetings }),
    summary.slipped > 0 && t("myDay.summarySlipped", { count: summary.slipped }),
  ].filter(Boolean);

  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-display">
        {t(greetingKey(now.getHours(), name !== ""), { name })}
      </h1>
      <p className="text-h3 text-text-muted">{format(now, "EEEE d MMMM")}</p>
      <p className="text-body">
        {parts.length > 0 ? parts.join(", ") + "." : t("myDay.summaryClear")}
      </p>
    </header>
  );
}
