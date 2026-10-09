import { afterEach, describe, expect, it } from "vitest";
import { scheduleAfterDrag, scheduleAtMinute } from "@/features/calendar/dragSchedule";
import type { Item } from "@/types/Item";

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const base: Item = {
  id: "i1",
  kind: "event",
  title: "Meeting",
  notes: null,
  areaId: null,
  priority: 0,
  allDay: false,
  startAt: "2026-10-07T09:00:00.000Z",
  endAt: "2026-10-07T10:00:00.000Z",
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
};
const move = { kind: "move", itemId: "i1" } as const;
const resize = { kind: "resize", itemId: "i1" } as const;

describe("scheduleAfterDrag", () => {
  it("moves within the day, snapped to 15 minutes, keeping the length", () => {
    process.env.TZ = "UTC";
    expect(scheduleAfterDrag(base, move, "2026-10-07", 37)).toEqual({
      startAt: "2026-10-07T09:30:00.000Z",
      endAt: "2026-10-07T10:30:00.000Z",
      dueDate: null,
    });
  });

  it("moves to another day at the same clock time", () => {
    process.env.TZ = "UTC";
    expect(scheduleAfterDrag(base, move, "2026-10-09", 0)).toMatchObject({
      startAt: "2026-10-09T09:00:00.000Z",
      endAt: "2026-10-09T10:00:00.000Z",
    });
  });

  it("keeps wall-clock time when moving across a DST change", () => {
    process.env.TZ = "America/New_York";
    const sat = { ...base, startAt: "2026-10-31T13:00:00.000Z", endAt: "2026-10-31T14:00:00.000Z" }; // 09:00 EDT
    expect(scheduleAfterDrag(sat, move, "2026-11-02", 0)).toMatchObject({
      startAt: "2026-11-02T14:00:00.000Z", // 09:00 EST
    });
  });

  it("returns null when nothing changed (a click, not a drag)", () => {
    process.env.TZ = "UTC";
    expect(scheduleAfterDrag(base, move, "2026-10-07", 5)).toBeNull();
    expect(scheduleAfterDrag(base, resize, "2026-10-07", -6)).toBeNull();
  });

  it("resizes the end but never below one slot", () => {
    expect(scheduleAfterDrag(base, resize, null, 30)).toEqual({
      startAt: base.startAt,
      endAt: "2026-10-07T10:30:00.000Z",
      dueDate: null,
    });
    expect(scheduleAfterDrag(base, resize, null, -300)?.endAt).toBe("2026-10-07T09:15:00.000Z");
  });

  it("gives a point-in-time task a length when its edge is dragged", () => {
    const task = { ...base, kind: "task" as const, endAt: null };
    expect(scheduleAfterDrag(task, resize, null, 30)?.endAt).toBe("2026-10-07T10:00:00.000Z");
  });

  it("moves all-day items between days", () => {
    const allDay = { ...base, startAt: null, endAt: null, dueDate: "2026-10-07", allDay: true };
    const drag = { kind: "allDay", itemId: "i1" } as const;
    expect(scheduleAfterDrag(allDay, drag, "2026-10-08", 0)).toEqual({
      dueDate: "2026-10-08",
      startAt: null,
      endAt: null,
    });
    expect(scheduleAfterDrag(allDay, drag, "2026-10-07", 0)).toBeNull();
  });
});

describe("scheduleAtMinute (time-blocking)", () => {
  const inbox: Item = { ...base, kind: "task", startAt: null, endAt: null };

  it("gives an Inbox task a half-hour block at the snapped drop time", () => {
    process.env.TZ = "Asia/Karachi"; // UTC+5
    expect(scheduleAtMinute(inbox, "2026-10-09", 9 * 60 + 7)).toEqual({
      startAt: "2026-10-09T04:00:00.000Z", // 09:00 local
      endAt: "2026-10-09T04:30:00.000Z",
      dueDate: null,
    });
  });

  it("an all-day task dropped on the grid becomes timed", () => {
    process.env.TZ = "UTC";
    const dated: Item = { ...inbox, dueDate: "2026-10-09", allDay: true };
    expect(scheduleAtMinute(dated, "2026-10-10", 14 * 60 + 25)).toEqual({
      startAt: "2026-10-10T14:30:00.000Z",
      endAt: "2026-10-10T15:00:00.000Z",
      dueDate: null,
    });
  });

  it("keeps a timed item's length and stays inside the day", () => {
    process.env.TZ = "UTC";
    expect(scheduleAtMinute(base, "2026-10-09", 30).endAt).toBe("2026-10-09T01:30:00.000Z");
    expect(scheduleAtMinute(inbox, "2026-10-09", -40).startAt).toBe("2026-10-09T00:00:00.000Z");
    expect(scheduleAtMinute(inbox, "2026-10-09", 24 * 60 + 90).startAt).toBe(
      "2026-10-09T23:45:00.000Z",
    );
  });
});
