import { addWeeks, isSameDay, startOfWeek } from "date-fns";
import type { AreaBalance } from "@/features/dashboard/balance";
import { toLocalDateString, type DayContext } from "@/lib/dates/dayContext";
import { getItemStatus } from "@/lib/status/status";
import type { DateRange } from "@/types/DateRange";
import type { FocusTotal } from "@/types/FocusTotal";
import type { Item } from "@/types/Item";
import type { Weekday } from "@/types/Weekday";

export const WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const weekdayOf = (date: Date): Weekday => WEEKDAYS[date.getDay()] ?? "sunday";

/** On the first day of a week the review looks back at the week just finished. */
export function defaultWeekOffset(now: Date, weekStartsOn: 0 | 1): number {
  return isSameDay(startOfWeek(now, { weekStartsOn }), now) ? -1 : 0;
}

/** The local week `offset` weeks from this one, plus its first day (for the heading). */
export function reviewWeek(
  now: Date,
  weekStartsOn: 0 | 1,
  offset: number,
): { first: Date; range: DateRange } {
  const first = addWeeks(startOfWeek(now, { weekStartsOn }), offset);
  const end = addWeeks(first, 1);
  return {
    first,
    range: {
      start: first.toISOString(),
      end: end.toISOString(),
      startDate: toLocalDateString(first),
      endDate: toLocalDateString(end),
    },
  };
}

/** What got done and what slipped among the week's items (status computed as of now). */
export function summarizeWeek(items: Item[], ctx: DayContext): { done: Item[]; slipped: Item[] } {
  const done: Item[] = [];
  const slipped: Item[] = [];
  for (const item of items) {
    const status = getItemStatus(item, ctx);
    if (status === "done") done.push(item);
    else if (status === "missed") slipped.push(item);
  }
  return { done, slipped };
}

export interface AreaTime extends AreaBalance {
  focusedMinutes: number;
}

/** Planned time per area (as on the balance strip) plus the time focused on it. */
export function withFocus(balance: AreaBalance[], totals: FocusTotal[]): AreaTime[] {
  return balance.map((b) => ({
    ...b,
    focusedMinutes: Math.round(
      totals.filter((f) => f.areaId === b.areaId).reduce((sum, f) => sum + f.seconds, 0) / 60,
    ),
  }));
}

export type Insight =
  | { kind: "zero"; area: string }
  | { kind: "most"; area: string; percent: number }
  | { kind: "even" };

/** Gentle observations, never judgements (PRD R17: "Health got 0 hours this week"). */
export function balanceInsights(areas: AreaTime[]): Insight[] {
  const time = (a: AreaTime) => Math.max(a.minutes, a.focusedMinutes);
  const total = areas.reduce((sum, a) => sum + time(a), 0);
  if (total === 0) return [];
  const insights: Insight[] = areas
    .filter((a) => time(a) === 0)
    .map((a) => ({ kind: "zero", area: a.name }));
  const top = areas.reduce((best, a) => (time(a) > time(best) ? a : best));
  const percent = Math.round((time(top) / total) * 100);
  if (areas.length > 1 && percent >= 60) insights.push({ kind: "most", area: top.name, percent });
  if (insights.length === 0) insights.push({ kind: "even" });
  return insights;
}
