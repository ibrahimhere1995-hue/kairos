import { useState } from "react";
import { addDays } from "date-fns";
import { CalendarCheck, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localMidnight } from "@/features/calendar/calendarView";
import { itemsOnDay } from "@/features/calendar/layout";
import { friendlyDate } from "@/features/items/editor/friendlyDate";
import { useEditorStore } from "@/features/items/editorStore";
import { ItemRow } from "@/features/items/ItemRow";
import { EmptyState } from "@/components/EmptyState";
import { ShowMoreButton } from "@/components/ShowMoreButton";
import { Button } from "@/components/ui/Button";
import type { DayContext } from "@/lib/dates/dayContext";
import { getItemStatus } from "@/lib/status/status";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

const ROWS_STEP = 200;

/** Agenda: the coming days as a list, grouped by day. Days with nothing are skipped. */
export function AgendaView({
  days,
  items,
  areas,
  ctx,
}: {
  days: string[];
  items: Item[];
  areas: Map<string, Area>;
  ctx: DayContext;
}) {
  const { t } = useTranslation();
  const openNew = useEditorStore((state) => state.openNew);
  const [rows, setRows] = useState(ROWS_STEP);
  const groups = days
    .map((date) => {
      const dayStart = localMidnight(date);
      return { date, items: itemsOnDay(items, date, dayStart, addDays(dayStart, 1)) };
    })
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        message={t("calendar.agendaEmpty")}
        action={
          <Button size="lg" onClick={() => openNew()}>
            <Plus aria-hidden="true" />
            {t("topbar.addTask")}
          </Button>
        }
      />
    );
  }

  // Whole days, until about `rows` rows are on screen (PROJECT_RULES: long lists stay light).
  const visible: typeof groups = [];
  let shownRows = 0;
  for (const group of groups) {
    if (shownRows >= rows) break;
    visible.push(group);
    shownRows += group.items.length;
  }

  return (
    <div className="flex flex-col gap-6">
      {visible.map(({ date, items: dayItems }) => (
        <section key={date} aria-labelledby={`agenda-${date}`} className="flex flex-col gap-2">
          <h2 id={`agenda-${date}`} className="text-h2">
            {friendlyDate(date, ctx.today, t)}
          </h2>
          <ul className="flex flex-col gap-2">
            {dayItems.map((item) => (
              <ItemRow
                key={`${date}-${item.id}`}
                item={item}
                status={getItemStatus(item, ctx)}
                area={item.areaId ? areas.get(item.areaId) : undefined}
                today={ctx.today}
              />
            ))}
          </ul>
        </section>
      ))}
      <ShowMoreButton
        hidden={groups.length - visible.length}
        label={t("calendar.agendaMore")}
        onMore={() => setRows((n) => n + ROWS_STEP)}
      />
    </div>
  );
}
