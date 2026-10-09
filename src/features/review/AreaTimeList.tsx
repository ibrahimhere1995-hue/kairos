import { Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";
import { friendlyDuration } from "@/features/items/editor/friendlyDate";
import { balanceInsights, type AreaTime, type Insight } from "@/features/review/review";
import { AreaDot } from "@/components/AreaDot";
import { areaColor } from "@/lib/api/areas";

/** Time per life area (planned and focused) and the balance insights drawn from it. */
export function AreaTimeList({ areas }: { areas: AreaTime[] }) {
  const { t } = useTranslation();
  const most = Math.max(1, ...areas.map((a) => Math.max(a.minutes, a.focusedMinutes)));
  const time = (minutes: number) =>
    minutes > 0 ? friendlyDuration(minutes, t) : t("dates.hours", { count: 0 });
  const insight = (i: Insight) =>
    i.kind === "zero"
      ? t("review.insightZero", { area: i.area })
      : i.kind === "most"
        ? t("review.insightMost", { area: i.area, percent: i.percent })
        : t("review.insightEven");
  const insights = balanceInsights(areas);

  return (
    <section
      aria-labelledby="review-areas"
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
    >
      <h2 id="review-areas" className="text-h3">
        {t("review.timePerArea")}
      </h2>
      <ul className="flex flex-col gap-2">
        {areas.map((a) => (
          <li key={a.areaId} className="flex flex-col gap-1">
            <span className="inline-flex flex-wrap items-center gap-x-2 text-body">
              <AreaDot color={a.color} />
              {a.name}
              <span className="text-small text-text-muted">
                {t("review.areaTime", {
                  planned: time(a.minutes),
                  focused: time(a.focusedMinutes),
                })}
              </span>
            </span>
            <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(Math.max(a.minutes, a.focusedMinutes) / most) * 100}%`,
                  backgroundColor: areaColor(a.color),
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      {insights.length > 0 && (
        <ul aria-label={t("review.insights")} className="flex flex-col gap-1">
          {insights.map((i) => (
            <li key={insight(i)} className="inline-flex items-start gap-2 text-body">
              <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-text" />
              {insight(i)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
