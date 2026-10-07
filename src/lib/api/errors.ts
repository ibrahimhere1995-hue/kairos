import type { ErrorPayload } from "@/types/ErrorPayload";

export function isErrorPayload(value: unknown): value is ErrorPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.message === "string";
}

/** Normalises anything a command rejects with into an ErrorPayload with an i18n `message` key. */
export function toErrorPayload(error: unknown): ErrorPayload {
  if (isErrorPayload(error)) {
    return { code: error.code, message: error.message, field: error.field ?? null };
  }
  return { code: "unknown", message: "errors.unknown", field: null };
}
