import { useMemo, useState, type FormEvent } from "react";
import { RotateCcw, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGoalActions, useGoals } from "@/features/goals/api";
import { GoalCard } from "@/features/goals/GoalCard";
import { useAreas } from "@/features/items/api";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { toErrorPayload } from "@/lib/api/errors";

const FIELD = "h-10 rounded-sm border border-border bg-surface-2 px-3 text-body text-text";

/** PRD R14: goals → milestones → tasks, with progress from the linked tasks. */
export function GoalsPage() {
  const { t } = useTranslation();
  const goals = useGoals();
  const { create } = useGoalActions();
  const { data: areaList = [] } = useAreas();
  const areas = useMemo(() => new Map(areaList.map((a) => [a.id, a])), [areaList]);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const add = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { title, description: null, areaId: null, targetDate: targetDate || null },
      { onSuccess: () => (setTitle(""), setTargetDate("")) },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1">{t("nav.goals")}</h1>
        <p className="text-text-muted">{t("goals.intro")}</p>
      </header>
      <form onSubmit={add} className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <input
            value={title}
            maxLength={200}
            aria-label={t("goals.title")}
            placeholder={t("goals.titlePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
            className={FIELD}
          />
          {create.error && <FieldError message={t(toErrorPayload(create.error).message)} />}
        </div>
        <label className="flex items-center gap-2 text-small text-text-muted">
          {t("goals.targetDate")}
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className={FIELD}
          />
        </label>
        <Button type="submit" variant="secondary" disabled={create.isPending}>
          {t("goals.add")}
        </Button>
      </form>

      {goals.isPending ? (
        <div aria-busy="true" className="skeleton h-40 rounded-lg" />
      ) : goals.isError ? (
        <EmptyState
          icon={RotateCcw}
          message={t("errors.database")}
          action={<Button onClick={() => void goals.refetch()}>{t("common.tryAgain")}</Button>}
        />
      ) : goals.data.length === 0 ? (
        <EmptyState icon={Target} message={t("goals.empty")} />
      ) : (
        <ul className="flex flex-col gap-4" aria-label={t("nav.goals")}>
          {goals.data.map((g) => (
            <GoalCard
              key={g.goal.id}
              progress={g}
              area={g.goal.areaId ? areas.get(g.goal.areaId) : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
