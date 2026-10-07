import { afterEach, describe, expect, it } from "vitest";
import {
  parseCalendarSearch,
  rangeForDays,
  stepAnchor,
  viewTitle,
  visibleDays,
} from "@/features/calendar/calendarView";
import { allDayItems, layoutDay, snapMinutes } from "@/features/calendar/layout";
import type { Item } from "@/types/Item";

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

let n = 0;
function item(fields: Partial<Item>): Item {
  n += 1;
  return {
    id: `i${n}`,
    kind: "event",
    title: `Item ${n}`,
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

describe("calendar search params", () => {
  it("accepts valid values and falls back safely", () => {
    expect(parseCalendarSearch({ view: "month", date: "2026-10-07" }, "2026-01-01")).toEqual({
      view: "month",
      date: "2026-10-07",
    });
    expect(parseCalendarSearch({ view: "year", date: "2026-02-30" }, "2026-01-01")).toEqual({
      view: "week",
      date: "2026-01-01",
    });
  });
});

describe("visible days and ranges", () => {
  it("week starts Monday; month covers whole weeks", () => {
    expect(visibleDays("week", "2026-10-07")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    const month = visibleDays("month", "2026-10-15");
    expect(month[0]).toBe("2026-09-28");
    expect(month[month.length - 1]).toBe("2026-11-01");
    expect(month.length % 7).toBe(0);
    expect(visibleDays("agenda", "2026-10-07")).toHaveLength(14);
  });

  it("ranges use local midnights, even across a DST change", () => {
    process.env.TZ = "America/New_York";
    const range = rangeForDays(visibleDays("week", "2026-11-01")); // week containing fall-back
    expect(range.startDate).toBe("2026-10-26");
    expect(range.endDate).toBe("2026-11-02");
    expect(range.start).toBe("2026-10-26T04:00:00.000Z"); // EDT
    expect(range.end).toBe("2026-11-02T05:00:00.000Z"); // EST
  });

  it("steps by the view's unit and titles the range", () => {
    expect(stepAnchor("day", "2026-10-07", 1)).toBe("2026-10-08");
    expect(stepAnchor("week", "2026-10-07", -1)).toBe("2026-09-30");
    expect(stepAnchor("month", "2026-01-31", 1)).toBe("2026-02-28");
    expect(viewTitle("month", "2026-10-07", [])).toBe("October 2026");
    expect(viewTitle("week", "2026-10-07", visibleDays("week", "2026-10-07"))).toBe(
      "5 – 11 Oct 2026",
    );
    expect(viewTitle("week", "2026-09-30", visibleDays("week", "2026-09-30"))).toBe(
      "28 Sep – 4 Oct 2026",
    );
  });
});

describe("layoutDay", () => {
  const dayStart = new Date("2026-10-07T00:00:00.000Z");
  const dayEnd = new Date("2026-10-08T00:00:00.000Z");
  const at = (hhmm: string, day = "2026-10-07") => `${day}T${hhmm}:00.000Z`;

  it("positions items in minutes from midnight", () => {
    const [p] = layoutDay([item({ startAt: at("09:00"), endAt: at("10:30") })], dayStart, dayEnd);
    expect(p).toMatchObject({ top: 540, bottom: 630, column: 0, columns: 1 });
  });

  it("puts overlapping items side by side and reuses free columns", () => {
    const a = item({ title: "A", startAt: at("09:00"), endAt: at("11:00") });
    const b = item({ title: "B", startAt: at("09:30"), endAt: at("10:00") });
    const c = item({ title: "C", startAt: at("10:15"), endAt: at("10:45") }); // B's column is free again
    const d = item({ title: "D", startAt: at("13:00"), endAt: at("14:00") }); // new cluster
    const byTitle = Object.fromEntries(
      layoutDay([d, c, b, a], dayStart, dayEnd).map((p) => [p.item.title, p]),
    );
    expect(byTitle.A).toMatchObject({ column: 0, columns: 2 });
    expect(byTitle.B).toMatchObject({ column: 1, columns: 2 });
    expect(byTitle.C).toMatchObject({ column: 1, columns: 2 });
    expect(byTitle.D).toMatchObject({ column: 0, columns: 1 });
  });

  it("clips items that cross midnight and marks the cut edges", () => {
    const overnight = item({ startAt: at("22:00", "2026-10-06"), endAt: at("02:00") });
    const [p] = layoutDay([overnight], dayStart, dayEnd);
    expect(p).toMatchObject({ top: 0, bottom: 120, startsBefore: true, endsAfter: false });
  });

  it("gives point-in-time tasks a clickable height and ignores other days", () => {
    const task = item({ kind: "task", startAt: at("15:00") });
    const tomorrow = item({ startAt: at("09:00", "2026-10-08"), endAt: at("10:00", "2026-10-08") });
    const result = layoutDay([task, tomorrow], dayStart, dayEnd);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ top: 900, bottom: 930 });
  });

  it("lays out 500 items in a week quickly", () => {
    const many = Array.from({ length: 500 }, (_, i) => {
      const start = new Date(dayStart.getTime() + (i % 96) * 15 * 60_000);
      return item({
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + 45 * 60_000).toISOString(),
      });
    });
    const t0 = performance.now();
    for (let day = 0; day < 7; day++) layoutDay(many, dayStart, dayEnd);
    expect(performance.now() - t0).toBeLessThan(250);
  });

  it("separates the all-day row and snaps to quarter hours", () => {
    const allDay = item({ dueDate: "2026-10-07", allDay: true });
    expect(
      allDayItems([allDay, item({ startAt: at("09:00"), endAt: at("10:00") })], "2026-10-07"),
    ).toEqual([allDay]);
    expect(snapMinutes(52)).toBe(45);
    expect(snapMinutes(53)).toBe(60);
  });
});
