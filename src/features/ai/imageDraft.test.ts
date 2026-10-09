import { describe, expect, it } from "vitest";
import { imageDraftToForm } from "@/features/ai/imageDraft";

const draft = {
  title: "Dentist",
  date: null,
  time: null,
  durationMinutes: null,
  location: null,
  notes: null,
};

describe("imageDraftToForm", () => {
  it("fills what was read and leaves the rest", () => {
    expect(
      imageDraftToForm({
        ...draft,
        date: "2026-10-20",
        time: "09:30",
        durationMinutes: 45,
        location: "12 High St",
        notes: "Ref 123",
      }),
    ).toEqual({
      title: "Dentist",
      schedule: "time",
      date: "2026-10-20",
      time: "09:30",
      durationMinutes: 45,
      location: "12 High St",
      notes: "Ref 123",
    });
  });

  it("uses a whole day or the Inbox when no time or date was found", () => {
    expect(imageDraftToForm({ ...draft, date: "2026-10-20" }).schedule).toBe("date");
    expect(imageDraftToForm(draft)).toEqual({
      title: "Dentist",
      schedule: "none",
      location: "",
      notes: "",
    });
  });
});
