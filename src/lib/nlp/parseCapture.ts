import * as chrono from "chrono-node";
import { differenceInMinutes, format } from "date-fns";
import type { Area } from "@/types/Area";

/**
 * Offline natural-language capture (PRD R4, P1-T11):
 * "Call bank tomorrow 3pm #home !high" → title "Call bank", tomorrow 15:00, area Home, priority High.
 * Pure and synchronous; the caller passes "now" and the user's areas.
 */

export type ChipKind = "date" | "time" | "area" | "priority" | "repeat";

export interface ParsedCapture {
  title: string;
  /** Local `YYYY-MM-DD`. */
  date: string | null;
  /** Local `HH:mm`. */
  time: string | null;
  /** From ranges like "3-4pm". */
  durationMinutes: number | null;
  areaId: string | null;
  /** 1 low, 2 medium, 3 high. */
  priority: 1 | 2 | 3 | null;
  /** "every Monday" etc. Recognised but not saved until recurrence lands (P2-T06). */
  repeat: string | null;
  /** Which parts were recognised, in display order. */
  chips: ChipKind[];
}

export interface ParseOptions {
  now: Date;
  areas: Area[];
  /** Parts the user removed: they stay in the title instead of being applied. */
  ignore?: ReadonlySet<ChipKind>;
}

const PRIORITY = /(^|\s)!(high|h|3|medium|med|m|2|low|l|1)(?=\s|$)/i;
const PRIORITY_LEVEL: Record<string, 1 | 2 | 3> = {
  high: 3,
  h: 3,
  "3": 3,
  medium: 2,
  med: 2,
  m: 2,
  "2": 2,
  low: 1,
  l: 1,
  "1": 1,
};
const TAG = /(^|\s)#([\p{L}\p{N}_-]+)/gu;
const WEEKDAY = "(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?";
const REPEAT = new RegExp(
  `\\b(?:every\\s+(?:other\\s+)?(?:day|weekday|week|month|year|${WEEKDAY})|daily|weekly|monthly|yearly)\\b`,
  "i",
);
/** Words left dangling once a date is removed: "Report by", "Lunch at". */
const DANGLING = /\s+(?:at|on|by|for|due|from|in|until)$/i;

const normalise = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

function cut(text: string, index: number, length: number): string {
  return `${text.slice(0, index)} ${text.slice(index + length)}`;
}

function tidy(text: string): string {
  let out = text.replace(/\s+/g, " ").trim();
  while (DANGLING.test(out)) out = out.replace(DANGLING, "").trim();
  return out.replace(/^(?:on|at|by)\s+/i, "").trim();
}

export function parseCapture(
  input: string,
  { now, areas, ignore = new Set() }: ParseOptions,
): ParsedCapture {
  let working = input;
  const result: ParsedCapture = {
    title: "",
    date: null,
    time: null,
    durationMinutes: null,
    areaId: null,
    priority: null,
    repeat: null,
    chips: [],
  };

  // !priority
  const p = PRIORITY.exec(working);
  if (p && !ignore.has("priority")) {
    result.priority = PRIORITY_LEVEL[(p[2] ?? "").toLowerCase()] ?? null;
    working = cut(working, p.index, p[0].length);
  }

  // #area: the first tag that names one of the user's areas; unknown tags stay in the title.
  if (!ignore.has("area")) {
    for (const tag of working.matchAll(TAG)) {
      const area = areas.find((a) => normalise(a.name) === normalise(tag[2] ?? ""));
      if (area) {
        result.areaId = area.id;
        working = cut(working, tag.index, tag[0].length);
        break;
      }
    }
  }

  // "every Monday": flag it, and use its weekday as the first date below.
  let repeatHint: string | null = null;
  const r = REPEAT.exec(working);
  if (r && !ignore.has("repeat")) {
    result.repeat = r[0];
    repeatHint = new RegExp(WEEKDAY, "i").exec(r[0])?.[0] ?? null;
    working = cut(working, r.index, r[0].length);
  }

  // Dates and times (chrono-node, English).
  if (!ignore.has("date")) {
    const found = chrono.parse(working, now, { forwardDate: true })[0];
    const parsed =
      found ?? (repeatHint ? chrono.parse(repeatHint, now, { forwardDate: true })[0] : undefined);
    if (parsed) {
      const start = parsed.start.date();
      result.date = format(start, "yyyy-MM-dd");
      if (parsed.start.isCertain("hour") && !ignore.has("time")) {
        result.time = format(start, "HH:mm");
        const end = parsed.end?.date();
        if (end && end > start) result.durationMinutes = differenceInMinutes(end, start);
      }
      if (found) working = cut(working, found.index, found.text.length);
    }
  }

  result.title = tidy(working) || input.trim();
  result.chips = (["date", "time", "area", "priority", "repeat"] as const).filter((kind) => {
    switch (kind) {
      case "date":
        return result.date !== null;
      case "time":
        return result.time !== null;
      case "area":
        return result.areaId !== null;
      case "priority":
        return result.priority !== null;
      case "repeat":
        return result.repeat !== null;
    }
  });
  return result;
}
