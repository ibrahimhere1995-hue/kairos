import { useMemo, useState } from "react";
import { CircleCheck, CircleDot, Clock, Plus, RotateCcw, Sparkles, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AreaFilter } from "@/features/dashboard/AreaFilter";
import { BalanceStrip } from "@/features/dashboard/BalanceStrip";
import { weeklyBalance } from "@/features/dashboard/balance";
import { buildDashboardQuery, currentWeekRange } from "@/features/dashboard/dashboardQuery";
import { DashboardSection } from "@/features/dashboard/DashboardSection";
import { Greeting } from "@/features/dashboard/Greeting";
import { OverbookedCard } from "@/features/dashboard/OverbookedCard";
import { overload } from "@/features/dashboard/overload";
import { RoutinesCard } from "@/features/dashboard/RoutinesCard";
import { SlippedCard } from "@/features/dashboard/SlippedCard";
import {
  groupDashboard,
  isEmpty,
  summarize,
  unloadedSlipped,
} from "@/features/dashboard/groupDashboard";
import { useNow } from "@/features/dashboard/useNow";
import { useAreas, useDashboard, useItemsInRange } from "@/features/items/api";
import { useEditorStore } from "@/features/items/editorStore";
import { useAiReady } from "@/features/ai/api";
import { usePlanStore } from "@/features/ai/plan/planStore";
import { ReviewNudge } from "@/features/review/ReviewNudge";
import { SamplesNote } from "@/features/onboarding/SamplesNote";
import { useAppSettings, useWeekStartsOn } from "@/features/settings/api";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { getDayContext } from "@/lib/dates/dayContext";

/** The home screen (PRD R2): what's happening now, what's left today, what slipped. */
export function MyDayPage() {
  const { t } = useTranslation();
  const now = useNow();
  const ctx = useMemo(() => getDayContext(now), [now]);
  const [areaId, setAreaId] = useState<string | null>(null);
  const openNew = useEditorStore((state) => state.openNew);
  const aiReady = useAiReady();
  const openPlan = usePlanStore((state) => state.openPlan);

  const weekStartsOn = useWeekStartsOn();
  const { data: settings } = useAppSettings();
  const dashboard = useDashboard(buildDashboardQuery(ctx, weekStartsOn));
  const week = useItemsInRange(currentWeekRange(ctx, weekStartsOn));
  const { data: areaList = [] } = useAreas();
  const areas = useMemo(() => new Map(areaList.map((a) => [a.id, a])), [areaList]);
  const activeAreas = useMemo(() => areaList.filter((a) => !a.isArchived), [areaList]);

  if (dashboard.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("myDay.loading")}>
        <div className="skeleton h-11 w-2/3 rounded-sm" />
        <div className="skeleton h-6 w-1/3 rounded-sm" />
        <div className="skeleton h-16 rounded-md" />
        <div className="skeleton h-16 rounded-md" />
      </div>
    );
  }
  if (dashboard.isError) {
    return (
      <EmptyState
        icon={RotateCcw}
        message={t("errors.database")}
        action={<Button onClick={() => void dashboard.refetch()}>{t("common.tryAgain")}</Button>}
      />
    );
  }

  const sections = groupDashboard(dashboard.data, ctx, areaId);
  const allEmpty = isEmpty(groupDashboard(dashboard.data, ctx));
  const common = { areas, today: ctx.today };
  const load = settings
    ? overload(dashboard.data.today, ctx, settings.workDayStart, settings.workDayEnd)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <Greeting
        now={now}
        summary={summarize(groupDashboard(dashboard.data, ctx), unloadedSlipped(dashboard.data))}
      />
      <SamplesNote />
      <ReviewNudge now={now} />

      {allEmpty ? (
        <EmptyState
          icon={Sparkles}
          message={t("myDay.emptyDay")}
          action={
            <Button size="lg" onClick={() => openNew()}>
              <Plus aria-hidden="true" />
              {t("myDay.addFirst")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <AreaFilter areas={activeAreas} value={areaId} onChange={setAreaId} />
            {aiReady && (
              <Button variant="ghost" size="sm" onClick={() => openPlan("day")}>
                <Sparkles aria-hidden="true" />
                {t("plan.myDay")}
              </Button>
            )}
          </div>
          {week.data && <BalanceStrip balance={weeklyBalance(week.data, activeAreas)} />}
          {isEmpty(sections) && (
            <p className="text-body text-text-muted">{t("myDay.emptyFiltered")}</p>
          )}
          <DashboardSection
            title={t("myDay.now")}
            icon={CircleDot}
            iconClassName="text-status-now now-pulse"
            entries={sections.now}
            {...common}
          />
          {/* DESIGN_SYSTEM §6: the slipped card comes right after Now. */}
          <SlippedCard
            entries={sections.slipped}
            unloaded={unloadedSlipped(dashboard.data, areaId)}
            areas={areas}
            today={ctx.today}
            dayStart={ctx.dayStart.toISOString()}
          />
          {load && <OverbookedCard load={load} />}
          <RoutinesCard entries={sections.routines} areas={areas} today={ctx.today} />
          <DashboardSection
            title={t("myDay.today")}
            icon={Sun}
            iconClassName="text-status-today"
            entries={sections.today}
            {...common}
          />
          <DashboardSection
            title={t("myDay.thisWeek")}
            icon={Clock}
            iconClassName="text-status-upcoming"
            entries={sections.thisWeek}
            {...common}
          />
          <DashboardSection
            title={t("myDay.doneToday")}
            icon={CircleCheck}
            iconClassName="text-status-done"
            entries={sections.doneToday}
            collapsible
            {...common}
          />
        </>
      )}
    </div>
  );
}
