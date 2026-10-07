import { differenceInMinutes } from "date-fns";
import type { Item } from "@/types/Item";

/** DESIGN_SYSTEM §7: hour rows are 56 px (3.5rem) tall. */
export const HOUR_HEIGHT_REM = 3.5;
export const MINUTES_PER_DAY = 24 * 60;
/** Drag and click-drag snap to quarter hours. */
export const SNAP_MINUTES = 15;
/** Point-in-time tasks (no end) are drawn this tall so they stay clickable. */
export const POINT_TASK_MINUTES = 30;
/** Very short items are drawn at least this tall. */
export const MIN_BLOCK_MINUTES = 20;

export interface PositionedItem {
  item: Item;
  /** Minutes from local midnight where the visible part starts / ends (clipped to the day). */
  top: number;
  bottom: number;
  /** Overlap layout: which column and how many columns its cluster uses. */
  column: number;
  columns: number;
  /** True if the item really started before / ends after this day (drawn with a cut edge). */
  startsBefore: boolean;
  endsAfter: boolean;
}

/**
 * Lays out the timed items of one local day for the hour grid.
 * Overlapping items share the width side by side (greedy column packing per overlap cluster).
 * O(n log n): fine for hundreds of items (PROJECT_RULES performance budget).
 */
export function layoutDay(items: Item[], dayStart: Date, dayEnd: Date): PositionedItem[] {
  const startMs = dayStart.getTime();
  const endMs = dayEnd.getTime();
  const dayLength = differenceInMinutes(dayEnd, dayStart); // 1380/1440/1500 on DST days

  const visible = items
    .filter((item) => item.startAt !== null)
    .map((item) => {
      const s = Date.parse(item.startAt ?? "");
      const rawEnd = item.endAt ? Date.parse(item.endAt) : s + POINT_TASK_MINUTES * 60_000;
      return { item, s, e: Math.max(rawEnd, s + MIN_BLOCK_MINUTES * 60_000), realEnd: rawEnd };
    })
    .filter(({ s, e }) => s < endMs && e > startMs)
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const result: PositionedItem[] = [];
  let cluster: { entry: PositionedItem; end: number }[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    const columns = Math.max(1, ...cluster.map((c) => c.entry.column + 1));
    for (const c of cluster) c.entry.columns = columns;
    cluster = [];
  };

  for (const { item, s, e, realEnd } of visible) {
    if (s >= clusterEnd) {
      closeCluster();
      clusterEnd = -Infinity;
    }
    // First column whose last item has ended.
    const used = new Set(cluster.filter((c) => c.end > s).map((c) => c.entry.column));
    let column = 0;
    while (used.has(column)) column += 1;

    const entry: PositionedItem = {
      item,
      top: Math.max(0, (s - startMs) / 60_000),
      bottom: Math.min(dayLength, (e - startMs) / 60_000),
      column,
      columns: 1,
      startsBefore: s < startMs,
      endsAfter: realEnd > endMs,
    };
    cluster.push({ entry, end: e });
    clusterEnd = Math.max(clusterEnd, e);
    result.push(entry);
  }
  closeCluster();
  return result;
}

/** Date-only items for one local date (the all-day row). */
export function allDayItems(items: Item[], date: string): Item[] {
  return items.filter((item) => item.startAt === null && item.dueDate === date);
}

/** Every item that touches a local day: all-day ones first, then by start time. */
export function itemsOnDay(items: Item[], date: string, dayStart: Date, dayEnd: Date): Item[] {
  const timed = layoutDay(items, dayStart, dayEnd).map((p) => p.item);
  return [...allDayItems(items, date), ...timed];
}

/** Snaps minutes to the grid (15-minute slots). */
export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}
