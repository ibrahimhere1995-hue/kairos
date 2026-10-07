import { HOUR_HEIGHT_REM } from "@/features/calendar/layout";

/**
 * Pixels per minute in the hour grid. Rows are sized in rem, so this follows the user's
 * text-size setting (DESIGN_SYSTEM §4).
 */
export function pxPerMinute(): number {
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return (HOUR_HEIGHT_REM * rootPx) / 60;
}

/** CSS length for a number of minutes on the grid. */
export function minutesToRem(minutes: number): string {
  return `${(minutes / 60) * HOUR_HEIGHT_REM}rem`;
}
