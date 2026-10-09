import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  DAY_REMINDER_CHOICES,
  TIMED_REMINDER_CHOICES,
  reminderLabel,
  reminderSummary,
  toggleReminder,
} from "@/features/items/editor/reminderLabels";
import type { ItemFormValues } from "@/features/items/itemForm";
import { useAppSettings } from "@/features/settings/api";
import { OptionButton } from "@/components/ui/OptionButton";
import { Pill } from "@/components/ui/Pill";
import { Popover } from "@/components/ui/Popover";
import { DEFAULT_SETTINGS } from "@/lib/api/settings";

/** "Remind me" (PRD R3): any number of reminders. Hidden while the item has no date. */
export function ReminderPill() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { setValue, control } = useFormContext<ItemFormValues>();
  const [schedule, reminders] = useWatch({ control, name: ["schedule", "reminders"] });
  const dayTime = (useAppSettings().data ?? DEFAULT_SETTINGS).defaultReminderTime;
  if (schedule === "none") return null;

  const dateOnly = schedule === "date";
  const base = dateOnly ? DAY_REMINDER_CHOICES : TIMED_REMINDER_CHOICES;
  // Keep any reminder that isn't a standard choice (e.g. set before switching to all day).
  const choices = [...new Set([...base, ...reminders])].sort((a, b) => a - b);
  const set = (next: number[]) =>
    setValue("reminders", next, { shouldDirty: true, shouldValidate: true });

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("editor.remind")}
      trigger={
        <Pill icon={reminders.length > 0 ? Bell : BellOff} field={t("editor.remind")}>
          {reminderSummary(reminders, dateOnly, dayTime, t)}
        </Pill>
      }
    >
      <p className="text-small text-text-muted">{t("editor.reminderChoices")}</p>
      {choices.map((offset) => (
        <OptionButton
          key={offset}
          selected={reminders.includes(offset)}
          onClick={() => set(toggleReminder(reminders, offset))}
        >
          {reminderLabel(offset, dateOnly, dayTime, t)}
        </OptionButton>
      ))}
      <OptionButton
        selected={reminders.length === 0}
        onClick={() => {
          set([]);
          setOpen(false);
        }}
        className="border-t border-border"
      >
        {t("editor.noReminder")}
      </OptionButton>
    </Popover>
  );
}
