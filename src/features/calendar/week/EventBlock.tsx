import { format, parseISO } from "date-fns";
import { useDraggable } from "@dnd-kit/core";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PositionedItem } from "@/features/calendar/layout";
import type { DragData } from "@/features/calendar/week/dragData";
import { minutesToRem } from "@/features/calendar/week/gridMetrics";
import { useEditorStore } from "@/features/items/editorStore";
import { areaColor } from "@/lib/api/areas";
import type { ItemStatus } from "@/lib/status/status";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";

/**
 * A timed item on the grid. Drag the block to move it, drag its bottom edge to resize.
 * Keyboard: Enter opens it; Space picks it up, arrows move it, Space drops (dnd-kit).
 */
export function EventBlock({
  positioned,
  status,
  area,
}: {
  positioned: PositionedItem;
  status: ItemStatus;
  area: Area | undefined;
}) {
  const { t } = useTranslation();
  const openItem = useEditorStore((state) => state.openItem);
  const { item, top, bottom, column, columns, startsBefore, endsAfter } = positioned;

  const {
    setNodeRef: moveRef,
    attributes: moveAttributes,
    listeners: moveListeners,
    transform: moveTransform,
    isDragging: moving,
  } = useDraggable({
    id: `move:${item.id}`,
    data: { kind: "move", itemId: item.id } satisfies DragData,
  });
  const {
    setNodeRef: resizeRef,
    attributes: resizeAttributes,
    listeners: resizeListeners,
    transform: resizeTransform,
    isDragging: resizing,
  } = useDraggable({
    id: `resize:${item.id}`,
    data: { kind: "resize", itemId: item.id } satisfies DragData,
  });

  const color = areaColor(area?.color);
  const done = status === "done";
  const start = item.startAt ? format(parseISO(item.startAt), "p") : "";
  const end = item.endAt ? format(parseISO(item.endAt), "p") : null;
  const timeLabel = end ? `${start} – ${end}` : start;
  const growPx = resizeTransform?.y ?? 0;
  const dragging = moving || resizing;

  return (
    <div
      className={cn("absolute px-0.5", dragging && "z-30")}
      style={{
        top: minutesToRem(top),
        height: `calc(${minutesToRem(bottom - top)} + ${growPx}px)`,
        left: `${(column / columns) * 100}%`,
        width: `${100 / columns}%`,
        transform: moveTransform
          ? `translate3d(${moveTransform.x}px, ${moveTransform.y}px, 0)`
          : undefined,
      }}
    >
      <button
        ref={moveRef}
        type="button"
        {...moveAttributes}
        {...moveListeners}
        onClick={() => openItem(item.id)}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden border-l-4 px-2 py-1 text-left text-small text-text",
          "rounded-sm hover:brightness-95 focus-visible:z-30",
          startsBefore && "rounded-t-none",
          endsAfter && "rounded-b-none",
          done && "opacity-60",
          dragging && "scale-[1.02] shadow-lg",
        )}
        style={{
          borderLeftColor: color,
          backgroundColor: `color-mix(in srgb, ${color} 16%, var(--surface))`,
        }}
      >
        <span className={cn("truncate font-semibold", done && "line-through")}>{item.title}</span>
        <span className="sr-only">,</span>{" "}
        <span className="truncate text-caption text-text-muted tabular-nums">
          {status === "missed" && (
            <RotateCcw aria-hidden="true" className="mr-1 inline size-3 text-status-slipped" />
          )}
          {timeLabel}
        </span>
        {/* The visible words are the name (WCAG 2.5.3); the area is added for screen readers. */}
        {area && <span className="sr-only">, {area.name}</span>}
      </button>
      <span
        ref={resizeRef}
        {...resizeListeners}
        {...resizeAttributes}
        // Mouse and touch only: keyboard and screen-reader users change the length in the
        // editor, an equivalent control (WCAG 2.5.8), so the thin strip stays out of their way.
        role={undefined}
        tabIndex={-1}
        aria-hidden="true"
        title={t("calendar.resize", { title: item.title })}
        className="absolute right-1 bottom-0 left-1 h-2 cursor-ns-resize rounded-full focus-visible:bg-accent"
      />
    </div>
  );
}
