import { useMemo } from "react";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buildDashboardQuery } from "@/features/dashboard/dashboardQuery";
import { useFocusStore } from "@/features/focus/focusStore";
import { BREAK_MAX, clampMinutes, POMODORO, WORK_MAX } from "@/features/focus/timer";
import { useDashboard } from "@/features/items/api";
import { useWeekStartsOn } from "@/features/settings/api";
import { Button } from "@/components/ui/Button";
import { getDayContext } from "@/lib/dates/dayContext";

const FIELD = "h-10 rounded-sm border border-border bg-surface-2 px-3 text-body text-text";
const PRESETS = [POMODORO, { workMinutes: 50, breakMinutes: 10 }];

/** Pick one task (or none) and the timer: 25/5, 50/10 or your own lengths. */
export function FocusSetup({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  const { task, plan, setTask, setPlan } = useFocusStore();
  const weekStartsOn = useWeekStartsOn();
  const query = useMemo(() => buildDashboardQuery(getDayContext(), weekStartsOn), [weekStartsOn]);
  const dashboard = useDashboard(query);
  const tasks = useMemo(() => {
    const open = [...(dashboard.data?.overdue ?? []), ...(dashboard.data?.today ?? [])].filter(
      (i) => i.kind === "task" && i.completedAt === null && i.skippedAt === null,
    );
    return task && !open.some((i) => i.id === task.id) ? [task, ...open] : open;
  }, [dashboard.data, task]);

  return (
    <form
      className="flex w-full max-w-md flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onStart();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-body font-semibold">{t("focus.what")}</span>
        <select
          value={task?.id ?? ""}
          onChange={(e) => setTask(tasks.find((i) => i.id === e.target.value) ?? null)}
          className={FIELD}
        >
          <option value="">{t("focus.noTask")}</option>
          {tasks.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body font-semibold">{t("focus.timer")}</legend>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.workMinutes}
              variant={
                p.workMinutes === plan.workMinutes && p.breakMinutes === plan.breakMinutes
                  ? "secondary"
                  : "ghost"
              }
              aria-pressed={
                p.workMinutes === plan.workMinutes && p.breakMinutes === plan.breakMinutes
              }
              onClick={() => setPlan(p)}
            >
              {t("focus.preset", { work: p.workMinutes, rest: p.breakMinutes })}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-small text-text-muted">
            {t("focus.workMinutes")}
            <input
              type="number"
              min={1}
              max={WORK_MAX}
              value={plan.workMinutes}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  workMinutes: clampMinutes(e.target.valueAsNumber, 1, WORK_MAX, 25),
                })
              }
              className={`${FIELD} w-28`}
            />
          </label>
          <label className="flex flex-col gap-1 text-small text-text-muted">
            {t("focus.breakMinutes")}
            <input
              type="number"
              min={0}
              max={BREAK_MAX}
              value={plan.breakMinutes}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  breakMinutes: clampMinutes(e.target.valueAsNumber, 0, BREAK_MAX, 5),
                })
              }
              className={`${FIELD} w-28`}
            />
          </label>
        </div>
      </fieldset>

      <p className="text-small text-text-muted">{t("focus.muteNote")}</p>
      <Button type="submit" size="lg">
        <Play aria-hidden="true" />
        {t("focus.start")}
      </Button>
    </form>
  );
}
