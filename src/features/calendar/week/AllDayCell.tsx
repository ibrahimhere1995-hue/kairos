import { useDroppable } from "@dnd-kit/core";
import { AllDayChip } from "@/features/calendar/week/AllDayChip";
import { allDayId } from "@/features/calendar/week/dragData";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** One day's slot in the all-day row: date-only items, droppable for moving between days. */
export function AllDayCell({
  date,
  items,
  areas,
}: {
  date: string;
  items: Item[];
  areas: Map<string, Area>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: allDayId(date) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-9 min-w-0 flex-1 flex-col gap-1 border-l border-border p-1",
        isOver && "bg-surface-3 outline-2 -outline-offset-2 outline-accent",
      )}
    >
      {items.map((item) => (
        <AllDayChip
          key={item.id}
          item={item}
          area={item.areaId ? areas.get(item.areaId) : undefined}
        />
      ))}
    </div>
  );
}
