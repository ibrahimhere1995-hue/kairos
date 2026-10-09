import { describe, expect, it } from "vitest";
import { groupHits, matchCommands, type PaletteCommand } from "@/features/search/paletteEntries";
import type { DayContext } from "@/lib/dates/dayContext";
import type { Item } from "@/types/Item";
import type { SearchHit } from "@/types/SearchHit";

const ctx: DayContext = {
  now: new Date("2026-10-07T10:00:00.000Z"),
  today: "2026-10-07",
  dayStart: new Date("2026-10-07T00:00:00.000Z"),
  dayEnd: new Date("2026-10-08T00:00:00.000Z"),
};

function hit(id: string, fields: Partial<Item>): SearchHit {
  return {
    matchedIn: "title",
    item: {
      id,
      kind: "task",
      title: id,
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
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      deletedAt: null,
      ...fields,
    },
  };
}

const noop = () => undefined;
const commands: PaletteCommand[] = [
  { id: "new", label: "New task", keywords: "add create capture", run: noop },
  { id: "week", label: "Go to calendar: week view", keywords: "show", run: noop },
  { id: "dark", label: "Switch to dark theme", keywords: "appearance mode", run: noop },
];

describe("palette entries", () => {
  it("matches commands by label and keywords, every word", () => {
    expect(matchCommands(commands, "").map((c) => c.id)).toEqual(["new", "week", "dark"]);
    expect(matchCommands(commands, "add").map((c) => c.id)).toEqual(["new"]);
    expect(matchCommands(commands, "go week").map((c) => c.id)).toEqual(["week"]);
    expect(matchCommands(commands, "THEME").map((c) => c.id)).toEqual(["dark"]);
    expect(matchCommands(commands, "dentist")).toEqual([]);
  });

  it("groups results by status in a fixed order", () => {
    const groups = groupHits(
      [
        hit("later", { dueDate: "2026-10-09" }),
        hit("today", { dueDate: "2026-10-07" }),
        hit("slipped", { dueDate: "2026-10-01" }),
        hit("inbox", {}),
        hit("done", { dueDate: "2026-10-01", completedAt: "2026-10-02T00:00:00.000Z" }),
        hit("event", { kind: "event", dueDate: "2026-10-01" }),
      ],
      ctx,
    );
    expect(groups.map((g) => [g.group, g.hits.map((h) => h.item.id)])).toEqual([
      ["today", ["today"]],
      ["slipped", ["slipped"]],
      ["upcoming", ["later"]],
      ["noDate", ["inbox"]],
      ["done", ["done"]],
      ["past", ["event"]],
    ]);
  });
});
