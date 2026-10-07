import type { ItemFormValues } from "@/features/items/itemForm";
import type { ParsedCapture } from "@/lib/nlp/parseCapture";

/** Starting values for the full editor when "More details" is chosen in the capture bar. */
export function captureToForm(parsed: ParsedCapture, today: string): Partial<ItemFormValues> {
  return {
    title: parsed.title,
    schedule: parsed.time ? "time" : "date",
    date: parsed.date ?? today,
    ...(parsed.time ? { time: parsed.time } : {}),
    durationMinutes: parsed.durationMinutes ?? 0,
    areaId: parsed.areaId,
    priority: parsed.priority ?? 0,
  };
}
