import { AreaDot } from "@/components/AreaDot";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** What follows the pointer while an Inbox task is dragged onto the calendar. */
export function UnscheduledDragPreview({ item, area }: { item: Item; area: Area | undefined }) {
  return (
    <div className="flex w-56 items-center gap-2 rounded-sm border border-accent bg-surface px-2 py-1.5 text-small shadow-lg">
      <AreaDot color={area?.color ?? null} />
      <span className="truncate">{item.title}</span>
    </div>
  );
}
