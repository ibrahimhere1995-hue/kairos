import type { DayContext } from "@/lib/dates/dayContext";
import { getItemStatus, type ItemStatus } from "@/lib/status/status";
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
    thisWeek: [],
    doneToday: [],
  };
  for (const entry of withStatus(data.today)) {
    if (entry.status === "ongoing") sections.now.push(entry);
    else if (entry.status === "dueToday") sections.today.push(entry);
    else if (entry.status === "missed") sections.slipped.push(entry);
  }
  // Earlier days first, then anything that slipped earlier today.
  sections.slipped = [...withStatus(data.overdue), ...sections.slipped];
  sections.thisWeek = withStatus(data.thisWeek);
  sections.doneToday = withStatus(data.doneToday);
  return sections;
}

export function summarize(sections: DashboardSections): DaySummary {
  const remaining = [...sections.now, ...sections.today];
  return {
    tasks: remaining.filter((e) => e.item.kind === "task").length,
    meetings: remaining.filter((e) => e.item.kind === "event").length,
    slipped: sections.slipped.length,
  };
}

export function isEmpty(sections: DashboardSections): boolean {
  return Object.values(sections).every((list: DashboardItem[]) => list.length === 0);
}
