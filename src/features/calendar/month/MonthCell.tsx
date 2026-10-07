import { useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { localMidnight } from "@/features/calendar/calendarView";
import { MonthChip } from "@/features/calendar/month/MonthChip";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** How many items fit in a month cell before "+N more". */
const VISIBLE = 3;

export function MonthCell({
  date,
  items,
  areas,
  inMonth,
  isToday,
  onOpenDay,
}: {
  date: string;
  items: Item[];
  areas: Map<string, Area>;
  inMonth: boolean;
  isToday: boolean;
  onOpenDay: (date: string) => void;
}) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const day = localMidnight(date);
  const hidden = items.length - VISIBLE;
  const chip = (item: Item) => (
    <MonthChip key={item.id} item={item} area={item.areaId ? areas.get(item.areaId) : undefined} />
  );

  return (
    <div
      className={cn(
        "flex min-h-28 min-w-0 flex-col gap-0.5 border-t border-l border-border p-1",
        !inMonth && "bg-surface-2",
      )}
    >
      <button
        type="button"
        onClick={() => onOpenDay(date)}
        aria-label={t("calendar.openDay", { date: format(day, "EEEE d MMMM") })}
        aria-current={isToday ? "date" : undefined}
        className={cn(
          "flex size-7 items-center justify-center self-start rounded-full text-small tabular-nums hover:bg-surface-3",
          !inMonth && "text-text-muted",
          isToday && "bg-accent font-semibold text-on-accent hover:bg-accent-hover",
        )}
      >
        {format(day, "d")}
      </button>
      {items.slice(0, VISIBLE).map(chip)}
      {hidden > 0 && (
        <Popover
          open={moreOpen}
          onOpenChange={setMoreOpen}
          label={format(day, "EEEE d MMMM")}
          trigger={
            <button
              type="button"
              className="self-start rounded-sm px-1 text-caption font-semibold text-accent-text hover:bg-surface-3"
            >
              {t("calendar.more", { count: hidden })}
            </button>
          }
        >
          <p className="text-small font-semibold">{format(day, "EEEE d MMMM")}</p>
          {items.map(chip)}
        </Popover>
      )}
    </div>
  );
}
