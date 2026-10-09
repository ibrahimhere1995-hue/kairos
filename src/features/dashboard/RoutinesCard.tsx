import { Repeat } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import type { DashboardItem } from "@/features/dashboard/groupDashboard";
import { RoutineRow } from "@/features/dashboard/RoutineRow";
import type { Area } from "@/types/Area";

/**
 * Missed occurrences of repeating tasks (decision 2026-10-09): calmer than the Slipped card,
 * since the next one is already on its way. Only each routine's latest missed one appears.
 */
export function RoutinesCard({
  entries,
  areas,
  today,
}: {
  entries: DashboardItem[];
  areas: Map<string, Area>;
  today: string;
}) {
  const { t } = useTranslation();
  if (entries.length === 0) return null;
  return (
    <section
      aria-labelledby="routines-heading"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-4"
    >
      <div className="flex items-start gap-2">
        <Repeat aria-hidden="true" className="mt-1 size-5 shrink-0 text-text-muted" />
        <div className="flex flex-col">
          <h2 id="routines-heading" className="text-h3">
            {t("routines.title")}
          </h2>
          <p className="text-small text-text-muted">{t("routines.prompt")}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {entries.map(({ item }) => (
            <RoutineRow
              key={item.id}
              item={item}
              area={item.areaId ? areas.get(item.areaId) : undefined}
              today={today}
            />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
