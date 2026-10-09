import { afterEach, describe, expect, it } from "vitest";
import { keepsMoving, newMoment } from "@/features/dashboard/slippedMoves";
import type { Item } from "@/types/Item";

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

function item(fields: Partial<Item>): Item {
  return {
    id: "i1",
    kind: "task",
    title: "Pay bill",
    notes: null,
    areaId: null,
    priority: 0,
    allDay: false,
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
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    deletedAt: null,
    ...fields,
  };
}

describe("new moments for slipped tasks", () => {
  it("today makes it an all-day task for today", () => {
    process.env.TZ = "UTC";
    const timed = item({ startAt: "2026-10-06T15:00:00.000Z" });
    expect(newMoment(timed, "2026-10-07", "2026-10-07")).toEqual({
      dueDate: "2026-10-07",
      startAt: null,
      endAt: null,
    });
    const dated = item({ dueDate: "2026-10-05", allDay: true });
    expect(newMoment(dated, "2026-10-07", "2026-10-07").dueDate).toBe("2026-10-07");
  });

  it("another day keeps a date-only task date-only", () => {
    const dated = item({ dueDate: "2026-10-05", allDay: true });
    expect(newMoment(dated, "2026-10-08", "2026-10-07")).toEqual({
      dueDate: "2026-10-08",
      startAt: null,
      endAt: null,
    });
  });

  it("another day keeps the local time and length", () => {
    process.env.TZ = "Asia/Karachi"; // UTC+5
    const timed = item({
      startAt: "2026-10-06T10:00:00.000Z", // 15:00 local
      endAt: "2026-10-06T10:45:00.000Z",
    });
    expect(newMoment(timed, "2026-10-08", "2026-10-07")).toEqual({
      startAt: "2026-10-08T10:00:00.000Z",
      endAt: "2026-10-08T10:45:00.000Z",
      dueDate: null,
    });
  });

  it("keeps the wall-clock time across a DST change", () => {
    process.env.TZ = "Europe/London";
    // Fri 23 Oct 09:00 BST (08:00Z) → Mon 26 Oct 09:00 GMT (09:00Z).
    const timed = item({ startAt: "2026-10-23T08:00:00.000Z" });
    expect(newMoment(timed, "2026-10-26", "2026-10-24").startAt).toBe("2026-10-26T09:00:00.000Z");
  });

  it("notices tasks that keep moving", () => {
    expect(keepsMoving(item({ rescheduleCount: 2 }))).toBe(false);
    expect(keepsMoving(item({ rescheduleCount: 3 }))).toBe(true);
  });
});
