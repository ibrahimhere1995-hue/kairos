import { addMinutes } from "date-fns";
import type { ParsedCapture } from "@/lib/nlp/parseCapture";
import { phraseToRule } from "@/lib/recurrence/rules";
import type { ItemInput } from "@/types/ItemInput";

/**
 * Turns a parsed capture into a new task. PRD R4: with no date given it lands on Today.
 * Times are local and sent as UTC. "every Monday" etc. makes it repeat (P2-T06).
 * `reminders` (minutes before) replaces the default reminder, e.g. from an AI reading (A2).
 */
export function captureToItemInput(
  parsed: ParsedCapture,
  today: string,
  reminders?: number[],
): ItemInput {
  let startAt: string | null = null;
  let endAt: string | null = null;
  let dueDate: string | null = null;

  if (parsed.date && parsed.time) {
    const start = new Date(`${parsed.date}T${parsed.time}`); // no offset → local time
    startAt = start.toISOString();
    if (parsed.durationMinutes) endAt = addMinutes(start, parsed.durationMinutes).toISOString();
  } else {
    dueDate = parsed.date ?? today;
  }

  return {
    kind: "task",
    title: parsed.title,
    notes: null,
    areaId: parsed.areaId,
    priority: parsed.priority ?? 0,
    startAt,
    endAt,
    dueDate,
    location: null,
    source: parsed.chips.length > 0 ? "nlp" : "quick",
    rrule: parsed.repeat ? phraseToRule(parsed.repeat) : null,
    ...(reminders ? { reminders } : {}),
  };
}
