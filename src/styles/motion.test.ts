import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// P2-T13 / DESIGN_SYSTEM §6.3: with "reduce motion" on, movement becomes a short fade and
// loops stop. Every animated class in globals.css must be covered by the reduce-motion block.
// (Vitest replaces CSS imports with empty strings, so the file is read from disk.)
const css = readFileSync(path.resolve(import.meta.dirname, "globals.css"), "utf8");

function animatedClasses(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\.([a-z-]+)\s*\{[^}]*animation(?:-name)?:\s*([a-z-]+)/g)) {
    const [, cls, name] = match;
    if (cls && name !== "none" && name !== "fade-in") found.add(cls);
  }
  return [...found];
}

describe("reduce motion", () => {
  const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
  const reduceBlock = css.slice(start, css.indexOf("@keyframes", start));

  it("has a reduce-motion block", () => {
    expect(start).toBeGreaterThan(-1);
  });

  it("covers every animated class (except gentle fades and the toast timer bar)", () => {
    const uncovered = animatedClasses(css)
      .filter((cls) => cls !== "toast-timer") // a progress bar, not movement
      .filter((cls) => !reduceBlock.includes(`.${cls}`));
    expect(uncovered).toEqual([]);
  });
});
