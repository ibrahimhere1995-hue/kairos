import { useState } from "react";
import { RotateCcw, Sparkles, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import type { DashboardItem } from "@/features/dashboard/groupDashboard";
import { SlippedRow } from "@/features/dashboard/SlippedRow";
import { useMoveAllSlipped, useMoveItems } from "@/features/items/api";
import { ShowMoreButton } from "@/components/ShowMoreButton";
import { Button } from "@/components/ui/Button";
import type { Area } from "@/types/Area";

/**
 * PRD R6: "3 things slipped by. Want to give them a new moment?" Calm amber, never red.
 * Once everything has a new moment, a one-line "All caught up" takes its place.
 */
/** Rows shown at first (and added per "Show more"): a long list is never calm. */
const STEP = 50;

export function SlippedCard({
  entries,
  unloaded,
  areas,
  today,
  dayStart,
}: {
  entries: DashboardItem[];
  /** Older slipped tasks counted but not loaded (My Day loads the newest 200). */
  unloaded: number;
  areas: Map<string, Area>;
  today: string;
  /** Local midnight today, as a UTC instant. */
  dayStart: string;
}) {
  const { t } = useTranslation();
  const moveAll = useMoveItems();
  const moveEvery = useMoveAllSlipped();
  const total = entries.length + unloaded;
  const [shown, setShown] = useState(STEP);
  // Remember that there was something to sort out, so clearing it can be acknowledged.
  const [hadItems, setHadItems] = useState(entries.length > 0);
  if (entries.length > 0 && !hadItems) setHadItems(true);

  return (
    <AnimatePresence initial={false} mode="wait">
      {entries.length > 0 ? (
        <motion.section
          key="card"
          aria-labelledby="slipped-heading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.32 } }}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <RotateCcw aria-hidden="true" className="mt-1 size-5 shrink-0 text-status-slipped" />
              <div className="flex flex-col">
                <h2 id="slipped-heading" className="text-h3">
                  {t("slipped.title", { count: total })}
                </h2>
                <p className="text-small text-text-muted">
                  {t("slipped.prompt", { count: total })}
                </p>
              </div>
            </div>
            {total > 1 && (
              <Button
                size="sm"
                variant="secondary"
                disabled={moveAll.isPending || moveEvery.isPending}
                onClick={() =>
                  unloaded > 0
                    ? moveEvery.mutate({ dayStart, today, also: entries.map((e) => e.item.id) })
                    : moveAll.mutate({
                        ids: entries.map((e) => e.item.id),
                        schedule: { dueDate: today, startAt: null, endAt: null },
                      })
                }
              >
                <Sun aria-hidden="true" />
                {t("slipped.moveAllToday")}
              </Button>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {entries.slice(0, shown).map(({ item }) => (
                <SlippedRow
                  key={item.id}
                  item={item}
                  area={item.areaId ? areas.get(item.areaId) : undefined}
                  today={today}
                />
              ))}
            </AnimatePresence>
          </ul>
          <ShowMoreButton
            hidden={entries.length - shown}
            label={t("common.showMore", { count: STEP })}
            onMore={() => setShown((n) => n + STEP)}
          />
          {unloaded > 0 && shown >= entries.length && (
            <p className="text-small text-text-muted">{t("slipped.older", { count: unloaded })}</p>
          )}
        </motion.section>
      ) : (
        hadItems && (
          <motion.p
            key="caught-up"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-body text-text-muted"
          >
            <Sparkles aria-hidden="true" className="size-4 text-accent-text" />
            {t("slipped.allCaughtUp")}
          </motion.p>
        )
      )}
    </AnimatePresence>
  );
}
