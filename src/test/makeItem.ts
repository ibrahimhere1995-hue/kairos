import type { Item } from "@/types/Item";

/** A plain open task with no date; override what a test needs. */
export function makeItem(fields: Partial<Item> = {}): Item {
  return {
    id: "i1",
    kind: "task",
    title: "Task",
    notes: null,
    areaId: null,
    priority: 0,
    allDay: true,
    startAt: null,
    endAt: null,
    dueDate: null,
    completedAt: null,
    skippedAt: null,
    location: null,
    rrule: null,
    recurrenceParentId: null,
    originalStartAt: null,
    milestoneId: null,
    rescheduleCount: 0,
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...fields,
  };
}
