import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Read from disk: Vitest replaces CSS imports (even `?raw`) with empty strings.
// Vitest runs from the project root.
const tokensCss = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8").replace(
  /\r\n/g,
  "\n",
);

// DESIGN_SYSTEM §3.5: body text ≥ 4.5:1, UI parts and icons ≥ 3:1 (WCAG 2.2 AA), in both themes.

function readBlock(selectorStart: string): Record<string, string> {
  const start = tokensCss.indexOf(selectorStart);
  const block = tokensCss.slice(start, tokensCss.indexOf("}", start));
  const tokens: Record<string, string> = {};
  for (const [, name, hex] of block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    if (name && hex) tokens[name] = hex;
  }
  return tokens;
}

const light = readBlock(':root,\n[data-theme="light"]');
const dark = { ...light, ...readBlock('[data-theme="dark"]') };

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;

// [foreground, background, minimum ratio]
const PAIRS: [string, string, number][] = [
  ["--text", "--bg", TEXT],
  ["--text", "--surface-2", TEXT],
  ["--text-muted", "--bg", TEXT],
  ["--text-muted", "--surface", TEXT],
  ["--text-subtle", "--bg", TEXT],
  ["--text-subtle", "--surface", TEXT],
  ["--text-subtle", "--surface-2", TEXT],
  ["--accent-text", "--bg", TEXT],
  ["--accent-text", "--surface", TEXT],
  ["--on-accent", "--accent", TEXT],
  ["--on-accent", "--accent-hover", TEXT],
  ["--on-danger", "--danger", TEXT],
  ["--focus-ring", "--bg", UI],
  ["--focus-ring", "--surface-2", UI],
  ["--success", "--surface", UI],
  ["--warning", "--surface", UI],
  ["--info", "--surface", UI],
  ["--danger", "--surface", UI],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_theme, tokens) => {
  it.each(PAIRS)("%s on %s meets %s:1", (fg, bg, min) => {
    const fgHex = tokens[fg];
    const bgHex = tokens[bg];
    expect(fgHex, `${fg} missing`).toBeDefined();
    expect(bgHex, `${bg} missing`).toBeDefined();
    expect(contrast(fgHex ?? "", bgHex ?? "")).toBeGreaterThanOrEqual(min);
  });
});
