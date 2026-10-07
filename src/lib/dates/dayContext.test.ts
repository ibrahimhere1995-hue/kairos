import { afterEach, describe, expect, it } from "vitest";
import { getDayContext } from "@/lib/dates/dayContext";
import { getItemStatus, type StatusInput } from "@/lib/status/status";

// Node re-reads process.env.TZ at runtime, so each test can act as a user in a real time zone.
const originalTZ = process.env.TZ;
function useTimeZone(tz: string) {
  process.env.TZ = tz;
}
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const iso = (d: Date) => d.toISOString();
const hours = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3_600_000;

const dateOnlyTask: StatusInput = {
  kind: "task",
  startAt: null,
  endAt: null,
  dueDate: "2026-10-07",
  completedAt: null,
  skippedAt: null,
};

describe("getDayContext", () => {
  it("uses the local calendar day, not the UTC day", () => {
    useTimeZone("Asia/Kolkata"); // UTC+05:30
    const ctx = getDayContext(new Date("2026-10-07T20:00:00Z")); // 01:30 on the 8th locally
    expect(ctx.today).toBe("2026-10-08");
    expect(iso(ctx.dayStart)).toBe("2026-10-07T18:30:00.000Z");
    expect(iso(ctx.dayEnd)).toBe("2026-10-08T18:30:00.000Z");
  });

  it("flips to the next day exactly at local midnight", () => {
    useTimeZone("America/New_York"); // EDT, UTC-4, in October
    expect(getDayContext(new Date("2026-10-08T03:59:59.999Z")).today).toBe("2026-10-07");
    expect(getDayContext(new Date("2026-10-08T04:00:00.000Z")).today).toBe("2026-10-08");
  });

  it("spring-forward day lasts 23 hours", () => {
    useTimeZone("America/New_York"); // 2026-03-08: 02:00 EST → 03:00 EDT
    const ctx = getDayContext(new Date("2026-03-08T12:00:00Z"));
    expect(ctx.today).toBe("2026-03-08");
    expect(iso(ctx.dayStart)).toBe("2026-03-08T05:00:00.000Z");
    expect(iso(ctx.dayEnd)).toBe("2026-03-09T04:00:00.000Z");
    expect(hours(ctx.dayStart, ctx.dayEnd)).toBe(23);
  });

  it("fall-back day lasts 25 hours", () => {
    useTimeZone("America/New_York"); // 2026-11-01: 02:00 EDT → 01:00 EST
    const ctx = getDayContext(new Date("2026-11-01T12:00:00Z"));
    expect(iso(ctx.dayStart)).toBe("2026-11-01T04:00:00.000Z");
    expect(iso(ctx.dayEnd)).toBe("2026-11-02T05:00:00.000Z");
    expect(hours(ctx.dayStart, ctx.dayEnd)).toBe(25);
  });
});

describe("status in real time zones", () => {
  it("a date-only task is due today until local midnight, then slips", () => {
    useTimeZone("America/New_York");
    const lateEvening = getDayContext(new Date("2026-10-08T03:30:00Z")); // 23:30 on the 7th
    const justAfterMidnight = getDayContext(new Date("2026-10-08T04:00:00Z")); // 00:00 on the 8th
    expect(getItemStatus(dateOnlyTask, lateEvening)).toBe("dueToday");
    expect(getItemStatus(dateOnlyTask, justAfterMidnight)).toBe("missed");
  });

  it("the same instant can be today in one zone and tomorrow in another", () => {
    const now = new Date("2026-10-07T20:00:00Z");
    useTimeZone("America/New_York"); // 16:00 on the 7th
    expect(getItemStatus(dateOnlyTask, getDayContext(now))).toBe("dueToday");
    useTimeZone("Asia/Kolkata"); // 01:30 on the 8th
    expect(getItemStatus(dateOnlyTask, getDayContext(now))).toBe("missed");
  });

  it("a timed task late on a spring-forward day is still due today", () => {
    useTimeZone("America/New_York");
    const ctx = getDayContext(new Date("2026-03-08T06:00:00Z")); // 01:00 EST
    const lateTask: StatusInput = {
      ...dateOnlyTask,
      dueDate: null,
      startAt: "2026-03-09T03:30:00.000Z",
    }; // 23:30 EDT
    expect(getItemStatus(lateTask, ctx)).toBe("dueToday");
    const nextMorning: StatusInput = { ...lateTask, startAt: "2026-03-09T04:00:00.000Z" }; // 00:00 on the 9th
    expect(getItemStatus(nextMorning, ctx)).toBe("upcoming");
  });
});
