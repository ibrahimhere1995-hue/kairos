import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { isComputedOccurrence } from "@/lib/status/status";
import type { DayContext } from "@/lib/dates/dayContext";
import type { Item } from "@/types/Item";
import type { PlanDay } from "@/types/PlanDay";
import type { PlanRequest } from "@/types/PlanRequest";
import type { PlanTask } from "@/types/PlanTask";

/** "lighten": today is overbooked; move some of today's tasks to the coming days (A4). */
export type PlanSpan = "day" | "week" | "lighten";

const TASKS_MAX = 30;
/** Sent to the AI (not shown to the user) when lightening an overbooked day. */
const LIGHTEN_NOTE =
  "Today is overbooked. Suggest which of these tasks to move to the coming days so today " +
  "becomes manageable. Move the least urgent ones first and leave the rest.";

/**
 * Today; today to the end of this week (`weekEnd` = local date after the last day); or, to
 * lighten today, the next six days.
 */
export function planDates(ctx: DayContext, span: PlanSpan, weekEnd: string): string[] {
  const first = span === "lighten" ? 1 : 0;
  const count =
    span === "day"
      ? 1
      : span === "lighten"
        ? 6
        : Math.max(1, differenceInCalendarDays(parseISO(weekEnd), ctx.dayStart));
  return Array.from({ length: Math.min(7, count) }, (_, i) =>
    format(addDays(ctx.dayStart, first + i), "yyyy-MM-dd"),
  );
}

const open = (i: Item) => i.completedAt === null && i.skippedAt === null && i.deletedAt === null;

/** Busy times on each day: timed items that are not done (only titles and times are sent). */
function busyDays(dates: string[], items: Item[]): PlanDay[] {
  return dates.map((date) => ({
    date,
    busy: items
      .filter((i) => open(i) && i.startAt && i.endAt)
      .flatMap((i) => {
        const start = new Date(i.startAt ?? "");
        const end = new Date(i.endAt ?? "");
        if (format(start, "yyyy-MM-dd") > date || format(end, "yyyy-MM-dd") < date) return [];
        return [
          {
            title: i.title,
            start: format(start, "yyyy-MM-dd") < date ? "00:00" : format(start, "HH:mm"),
            end: format(end, "yyyy-MM-dd") > date ? "23:59" : format(end, "HH:mm"),
          },
        ];
      }),
  }));
}

/**
 * Tasks worth a slot: open, not yet at a time, and not repeating (their rhythm is set).
 * Slipped first, then the days in order, then the Inbox.
 */
export function planTasks(candidates: Item[]): PlanTask[] {
  const seen = new Set<string>();
  return candidates
    .filter((i) => {
      const fresh = !seen.has(i.id);
      seen.add(i.id);
      return (
        fresh && i.kind === "task" && open(i) && !i.startAt && !i.rrule && !isComputedOccurrence(i)
      );
    })
    .slice(0, TASKS_MAX)
    .map((i) => ({ id: i.id, title: i.title, durationMinutes: null }));
}

export function buildPlanRequest(args: {
  ctx: DayContext;
  span: PlanSpan;
  weekEnd: string;
  instruction: string;
  rangeItems: Item[];
  candidates: Item[];
  /** Working hours from Settings, local `HH:mm`. */
  dayStart: string;
  dayEnd: string;
  /** A5, e.g. "09:00–11:00". */
  preferredHours?: string | null;
}): PlanRequest {
  const note = args.span === "lighten" ? LIGHTEN_NOTE : "";
  const dates = planDates(args.ctx, args.span, args.weekEnd);
  const last = dates[dates.length - 1] ?? args.ctx.today;
  return {
    instruction: [note, args.instruction.trim()].filter(Boolean).join("\n"),
    now: format(args.ctx.now, "yyyy-MM-dd'T'HH:mm"),
    dayStart: args.dayStart,
    dayEnd: args.dayEnd,
    preferredHours: args.preferredHours ?? undefined,
    days: busyDays(dates, args.rangeItems),
    tasks: planTasks(args.candidates.filter((i) => !i.dueDate || i.dueDate <= last)),
  };
}
