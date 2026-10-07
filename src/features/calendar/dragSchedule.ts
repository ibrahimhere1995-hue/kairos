import { addDays, addMinutes, differenceInCalendarDays, parseISO } from "date-fns";
import { POINT_TASK_MINUTES, SNAP_MINUTES, snapMinutes } from "@/features/calendar/layout";
import type { DragData } from "@/features/calendar/week/dragData";
import { toLocalDateString } from "@/lib/dates/dayContext";
import type { Item } from "@/types/Item";
import type { ScheduleInput } from "@/types/ScheduleInput";

/**
 * The new schedule after a calendar drag, or null if nothing changed.
 * `targetDate` is the local day the pointer ended on; `deltaMinutes` the vertical movement.
 * Moving across days keeps the wall-clock time (calendar-day maths), even across DST.
 */
export function scheduleAfterDrag(
  item: Item,
  drag: DragData,
  targetDate: string | null,
  deltaMinutes: number,
): ScheduleInput | null {
  const minutes = snapMinutes(deltaMinutes);

  if (drag.kind === "allDay") {
    if (!item.dueDate || !targetDate || targetDate === item.dueDate) return null;
    return { dueDate: targetDate, startAt: null, endAt: null };
  }
  if (!item.startAt) return null;
  const start = parseISO(item.startAt);
  const end = item.endAt ? parseISO(item.endAt) : null;

  if (drag.kind === "move") {
    const dayShift = targetDate
      ? differenceInCalendarDays(parseISO(targetDate), parseISO(toLocalDateString(start)))
      : 0;
    if (dayShift === 0 && minutes === 0) return null;
    const move = (d: Date) => addMinutes(addDays(d, dayShift), minutes).toISOString();
    return { startAt: move(start), endAt: end ? move(end) : null, dueDate: null };
  }

  // Resize: drag the bottom edge; never shorter than one slot.
  const currentEnd = end ?? addMinutes(start, POINT_TASK_MINUTES);
  const newEnd = addMinutes(currentEnd, minutes);
  const earliest = addMinutes(start, SNAP_MINUTES);
  const finalEnd = newEnd < earliest ? earliest : newEnd;
  if (end && finalEnd.getTime() === end.getTime()) return null;
  return { startAt: item.startAt, endAt: finalEnd.toISOString(), dueDate: null };
}
