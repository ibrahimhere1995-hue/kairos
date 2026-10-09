import { progress } from "@/features/focus/timer";

const R = 90;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The timer ring: fills as the phase passes. Decorative; the clock beside it carries the meaning. */
export function FocusRing({
  leftMs,
  phaseMs,
  rest,
}: {
  leftMs: number;
  phaseMs: number;
  rest: boolean;
}) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute inset-0 size-full -rotate-90">
      <circle cx="100" cy="100" r={R} fill="none" strokeWidth="6" className="stroke-surface-3" />
      <circle
        cx="100"
        cy="100"
        r={R}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - progress(leftMs, phaseMs))}
        className={rest ? "stroke-status-done" : "stroke-accent"}
      />
    </svg>
  );
}
