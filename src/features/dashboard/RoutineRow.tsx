import { CircleCheck, SkipForward, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { newMoment } from "@/features/dashboard/slippedMoves";
import { useCompleteItem, useRescheduleItem, useSkipItem } from "@/features/items/api";
import { useEditorStore } from "@/features/items/editorStore";
import { itemWhen } from "@/features/items/itemMeta";
import { Button } from "@/components/ui/Button";
import { areaColor } from "@/lib/api/areas";
import { repeatsOftenerThanWeekly } from "@/lib/recurrence/rules";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/**
 * A routine's missed occurrence: Done already / Skip this time, and for weekly or rarer
 * routines "Do it today" (a daily one's next turn is already today or tomorrow).
 */
export function RoutineRow({
  item,
  area,
  today,
}: {
  item: Item;
  area: Area | undefined;
  today: string;
}) {
  const { t } = useTranslation();
  const openItem = useEditorStore((state) => state.openItem);
  const complete = useCompleteItem();
  const skip = useSkipItem("toast.skippedOnce");
  const move = useRescheduleItem();
  const when = itemWhen(item, today, t);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="overflow-hidden"
    >
      <div className="relative flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface py-2 pr-3 pl-4">
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-1 rounded-full"
          style={{ backgroundColor: areaColor(area?.color) }}
        />
        <button
          type="button"
          onClick={() => openItem(item.id)}
          className="flex min-w-40 flex-1 flex-col items-start rounded-sm text-left"
        >
          <span className="max-w-full truncate text-body">{item.title}</span>
          {when && <span className="text-small text-text-muted">{when}</span>}
        </button>
        <div
          role="group"
          aria-label={t("routines.choicesFor", { title: item.title })}
          className="flex flex-wrap gap-1"
        >
          {!repeatsOftenerThanWeekly(item.rrule) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => move.mutate({ item, schedule: newMoment(item, today, today) })}
            >
              <Sun aria-hidden="true" />
              {t("routines.doToday")}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => complete.mutate(item)}>
            <CircleCheck aria-hidden="true" />
            {t("routines.doneAlready")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => skip.mutate(item)}>
            <SkipForward aria-hidden="true" />
            {t("routines.skip")}
          </Button>
        </div>
      </div>
    </motion.li>
  );
}
