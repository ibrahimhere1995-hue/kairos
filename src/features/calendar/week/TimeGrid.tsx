import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { localMidnight } from "@/features/calendar/calendarView";
import { allDayItems, layoutDay } from "@/features/calendar/layout";
import { AllDayCell } from "@/features/calendar/week/AllDayCell";
import { DayColumn } from "@/features/calendar/week/DayColumn";
import { pxPerMinute } from "@/features/calendar/week/gridMetrics";
import type { DragData } from "@/features/calendar/week/dragData";
import { HourGutter } from "@/features/calendar/week/HourGutter";
import { ToSchedulePanel } from "@/features/calendar/week/ToSchedulePanel";
import { UnscheduledDragPreview } from "@/features/calendar/week/UnscheduledDragPreview";
import { useCalendarDnd } from "@/features/calendar/week/useCalendarDnd";
import type { DayContext } from "@/lib/dates/dayContext";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/**
 * Day and Week views: day headers, all-day row and the scrolling hour grid, plus the optional
 * "To schedule" list of Inbox tasks to drag onto it (time-blocking).
 */
export function TimeGrid({
  days,
  items,
  areas,
  ctx,
  toSchedule = null,
}: {
  days: string[];
  items: Item[];
  areas: Map<string, Area>;
  ctx: DayContext;
  /** Inbox tasks for the "To schedule" list; null hides the list. */
  toSchedule?: { items: Item[]; loading: boolean } | null;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemsById = useMemo(
    () => new Map([...items, ...(toSchedule?.items ?? [])].map((i) => [i.id, i])),
    [items, toSchedule?.items],
  );
  const { sensors, onDragEnd, accessibility } = useCalendarDnd(itemsById);
  // The Inbox task being dragged: drawn in a DragOverlay so it can leave the list's box.
  const [dragging, setDragging] = useState<Item | null>(null);

  const columns = useMemo(
    () =>
      days.map((date) => {
        const dayStart = localMidnight(date);
        return { date, dayStart, positioned: layoutDay(items, dayStart, addDays(dayStart, 1)) };
      }),
    [days, items],
  );

  // Open scrolled to an hour before now (or 7 AM), not midnight.
  useEffect(() => {
    const hour = days.includes(ctx.today) ? Math.max(0, ctx.now.getHours() - 1) : 7;
    if (scrollRef.current) scrollRef.current.scrollTop = hour * 60 * pxPerMinute();
    // Only when the visible days change, not every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join()]);

  return (
    <DndContext
      sensors={sensors}
      accessibility={accessibility}
      onDragStart={({ active }) => {
        const drag = active.data.current as DragData | undefined;
        setDragging(drag?.kind === "unscheduled" ? (itemsById.get(drag.itemId) ?? null) : null);
      }}
      onDragCancel={() => setDragging(null)}
      onDragEnd={(event) => {
        setDragging(null);
        onDragEnd(event);
      }}
    >
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex border-b border-border pr-3">
            <div className="w-16 shrink-0" />
            {days.map((date) => {
              const d = localMidnight(date);
              const isToday = date === ctx.today;
              return (
                <div
                  key={date}
                  className="flex min-w-0 flex-1 flex-col items-center border-l border-border py-2"
                >
                  <span className="text-caption text-text-muted uppercase">{format(d, "EEE")}</span>
                  <span
                    aria-current={isToday ? "date" : undefined}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-h3 tabular-nums",
                      isToday && "bg-accent text-on-accent",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex border-b border-border pr-3">
            <div className="flex w-16 shrink-0 items-center justify-end pr-2 text-caption text-text-muted">
              {t("calendar.allDay")}
            </div>
            {days.map((date) => (
              <AllDayCell key={date} date={date} items={allDayItems(items, date)} areas={areas} />
            ))}
          </div>

          {/* Focusable so keyboard users can scroll the hours even on an empty day. */}
          <div
            ref={scrollRef}
            tabIndex={0}
            role="region"
            aria-label={t("calendar.hourGrid")}
            className="min-h-0 flex-1 overflow-y-scroll"
          >
            <div className="flex">
              <HourGutter />
              {columns.map(({ date, dayStart, positioned }) => (
                <div key={date} data-day-column className="flex min-w-0 flex-1">
                  <DayColumn
                    date={date}
                    dayStart={dayStart}
                    positioned={positioned}
                    areas={areas}
                    ctx={ctx}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        {toSchedule && (
          <ToSchedulePanel items={toSchedule.items} areas={areas} loading={toSchedule.loading} />
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <UnscheduledDragPreview
            item={dragging}
            area={dragging.areaId ? areas.get(dragging.areaId) : undefined}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
