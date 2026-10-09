import type { DayContext } from "@/lib/dates/dayContext";
import { getItemStatus, type ItemStatus } from "@/lib/status/status";
import type { SearchHit } from "@/types/SearchHit";

/** A command in the palette: a label and what it does. */
export interface PaletteCommand {
  id: string;
  label: string;
  /** Extra words it answers to ("theme" finds "Switch to dark theme"). */
  keywords: string;
  run: () => void;
}

export type PaletteEntry =
  | { kind: "command"; command: PaletteCommand }
  | { kind: "hit"; hit: SearchHit }
  | { kind: "create"; text: string };

export interface PaletteSection {
  /** Heading i18n key, or null for no heading. */
  heading: string | null;
  entries: PaletteEntry[];
}

export const optionId = (index: number) => `palette-option-${index}`;

export type ResultGroup = "today" | "slipped" | "upcoming" | "noDate" | "done" | "past";

/** Result groups in display order (PRD R9: results grouped by status). */
export const RESULT_GROUPS: ResultGroup[] = [
  "today",
  "slipped",
  "upcoming",
  "noDate",
  "done",
  "past",
];

const GROUP_OF: Record<ItemStatus, ResultGroup> = {
  ongoing: "today",
  dueToday: "today",
  missed: "slipped",
  upcoming: "upcoming",
  unscheduled: "noDate",
  done: "done",
  skipped: "done",
  past: "past",
};

/** Commands whose label or keywords contain every typed word (all of them when empty). */
export function matchCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return commands.filter((c) => {
    const text = `${c.label} ${c.keywords}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** Search hits by status group, groups in display order, empty groups left out. */
export function groupHits(
  hits: SearchHit[],
  ctx: DayContext,
): { group: ResultGroup; hits: SearchHit[] }[] {
  const byGroup = new Map<ResultGroup, SearchHit[]>();
  for (const hit of hits) {
    const group = GROUP_OF[getItemStatus(hit.item, ctx)];
    byGroup.set(group, [...(byGroup.get(group) ?? []), hit]);
  }
  return RESULT_GROUPS.flatMap((group) => {
    const inGroup = byGroup.get(group);
    return inGroup ? [{ group, hits: inGroup }] : [];
  });
}
