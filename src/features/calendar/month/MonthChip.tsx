import { format, parseISO } from "date-fns";
import { useEditorStore } from "@/features/items/editorStore";
import { AreaDot } from "@/components/AreaDot";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** Compact item in a month cell: area dot, start time (if timed), title. Click opens it. */
export function MonthChip({ item, area }: { item: Item; area: Area | undefined }) {
  const openItem = useEditorStore((state) => state.openItem);
  const done = item.completedAt !== null;
  return (
    <button
      type="button"
      onClick={() => openItem(item.id)}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-caption hover:bg-surface-3",
        done && "text-text-muted line-through",
      )}
    >
      <AreaDot color={area?.color ?? null} className="size-2" />
      {item.startAt && (
        <span className="shrink-0 text-text-muted tabular-nums">
          {format(parseISO(item.startAt), "p")}
        </span>
      )}
      <span className="truncate">{item.title}</span>
    </button>
  );
}
