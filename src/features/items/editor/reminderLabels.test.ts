import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  reminderLabel,
  reminderSummary,
  toggleReminder,
} from "@/features/items/editor/reminderLabels";

const t = i18n.t.bind(i18n);

describe("reminder labels", () => {
  it("describes offsets in plain words", () => {
    expect(reminderLabel(0, false, "09:00", t)).toBe("At the time");
    expect(reminderLabel(0, true, "09:00", t)).toBe("On the day at 9:00 AM");
    expect(reminderLabel(0, true, "18:30", t)).toBe("On the day at 6:30 PM");
    expect(reminderLabel(5, false, "09:00", t)).toBe("5 min before");
    expect(reminderLabel(60, false, "09:00", t)).toBe("1 hour before");
    expect(reminderLabel(120, false, "09:00", t)).toBe("2 hours before");
    expect(reminderLabel(90, false, "09:00", t)).toBe("90 min before");
    expect(reminderLabel(1440, true, "09:00", t)).toBe("1 day before");
    expect(reminderLabel(2880, true, "09:00", t)).toBe("2 days before");
    expect(reminderLabel(10080, true, "09:00", t)).toBe("1 week before");
  });

  it("summarises the pill", () => {
    expect(reminderSummary([], false, "09:00", t)).toBe("No reminder");
    expect(reminderSummary([15], false, "09:00", t)).toBe("15 min before");
    expect(reminderSummary([0, 15], false, "09:00", t)).toBe("2 reminders");
  });

  it("toggles offsets and keeps them sorted", () => {
    expect(toggleReminder([0, 60], 15)).toEqual([0, 15, 60]);
    expect(toggleReminder([0, 15, 60], 15)).toEqual([0, 60]);
    expect(toggleReminder([], 0)).toEqual([0]);
  });
});
