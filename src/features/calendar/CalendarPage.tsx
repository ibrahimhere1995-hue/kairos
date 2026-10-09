import { useCallback, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Inbox, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { AgendaView } from "@/features/calendar/agenda/AgendaView";
import { CalendarToolbar } from "@/features/calendar/CalendarToolbar";
import {
  rangeForDays,
  stepAnchor,
  viewTitle,
  visibleDays,
  type CalendarView,
} from "@/features/calendar/calendarView";
import { MonthView } from "@/features/calendar/month/MonthView";
import { useTodayShortcut } from "@/features/calendar/useTodayShortcut";
import { TimeGrid } from "@/features/calendar/week/TimeGrid";
import { useNow } from "@/features/dashboard/useNow";
import { useAreas, useItemsInRange, useUnscheduledItems } from "@/features/items/api";
import { useUiStore } from "@/app/uiStore";
import { useWeekStartsOn } from "@/features/settings/api";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { getDayContext } from "@/lib/dates/dayContext";

/** Day · Week · Month · Agenda (PRD R1). View and date live in the URL search params. */
export function CalendarPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/calendar" });
  const navigate = useNavigate({ from: "/calendar" });
  const now = useNow();
  const ctx = useMemo(() => getDayContext(now), [now]);

  const view: CalendarView = search.view ?? "week";
  const anchor = search.date ?? ctx.today;
  const weekStartsOn = useWeekStartsOn();
  const days = useMemo(() => visibleDays(view, anchor, weekStartsOn), [view, anchor, weekStartsOn]);
  const range = useMemo(() => rangeForDays(days), [days]);
  const items = useItemsInRange(range);
  const { data: areaList = [] } = useAreas();
  const areas = useMemo(() => new Map(areaList.map((a) => [a.id, a])), [areaList]);

  const go = useCallback(
    (next: { view?: CalendarView; date?: string }) =>
      void navigate({ search: (prev) => ({ ...prev, ...next }) }),
    [navigate],
  );
  const goToToday = useCallback(() => go({ date: ctx.today }), [go, ctx.today]);
  useTodayShortcut(goToToday);

  const grid = useMemo(() => items.data ?? [], [items.data]);
  const hasGrid = view === "day" || view === "week";
  const { toScheduleOpen, toggleToSchedule } = useUiStore();
  const unscheduled = useUnscheduledItems();
  const toSchedule =
    hasGrid && toScheduleOpen
      ? { items: unscheduled.data ?? [], loading: unscheduled.isPending }
      : null;

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[32rem] flex-col gap-4">
      <CalendarToolbar
        title={viewTitle(view, anchor, days)}
        view={view}
        onViewChange={(v) => go({ view: v })}
        onStep={(direction) => go({ date: stepAnchor(view, anchor, direction) })}
        onToday={goToToday}
        extra={
          hasGrid && (
            <Button variant="secondary" aria-pressed={toScheduleOpen} onClick={toggleToSchedule}>
              <Inbox aria-hidden="true" />
              {t("calendar.toSchedule")}
              {unscheduled.data && unscheduled.data.length > 0 && (
                <span className="text-small font-normal text-text-muted">
                  {unscheduled.data.length}
                </span>
              )}
            </Button>
          )
        }
      />

      {items.isError ? (
        <EmptyState
          icon={RotateCcw}
          message={t("errors.database")}
          action={<Button onClick={() => void items.refetch()}>{t("common.tryAgain")}</Button>}
        />
      ) : (
        <motion.div
          key={`${view}-${anchor}`}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          aria-busy={items.isPending}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {hasGrid && (
            <TimeGrid days={days} items={grid} areas={areas} ctx={ctx} toSchedule={toSchedule} />
          )}
          {view === "month" && (
            <MonthView
              days={days}
              anchor={anchor}
              items={grid}
              areas={areas}
              ctx={ctx}
              onOpenDay={(date) => go({ view: "day", date })}
            />
          )}
          {view === "agenda" && items.isPending && (
            <div className="flex flex-col gap-3">
              <div className="skeleton h-6 w-40 rounded-sm" />
              <div className="skeleton h-14 rounded-md" />
              <div className="skeleton h-14 rounded-md" />
            </div>
          )}
          {view === "agenda" && !items.isPending && (
            <AgendaView days={days} items={grid} areas={areas} ctx={ctx} />
          )}
        </motion.div>
      )}
    </div>
  );
}
