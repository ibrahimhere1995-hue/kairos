import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { CalendarDays, Sparkles, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBestHours } from "@/features/ai/api";
import { hoursRange } from "@/features/ai/bestHours";
import { buildPlanRequest, type PlanSpan } from "@/features/ai/plan/planRequest";
import { PlanResults } from "@/features/ai/plan/PlanResults";
import { useApplyPlan } from "@/features/ai/plan/useApplyPlan";
import { buildDashboardQuery, currentWeekRange } from "@/features/dashboard/dashboardQuery";
import { useDashboard, useItemsInRange, useUnscheduledItems } from "@/features/items/api";
import { useAppSettings, useWeekStartsOn } from "@/features/settings/api";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { aiApi } from "@/lib/api/ai";
import { toErrorPayload } from "@/lib/api/errors";
import { DEFAULT_SETTINGS } from "@/lib/api/settings";
import { getDayContext, toLocalDateString } from "@/lib/dates/dayContext";

/** Ask for a plan, then accept all, some or none of it (PRD A3). */
export function PlanForm({ initialSpan, onDone }: { initialSpan: PlanSpan; onDone: () => void }) {
  const { t } = useTranslation();
  const [span, setSpan] = useState<PlanSpan>(initialSpan);
  const [instruction, setInstruction] = useState("");
  const weekStartsOn = useWeekStartsOn();
  const ctx = useMemo(() => getDayContext(), []);
  const week = currentWeekRange(ctx, weekStartsOn);
  const dashboard = useDashboard(buildDashboardQuery(ctx, weekStartsOn));
  const unscheduled = useUnscheduledItems();
  const settings = useAppSettings().data ?? DEFAULT_SETTINGS;
  const best = useBestHours().data ?? null;
  const lighten = span === "lighten";
  // Eight days covers the rest of this week and the six days after today.
  const rangeEnd = addDays(ctx.dayStart, 8);
  const range = useItemsInRange({
    start: ctx.dayStart.toISOString(),
    end: rangeEnd.toISOString(),
    startDate: ctx.today,
    endDate: toLocalDateString(rangeEnd),
  });
  const candidates = useMemo(() => {
    const d = dashboard.data;
    if (!d) return [];
    // Lightening today only moves today's (and slipped) tasks.
    return lighten
      ? [...d.overdue, ...d.today]
      : [...d.overdue, ...d.today, ...d.thisWeek, ...(unscheduled.data ?? [])];
  }, [dashboard.data, unscheduled.data, lighten]);
  const ready = dashboard.isSuccess && range.isSuccess;

  const plan = useMutation({
    mutationFn: () =>
      aiApi.plan(
        buildPlanRequest({
          ctx: getDayContext(),
          span,
          weekEnd: week.endDate,
          instruction,
          rangeItems: range.data ?? [],
          candidates,
          dayStart: settings.workDayStart,
          dayEnd: settings.workDayEnd,
          preferredHours: best ? hoursRange(best) : null,
        }),
      ),
  });
  const apply = useApplyPlan();

  if (plan.data) {
    return (
      <PlanResults
        proposals={plan.data}
        items={candidates}
        busy={apply.isPending}
        onNone={onDone}
        onAccept={(accepted) =>
          apply.mutate({ accepted, items: candidates }, { onSuccess: onDone })
        }
      />
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        plan.mutate();
      }}
    >
      {lighten ? (
        <p className="text-body">{t("plan.lightenIntro")}</p>
      ) : (
        <SegmentedControl<PlanSpan>
          name="plan-span"
          legend={t("plan.span")}
          value={span}
          onChange={setSpan}
          options={[
            { value: "day", label: t("plan.today"), icon: Sun },
            { value: "week", label: t("plan.week"), icon: CalendarDays },
          ]}
        />
      )}
      <label className="flex flex-col gap-1">
        <span className="text-body font-semibold">{t("plan.instruction")}</span>
        <textarea
          rows={2}
          maxLength={500}
          value={instruction}
          placeholder={t("plan.instructionPlaceholder")}
          onChange={(e) => setInstruction(e.target.value)}
          className="rounded-sm border border-border bg-surface-2 px-3 py-2 text-body text-text"
        />
      </label>
      <p className="text-small text-text-muted">{t("plan.privacy")}</p>
      {plan.error && <FieldError message={t(toErrorPayload(plan.error).message)} />}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={!ready || plan.isPending}>
          <Sparkles aria-hidden="true" />
          {t(plan.isPending ? "plan.thinking" : "plan.make")}
        </Button>
      </div>
    </form>
  );
}
