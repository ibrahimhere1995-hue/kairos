import { addDays, format, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const DAYS = 12 * 7;

/**
 * The last 12 weeks, one square per day (PRD R13 heatmap). Decorative: the same information
 * is given in words by the accessible name.
 */
export function Heatmap({ today, ticked }: { today: string; ticked: string[] }) {
  const { t } = useTranslation();
  const done = new Set(ticked);
  const start = addDays(parseISO(today), -(DAYS - 1));
  const days = Array.from({ length: DAYS }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
  return (
    <div
      role="img"
      aria-label={t("habits.heatmap", { count: ticked.length })}
      className="grid w-fit grid-flow-col grid-rows-7 gap-0.5"
    >
      {days.map((day) => (
        <span
          key={day}
          title={day}
          className={cn(
            "size-2.5 rounded-[2px]",
            done.has(day) ? "bg-accent" : "bg-surface-3",
            day === today && "ring-1 ring-text-subtle",
          )}
        />
      ))}
    </div>
  );
}
