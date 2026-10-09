import { useState } from "react";
import { addDays, parseISO } from "date-fns";
import { CalendarDays, CircleCheck, ListChecks, Sun, Sunrise, Wind } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { keepsMoving, newMoment } from "@/features/dashboard/slippedMoves";
import { useCompleteItem, useRescheduleItem, useSkipItem } from "@/features/items/api";
import { useEditorStore } from "@/features/items/editorStore";
import { itemWhen } from "@/features/items/itemMeta";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { areaColor } from "@/lib/api/areas";
import { toLocalDateString } from "@/lib/dates/dayContext";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** One slipped task with its choices (PRD R6): Today, Tomorrow, Pick a date, Done already, Let it go. */
export function SlippedRow({
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
  const move = useRescheduleItem();
  const complete = useCompleteItem();
  const skip = useSkipItem();
  const [picking, setPicking] = useState(false);
  const tomorrow = toLocalDateString(addDays(parseISO(today), 1));
  const when = itemWhen(item, today, t);

  const moveTo = (date: string) => move.mutate({ item, schedule: newMoment(item, date, today) });

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="overflow-hidden"
    >
      <div className="relative flex flex-col gap-2 rounded-md border border-border bg-surface py-2 pr-3 pl-4">
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-1 rounded-full"
          style={{ backgroundColor: areaColor(area?.color) }}
        />
        <button
          type="button"
          onClick={() => openItem(item.id)}
          className="flex min-w-0 flex-col items-start rounded-sm text-left"
        >
          <span className="max-w-full truncate text-body">{item.title}</span>
          {(when ?? area) && (
            <span className="max-w-full truncate text-small text-text-muted">
              {[when, area?.name].filter(Boolean).join(" · ")}
            </span>
          )}
        </button>

        <div
          role="group"
          aria-label={t("slipped.choicesFor", { title: item.title })}
          className="flex flex-wrap gap-1"
        >
          <Button size="sm" variant="secondary" onClick={() => moveTo(today)}>
            <Sun aria-hidden="true" />
            {t("slipped.today")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => moveTo(tomorrow)}>
            <Sunrise aria-hidden="true" />
            {t("slipped.tomorrow")}
          </Button>
          <Popover
            open={picking}
            onOpenChange={setPicking}
            label={t("slipped.pickDate")}
            trigger={
              <Button size="sm" variant="ghost">
                <CalendarDays aria-hidden="true" />
                {t("slipped.pickDate")}
              </Button>
            }
          >
            <label className="flex flex-col gap-1 text-small text-text-muted">
              {t("slipped.newDate")}
              <input
                type="date"
                min={today}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setPicking(false);
                  moveTo(e.target.value);
                }}
                className="h-9 rounded-sm border border-border bg-surface-2 px-2 text-body text-text"
              />
            </label>
          </Popover>
          <Button size="sm" variant="ghost" onClick={() => complete.mutate(item)}>
            <CircleCheck aria-hidden="true" />
            {t("slipped.doneAlready")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => skip.mutate(item)}>
            <Wind aria-hidden="true" />
            {t("slipped.letGo")}
          </Button>
        </div>

        {keepsMoving(item) && (
          <p className="flex flex-wrap items-center gap-x-2 text-small text-text-muted">
            <ListChecks aria-hidden="true" className="size-4 text-status-slipped" />
            {t("slipped.keepsMoving")}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openItem(item.id, { focusSteps: true })}
            >
              {t("slipped.breakDown")}
            </Button>
          </p>
        )}
      </div>
    </motion.li>
  );
}
