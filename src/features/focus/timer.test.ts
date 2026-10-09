import { describe, expect, it } from "vitest";
import { clampMinutes, formatClock, progress } from "@/features/focus/timer";

describe("focus timer", () => {
  it("formats the clock, rounding partial seconds up", () => {
    expect(formatClock(25 * 60_000)).toBe("25:00");
    expect(formatClock(245_001)).toBe("4:06");
    expect(formatClock(999)).toBe("0:01");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-5)).toBe("0:00");
  });

  it("keeps custom lengths in range", () => {
    expect(clampMinutes(0, 1, 180, 25)).toBe(1);
    expect(clampMinutes(500, 1, 180, 25)).toBe(180);
    expect(clampMinutes(12.6, 1, 180, 25)).toBe(13);
    expect(clampMinutes(Number.NaN, 1, 180, 25)).toBe(25);
  });

  it("reports progress through a phase", () => {
    expect(progress(60_000, 60_000)).toBe(0);
    expect(progress(15_000, 60_000)).toBe(0.75);
    expect(progress(0, 60_000)).toBe(1);
    expect(progress(5, 0)).toBe(1);
  });
});
