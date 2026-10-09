import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { unscheduledDragId, type DragData } from "@/features/calendar/week/dragData";
import { useEditorStore } from "@/features/items/editorStore";
import { AreaDot } from "@/components/AreaDot";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** An Inbox task in the "To schedule" list: drag it onto the grid, or click to open it. */
export function UnscheduledChip({ item, area }: { item: Item; area: Area | undefined }) {
  const openItem = useEditorStore((state) => state.openItem);
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: unscheduledDragId(item.id),
    data: { kind: "unscheduled", itemId: item.id } satisfies DragData,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => openItem(item.id)}
      title={item.title}
      className={cn(
        "flex w-full cursor-grab items-center gap-2 rounded-sm border border-border bg-surface px-2 py-1.5 text-left text-small",
        "hover:bg-surface-3",
        // The floating copy (DragOverlay) moves; the original stays as a faint placeholder.
        isDragging && "opacity-40",
      )}
    >
      <GripVertical aria-hidden="true" className="size-4 shrink-0 text-text-subtle" />
      <AreaDot color={area?.color ?? null} />
      <span className="truncate">{item.title}</span>
    </button>
  );
}
