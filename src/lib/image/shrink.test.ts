import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/image/shrink";

describe("fitWithin", () => {
  it("shrinks the longest side to 1600 px, keeping the shape", () => {
    expect(fitWithin(3200, 1800)).toEqual({ width: 1600, height: 900 });
    expect(fitWithin(1000, 4000)).toEqual({ width: 400, height: 1600 });
  });

  it("never enlarges small pictures", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
  });
});
