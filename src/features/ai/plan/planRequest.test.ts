import { describe, expect, it } from "vitest";
import { buildPlanRequest, planDates, planTasks } from "@/features/ai/plan/planRequest";
import { getDayContext } from "@/lib/dates/dayContext";
import type { Item } from "@/types/Item";

const item = (fields: Partial<Item>): Item => ({
  id: "i1",
  kind: "task",
  title: "Task",
  notes: "private notes",
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
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
  ...fields,
});

// Wednesday 14 Oct 2026, 10:00 local; the week ends on Monday 19 Oct.
const ctx = getDayContext(new Date(2026, 9, 14, 10, 0));

describe("Plan my day / week request", () => {
  it("covers today, or the rest of the week", () => {
    expect(planDates(ctx, "day", "2026-10-19")).toEqual(["2026-10-14"]);
    expect(planDates(ctx, "week", "2026-10-19")).toEqual([
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });

  it("lightens today by looking at the next six days", () => {
    expect(planDates(ctx, "lighten", "2026-10-19")).toEqual([
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
    ]);
    const request = buildPlanRequest({
      ctx,
      span: "lighten",
      weekEnd: "2026-10-19",
      instruction: "",
      rangeItems: [],
      candidates: [item({ id: "a", dueDate: "2026-10-14" })],
      dayStart: "08:00",
      dayEnd: "16:00",
    });
    expect(request.instruction).toMatch(/^Today is overbooked/);
    expect(request.days).toHaveLength(6);
    expect(request.tasks.map((t) => t.id)).toEqual(["a"]);
  });

  it("offers open tasks without a time, once each, never repeating ones", () => {
    const tasks = planTasks([
      item({ id: "a", title: "Report", dueDate: "2026-10-14" }),
      item({ id: "a", title: "Report" }),
      item({ id: "b", completedAt: "2026-10-14T08:00:00.000Z" }),
      item({ id: "c", startAt: "2026-10-14T08:00:00.000Z" }),
      item({ id: "d", kind: "event" }),
      item({ id: "e", rrule: "FREQ=DAILY" }),
      item({ id: "s@2026-10-14" }),
      item({ id: "f", title: "Inbox idea" }),
    ]);
    expect(tasks).toEqual([
      { id: "a", title: "Report", durationMinutes: null },
      { id: "f", title: "Inbox idea", durationMinutes: null },
    ]);
  });

  it("sends only titles and local times, never notes", () => {
    const meeting = item({
      id: "m",
      kind: "event",
      title: "Team sync",
      startAt: new Date(2026, 9, 14, 11, 0).toISOString(),
      endAt: new Date(2026, 9, 14, 12, 0).toISOString(),
    });
    const request = buildPlanRequest({
      ctx,
      span: "day",
      weekEnd: "2026-10-19",
      instruction: "  around my meeting ",
      rangeItems: [meeting],
      candidates: [item({ id: "a", title: "Report" }), item({ id: "z", dueDate: "2026-10-16" })],
      dayStart: "09:00",
      dayEnd: "18:00",
      preferredHours: "09:00–11:00",
    });
    expect(request).toEqual({
      instruction: "around my meeting",
      now: "2026-10-14T10:00",
      dayStart: "09:00",
      dayEnd: "18:00",
      days: [{ date: "2026-10-14", busy: [{ title: "Team sync", start: "11:00", end: "12:00" }] }],
      tasks: [{ id: "a", title: "Report", durationMinutes: null }],
      preferredHours: "09:00–11:00",
    });
    expect(JSON.stringify(request)).not.toContain("private notes");
  });
});
