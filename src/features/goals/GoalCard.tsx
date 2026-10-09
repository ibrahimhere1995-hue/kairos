import { useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { CircleCheck, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGoalActions } from "@/features/goals/api";
import { useEditorStore } from "@/features/items/editorStore";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { areaColor } from "@/lib/api/areas";
import type { Area } from "@/types/Area";
import type { GoalProgress } from "@/types/GoalProgress";

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A goal with its milestones; each milestone's progress comes from its tasks. */
export function GoalCard({ progress, area }: { progress: GoalProgress; area: Area | undefined }) {
  const { t } = useTranslation();
  const { achieve, addMilestone, removeMilestone, remove } = useGoalActions();
  const openNew = useEditorStore((s) => s.openNew);
  const [milestone, setMilestone] = useState("");
  const { goal, milestones, done, total } = progress;
  const achieved = goal.achievedAt !== null;

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (milestone.trim())
      addMilestone.mutate(
        { goalId: goal.id, title: milestone },
        { onSuccess: () => setMilestone("") },
      );
  };

  return (
    <li className="relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 pl-5">
      <span
        aria-hidden="true"
        className="absolute inset-y-3 left-0 w-1 rounded-full"
        style={{ backgroundColor: areaColor(area?.color) }}
      />
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-48 flex-1 flex-col">
          <h2 className="text-h3">{goal.title}</h2>
          <span className="text-small text-text-muted">
            {[
              goal.targetDate &&
                t("goals.by", { date: format(parseISO(goal.targetDate), "d MMM yyyy") }),
              area?.name,
              achieved ? t("goals.achieved") : t("goals.progress", { done, total }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => achieve.mutate({ id: goal.id, achieved: !achieved })}
        >
          <CircleCheck aria-hidden="true" />
          {t(achieved ? "goals.reopen" : "goals.markAchieved")}
        </Button>
        <IconButton
          icon={Trash2}
          label={t("goals.delete", { title: goal.title })}
          onClick={() => remove.mutate({ id: goal.id, title: goal.title })}
        />
      </div>
      <Progress done={done} total={total} label={t("goals.progressOf", { title: goal.title })} />

      <ul
        className="flex flex-col gap-2"
        aria-label={t("goals.milestonesOf", { title: goal.title })}
      >
        {milestones.map(({ milestone: m, done: md, total: mt }) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center gap-2 rounded-sm bg-surface-2 py-1 pr-1 pl-3"
          >
            <span className="min-w-32 flex-1 text-body">{m.title}</span>
            <span className="text-small text-text-muted">
              {t("goals.progress", { done: md, total: mt })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openNew({ kind: "task", schedule: "none", milestoneId: m.id })}
            >
              <Plus aria-hidden="true" />
              {t("goals.addTask")}
            </Button>
            <IconButton
              icon={X}
              label={t("goals.removeMilestone", { title: m.title })}
              onClick={() => removeMilestone.mutate(m.id)}
            />
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={milestone}
          maxLength={200}
          aria-label={t("goals.newMilestone")}
          placeholder={t("goals.newMilestone")}
          onChange={(e) => setMilestone(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-sm border border-border bg-surface-2 px-2 text-body text-text"
        />
        <Button type="submit" size="sm" variant="secondary">
          {t("goals.addMilestone")}
        </Button>
      </form>
    </li>
  );
}
