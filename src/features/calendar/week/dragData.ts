/** What is being dragged on the calendar (dnd-kit `data`). */
export type DragData =
  | { kind: "move"; itemId: string }
  | { kind: "resize"; itemId: string }
  | { kind: "allDay"; itemId: string };

/** Droppable ids: a day column in the hour grid, or a day's slot in the all-day row. */
export const columnId = (date: string) => `day:${date}`;
export const allDayId = (date: string) => `allday:${date}`;

export function dateFromDropId(id: string | number | undefined): string | null {
  if (typeof id !== "string") return null;
  const match = /^(?:day|allday):(\d{4}-\d{2}-\d{2})$/.exec(id);
  return match?.[1] ?? null;
}
