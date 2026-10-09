import type { ItemFormValues } from "@/features/items/itemForm";
import type { AiImageDraft } from "@/types/AiImageDraft";

/** A1: editor starting values from what the AI read in a picture. Missing parts stay empty. */
export function imageDraftToForm(draft: AiImageDraft): Partial<ItemFormValues> {
  const schedule = draft.date ? (draft.time ? "time" : "date") : "none";
  return {
    title: draft.title,
    schedule,
    ...(draft.date ? { date: draft.date } : {}),
    ...(draft.time ? { time: draft.time } : {}),
    ...(draft.durationMinutes ? { durationMinutes: draft.durationMinutes } : {}),
    location: draft.location ?? "",
    notes: draft.notes ?? "",
  };
}
