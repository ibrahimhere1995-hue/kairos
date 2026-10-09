import { describe, expect, it } from "vitest";
import type { DayContext } from "@/lib/dates/dayContext";
import { getItemStatus, type ItemStatus, type StatusInput } from "@/lib/status/status";

// A user whose local day is the UTC day, at 10:00 on 2026-10-07.
const ctx: DayContext = {
  now: new Date("2026-10-07T10:00:00.000Z"),
  today: "2026-10-07",
  dayStart: new Date("2026-10-07T00:00:00.000Z"),
  dayEnd: new Date("2026-10-08T00:00:00.000Z"),
};

const base: StatusInput = {
  kind: "task",
  startAt: null,
  endAt: null,
  dueDate: null,
  completedAt: null,
  skippedAt: null,
};

const task = (fields: Partial<StatusInput>): StatusInput => ({ ...base, ...fields });
const event = (startAt: string, endAt: string): StatusInput => ({
  ...base,
  kind: "event",
  startAt,
  endAt,
});
/** `at("15:00")` → `2026-10-07T15:00:00.000Z` (UTC, the format Rust stores). */
const at = (hhmm: string, day = "2026-10-07") => `${day}T${hhmm}:00.000Z`;

function expectStatus(cases: [string, StatusInput, ItemStatus][]) {
  for (const [name, item, status] of cases) {
    expect(getItemStatus(item, ctx), name).toBe(status);
  }
}

describe("getItemStatus", () => {
  it("done and skipped win over any date", () => {
    expectStatus([
      ["done, long overdue", task({ dueDate: "2026-01-01", completedAt: at("09:00") }), "done"],
      [
        "done event, in progress",
        { ...event(at("09:00"), at("11:00")), completedAt: at("09:30") },
        "done",
      ],
      ["skipped", task({ dueDate: "2026-10-01", skippedAt: at("09:00") }), "skipped"],
      ["done beats skipped", task({ completedAt: at("09:00"), skippedAt: at("08:00") }), "done"],
    ]);
  });

  it("items without a date are unscheduled (Inbox)", () => {
    expectStatus([["no date", task({}), "unscheduled"]]);
  });

  it("date-only tasks: today, before, after", () => {
    expectStatus([
      ["due today", task({ dueDate: "2026-10-07" }), "dueToday"],
      ["due yesterday", task({ dueDate: "2026-10-06" }), "missed"],
      ["due tomorrow", task({ dueDate: "2026-10-08" }), "upcoming"],
      ["due last year", task({ dueDate: "2025-12-31" }), "missed"],
    ]);
  });

  it("all-day events never slip", () => {
    const allDay = (dueDate: string): StatusInput => ({ ...base, kind: "event", dueDate });
    expectStatus([
      ["all-day today", allDay("2026-10-07"), "dueToday"],
      ["all-day yesterday", allDay("2026-10-06"), "past"],
      ["all-day tomorrow", allDay("2026-10-08"), "upcoming"],
    ]);
  });

  it("timed tasks: a passed time is never Now", () => {
    expectStatus([
      ["later today", task({ startAt: at("15:00") }), "dueToday"],
      ["last millisecond of today", task({ startAt: "2026-10-07T23:59:59.999Z" }), "dueToday"],
      ["exactly at midnight tonight", task({ startAt: at("00:00", "2026-10-08") }), "upcoming"],
      ["time is exactly now", task({ startAt: at("10:00") }), "missed"],
      ["one minute ago", task({ startAt: at("09:59") }), "missed"],
      ["earlier yesterday", task({ startAt: at("15:00", "2026-10-06") }), "missed"],
    ]);
  });

  it("timed tasks with a time window are Now inside the window", () => {
    expectStatus([
      ["inside window", task({ startAt: at("09:00"), endAt: at("11:00") }), "ongoing"],
      ["window ends exactly now", task({ startAt: at("08:00"), endAt: at("10:00") }), "missed"],
      ["window later today", task({ startAt: at("14:00"), endAt: at("15:00") }), "dueToday"],
    ]);
  });

  it("events: Now while running, then Past", () => {
    expectStatus([
      ["in progress", event(at("09:30"), at("10:30")), "ongoing"],
      ["starts exactly now", event(at("10:00"), at("11:00")), "ongoing"],
      ["ended exactly now", event(at("09:00"), at("10:00")), "past"],
      ["ended this morning", event(at("08:00"), at("09:00")), "past"],
      ["later today", event(at("16:00"), at("17:00")), "dueToday"],
      ["tomorrow", event(at("09:00", "2026-10-08"), at("10:00", "2026-10-08")), "upcoming"],
      ["overnight, started yesterday", event(at("23:00", "2026-10-06"), at("11:00")), "ongoing"],
      ["yesterday", event(at("09:00", "2026-10-06"), at("10:00", "2026-10-06")), "past"],
    ]);
  });

  it("repeating tasks: earlier days' computed occurrences are past, not slipped", () => {
    expectStatus([
      ["computed, yesterday", task({ id: "s1@2026-10-06", dueDate: "2026-10-06" }), "past"],
      [
        "computed, earlier today",
        task({ id: "s1@2026-10-07T08:00", startAt: at("08:00") }),
        "missed",
      ],
      ["stored (moved) occurrence, yesterday", task({ id: "x9", dueDate: "2026-10-06" }), "missed"],
      ["computed, today", task({ id: "s1@2026-10-07", dueDate: "2026-10-07" }), "dueToday"],
    ]);
  });
});
