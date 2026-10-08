import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FieldError } from "@/components/ui/FieldError";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Local `HH:mm` input that saves only valid times. Give it `key={saved}` so it resets when the
 * saved value changes elsewhere (e.g. after restoring a backup).
 */
export function ReminderTimeInput({
  saved,
  label,
  onSave,
}: {
  saved: string;
  label: string;
  onSave: (time: string) => void;
}) {
  const { t } = useTranslation();
  const [time, setTime] = useState(saved);
  const invalid = !TIME.test(time);

  return (
    <div className="flex flex-col gap-1">
      <input
        type="time"
        value={time}
        aria-label={label}
        aria-invalid={invalid}
        onChange={(e) => setTime(e.target.value)}
        // Save when leaving the field, so the input never resets while you're typing.
        onBlur={() => {
          if (TIME.test(time) && time !== saved) onSave(time);
        }}
        className="h-10 rounded-sm border border-border bg-surface-2 px-3 text-body text-text"
      />
      {invalid && <FieldError message={t("errors.validation.invalidDateTime")} />}
    </div>
  );
}
