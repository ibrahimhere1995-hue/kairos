import { useDraggable } from "@dnd-kit/core";
import type { DragData } from "@/features/calendar/week/dragData";
import { useEditorStore } from "@/features/items/editorStore";
import { AreaDot } from "@/components/AreaDot";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** A date-only item in the all-day row: click opens it, drag moves it to another day. */
export function AllDayChip({ item, area }: { item: Item; area: Area | undefined }) {
  const openItem = useEditorStore((state) => state.openItem);
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `allday-item:${item.id}`,
    data: { kind: "allDay", itemId: item.id } satisfies DragData,
  });
  const done = item.completedAt !== null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => openItem(item.id)}
      // Narrow day columns truncate the title: show it in full on hover.
      title={item.title}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-left text-caption",
        "hover:bg-surface-3",
        done && "text-text-muted line-through",
        isDragging && "relative z-30 shadow-lg",
      )}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
    >
      <AreaDot color={area?.color ?? null} />
      <span className="truncate">{item.title}</span>
    </button>
  );
}
