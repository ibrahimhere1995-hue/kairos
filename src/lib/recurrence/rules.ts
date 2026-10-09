import { format, parseISO } from "date-fns";
import type { TFunction } from "i18next";

/**
 * Repeat rules (RFC 5545 RRULE without DTSTART; the item's own date is the first occurrence).
 * The backend validates and expands them (src-tauri/src/scheduler/recurrence.rs); this file
 * builds them from the editor's choices and Quick Capture phrases, and describes them in
 * plain language.
 */

export type RepeatPreset = "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "yearly";

export const REPEAT_PRESETS: RepeatPreset[] = [
  "daily",
  "weekdays",
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
];

const PRESET_RULES: Record<RepeatPreset, string> = {
  daily: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};

export type RepeatEnd =
  | { kind: "never" }
  | { kind: "count"; count: number }
  /** Last day (local `YYYY-MM-DD`) an occurrence may fall on. */
  | { kind: "until"; date: string };

const END_PARTS = /^(COUNT|UNTIL)=/;

/** The rule without its end (COUNT/UNTIL). */
function pattern(rule: string): string {
  return rule
    .split(";")
    .filter((part) => part !== "" && !END_PARTS.test(part))
    .join(";");
}

export function presetRule(preset: RepeatPreset, end: RepeatEnd = { kind: "never" }): string {
  return withEnd(PRESET_RULES[preset], end);
}

/** Which preset a rule is (ignoring how it ends), or null for anything else. */
export function presetOf(rule: string | null): RepeatPreset | null {
  if (!rule) return null;
  const core = pattern(rule.toUpperCase());
  return REPEAT_PRESETS.find((p) => PRESET_RULES[p] === core) ?? null;
}

export function withEnd(rule: string, end: RepeatEnd): string {
  const core = pattern(rule);
  if (end.kind === "count") return `${core};COUNT=${Math.max(1, Math.round(end.count))}`;
  if (end.kind === "until") {
    // The backend expands in local wall-clock time written as UTC: the end of that local day.
    return `${core};UNTIL=${end.date.replaceAll("-", "")}T235959Z`;
  }
  return core;
}

export function endOf(rule: string | null): RepeatEnd {
  if (!rule) return { kind: "never" };
  const count = /(?:^|;)COUNT=(\d+)/i.exec(rule);
  if (count?.[1]) return { kind: "count", count: Number(count[1]) };
  const until = /(?:^|;)UNTIL=(\d{4})(\d{2})(\d{2})/i.exec(rule);
  if (until) return { kind: "until", date: `${until[1]}-${until[2]}-${until[3]}` };
  return { kind: "never" };
}

/**
 * Plain-language summary, e.g. "Every week on Monday", "Every weekday", "Every month on the 14th".
 * `date` is the item's (local) date, which sets the weekday or day of the month.
 */
export function describeRule(rule: string | null, date: string, t: TFunction): string {
  if (!rule) return t("repeat.none");
  const day = parseISO(date);
  const preset = presetOf(rule);
  let text: string;
  switch (preset) {
    case "daily":
      text = t("repeat.daily");
      break;
    case "weekdays":
      text = t("repeat.weekdays");
      break;
    case "weekly":
      text = t("repeat.weeklyOn", { weekday: format(day, "EEEE") });
      break;
    case "biweekly":
      text = t("repeat.biweeklyOn", { weekday: format(day, "EEEE") });
      break;
    case "monthly":
      text = t("repeat.monthlyOn", { day: format(day, "do") });
      break;
    case "yearly":
      text = t("repeat.yearlyOn", { date: format(day, "d MMMM") });
      break;
    default:
      text = t("repeat.custom");
  }
  const end = endOf(rule);
  if (end.kind === "count") return t("repeat.withCount", { text, count: end.count });
  if (end.kind === "until") {
    return t("repeat.withUntil", { text, date: format(parseISO(end.date), "d MMM yyyy") });
  }
  return text;
}

const WEEKDAY_CODES: Record<string, string> = {
  mon: "MO",
  tue: "TU",
  wed: "WE",
  thu: "TH",
  fri: "FR",
  sat: "SA",
  sun: "SU",
};

/** Quick Capture: "every Monday", "every other week", "daily"… → a rule (null if unknown). */
export function phraseToRule(phrase: string): string | null {
  const p = phrase.toLowerCase().replace(/\s+/g, " ").trim();
  const every = p.startsWith("every other ") ? 2 : 1;
  const interval = every === 2 ? ";INTERVAL=2" : "";
  const unit = p.replace(/^every (other )?/, "");
  if (unit === "day" || p === "daily") return `FREQ=DAILY${interval}`;
  if (unit === "weekday") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  if (unit === "week" || p === "weekly") return `FREQ=WEEKLY${interval}`;
  if (unit === "month" || p === "monthly") return `FREQ=MONTHLY${interval}`;
  if (unit === "year" || p === "yearly") return `FREQ=YEARLY${interval}`;
  const code = WEEKDAY_CODES[unit.slice(0, 3)];
  return code ? `FREQ=WEEKLY${interval};BYDAY=${code}` : null;
}
