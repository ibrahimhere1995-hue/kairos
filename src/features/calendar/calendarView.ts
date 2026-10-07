import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { DEFAULT_WEEK_STARTS_ON } from "@/features/dashboard/dashboardQuery";
import { toLocalDateString } from "@/lib/dates/dayContext";
import type { DateRange } from "@/types/DateRange";

export const CALENDAR_VIEWS = ["day", "week", "month", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** Agenda shows this many days from the anchor date. */
export const AGENDA_DAYS = 14;

export interface CalendarSearch {
  view: CalendarView;
  /** Anchor date, local `YYYY-MM-DD`. */
  date: string;
}

/** Validates `/calendar?view=…&date=…`; anything unexpected falls back to this week. */
export function parseCalendarSearch(
  search: Record<string, unknown>,
  today: string,
): CalendarSearch {
  const view = CALENDAR_VIEWS.includes(search.view as CalendarView)
    ? (search.view as CalendarView)
    : "week";
  const raw = typeof search.date === "string" ? search.date : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) && isValid(parseISO(raw)) ? raw : today;
  return { view, date };
}

/** Local midnight of a `YYYY-MM-DD` date. */
export function localMidnight(date: string): Date {
  return parseISO(date);
}

/** The days shown by a view, as local `YYYY-MM-DD` strings. */
export function visibleDays(
  view: CalendarView,
  anchor: string,
  weekStartsOn: 0 | 1 = DEFAULT_WEEK_STARTS_ON,
): string[] {
  const start = localMidnight(anchor);
  let first: Date;
  let count: number;
  switch (view) {
    case "day":
      first = start;
      count = 1;
      break;
    case "week":
      first = startOfWeek(start, { weekStartsOn });
      count = 7;
      break;
    case "month": {
      first = startOfWeek(startOfMonth(start), { weekStartsOn });
      const last = endOfWeek(endOfMonth(start), { weekStartsOn });
      count = differenceInCalendarDays(last, first) + 1;
      break;
    }
    case "agenda":
      first = start;
      count = AGENDA_DAYS;
      break;
  }
  return Array.from({ length: count }, (_, i) => toLocalDateString(addDays(first, i)));
}

/** The range to fetch for the visible days (range-bounded; never "load all items"). */
export function rangeForDays(days: string[]): DateRange {
  const first = days[0] ?? toLocalDateString(new Date());
  const last = days[days.length - 1] ?? first;
  const start = localMidnight(first);
  const end = addDays(localMidnight(last), 1); // calendar-day maths: correct across DST
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    startDate: first,
    endDate: toLocalDateString(end),
  };
}

/** Anchor date one step back or forward in the current view. */
export function stepAnchor(view: CalendarView, anchor: string, direction: 1 | -1): string {
  const date = localMidnight(anchor);
  switch (view) {
    case "day":
      return toLocalDateString(addDays(date, direction));
    case "week":
      return toLocalDateString(addWeeks(date, direction));
    case "month":
      return toLocalDateString(addMonths(date, direction));
    case "agenda":
      return toLocalDateString(addDays(date, direction * AGENDA_DAYS));
  }
}

/** Toolbar title: "Wednesday 7 October 2026", "5 – 11 Oct 2026", "October 2026". */
export function viewTitle(view: CalendarView, anchor: string, days: string[]): string {
  const date = localMidnight(anchor);
  if (view === "day") return format(date, "EEEE d MMMM yyyy");
  if (view === "month") return format(date, "MMMM yyyy");
  const first = localMidnight(days[0] ?? anchor);
  const last = localMidnight(days[days.length - 1] ?? anchor);
  const sameMonth = format(first, "MM yyyy") === format(last, "MM yyyy");
  return sameMonth
    ? `${format(first, "d")} – ${format(last, "d MMM yyyy")}`
    : `${format(first, "d MMM")} – ${format(last, "d MMM yyyy")}`;
}
