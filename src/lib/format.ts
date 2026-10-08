import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { TFunction } from "i18next";

/** "512 KB", "3.4 MB" (binary units, one decimal above 1 MB). */
export function formatBytes(bytes: number, t: TFunction): string {
  if (bytes < 1024 * 1024) return t("units.kb", { value: Math.max(1, Math.round(bytes / 1024)) });
  return t("units.mb", { value: (bytes / (1024 * 1024)).toFixed(1) });
}

/** "Today, 10:15 AM", "Yesterday, 9:00 PM", "Wed 7 Oct, 9:00 AM" for a UTC ISO timestamp. */
export function formatWhen(iso: string, now: Date, t: TFunction): string {
  const date = parseISO(iso);
  const days = differenceInCalendarDays(now, date);
  const time = format(date, "p");
  if (days === 0) return t("dates.todayAt", { time });
  if (days === 1) return t("dates.yesterdayAt", { time });
  return `${format(date, "EEE d MMM")}, ${time}`;
}
