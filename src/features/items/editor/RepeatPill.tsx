import { useState } from "react";
import { Repeat } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { ItemFormValues } from "@/features/items/itemForm";
import { OptionButton } from "@/components/ui/OptionButton";
import { Pill } from "@/components/ui/Pill";
import { Popover } from "@/components/ui/Popover";
import {
  REPEAT_PRESETS,
  describeRule,
  endOf,
  presetOf,
  presetRule,
  withEnd,
  type RepeatEnd,
} from "@/lib/recurrence/rules";

const FIELD = "h-9 rounded-sm border border-border bg-surface-2 px-2 text-body text-text";

/** "Repeat" (P2-T06) in plain language, with how it ends. Hidden while the item has no date. */
export function RepeatPill() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { setValue, control } = useFormContext<ItemFormValues>();
  const [schedule, date, rrule] = useWatch({ control, name: ["schedule", "date", "rrule"] });
  if (schedule === "none") return null;

  const set = (next: string | null) =>
    setValue("rrule", next, { shouldDirty: true, shouldValidate: true });
  const end = endOf(rrule);
  const current = presetOf(rrule);
  const setEnd = (next: RepeatEnd) => rrule && set(withEnd(rrule, next));

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("repeat.label")}
      trigger={
        <Pill icon={Repeat} field={t("repeat.label")}>
          {describeRule(rrule, date, t)}
        </Pill>
      }
    >
      <OptionButton
        selected={rrule === null}
        onClick={() => {
          set(null);
          setOpen(false);
        }}
      >
        {t("repeat.none")}
      </OptionButton>
      {REPEAT_PRESETS.map((preset) => (
        <OptionButton
          key={preset}
          selected={current === preset}
          onClick={() => set(presetRule(preset, end))}
        >
          {describeRule(presetRule(preset), date, t)}
        </OptionButton>
      ))}
      {rrule && current === null && (
        <OptionButton selected onClick={() => undefined}>
          {t("repeat.custom")}
        </OptionButton>
      )}

      {rrule && (
        <fieldset className="flex flex-col gap-1 border-t border-border pt-2">
          <legend className="pb-1 text-small text-text-muted">{t("repeat.ends")}</legend>
          <OptionButton selected={end.kind === "never"} onClick={() => setEnd({ kind: "never" })}>
            {t("repeat.never")}
          </OptionButton>
          <OptionButton
            selected={end.kind === "count"}
            onClick={() => setEnd({ kind: "count", count: end.kind === "count" ? end.count : 10 })}
          >
            {t("repeat.afterCount")}
          </OptionButton>
          {end.kind === "count" && (
            <input
              type="number"
              min={1}
              max={999}
              aria-label={t("repeat.count")}
              value={end.count}
              onChange={(e) => {
                const count = Number(e.target.value);
                if (count >= 1) setEnd({ kind: "count", count });
              }}
              className={FIELD}
            />
          )}
          <OptionButton
            selected={end.kind === "until"}
            onClick={() => setEnd({ kind: "until", date: end.kind === "until" ? end.date : date })}
          >
            {t("repeat.onDate")}
          </OptionButton>
          {end.kind === "until" && (
            <input
              type="date"
              min={date}
              aria-label={t("repeat.until")}
              value={end.date}
              onChange={(e) => e.target.value && setEnd({ kind: "until", date: e.target.value })}
              className={FIELD}
            />
          )}
        </fieldset>
      )}
    </Popover>
  );
}
