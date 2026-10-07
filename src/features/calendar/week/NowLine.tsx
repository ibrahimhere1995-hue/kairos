import { minutesToRem } from "@/features/calendar/week/gridMetrics";

/** Gold "now" line with a pulsing dot; glides to its new spot each minute (DESIGN_SYSTEM §6.2). */
export function NowLine({ minutes }: { minutes: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-0 left-0 z-20 flex items-center transition-[top] duration-1000 ease-(--ease-out)"
      style={{ top: minutesToRem(minutes) }}
    >
      <span className="now-pulse -ml-1.5 size-3 rounded-full bg-accent" />
      <span className="h-0.5 flex-1 bg-accent" />
    </div>
  );
}
