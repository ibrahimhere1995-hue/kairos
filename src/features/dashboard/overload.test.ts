import { describe, expect, it } from "vitest";
import { overload } from "@/features/dashboard/overload";
import { getDayContext } from "@/lib/dates/dayContext";
import { makeItem } from "@/test/makeItem";

// Wednesday 14 Oct 2026, 13:00 local: 5 working hours left until 18:00.
const ctx = getDayContext(new Date(2026, 9, 14, 13, 0));
const local = (h: number, m = 0) => new Date(2026, 9, 14, h, m).toISOString();
const task = (id: string) => makeItem({ id, dueDate: "2026-10-14" });

describe("overbooked today (A4)", () => {
  it("compares tasks left with working time left, minus events", () => {
    const items = [
      makeItem({ id: "m", kind: "event", startAt: local(14), endAt: local(16) }), // 2 h busy
      makeItem({ id: "t", startAt: local(16), endAt: local(18) }), // 2 h of task
      ...["a", "b", "c", "d"].map(task), // 4 × 30 min
    ];
    expect(overload(items, ctx, "09:00", "18:00")).toEqual({ planned: 240, free: 180 });
  });

  it("stays quiet when it fits, after hours, or for done and slipped items", () => {
    expect(overload([task("a"), task("b")], ctx, "09:00", "18:00")).toBeNull();
    expect(
      overload([task("a")], getDayContext(new Date(2026, 9, 14, 19)), "09:00", "18:00"),
    ).toBeNull();
    const done = { ...task("x"), completedAt: local(9) };
    const older = makeItem({ id: "o", dueDate: "2026-10-12" });
    const many = Array.from({ length: 12 }, () => done).concat(Array(12).fill(older));
    expect(overload(many, ctx, "09:00", "18:00")).toBeNull();
  });

  it("only counts the part of a timed task still ahead", () => {
    const long = makeItem({ id: "l", startAt: local(9), endAt: local(19) }); // 5 h left in hours
    const meeting = makeItem({ id: "m", kind: "event", startAt: local(13), endAt: local(15) });
    expect(overload([long, meeting], ctx, "09:00", "18:00")).toEqual({ planned: 300, free: 180 });
  });
});
