import { afterEach, describe, expect, it } from "vitest";
import {
  emptyItemForm,
  formFromDetail,
  itemFormSchema,
  toChecklistInput,
  toItemInput,
  type ItemFormValues,
} from "@/features/items/itemForm";
import type { Item } from "@/types/Item";

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const form = (fields: Partial<ItemFormValues>): ItemFormValues => ({
  ...emptyItemForm("2026-10-07"),
  title: "Call bank",
  ...fields,
});

const issues = (values: ItemFormValues) => {
  const result = itemFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

const storedItem: Item = {
  id: "i1",
  kind: "event",
  title: "Standup",
  notes: null,
  areaId: null,
  priority: 0,
  allDay: false,
  startAt: "2026-10-07T13:00:00.000Z",
  endAt: "2026-10-07T13:30:00.000Z",
  dueDate: null,
  completedAt: null,
  skippedAt: null,
  location: "Room 4",
  rrule: null,
  recurrenceParentId: null,
  originalStartAt: null,
  milestoneId: null,
  rescheduleCount: 0,
  source: "quick",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
};

describe("item form validation", () => {
  it("requires a title", () => {
    expect(issues(form({ title: "   " }))).toEqual(["title:errors.validation.required"]);
  });

  it("events need a date and, when timed, a duration", () => {
    expect(issues(form({ kind: "event", schedule: "none" }))).toContain(
      "date:errors.validation.eventNeedsDate",
    );
    expect(issues(form({ kind: "event", schedule: "time", durationMinutes: 0 }))).toContain(
      "durationMinutes:errors.validation.eventNeedsEnd",
    );
  });

  it("accepts a plain dated task", () => {
    expect(issues(form({}))).toEqual([]);
  });
});

describe("toItemInput", () => {
  it("date-only task sends a due date", () => {
    expect(toItemInput(form({ schedule: "date", date: "2026-10-08" }), null)).toMatchObject({
      dueDate: "2026-10-08",
      startAt: null,
      endAt: null,
      source: "manual",
    });
  });

  it("converts local time to UTC using the device time zone", () => {
    process.env.TZ = "America/New_York"; // EDT, UTC-4
    const input = toItemInput(
      form({
        kind: "event",
        schedule: "time",
        date: "2026-10-07",
        time: "09:00",
        durationMinutes: 30,
      }),
      null,
    );
    expect(input.startAt).toBe("2026-10-07T13:00:00.000Z");
    expect(input.endAt).toBe("2026-10-07T13:30:00.000Z");
    expect(input.dueDate).toBeNull();
  });

  it("unscheduled task has no dates", () => {
    expect(toItemInput(form({ schedule: "none" }), null)).toMatchObject({
      dueDate: null,
      startAt: null,
    });
  });

  it("keeps fields the editor doesn't show yet", () => {
    const input = toItemInput(form({}), storedItem);
    expect(input.location).toBe("Room 4");
    expect(input.source).toBe("quick");
  });
});

describe("formFromDetail", () => {
  it("round-trips a timed event in local time", () => {
    process.env.TZ = "America/New_York";
    const values = formFromDetail({ item: storedItem, checklist: [] }, "2026-10-07");
    expect(values).toMatchObject({
      schedule: "time",
      date: "2026-10-07",
      time: "09:00",
      durationMinutes: 30,
    });
    expect(toItemInput(values, storedItem)).toMatchObject({
      startAt: storedItem.startAt,
      endAt: storedItem.endAt,
    });
  });
});

describe("toChecklistInput", () => {
  it("drops blank steps and trims text", () => {
    expect(
      toChecklistInput(
        form({
          checklist: [
            { stepId: "s1", text: " Pack ", done: true },
            { stepId: null, text: "  ", done: false },
          ],
        }),
      ),
    ).toEqual([{ id: "s1", text: "Pack", done: true }]);
  });
});
