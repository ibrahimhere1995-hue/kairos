import { addDays, format } from "date-fns";
import { localMidnight } from "@/features/calendar/calendarView";
import { itemsOnDay } from "@/features/calendar/layout";
import { MonthCell } from "@/features/calendar/month/MonthCell";
import type { DayContext } from "@/lib/dates/dayContext";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** Month grid: whole weeks covering the month; days outside it are shaded. */
export function MonthView({
  days,
  anchor,
  items,
  areas,
  ctx,
  onOpenDay,
}: {
  days: string[];
  anchor: string;
  items: Item[];
  areas: Map<string, Area>;
  ctx: DayContext;
  onOpenDay: (date: string) => void;
}) {
  const month = anchor.slice(0, 7);
  return (
    <div className="overflow-hidden rounded-lg border-r border-b border-border bg-surface">
      <div className="grid grid-cols-7" aria-hidden="true">
        {days.slice(0, 7).map((date) => (
          <div
            key={date}
            className="border-t border-l border-border py-1.5 text-center text-caption text-text-muted uppercase"
          >
            {format(localMidnight(date), "EEE")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const dayStart = localMidnight(date);
          return (
            <MonthCell
              key={date}
              date={date}
              items={itemsOnDay(items, date, dayStart, addDays(dayStart, 1))}
              areas={areas}
              inMonth={date.startsWith(month)}
              isToday={date === ctx.today}
              onOpenDay={onOpenDay}
            />
          );
        })}
      </div>
    </div>
  );
}
