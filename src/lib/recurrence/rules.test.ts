import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  describeRule,
  endOf,
  phraseToRule,
  presetOf,
  presetRule,
  repeatsOftenerThanWeekly,
  withEnd,
} from "@/lib/recurrence/rules";

const t = i18n.t.bind(i18n);

describe("repeat rules", () => {
  it("builds presets and recognises them again", () => {
    expect(presetRule("weekdays")).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(presetRule("biweekly")).toBe("FREQ=WEEKLY;INTERVAL=2");
    expect(presetOf("FREQ=WEEKLY;COUNT=5")).toBe("weekly");
    expect(presetOf("freq=daily")).toBe("daily");
    expect(presetOf("FREQ=WEEKLY;BYDAY=MO,WE")).toBeNull();
    expect(presetOf(null)).toBeNull();
  });

  it("sets and reads how a series ends", () => {
    expect(withEnd("FREQ=DAILY;COUNT=3", { kind: "never" })).toBe("FREQ=DAILY");
    expect(withEnd("FREQ=DAILY", { kind: "count", count: 10 })).toBe("FREQ=DAILY;COUNT=10");
    expect(withEnd("FREQ=DAILY;COUNT=10", { kind: "until", date: "2026-12-31" })).toBe(
      "FREQ=DAILY;UNTIL=20261231T235959Z",
    );
    expect(endOf("FREQ=DAILY;COUNT=4")).toEqual({ kind: "count", count: 4 });
    expect(endOf("FREQ=DAILY;UNTIL=20261231T235959Z")).toEqual({
      kind: "until",
      date: "2026-12-31",
    });
    expect(endOf("FREQ=DAILY")).toEqual({ kind: "never" });
  });

  it("describes rules in plain language", () => {
    const monday = "2026-10-12";
    expect(describeRule(null, monday, t)).toBe("Does not repeat");
    expect(describeRule("FREQ=DAILY", monday, t)).toBe("Every day");
    expect(describeRule("FREQ=WEEKLY", monday, t)).toBe("Every week on Monday");
    expect(describeRule("FREQ=WEEKLY;INTERVAL=2", monday, t)).toBe("Every 2 weeks on Monday");
    expect(describeRule("FREQ=MONTHLY", monday, t)).toBe("Every month on the 12th");
    expect(describeRule("FREQ=YEARLY", monday, t)).toBe("Every year on 12 October");
    expect(describeRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", monday, t)).toBe("Every weekday");
    expect(describeRule("FREQ=WEEKLY;BYDAY=MO,WE", monday, t)).toBe("Custom repeat");
    expect(describeRule("FREQ=DAILY;COUNT=5", monday, t)).toBe("Every day, 5 times");
    expect(describeRule("FREQ=DAILY;UNTIL=20261231T235959Z", monday, t)).toBe(
      "Every day, until 31 Dec 2026",
    );
  });

  it("understands Quick Capture phrases", () => {
    expect(phraseToRule("every Monday")).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(phraseToRule("every other Friday")).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=FR");
    expect(phraseToRule("every tues")).toBe("FREQ=WEEKLY;BYDAY=TU");
    expect(phraseToRule("every day")).toBe("FREQ=DAILY");
    expect(phraseToRule("daily")).toBe("FREQ=DAILY");
    expect(phraseToRule("every other week")).toBe("FREQ=WEEKLY;INTERVAL=2");
    expect(phraseToRule("every weekday")).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(phraseToRule("monthly")).toBe("FREQ=MONTHLY");
    expect(phraseToRule("every year")).toBe("FREQ=YEARLY");
    expect(phraseToRule("every blue moon")).toBeNull();
  });

  it("knows which routines come round more than weekly", () => {
    expect(repeatsOftenerThanWeekly("FREQ=DAILY")).toBe(true);
    expect(repeatsOftenerThanWeekly("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe(true);
    expect(repeatsOftenerThanWeekly("FREQ=WEEKLY;BYDAY=MO")).toBe(false);
    expect(repeatsOftenerThanWeekly("FREQ=WEEKLY")).toBe(false);
    expect(repeatsOftenerThanWeekly("FREQ=MONTHLY")).toBe(false);
    expect(repeatsOftenerThanWeekly(null)).toBe(false);
  });
});
