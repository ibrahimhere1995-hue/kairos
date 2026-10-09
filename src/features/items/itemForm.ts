import { addMinutes, differenceInMinutes, format, parseISO } from "date-fns";
import type { FieldErrors, Resolver } from "react-hook-form";
import { z } from "zod";
import type { ItemDetail } from "@/types/ItemDetail";
import type { ItemInput } from "@/types/ItemInput";
import type { ChecklistEntryInput } from "@/types/ChecklistEntryInput";

export const DURATION_OPTIONS = [0, 15, 30, 45, 60, 90, 120, 180, 240] as const;

/** PRD R3: one reminder at the item's moment unless you choose otherwise. */
export const DEFAULT_REMINDERS = [0];
/** Must match MAX_REMINDERS / MAX_OFFSET_MINUTES in src-tauri/src/services/reminders.rs. */
const MAX_REMINDERS = 10;
const MAX_OFFSET_MINUTES = 4 * 7 * 24 * 60;

/**
 * Editor fields in the user's terms (local date, local time, duration). Messages are i18n keys.
 * `schedule`: "none" (Inbox), "date" (whole day) or "time" (date + start time).
 */
export const itemFormSchema = z
  .object({
    kind: z.enum(["task", "event"]),
    title: z
      .string()
      .trim()
      .min(1, { error: "errors.validation.required" })
      .max(500, { error: "errors.validation.tooLong" }),
    schedule: z.enum(["none", "date", "time"]),
    date: z.string(),
    time: z.string(),
    durationMinutes: z.number().int().min(0).max(1440),
    areaId: z.string().nullable(),
    priority: z.number().int().min(0).max(3),
    notes: z.string().max(100_000, { error: "errors.validation.tooLong" }),
    reminders: z.array(z.number().int().min(0).max(MAX_OFFSET_MINUTES)).max(MAX_REMINDERS),
    /** Repeat rule (RRULE without DTSTART), or null for "Does not repeat". */
    rrule: z.string().nullable(),
    checklist: z.array(
      z.object({
        stepId: z.string().nullable(),
        text: z.string().max(500, { error: "errors.validation.tooLong" }),
        done: z.boolean(),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, error: string) =>
      ctx.addIssue({ code: "custom", path: [path], message: error });
    if (v.kind === "event" && v.schedule === "none")
      issue("date", "errors.validation.eventNeedsDate");
    if (v.schedule !== "none" && !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
      issue("date", "errors.validation.invalidDate");
    }
    if (v.schedule === "time" && !/^\d{2}:\d{2}$/.test(v.time)) {
      issue("time", "errors.validation.invalidDateTime");
    }
    if (v.kind === "event" && v.schedule === "time" && v.durationMinutes === 0) {
      issue("durationMinutes", "errors.validation.eventNeedsEnd");
    }
  });

export type ItemFormValues = z.input<typeof itemFormSchema>;

/** react-hook-form resolver backed by the Zod schema (no extra resolver package needed). */
export const itemFormResolver: Resolver<ItemFormValues> = (values) => {
  const result = itemFormSchema.safeParse(values);
  if (result.success) return { values: result.data, errors: {} };

  const errors: Record<string, unknown> = {};
  for (const issue of result.error.issues) {
    // Build nested objects for paths like ["checklist", 2, "text"].
    let node = errors;
    issue.path.forEach((key, index) => {
      const k = String(key);
      if (index === issue.path.length - 1) {
        node[k] ??= { type: issue.code, message: issue.message };
      } else {
        node[k] ??= {};
        node = node[k] as Record<string, unknown>;
      }
    });
  }
  return { values: {}, errors: errors as FieldErrors<ItemFormValues> };
};

export function emptyItemForm(today: string): ItemFormValues {
  return {
    kind: "task",
    title: "",
    schedule: "date", // PRD R4: new items land on Today unless changed
    date: today,
    time: "09:00",
    durationMinutes: 0,
    areaId: null,
    priority: 0,
    notes: "",
    reminders: DEFAULT_REMINDERS,
    rrule: null,
    checklist: [],
  };
}

export function formFromDetail(
  { item, checklist, reminders }: ItemDetail,
  today: string,
): ItemFormValues {
  const start = item.startAt ? parseISO(item.startAt) : null;
  const end = item.endAt ? parseISO(item.endAt) : null;
  return {
    kind: item.kind,
    title: item.title,
    schedule: start ? "time" : item.dueDate ? "date" : "none",
    date: start ? format(start, "yyyy-MM-dd") : (item.dueDate ?? today),
    time: start ? format(start, "HH:mm") : "09:00",
    durationMinutes: start && end ? differenceInMinutes(end, start) : 0,
    areaId: item.areaId,
    priority: item.priority,
    notes: item.notes ?? "",
    reminders,
    rrule: item.rrule,
    checklist: checklist.map((step) => ({ stepId: step.id, text: step.text, done: step.done })),
  };
}

/**
 * Converts editor values to the backend input. Fields the editor doesn't show yet
 * (location, source) are carried over from the existing item so saving never erases them.
 */
export function toItemInput(
  values: ItemFormValues,
  existing: ItemDetail["item"] | null,
): ItemInput {
  let startAt: string | null = null;
  let endAt: string | null = null;
  let dueDate: string | null = null;

  if (values.schedule === "date") dueDate = values.date;
  if (values.schedule === "time") {
    // "YYYY-MM-DDTHH:mm" without an offset is parsed as local time.
    const start = new Date(`${values.date}T${values.time}`);
    startAt = start.toISOString();
    if (values.durationMinutes > 0) endAt = addMinutes(start, values.durationMinutes).toISOString();
  }

  return {
    kind: values.kind,
    title: values.title.trim(),
    notes: values.notes.trim() === "" ? null : values.notes,
    areaId: values.areaId,
    priority: values.priority,
    startAt,
    endAt,
    dueDate,
    location: existing?.location ?? null,
    source: existing?.source ?? "manual",
    reminders: values.reminders,
    // Without a date nothing can repeat.
    rrule: values.schedule === "none" ? null : values.rrule,
  };
}

export function toChecklistInput(values: ItemFormValues): ChecklistEntryInput[] {
  return values.checklist
    .filter((step) => step.text.trim() !== "")
    .map((step) => ({ id: step.stepId, text: step.text.trim(), done: step.done }));
}
