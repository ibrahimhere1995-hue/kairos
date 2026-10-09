import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UnscheduledChip } from "@/features/calendar/week/UnscheduledChip";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** PRD R12 time-blocking: tasks without a date, ready to be dragged onto the grid. */
export function ToSchedulePanel({
  items,
  areas,
  loading,
}: {
  items: Item[];
  areas: Map<string, Area>;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <aside
      aria-labelledby="to-schedule-heading"
      className="flex w-56 shrink-0 flex-col gap-2 overflow-hidden rounded-lg border border-border bg-surface-2 p-3"
    >
      <h2 id="to-schedule-heading" className="flex items-center gap-2 text-h3">
        <Inbox aria-hidden="true" className="size-4" />
        {t("calendar.toSchedule")}
      </h2>
      <p className="text-small text-text-muted">{t("calendar.toScheduleHelp")}</p>
      {loading ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <div className="skeleton h-8 rounded-sm" />
          <div className="skeleton h-8 rounded-sm" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-small text-text-muted">{t("calendar.toScheduleEmpty")}</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <UnscheduledChip
                item={item}
                area={item.areaId ? areas.get(item.areaId) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
