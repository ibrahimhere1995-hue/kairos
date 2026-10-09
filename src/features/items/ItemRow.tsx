import { useState, type CSSProperties } from "react";
import { CalendarClock, Flag, Repeat } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useCompleteItem, useUncompleteItem } from "@/features/items/api";
import { useEditorStore } from "@/features/items/editorStore";
import { itemWhen } from "@/features/items/itemMeta";
import { StatusBadge } from "@/features/items/StatusBadge";
import { CompleteCheckbox } from "@/components/ui/CompleteCheckbox";
import { areaColor } from "@/lib/api/areas";
import type { ItemStatus } from "@/lib/status/status";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** One item in a list: area stripe, one-click complete (tasks), title opens the editor. */
export function ItemRow({
  item,
  status,
  area,
  today,
  style,
}: {
  item: Item;
  status: ItemStatus;
  area: Area | undefined;
  today: string;
  /** Set by VirtualList for long lists. */
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  const openItem = useEditorStore((state) => state.openItem);
  const complete = useCompleteItem();
  const uncomplete = useUncompleteItem();
  // Show the tick immediately; the list re-sorts once the animation has played.
  // The tick shows at once, but only until fresh data for this item arrives (e.g. after Undo):
  // it is tied to the version of the item it was made on.
  const [optimistic, setOptimistic] = useState<{ done: boolean; version: string } | null>(null);
  const done = optimistic?.version === item.updatedAt ? optimistic.done : item.completedAt !== null;
  const when = itemWhen(item, today, t);
  const repeats = item.rrule !== null || item.recurrenceParentId !== null;

  const row = (
    <div
      className={cn(
        "relative flex items-center gap-2 rounded-md border border-border bg-surface py-1.5 pr-3 pl-3",
        "transition-colors duration-(--dur-fast) hover:bg-surface-3",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-2 left-0 w-1 rounded-full"
        style={{ backgroundColor: areaColor(area?.color) }}
      />
      {item.kind === "task" ? (
        <CompleteCheckbox
          checked={done}
          label={t(done ? "items.markNotDone" : "items.markDone", { title: item.title })}
          onChange={(next) => {
            setOptimistic({ done: next, version: item.updatedAt });
            const action = next ? complete : uncomplete;
            action.mutate(item, { onError: () => setOptimistic(null) });
          }}
        />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center text-text-muted">
          <CalendarClock aria-hidden="true" className="size-5" />
        </span>
      )}
      <button
        type="button"
        onClick={() => openItem(item.id)}
        className="flex min-w-0 flex-1 flex-col items-start rounded-sm py-1 text-left"
      >
        <span className={cn("max-w-full truncate text-body", done && "strike text-text-muted")}>
          {item.title}
        </span>
        {(when ?? area ?? item.location ?? repeats) && (
          <span className="inline-flex max-w-full items-center gap-1 truncate text-small text-text-muted">
            {repeats && (
              <>
                <Repeat aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="sr-only">{t("repeat.repeats")}</span>
              </>
            )}
            {[when, area?.name, item.location].filter(Boolean).join(" · ")}
          </span>
        )}
      </button>
      {item.priority === 3 && (
        <span className="inline-flex items-center gap-1 text-caption text-text-muted">
          <Flag aria-hidden="true" className="size-4" />
          {t("priority.high")}
        </span>
      )}
      <StatusBadge status={done ? "done" : status} />
    </div>
  );

  // Inside a windowed list (VirtualList): fixed position, no enter animation.
  if (style) {
    return (
      <li style={style} className="pb-2">
        {row}
      </li>
    );
  }
  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="overflow-hidden"
    >
      {row}
    </motion.li>
  );
}
