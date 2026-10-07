import { format, setHours, startOfDay } from "date-fns";
import { minutesToRem } from "@/features/calendar/week/gridMetrics";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Hour labels down the left edge ("9 AM" style follows the system locale via date-fns "p"). */
export function HourGutter() {
  const midnight = startOfDay(new Date());
  return (
    <div
      aria-hidden="true"
      className="relative w-16 shrink-0"
      style={{ height: minutesToRem(24 * 60) }}
    >
      {HOURS.slice(1).map((h) => (
        <span
          key={h}
          className="absolute right-2 -translate-y-1/2 text-caption text-text-muted tabular-nums"
          style={{ top: minutesToRem(h * 60) }}
        >
          {format(setHours(midnight, h), "h a")}
        </span>
      ))}
    </div>
  );
}
