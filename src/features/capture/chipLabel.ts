import { format, parseISO } from "date-fns";
import type { TFunction } from "i18next";
import { friendlyDate, friendlyDuration } from "@/features/items/editor/friendlyDate";
import type { ChipKind, ParsedCapture } from "@/lib/nlp/parseCapture";
import { describeRule, phraseToRule } from "@/lib/recurrence/rules";
import type { Area } from "@/types/Area";

const PRIORITY_KEYS = { 1: "priority.low", 2: "priority.medium", 3: "priority.high" } as const;

/** Human text for one recognised part, e.g. "Tomorrow", "3:00 PM · 1 h", "Home", "High". */
export function chipLabel(
  kind: ChipKind,
  parsed: ParsedCapture,
  today: string,
  areas: Area[],
  t: TFunction,
): string {
  switch (kind) {
    case "date":
      return parsed.date ? friendlyDate(parsed.date, today, t) : "";
    case "time": {
      if (!parsed.date || !parsed.time) return "";
      const time = format(parseISO(`${parsed.date}T${parsed.time}`), "p");
      return parsed.durationMinutes
        ? `${time} · ${friendlyDuration(parsed.durationMinutes, t)}`
        : time;
    }
    case "area":
      return areas.find((a) => a.id === parsed.areaId)?.name ?? "";
    case "priority":
      return parsed.priority ? t(PRIORITY_KEYS[parsed.priority]) : "";
    case "repeat": {
      const rule = parsed.repeat ? phraseToRule(parsed.repeat) : null;
      return rule ? describeRule(rule, parsed.date ?? today, t) : (parsed.repeat ?? "");
    }
  }
}
