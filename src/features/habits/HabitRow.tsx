import { useState } from "react";
import { Flame, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHabitActions } from "@/features/habits/api";
import { HabitForm } from "@/features/habits/HabitForm";
import { Heatmap } from "@/features/habits/Heatmap";
import { CompleteCheckbox } from "@/components/ui/CompleteCheckbox";
import { IconButton } from "@/components/ui/IconButton";
import { areaColor } from "@/lib/api/areas";
import type { Area } from "@/types/Area";
import type { HabitStatus } from "@/types/HabitStatus";

/** Tick today, see the streak in words (never shaming), the week's progress and 12 weeks. */
export function HabitRow({
  status,
  area,
  today,
}: {
  status: HabitStatus;
  area: Area | undefined;
  today: string;
}) {
  const { t } = useTranslation();
  const { toggleToday, update, remove } = useHabitActions(today);
  const [editing, setEditing] = useState(false);
  const { habit, streak, doneToday, thisWeek, perWeek } = status;
  const daily = habit.frequency === "daily";
  const streakText =
    streak > 0
      ? t(daily ? "habits.streakDays" : "habits.streakWeeks", { count: streak })
      : t("habits.paused");

  if (editing) {
    return (
      <li className="rounded-md border border-border bg-surface p-3">
        <HabitForm
          initial={{ title: habit.title, frequency: habit.frequency, areaId: habit.areaId }}
          submitLabel={t("editor.save")}
          onSubmit={(input) =>
            update.mutateAsync({ id: habit.id, input }).then(() => setEditing(false))
          }
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="relative flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface py-2 pr-2 pl-4">
      <span
        aria-hidden="true"
        className="absolute inset-y-2 left-0 w-1 rounded-full"
        style={{ backgroundColor: areaColor(area?.color) }}
      />
      <CompleteCheckbox
        checked={doneToday}
        label={t(doneToday ? "habits.untick" : "habits.tick", { title: habit.title })}
        onChange={(done) => toggleToday.mutate({ id: habit.id, done })}
      />
      <div className="flex min-w-40 flex-1 flex-col">
        <span className="text-body">{habit.title}</span>
        <span className="inline-flex items-center gap-1 text-small text-text-muted">
          {streak > 0 && <Flame aria-hidden="true" className="size-3.5 text-accent-text" />}
          {streakText}
          {" · "}
          {daily
            ? t("habits.weekDaily", { done: thisWeek })
            : t("habits.weekTarget", { done: thisWeek, target: perWeek })}
        </span>
      </div>
      <Heatmap today={today} ticked={status.recent} />
      <IconButton
        icon={Pencil}
        label={t("habits.edit", { title: habit.title })}
        onClick={() => setEditing(true)}
      />
      <IconButton
        icon={Trash2}
        label={t("habits.delete", { title: habit.title })}
        onClick={() => remove.mutate({ id: habit.id, title: habit.title })}
      />
    </li>
  );
}
