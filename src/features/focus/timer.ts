/** Pure helpers for the focus timer (PRD R16: 25/5 Pomodoro or custom). */

export interface FocusPlan {
  workMinutes: number;
  breakMinutes: number;
}

export const POMODORO: FocusPlan = { workMinutes: 25, breakMinutes: 5 };
export const WORK_MAX = 180;
export const BREAK_MAX = 60;

/** A whole number within `[min, max]`; anything unreadable becomes `fallback`. */
export function clampMinutes(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** `25:00`, `4:05`, `0:00` — whole seconds, rounded up so the clock never shows 0 early. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** How much of the phase has passed, 0–1 (for the ring). */
export function progress(leftMs: number, phaseMs: number): number {
  if (phaseMs <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - leftMs / phaseMs));
}
