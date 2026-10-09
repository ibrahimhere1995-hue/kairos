import { describe, expect, it } from "vitest";
import { looksUnsure } from "@/features/capture/looksUnsure";
import { parseCapture } from "@/lib/nlp/parseCapture";

const now = new Date(2026, 9, 9, 14, 5);
const unsure = (text: string) => looksUnsure(text, parseCapture(text, { now, areas: [] }));

describe("when to offer Read with AI", () => {
  it("offers it for sentences the offline parser can't read", () => {
    expect(unsure("remind me two days before mum's birthday on the 14th")).toBe(true);
    expect(unsure("Dentist the week after next")).toBe(true);
    expect(unsure("Book flights a week before the conference")).toBe(true);
  });

  it("stays quiet when the offline parser understood, or the text is short", () => {
    expect(unsure("Call bank tomorrow 3pm")).toBe(false);
    expect(unsure("Buy milk")).toBe(false);
    expect(unsure("Water the plants please")).toBe(false);
    expect(unsure("next week")).toBe(false);
  });
});
