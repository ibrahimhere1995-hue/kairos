import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

export interface AreaBalance {
  areaId: string;
  name: string;
  color: string;
  minutes: number;
}

/**
 * Planned time per life area this week (PRD R2 balance strip): the length of every timed
 * item that has an end, done or not. Items without an area or a duration don't count.
 * Areas with no time are kept (with 0) so the strip can say "Health: 0 h".
 */
export function weeklyBalance(items: Item[], areas: Area[]): AreaBalance[] {
  const minutesByArea = new Map<string, number>();
  for (const item of items) {
    if (!item.areaId || !item.startAt || !item.endAt || item.deletedAt) continue;
    const minutes = (Date.parse(item.endAt) - Date.parse(item.startAt)) / 60_000;
    if (minutes > 0)
      minutesByArea.set(item.areaId, (minutesByArea.get(item.areaId) ?? 0) + minutes);
  }
  return areas.map((area) => ({
    areaId: area.id,
    name: area.name,
    color: area.color,
    minutes: Math.round(minutesByArea.get(area.id) ?? 0),
  }));
}
