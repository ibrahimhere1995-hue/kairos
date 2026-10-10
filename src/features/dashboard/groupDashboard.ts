import type { DayContext } from "@/lib/dates/dayContext";
import { getItemStatus, isComputedOccurrence, type ItemStatus } from "@/lib/status/status";
import type { Dashboard } from "@/types/Dashboard";
import type { Item } from "@/types/Item";

export interface DashboardItem {
  item: Item;
  status: ItemStatus;
}

export interface DashboardSections {
  now: DashboardItem[];
  today: DashboardItem[];
  slipped: DashboardItem[];
  /** Repeating tasks whose latest occurrence was missed (their own calm card). */
  routines: DashboardItem[];
  thisWeek: DashboardItem[];
  doneToday: DashboardItem[];
}

export interface DaySummary {
  tasks: number;
  meetings: number;
  slipped: number;
}

/**
 * Places the backend's time-window buckets into My Day sections using the status engine
 * (PRD §6 placement): Now = ongoing, Today = dueToday, Slipped = missed. Events that are
 * already over today are left out (they are simply past).
 */
export function groupDashboard(
  data: Dashboard,
  ctx: DayContext,
  areaId: string | null = null,
): DashboardSections {
  const inArea = (item: Item) => areaId === null || item.areaId === areaId;
  const withStatus = (items: Item[]) =>
    items.filter(inArea).map((item) => ({ item, status: getItemStatus(item, ctx) }));

  const sections: DashboardSections = {
    now: [],
    today: [],
    slipped: [],
    routines: [],
    thisWeek: [],
    doneToday: [],
  };
  for (const entry of withStatus(data.today)) {
    if (entry.status === "ongoing") sections.now.push(entry);
    else if (entry.status === "dueToday") sections.today.push(entry);
    else if (entry.status === "missed") sections.slipped.push(entry);
  }
  // Earlier days first, then anything that slipped earlier today. A routine's missed occurrence
  // (computed, from an earlier day) goes to the routines card instead: its next one is already
  // coming, so it only needs closing, not a new moment.
  const overdue = withStatus(data.overdue);
  sections.routines = overdue.filter(({ item }) => isComputedOccurrence(item));
  sections.slipped = [
    ...overdue.filter(({ item }) => !isComputedOccurrence(item)),
    ...sections.slipped,
  ];
  sections.thisWeek = withStatus(data.thisWeek);
  sections.doneToday = withStatus(data.doneToday);
  return sections;
}

/**
 * Slipped tasks the backend counted but didn't send (it sends the newest 200). Area filters
 * can't apply to them, so they only count when no area is chosen.
 */
export function unloadedSlipped(data: Dashboard, areaId: string | null = null): number {
  if (areaId !== null) return 0;
  const loaded = data.overdue.filter((item) => !isComputedOccurrence(item)).length;
  return Math.max(0, data.overdueTotal - loaded);
}

export function summarize(sections: DashboardSections, unloaded = 0): DaySummary {
  const remaining = [...sections.now, ...sections.today];
  return {
    tasks: remaining.filter((e) => e.item.kind === "task").length,
    meetings: remaining.filter((e) => e.item.kind === "event").length,
    slipped: sections.slipped.length + unloaded,
  };
}

export function isEmpty(sections: DashboardSections): boolean {
  return Object.values(sections).every((list: DashboardItem[]) => list.length === 0);
}
