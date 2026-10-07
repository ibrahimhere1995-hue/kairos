import { useState } from "react";
import { Clock } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { friendlyDuration } from "@/features/items/editor/friendlyDate";
import { DURATION_OPTIONS, type ItemFormValues } from "@/features/items/itemForm";
import { OptionButton } from "@/components/ui/OptionButton";
import { Pill } from "@/components/ui/Pill";
import { Popover } from "@/components/ui/Popover";

/** All day vs. a start time + duration. Hidden while the item has no date. */
export function TimePill() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { setValue, control } = useFormContext<ItemFormValues>();
  const [schedule, time, duration, kind] = useWatch({
    control,
    name: ["schedule", "time", "durationMinutes", "kind"],
  });
  if (schedule === "none") return null;

  const opts = { shouldDirty: true, shouldValidate: true } as const;
  const setSchedule = (value: ItemFormValues["schedule"]) => setValue("schedule", value, opts);
  const setTime = (value: string) => setValue("time", value, opts);
  const setDuration = (value: number) => setValue("durationMinutes", value, opts);

  const durations = DURATION_OPTIONS.filter((m) => kind === "task" || m > 0);
  const label =
    schedule === "date"
      ? t("editor.allDay")
      : duration > 0
        ? `${time} · ${friendlyDuration(duration, t)}`
        : time;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("editor.time")}
      trigger={
        <Pill icon={Clock} field={t("editor.time")}>
          {label}
        </Pill>
      }
    >
      <OptionButton
        selected={schedule === "date"}
        onClick={() => {
          setSchedule("date");
          setOpen(false);
        }}
      >
        {t("editor.allDay")}
      </OptionButton>
      <label className="flex flex-col gap-1 text-small text-text-muted">
        {t("editor.startTime")}
        <input
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setSchedule("time");
            if (kind === "event" && duration === 0) setDuration(60);
          }}
          className="h-9 rounded-sm border border-border bg-surface-2 px-2 text-body text-text"
        />
      </label>
      <label className="flex flex-col gap-1 text-small text-text-muted">
        {t("editor.duration")}
        <select
          value={duration}
          onChange={(e) => {
            setDuration(Number(e.target.value));
            setSchedule("time");
          }}
          className="h-9 rounded-sm border border-border bg-surface-2 px-2 text-body text-text"
        >
          {durations.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? t("editor.noEndTime") : friendlyDuration(m, t)}
            </option>
          ))}
        </select>
      </label>
    </Popover>
  );
}
