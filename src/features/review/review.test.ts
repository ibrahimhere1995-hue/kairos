import { describe, expect, it } from "vitest";
import {
  balanceInsights,
  defaultWeekOffset,
  reviewWeek,
  summarizeWeek,
  weekdayOf,
  withFocus,
  type AreaTime,
} from "@/features/review/review";
import { getDayContext } from "@/lib/dates/dayContext";
import type { Item } from "@/types/Item";

const base: Item = {
  id: "i1",
  kind: "task",
  title: "Task",
  notes: null,
  areaId: null,
  priority: 0,
  allDay: true,
  startAt: null,
  endAt: null,
  dueDate: "2026-10-06",
  location: null,
  completedAt: null,
  skippedAt: null,
  source: "manual",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
  rrule: null,
  recurrenceParentId: null,
  originalStartAt: null,
  milestoneId: null,
  rescheduleCount: 0,
};

const area = (name: string, minutes: number, focusedMinutes = 0): AreaTime => ({
  areaId: name,
  name,
  color: "area.work",
  minutes,
  focusedMinutes,
});

describe("weekly review", () => {
  it("looks back a week on the first day of the week", () => {
    const sunday = new Date(2026, 9, 11, 18);
    expect(weekdayOf(sunday)).toBe("sunday");
    expect(defaultWeekOffset(sunday, 1)).toBe(0); // Monday weeks: Sunday is the last day
    expect(defaultWeekOffset(sunday, 0)).toBe(-1); // Sunday weeks: look back
  });

  it("builds local week ranges", () => {
    const { range } = reviewWeek(new Date(2026, 9, 8, 12), 1, -1);
    expect(range.startDate).toBe("2026-09-28");
    expect(range.endDate).toBe("2026-10-05");
  });

  it("spans a daylight-saving change as calendar days", () => {
    // Europe moves clocks back on 25 Oct 2026; the week still runs Monday to Monday.
    const { range } = reviewWeek(new Date(2026, 9, 25, 12), 1, 0);
    expect(range.startDate).toBe("2026-10-19");
    expect(range.endDate).toBe("2026-10-26");
  });

  it("sorts the week into done and slipped", () => {
    const ctx = getDayContext(new Date(2026, 9, 9, 12));
    const items = [
      { ...base, id: "done", completedAt: "2026-10-06T10:00:00.000Z" },
      { ...base, id: "slipped" },
      { ...base, id: "skipped", skippedAt: "2026-10-06T10:00:00.000Z" },
      { ...base, id: "event", kind: "event" as const },
      { ...base, id: "later", dueDate: "2026-10-10" },
    ];
    const { done, slipped } = summarizeWeek(items, ctx);
    expect(done.map((i) => i.id)).toEqual(["done"]);
    expect(slipped.map((i) => i.id)).toEqual(["slipped"]);
  });

  it("adds focused time per area", () => {
    const [work] = withFocus(
      [{ areaId: "a1", name: "Work", color: "area.work", minutes: 60 }],
      [
        { areaId: "a1", seconds: 1500 },
        { areaId: null, seconds: 600 },
      ],
    );
    expect(work?.focusedMinutes).toBe(25);
  });

  it("notices empty and dominant areas, kindly", () => {
    expect(balanceInsights([area("Work", 0), area("Health", 0)])).toEqual([]);
    expect(balanceInsights([area("Work", 300), area("Health", 0), area("Home", 60)])).toEqual([
      { kind: "zero", area: "Health" },
      { kind: "most", area: "Work", percent: 83 },
    ]);
    expect(balanceInsights([area("Work", 60), area("Health", 0, 50)])).toEqual([{ kind: "even" }]);
  });
});
