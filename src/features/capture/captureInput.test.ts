import { afterEach, describe, expect, it } from "vitest";
import { captureToItemInput } from "@/features/capture/captureInput";
import { parseCapture } from "@/lib/nlp/parseCapture";
import type { Area } from "@/types/Area";

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const areas: Area[] = [
  { id: "home", name: "Home", color: "area.home", icon: "house", sortOrder: 0, isArchived: false },
];
const parse = (text: string) => parseCapture(text, { now: new Date("2026-10-07T10:00:00"), areas });

describe("captureToItemInput", () => {
  it("builds the PRD example as a timed, high-priority Home task", () => {
    process.env.TZ = "America/New_York";
    expect(captureToItemInput(parse("Call bank tomorrow 3pm #home !high"), "2026-10-07")).toEqual({
      kind: "task",
      title: "Call bank",
      notes: null,
      areaId: "home",
      priority: 3,
      startAt: "2026-10-08T19:00:00.000Z", // 15:00 EDT
      endAt: null,
      dueDate: null,
      location: null,
      source: "nlp",
    });
  });

  it("lands on Today when no date is given (PRD R4)", () => {
    expect(captureToItemInput(parse("Buy milk"), "2026-10-07")).toMatchObject({
      dueDate: "2026-10-07",
      startAt: null,
      source: "quick",
      priority: 0,
    });
  });

  it("keeps a date-only result as an all-day task and ranges as a duration", () => {
    process.env.TZ = "UTC";
    expect(captureToItemInput(parse("Dentist next Fri"), "2026-10-07")).toMatchObject({
      dueDate: "2026-10-16",
      startAt: null,
    });
    expect(captureToItemInput(parse("Meeting tomorrow 3-4pm"), "2026-10-07")).toMatchObject({
      startAt: "2026-10-08T15:00:00.000Z",
      endAt: "2026-10-08T16:00:00.000Z",
    });
  });
});
