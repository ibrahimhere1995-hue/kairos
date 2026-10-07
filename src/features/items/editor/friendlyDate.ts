import { addDays, format, parseISO } from "date-fns";
import type { TFunction } from "i18next";
import { toLocalDateString } from "@/lib/dates/dayContext";

/** "Today", "Tomorrow", or e.g. "Fri 9 Oct" for a local `YYYY-MM-DD` date. */
export function friendlyDate(date: string, today: string, t: TFunction): string {
  if (date === today) return t("dates.today");
  if (date === toLocalDateString(addDays(parseISO(today), 1))) return t("dates.tomorrow");
  return format(parseISO(date), "EEE d MMM");
}

/** "30 min", "1 h", "1 h 30 min". */
export function friendlyDuration(minutes: number, t: TFunction): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return t("dates.minutes", { count: m });
  if (m === 0) return t("dates.hours", { count: h });
  return `${t("dates.hours", { count: h })} ${t("dates.minutes", { count: m })}`;
}
