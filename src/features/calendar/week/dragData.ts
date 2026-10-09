/** What is being dragged on the calendar (dnd-kit `data`). */
export type DragData =
  | { kind: "move"; itemId: string }
  | { kind: "resize"; itemId: string }
  | { kind: "allDay"; itemId: string }
  /** A task without a date, from the "To schedule" list (time-blocking). */
  | { kind: "unscheduled"; itemId: string };

/** Droppable ids: a day column in the hour grid, or a day's slot in the all-day row. */
export const columnId = (date: string) => `day:${date}`;
export const allDayId = (date: string) => `allday:${date}`;
/** Draggable id of an Inbox task in the "To schedule" list. */
export const unscheduledDragId = (itemId: string) => `unscheduled:${itemId}`;

/** True for a day column of the hour grid (a drop there means "at this time"). */
export const isColumnId = (id: string | number | undefined) =>
  typeof id === "string" && id.startsWith("day:");

export function dateFromDropId(id: string | number | undefined): string | null {
  if (typeof id !== "string") return null;
  const match = /^(?:day|allday):(\d{4}-\d{2}-\d{2})$/.exec(id);
  return match?.[1] ?? null;
}
