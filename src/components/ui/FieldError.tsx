import { CircleAlert } from "lucide-react";

/**
 * Gentle inline error: readable text colour (AA) with an amber icon — never red, never
 * colour alone (DESIGN_SYSTEM §2.9, PROJECT_RULES #9). `message` is already translated.
 */
export function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-small text-text">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>{message}</span>
    </p>
  );
}
