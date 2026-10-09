import { toLocalDateString, type DayContext } from "@/lib/dates/dayContext";
import type { Item } from "@/types/Item";

/**
 * Computed, never stored (PRD §6). How each status is shown lives in DESIGN_SYSTEM §3.4.
 *
 * - `ongoing`     happening right now (shown in "Now")
 * - `dueToday`    still to do today, not happening this minute (shown in "Today")
 * - `upcoming`    after today
 * - `missed`      a task whose moment passed without being done ("Slipped"); never an event
 * - `past`        an event that is over
 * - `done`, `skipped`
 * - `unscheduled` no date yet (Inbox)
 */
export type ItemStatus =
  "ongoing" | "dueToday" | "upcoming" | "missed" | "past" | "done" | "skipped" | "unscheduled";

export type StatusInput = Pick<
  Item,
  "kind" | "startAt" | "endAt" | "dueDate" | "completedAt" | "skippedAt"
> &
  Partial<Pick<Item, "id">>;

/** A computed occurrence of a repeating item (`series@key`), not a stored one. */
export const isComputedOccurrence = (item: Partial<Pick<Item, "id">>) =>
  item.id?.includes("@") ?? false;

function dateOnlyStatus(item: StatusInput, dueDate: string, ctx: DayContext): ItemStatus {
  // `YYYY-MM-DD` strings compare correctly as text.
  if (dueDate > ctx.today) return "upcoming";
  if (dueDate === ctx.today) return "dueToday";
  return item.kind === "event" ? "past" : "missed";
}

function timedStatus(item: StatusInput, startAt: string, ctx: DayContext): ItemStatus {
  const now = ctx.now.getTime();
  const start = Date.parse(startAt);
  const end = item.endAt === null ? null : Date.parse(item.endAt);

  if (now < start) {
    return start < ctx.dayEnd.getTime() ? "dueToday" : "upcoming";
  }
  // The moment has arrived. With a window, it's live until the end.
  if (end !== null && now < end) return "ongoing";
  // Over (or a point-in-time task whose time has come): a passed time is never "Now".
  return item.kind === "event" ? "past" : "missed";
}

export function getItemStatus(item: StatusInput, ctx: DayContext): ItemStatus {
  if (item.completedAt !== null) return "done";
  if (item.skippedAt !== null) return "skipped";
  const status =
    item.startAt !== null
      ? timedStatus(item, item.startAt, ctx)
      : item.dueDate !== null
        ? dateOnlyStatus(item, item.dueDate, ctx)
        : "unscheduled";
  // Repeating tasks: earlier days' occurrences are simply past; only the latest one slips,
  // and My Day picks that one (PRD R6, decision 2026-10-09).
  if (status === "missed" && isComputedOccurrence(item) && dayOf(item) < ctx.today) return "past";
  return status;
}

function dayOf(item: StatusInput): string {
  if (item.dueDate !== null) return item.dueDate;
  const start = item.startAt === null ? null : new Date(item.startAt);
  return start ? toLocalDateString(start) : "";
}
