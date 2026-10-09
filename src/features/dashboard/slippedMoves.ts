import { addMinutes, differenceInMinutes, format, parseISO } from "date-fns";
import type { Item } from "@/types/Item";
import type { ScheduleInput } from "@/types/ScheduleInput";

/** PRD R6: after this many moves, offer to break the task into smaller steps. */
export const KEEPS_MOVING_AFTER = 3;

/**
 * The new moment for a slipped task moved to `date` (local `YYYY-MM-DD`).
 * "Today" makes it an all-day task for today: its old time has usually already passed, and a
 * passed time would make it slip again at once. Another day keeps its time and length.
 */
export function newMoment(item: Item, date: string, today: string): ScheduleInput {
  if (date === today || !item.startAt) {
    return { dueDate: date, startAt: null, endAt: null };
  }
  const start = parseISO(item.startAt);
  // "YYYY-MM-DDTHH:mm" without an offset is local time.
  const moved = new Date(`${date}T${format(start, "HH:mm")}`);
  const end = item.endAt
    ? addMinutes(moved, differenceInMinutes(parseISO(item.endAt), start)).toISOString()
    : null;
  return { startAt: moved.toISOString(), endAt: end, dueDate: null };
}

export function keepsMoving(item: Item): boolean {
  return item.rescheduleCount >= KEEPS_MOVING_AFTER;
}
