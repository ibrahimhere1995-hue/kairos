import { useMemo } from "react";
import { RotateCcw, Sprout } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHabitActions, useHabits } from "@/features/habits/api";
import { HabitForm } from "@/features/habits/HabitForm";
import { HabitRow } from "@/features/habits/HabitRow";
import { useAreas } from "@/features/items/api";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { getDayContext } from "@/lib/dates/dayContext";

/** PRD R13: habits (daily or N times a week), ticks, streaks, a 12-week heatmap. */
export function HabitsPage() {
  const { t } = useTranslation();
  const today = getDayContext().today;
  const habits = useHabits(today);
  const { create } = useHabitActions(today);
  const { data: areaList = [] } = useAreas();
  const areas = useMemo(() => new Map(areaList.map((a) => [a.id, a])), [areaList]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1">{t("nav.habits")}</h1>
        <p className="text-text-muted">{t("habits.intro")}</p>
      </header>
      <HabitForm submitLabel={t("habits.add")} onSubmit={(input) => create.mutateAsync(input)} />

      {habits.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <div className="skeleton h-16 rounded-md" />
          <div className="skeleton h-16 rounded-md" />
        </div>
      ) : habits.isError ? (
        <EmptyState
          icon={RotateCcw}
          message={t("errors.database")}
          action={<Button onClick={() => void habits.refetch()}>{t("common.tryAgain")}</Button>}
        />
      ) : habits.data.length === 0 ? (
        <EmptyState icon={Sprout} message={t("habits.empty")} />
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t("nav.habits")}>
          {habits.data.map((status) => (
            <HabitRow
              key={status.habit.id}
              status={status}
              today={today}
              area={status.habit.areaId ? areas.get(status.habit.areaId) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
