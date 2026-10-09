import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, CircleCheck, RotateCcw, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { weeklyBalance } from "@/features/dashboard/balance";
import { useFeedbackStore } from "@/features/feedback/feedbackStore";
import { useFocusTotals } from "@/features/focus/api";
import { friendlyDuration } from "@/features/items/editor/friendlyDate";
import { useAreas, useItemsInRange } from "@/features/items/api";
import { AreaTimeList } from "@/features/review/AreaTimeList";
import { defaultWeekOffset, reviewWeek, summarizeWeek, withFocus } from "@/features/review/review";
import { WeekItemList } from "@/features/review/WeekItemList";
import { useWeekStartsOn } from "@/features/settings/api";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { getDayContext } from "@/lib/dates/dayContext";

/** PRD R17: what got done, what slipped, time per life area and a gentle balance insight. */
export function ReviewPage() {
  const { t } = useTranslation();
  const weekStartsOn = useWeekStartsOn();
  const openSuggest = useFeedbackStore((s) => s.openSuggest);
  const ctx = useMemo(() => getDayContext(), []);
  const [offset, setOffset] = useState(() => defaultWeekOffset(ctx.now, weekStartsOn));
  const { first, range } = reviewWeek(ctx.now, weekStartsOn, offset);
  const items = useItemsInRange(range);
  const focus = useFocusTotals(range.start, range.end);
  const { data: areaList = [] } = useAreas();
  const areas = useMemo(() => new Map(areaList.map((a) => [a.id, a])), [areaList]);
  const active = useMemo(() => areaList.filter((a) => !a.isArchived), [areaList]);

  let body;
  if (items.isPending || focus.isPending) {
    body = (
      <div aria-busy="true" className="flex flex-col gap-3">
        <div className="skeleton h-24 rounded-md" />
        <div className="skeleton h-24 rounded-md" />
      </div>
    );
  } else if (items.isError || focus.isError) {
    body = (
      <EmptyState
        icon={RotateCcw}
        message={t("errors.database")}
        action={
          <Button onClick={() => void Promise.all([items.refetch(), focus.refetch()])}>
            {t("common.tryAgain")}
          </Button>
        }
      />
    );
  } else {
    const { done, slipped } = summarizeWeek(items.data, ctx);
    const focused = Math.round(focus.data.reduce((sum, f) => sum + f.seconds, 0) / 60);
    body = (
      <>
        <p className="text-body text-text-muted">
          {t("review.summary", { done: done.length, slipped: slipped.length })}{" "}
          {focused > 0 && t("review.focused", { time: friendlyDuration(focused, t) })}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <WeekItemList
            id="review-done"
            title={t("review.done")}
            icon={CircleCheck}
            iconClassName="text-status-done"
            items={done}
            empty={t("review.doneEmpty")}
            areas={areas}
          />
          <WeekItemList
            id="review-slipped"
            title={t("review.slipped")}
            icon={Undo2}
            iconClassName="text-status-slipped"
            items={slipped}
            empty={t("review.slippedEmpty")}
            areas={areas}
          />
        </div>
        <AreaTimeList areas={withFocus(weeklyBalance(items.data, active), focus.data)} />
        <Button variant="ghost" className="self-start" onClick={() => openSuggest(t("nav.review"))}>
          {t("feedback.helpful")}
        </Button>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-h1">{t("nav.review")}</h1>
          <p className="text-text-muted">
            {t("review.week", {
              start: format(first, "d MMM"),
              end: format(addDays(first, 6), "d MMM yyyy"),
            })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            icon={ChevronLeft}
            label={t("review.previous")}
            onClick={() => setOffset((o) => o - 1)}
          />
          <IconButton
            icon={ChevronRight}
            label={t("review.next")}
            disabled={offset >= 0}
            onClick={() => setOffset((o) => o + 1)}
          />
        </div>
      </header>
      {body}
    </div>
  );
}
