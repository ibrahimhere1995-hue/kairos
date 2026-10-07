import { afterEach, describe, expect, it } from "vitest";
import { weeklyBalance } from "@/features/dashboard/balance";
import { buildDashboardQuery, currentWeekRange } from "@/features/dashboard/dashboardQuery";
import { groupDashboard, isEmpty, summarize } from "@/features/dashboard/groupDashboard";
import { getDayContext, type DayContext } from "@/lib/dates/dayContext";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const ctx: DayContext = {
  now: new Date("2026-10-07T10:00:00.000Z"),
  today: "2026-10-07",
  dayStart: new Date("2026-10-07T00:00:00.000Z"),
  dayEnd: new Date("2026-10-08T00:00:00.000Z"),
};

let n = 0;
function item(fields: Partial<Item>): Item {
  n += 1;
  return {
    id: `i${n}`,
    kind: "task",
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

const titles = (list: { item: Item }[]) => list.map((e) => e.item.title);

describe("groupDashboard", () => {
  const meetingNow = item({
    title: "Meeting now",
    kind: "event",
    startAt: "2026-10-07T09:30:00.000Z",
    endAt: "2026-10-07T10:30:00.000Z",
  });
  const meetingOver = item({
    title: "Meeting over",
    kind: "event",
    startAt: "2026-10-07T08:00:00.000Z",
    endAt: "2026-10-07T09:00:00.000Z",
  });
  const laterToday = item({
    title: "Later today",
    startAt: "2026-10-07T15:00:00.000Z",
    areaId: "work",
  });
  const dateOnly = item({ title: "Date only", dueDate: "2026-10-07", allDay: true });
  const passedToday = item({ title: "Passed this morning", startAt: "2026-10-07T08:00:00.000Z" });
  const yesterday = item({
    title: "Yesterday",
    dueDate: "2026-10-06",
    allDay: true,
    areaId: "work",
  });
  const friday = item({ title: "Friday", dueDate: "2026-10-09", allDay: true });
  const done = item({
    title: "Done",
    completedAt: "2026-10-07T09:00:00.000Z",
    dueDate: "2026-10-07",
  });

  const data = {
    today: [passedToday, meetingOver, meetingNow, laterToday, dateOnly],
    overdue: [yesterday],
    thisWeek: [friday],
    doneToday: [done],
  };

  it("places items by status: Now, Today, Slipped (only tasks), This week, Done", () => {
    const s = groupDashboard(data, ctx);
    expect(titles(s.now)).toEqual(["Meeting now"]);
    expect(titles(s.today)).toEqual(["Later today", "Date only"]);
    expect(titles(s.slipped)).toEqual(["Yesterday", "Passed this morning"]);
    expect(titles(s.thisWeek)).toEqual(["Friday"]);
    expect(titles(s.doneToday)).toEqual(["Done"]);
    // The meeting that already ended appears nowhere: it's past, never "slipped".
    expect(
      Object.values(s)
        .flat()
        .some((e) => e.item.title === "Meeting over"),
    ).toBe(false);
  });

  it("filters every section by life area", () => {
    const s = groupDashboard(data, ctx, "work");
    expect(titles(s.today)).toEqual(["Later today"]);
    expect(titles(s.slipped)).toEqual(["Yesterday"]);
    expect(s.now).toEqual([]);
  });

  it("summarises what's left today", () => {
    expect(summarize(groupDashboard(data, ctx))).toEqual({ tasks: 2, meetings: 1, slipped: 2 });
  });

  it("detects an empty day", () => {
    const empty = groupDashboard({ today: [], overdue: [], thisWeek: [], doneToday: [] }, ctx);
    expect(isEmpty(empty)).toBe(true);
    expect(isEmpty(groupDashboard(data, ctx))).toBe(false);
  });
});

describe("week range and dashboard query", () => {
  it("weeks start on Monday by default, in local time", () => {
    process.env.TZ = "America/New_York";
    const local = getDayContext(new Date("2026-10-07T16:00:00Z")); // Wed 12:00 EDT
    const week = currentWeekRange(local);
    expect(week.startDate).toBe("2026-10-05");
    expect(week.endDate).toBe("2026-10-12");
    expect(week.start).toBe("2026-10-05T04:00:00.000Z");

    const query = buildDashboardQuery(local);
    expect(query).toMatchObject({
      today: "2026-10-07",
      weekEndDate: "2026-10-12",
      weekEnd: week.end,
    });
  });

  it("on Sunday the week still ends at the coming Monday", () => {
    process.env.TZ = "Europe/London";
    const sunday = getDayContext(new Date("2026-10-11T12:00:00Z"));
    expect(currentWeekRange(sunday).endDate).toBe("2026-10-12");
  });
});

describe("weeklyBalance", () => {
  const areas: Area[] = [
    {
      id: "work",
      name: "Work",
      color: "area.work",
      icon: "briefcase",
      sortOrder: 0,
      isArchived: false,
    },
    {
      id: "health",
      name: "Health",
      color: "area.health",
      icon: "activity",
      sortOrder: 1,
      isArchived: false,
    },
  ];

  it("sums planned minutes per area and keeps empty areas at zero", () => {
    const items = [
      item({
        areaId: "work",
        startAt: "2026-10-06T09:00:00.000Z",
        endAt: "2026-10-06T10:30:00.000Z",
      }),
      item({
        areaId: "work",
        startAt: "2026-10-07T13:00:00.000Z",
        endAt: "2026-10-07T13:30:00.000Z",
        completedAt: "x",
      }),
      item({ areaId: "work", dueDate: "2026-10-08" }), // no duration: not counted
      item({
        areaId: null,
        startAt: "2026-10-07T09:00:00.000Z",
        endAt: "2026-10-07T10:00:00.000Z",
      }),
    ];
    expect(weeklyBalance(items, areas)).toEqual([
      { areaId: "work", name: "Work", color: "area.work", minutes: 120 },
      { areaId: "health", name: "Health", color: "area.health", minutes: 0 },
    ]);
  });
});
