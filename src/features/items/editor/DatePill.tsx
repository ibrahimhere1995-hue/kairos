import { useState } from "react";
import { addDays, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { friendlyDate } from "@/features/items/editor/friendlyDate";
import type { ItemFormValues } from "@/features/items/itemForm";
import { OptionButton } from "@/components/ui/OptionButton";
import { Pill } from "@/components/ui/Pill";
import { Popover } from "@/components/ui/Popover";
import { toLocalDateString } from "@/lib/dates/dayContext";

export function DatePill({ today }: { today: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { setValue, control } = useFormContext<ItemFormValues>();
  const [schedule, date, kind] = useWatch({ control, name: ["schedule", "date", "kind"] });

  const choose = (next: string | null) => {
    if (next === null) {
      setValue("schedule", "none", { shouldDirty: true, shouldValidate: true });
    } else {
      setValue("date", next, { shouldDirty: true, shouldValidate: true });
      if (schedule === "none") setValue("schedule", "date", { shouldDirty: true });
    }
    setOpen(false);
  };

  const tomorrow = toLocalDateString(addDays(parseISO(today), 1));
  const nextWeek = toLocalDateString(addDays(parseISO(today), 7));
  const label = schedule === "none" ? t("editor.noDate") : friendlyDate(date, today, t);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("editor.date")}
      trigger={
        <Pill icon={CalendarDays} field={t("editor.date")}>
          {label}
        </Pill>
      }
    >
      <OptionButton selected={schedule !== "none" && date === today} onClick={() => choose(today)}>
        {t("dates.today")}
      </OptionButton>
      <OptionButton
        selected={schedule !== "none" && date === tomorrow}
        onClick={() => choose(tomorrow)}
      >
        {t("dates.tomorrow")}
      </OptionButton>
      <OptionButton
        selected={schedule !== "none" && date === nextWeek}
        onClick={() => choose(nextWeek)}
      >
        {t("dates.nextWeek")}
      </OptionButton>
      {kind === "task" && (
        <OptionButton selected={schedule === "none"} onClick={() => choose(null)}>
          {t("editor.noDate")}
        </OptionButton>
      )}
      <label className="flex flex-col gap-1 border-t border-border pt-2 text-small text-text-muted">
        {t("editor.pickDate")}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && choose(e.target.value)}
          className="h-9 rounded-sm border border-border bg-surface-2 px-2 text-body text-text"
        />
      </label>
    </Popover>
  );
}
