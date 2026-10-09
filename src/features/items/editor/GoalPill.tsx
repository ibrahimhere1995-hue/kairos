import { useState } from "react";
import { Target } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useGoals } from "@/features/goals/api";
import type { ItemFormValues } from "@/features/items/itemForm";
import { OptionButton } from "@/components/ui/OptionButton";
import { Pill } from "@/components/ui/Pill";
import { Popover } from "@/components/ui/Popover";

/** Links a task to a goal milestone (PRD R14). Tasks only; hidden when there are no goals. */
export function GoalPill() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { setValue, control } = useFormContext<ItemFormValues>();
  const [kind, milestoneId] = useWatch({ control, name: ["kind", "milestoneId"] });
  const { data: goals = [] } = useGoals();
  const active = goals.filter((g) => g.goal.achievedAt === null && g.milestones.length > 0);
  if (kind !== "task" || active.length === 0) return null;

  const current = goals
    .flatMap((g) => g.milestones.map((m) => ({ goal: g.goal, m: m.milestone })))
    .find((x) => x.m.id === milestoneId);
  const choose = (id: string | null) => {
    setValue("milestoneId", id, { shouldDirty: true });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("goals.pill")}
      trigger={
        <Pill icon={Target} field={t("goals.pill")}>
          {current ? `${current.goal.title} · ${current.m.title}` : t("goals.none")}
        </Pill>
      }
    >
      <OptionButton selected={milestoneId === null} onClick={() => choose(null)}>
        {t("goals.none")}
      </OptionButton>
      {active.map(({ goal, milestones }) => (
        <div
          key={goal.id}
          role="group"
          aria-label={goal.title}
          className="flex flex-col gap-1 border-t border-border pt-2"
        >
          <span className="px-2 text-caption text-text-muted">{goal.title}</span>
          {milestones.map(({ milestone }) => (
            <OptionButton
              key={milestone.id}
              selected={milestone.id === milestoneId}
              onClick={() => choose(milestone.id)}
            >
              {milestone.title}
            </OptionButton>
          ))}
        </div>
      ))}
    </Popover>
  );
}
