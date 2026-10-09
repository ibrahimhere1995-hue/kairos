import { format, parse } from "date-fns";
import type { TFunction } from "i18next";

const HOUR = 60;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Choices offered in the "Remind me" picker, in minutes before the item's moment. */
export const TIMED_REMINDER_CHOICES = [0, 5, 15, 30, HOUR, DAY];
export const DAY_REMINDER_CHOICES = [0, DAY, 2 * DAY, WEEK];

/**
 * "15 min before", "1 day before", "At the time"… For a date-only item, 0 means
 * "On the day at 9:00 AM" (the default reminder time from Settings).
 */
export function reminderLabel(
  offset: number,
  dateOnly: boolean,
  dayTime: string,
  t: TFunction,
): string {
  if (offset === 0) {
    if (!dateOnly) return t("reminders.atTime");
    const time = format(parse(dayTime, "HH:mm", new Date()), "p");
    return t("reminders.onTheDay", { time });
  }
  if (offset % WEEK === 0) return t("reminders.weeksBefore", { count: offset / WEEK });
  if (offset % DAY === 0) return t("reminders.daysBefore", { count: offset / DAY });
  if (offset % HOUR === 0) return t("reminders.hoursBefore", { count: offset / HOUR });
  return t("reminders.minutesBefore", { count: offset });
}

/** The pill's summary: "No reminder", the one reminder, or "2 reminders". */
export function reminderSummary(
  offsets: readonly number[],
  dateOnly: boolean,
  dayTime: string,
  t: TFunction,
): string {
  if (offsets.length === 0) return t("editor.noReminder");
  if (offsets.length === 1) return reminderLabel(offsets[0] ?? 0, dateOnly, dayTime, t);
  return t("editor.reminderCount", { count: offsets.length });
}

/** Adds or removes one offset, keeping the list sorted. */
export function toggleReminder(offsets: readonly number[], offset: number): number[] {
  return offsets.includes(offset)
    ? offsets.filter((o) => o !== offset)
    : [...offsets, offset].sort((a, b) => a - b);
}
