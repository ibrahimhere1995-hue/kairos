import { addWeeks, startOfWeek } from "date-fns";
import { toLocalDateString, type DayContext } from "@/lib/dates/dayContext";
import type { DashboardQuery } from "@/types/DashboardQuery";
import type { DateRange } from "@/types/DateRange";

/** 1 = Monday. Becomes a user setting in P1-T16 (PRD §9: week start configurable). */
export const DEFAULT_WEEK_STARTS_ON = 1 as const;

/** The current local week `[start, next week's start)`. */
export function currentWeekRange(
  ctx: DayContext,
  weekStartsOn: 0 | 1 = DEFAULT_WEEK_STARTS_ON,
): DateRange {
  const start = startOfWeek(ctx.now, { weekStartsOn });
  const end = addWeeks(start, 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
  };
}

export function buildDashboardQuery(
  ctx: DayContext,
  weekStartsOn: 0 | 1 = DEFAULT_WEEK_STARTS_ON,
): DashboardQuery {
  const week = currentWeekRange(ctx, weekStartsOn);
  return {
    now: ctx.now.toISOString(),
    dayStart: ctx.dayStart.toISOString(),
    dayEnd: ctx.dayEnd.toISOString(),
    today: ctx.today,
    weekEnd: week.end,
    weekEndDate: week.endDate,
  };
}
