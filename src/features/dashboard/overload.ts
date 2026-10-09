import type { DayContext } from "@/lib/dates/dayContext";
import type { Item } from "@/types/Item";

/** A task without a length is guessed at this many minutes. */
export const TASK_GUESS_MINUTES = 30;
/** Small overruns are normal; only say something past this. */
const TOLERANCE_MINUTES = 15;

export interface Overload {
  /** Minutes of open tasks still ahead today. */
  planned: number;
  /** Working minutes left today, minus events. */
  free: number;
}

const at = (ctx: DayContext, hhmm: string) => new Date(`${ctx.today}T${hhmm}`).getTime();
const open = (i: Item) => i.completedAt === null && i.skippedAt === null;

/**
 * A4: is the rest of today overbooked? Compares open tasks (timed ones by their length,
 * others guessed) with the working hours left minus events. Null when it fits.
 */
export function overload(
  items: Item[],
  ctx: DayContext,
  dayStart: string,
  dayEnd: string,
): Overload | null {
  const from = Math.max(ctx.now.getTime(), at(ctx, dayStart));
  const to = at(ctx, dayEnd);
  if (from >= to) return null;
  const within = (start: number, end: number) =>
    Math.max(0, Math.min(end, to) - Math.max(start, from));

  let busy = 0;
  let planned = 0;
  for (const item of items.filter(open)) {
    const start = item.startAt ? Date.parse(item.startAt) : null;
    const end = item.endAt ? Date.parse(item.endAt) : null;
    if (item.kind === "event") {
      if (start !== null && end !== null) busy += within(start, end);
    } else if (start === null) {
      if (item.dueDate === ctx.today) planned += TASK_GUESS_MINUTES * 60_000;
    } else {
      // A timed task counts as planned work, not as time taken away from the day.
      planned += within(start, end ?? start + TASK_GUESS_MINUTES * 60_000);
    }
  }
  const free = Math.max(0, to - from - busy);
  const minutes = (ms: number) => Math.round(ms / 60_000);
  return minutes(planned) > minutes(free) + TOLERANCE_MINUTES
    ? { planned: minutes(planned), free: minutes(free) }
    : null;
}
