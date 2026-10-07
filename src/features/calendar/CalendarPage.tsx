import { useCallback, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
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
import { useAreas, useItemsInRange } from "@/features/items/api";
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
  const days = useMemo(() => visibleDays(view, anchor), [view, anchor]);
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

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[32rem] flex-col gap-4">
      <CalendarToolbar
        title={viewTitle(view, anchor, days)}
        view={view}
        onViewChange={(v) => go({ view: v })}
        onStep={(direction) => go({ date: stepAnchor(view, anchor, direction) })}
        onToday={goToToday}
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
          {(view === "day" || view === "week") && (
            <TimeGrid days={days} items={grid} areas={areas} ctx={ctx} />
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
          {view === "agenda" && !items.isPending && (
            <AgendaView days={days} items={grid} areas={areas} ctx={ctx} />
          )}
        </motion.div>
      )}
    </div>
  );
}
