import { format, parseISO } from "date-fns";
import type { TFunction } from "i18next";
import { friendlyDate } from "@/features/items/editor/friendlyDate";
import type { Item } from "@/types/Item";

/** Short "when" text for a list row: "3:00 PM – 3:30 PM", "Tomorrow", "Fri 9 Oct · 9:00 AM". */
export function itemWhen(item: Item, today: string, t: TFunction): string | null {
  if (item.startAt) {
    const start = parseISO(item.startAt);
    const day = format(start, "yyyy-MM-dd");
    let time = format(start, "p");
    if (item.endAt) time += ` – ${format(parseISO(item.endAt), "p")}`;
    return day === today ? time : `${friendlyDate(day, today, t)} · ${time}`;
  }
  if (item.dueDate) return item.dueDate === today ? null : friendlyDate(item.dueDate, today, t);
  return null;
}
