import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseCapture, type ChipKind, type ParsedCapture } from "@/lib/nlp/parseCapture";
import type { Area } from "@/types/Area";

const originalTZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "UTC";
});
afterAll(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const area = (id: string, name: string): Area => ({
  id,
  name,
  color: `area.${id}`,
  icon: "circle",
  sortOrder: 0,
  isArchived: false,
});
const areas = [
  area("work", "Work"),
  area("home", "Home"),
  area("personal", "Personal"),
  area("learning", "Learning"),
  area("health", "Health"),
];

/** Wednesday 7 October 2026, 10:00 local. */
const now = () => new Date("2026-10-07T10:00:00");
const parse = (text: string, ignore?: ChipKind[]) =>
  parseCapture(text, { now: now(), areas, ignore: new Set(ignore) });

type Expect = Partial<Omit<ParsedCapture, "chips">>;

// [input, expected fields]: 40+ phrases (P1-T11 acceptance).
const CASES: [string, Expect][] = [
  // The PRD example
  [
    "Call bank tomorrow 3pm #home !high",
    { title: "Call bank", date: "2026-10-08", time: "15:00", areaId: "home", priority: 3 },
  ],
  // Relative days
  ["Buy milk today", { title: "Buy milk", date: "2026-10-07", time: null }],
  ["Buy milk tomorrow", { title: "Buy milk", date: "2026-10-08", time: null }],
  ["Call grandma tonight", { title: "Call grandma", date: "2026-10-07", time: null }],
  ["Dentist next Fri", { title: "Dentist", date: "2026-10-16" }],
  ["Report by Friday", { title: "Report", date: "2026-10-09" }],
  ["Report due Friday", { title: "Report", date: "2026-10-09" }],
  ["Water plants on Saturday", { title: "Water plants", date: "2026-10-10" }],
  ["Gym Monday", { title: "Gym", date: "2026-10-12" }],
  ["Plan trip next week", { title: "Plan trip", date: "2026-10-14" }],
  ["Review budget in 3 days", { title: "Review budget", date: "2026-10-10" }],
  // Absolute dates
  ["Exam on 14 October", { title: "Exam", date: "2026-10-14" }],
  ["Exam October 20", { title: "Exam", date: "2026-10-20" }],
  ["Renew passport 15/11/2026", { title: "Renew passport", date: "2026-11-15" }],
  ["Tax return 2026-12-01", { title: "Tax return", date: "2026-12-01" }],
  ["Birthday party Dec 3", { title: "Birthday party", date: "2026-12-03" }],
  ["Holiday Jan 5", { title: "Holiday", date: "2027-01-05" }], // forward: next January
  // Times
  ["Standup 9:30", { title: "Standup", date: "2026-10-08", time: "09:30" }], // already past today → tomorrow
  ["Lunch at noon", { title: "Lunch", date: "2026-10-07", time: "12:00" }],
  ["Call supplier at 4pm", { title: "Call supplier", date: "2026-10-07", time: "16:00" }],
  ["Team sync at 9", { title: "Team sync", date: "2026-10-08", time: "09:00" }],
  ["Stretch in 2 hours", { title: "Stretch", date: "2026-10-07", time: "12:00" }],
  ["Check oven in 30 minutes", { title: "Check oven", date: "2026-10-07", time: "10:30" }],
  [
    "Submit assignment Friday 6pm #learning",
    { title: "Submit assignment", date: "2026-10-09", time: "18:00", areaId: "learning" },
  ],
  ["Call mom tomorrow at 7:15 pm", { title: "Call mom", date: "2026-10-08", time: "19:15" }],
  ["Run 6am tomorrow", { title: "Run", date: "2026-10-08", time: "06:00" }],
  // Ranges → duration
  ["Meeting 3-4pm", { title: "Meeting", time: "15:00", durationMinutes: 60 }],
  [
    "Workshop tomorrow 10am-12pm #work",
    { title: "Workshop", date: "2026-10-08", time: "10:00", durationMinutes: 120, areaId: "work" },
  ],
  ["Call 2:30pm to 3pm", { title: "Call", time: "14:30", durationMinutes: 30 }],
  // Areas
  ["Fix tap #home", { title: "Fix tap", areaId: "home", date: null }],
  ["Read chapter #Learning", { title: "Read chapter", areaId: "learning" }],
  ["Yoga #HEALTH tomorrow", { title: "Yoga", areaId: "health", date: "2026-10-08" }],
  ["Ideas #random", { title: "Ideas #random", areaId: null }], // unknown tag stays in the title
  ["#work Send invoice", { title: "Send invoice", areaId: "work" }],
  // Priorities
  ["Pay bill !high", { title: "Pay bill", priority: 3 }],
  ["Pay bill !h", { title: "Pay bill", priority: 3 }],
  ["Tidy desk !low", { title: "Tidy desk", priority: 1 }],
  ["Email Sam !med", { title: "Email Sam", priority: 2 }],
  ["Email Sam !2", { title: "Email Sam", priority: 2 }],
  ["Wow!", { title: "Wow!", priority: null }], // "!" inside a word is not a priority
  // Repeating (recognised, saved once until Phase 2)
  ["Gym every Monday", { title: "Gym", repeat: "every Monday", date: "2026-10-12" }],
  ["Take vitamins daily", { title: "Take vitamins", repeat: "daily" }],
  [
    "Water plants every week #home",
    { title: "Water plants", repeat: "every week", areaId: "home" },
  ],
  // Nothing to parse: the title is untouched
  ["Buy 2 apples", { title: "Buy 2 apples", date: null, time: null }],
  ["May the force be with you", { title: "May the force be with you", date: null }],
  ["Read 1984", { title: "Read 1984", date: null }],
  ["  Plain task  ", { title: "Plain task" }],
];

describe("parseCapture", () => {
  it.each(CASES)("%s", (input, expected) => {
    expect(parse(input)).toMatchObject(expected);
  });

  it("has at least 40 phrases", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
  });

  it("lists the recognised parts as chips in display order", () => {
    expect(parse("Call bank tomorrow 3pm #home !high").chips).toEqual([
      "date",
      "time",
      "area",
      "priority",
    ]);
    expect(parse("Gym every Monday").chips).toEqual(["date", "repeat"]);
    expect(parse("Just a note").chips).toEqual([]);
  });

  it("removed chips leave their words in the title", () => {
    const noDate = parse("Call bank tomorrow 3pm #home", ["date"]);
    expect(noDate).toMatchObject({
      title: "Call bank tomorrow 3pm",
      date: null,
      time: null,
      areaId: "home",
    });

    const noTime = parse("Call bank tomorrow 3pm", ["time"]);
    expect(noTime).toMatchObject({ date: "2026-10-08", time: null });

    const noArea = parse("Fix tap #home", ["area"]);
    expect(noArea).toMatchObject({ title: "Fix tap #home", areaId: null });

    const noPriority = parse("Pay bill !high", ["priority"]);
    expect(noPriority).toMatchObject({ title: "Pay bill !high", priority: null });
  });

  it("never returns an empty title", () => {
    expect(parse("tomorrow 3pm").title).toBe("tomorrow 3pm");
    expect(parse("#work").title).toBe("#work");
  });

  it("works in other time zones and across a DST change", () => {
    const original = process.env.TZ;
    process.env.TZ = "America/New_York";
    // Saturday 31 Oct 2026, 10:00 EDT; clocks go back on Sunday 1 Nov.
    const result = parseCapture("Call Dad Monday 9am", {
      now: new Date("2026-10-31T14:00:00Z"),
      areas,
    });
    expect(result).toMatchObject({ title: "Call Dad", date: "2026-11-02", time: "09:00" });
    process.env.TZ = original;
  });
});
