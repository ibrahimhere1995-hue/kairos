import { addDays, format, startOfDay } from "date-fns";

/**
 * "Today" as the user experiences it, in the device's local time zone.
 * Status rules use this instead of reading the clock, so they stay pure and testable.
 */
export interface DayContext {
  /** The current instant. */
  now: Date;
  /** Today's local calendar date, `YYYY-MM-DD` (compared with `item.dueDate`). */
  today: string;
  /** Local midnight at the start of today. */
  dayStart: Date;
  /** Local midnight at the start of tomorrow (exclusive end of today). */
  dayEnd: Date;
}

/** Local calendar date of an instant, `YYYY-MM-DD`. */
export function toLocalDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Builds the context for `now`. Uses calendar-day arithmetic, so on daylight-saving days
 * "today" correctly lasts 23 or 25 hours.
 */
export function getDayContext(now: Date = new Date()): DayContext {
  const dayStart = startOfDay(now);
  return {
    now,
    today: toLocalDateString(now),
    dayStart,
    dayEnd: addDays(dayStart, 1),
  };
}
