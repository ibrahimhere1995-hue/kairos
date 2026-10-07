import { useState } from "react";
import { CalendarClock, Flag } from "lucide-react";
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
}: {
  item: Item;
  status: ItemStatus;
  area: Area | undefined;
  today: string;
}) {
  const { t } = useTranslation();
  const openItem = useEditorStore((state) => state.openItem);
  const complete = useCompleteItem();
  const uncomplete = useUncompleteItem();
  // Show the tick immediately; the list re-sorts once the animation has played.
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const done = optimisticDone ?? item.completedAt !== null;
  const when = itemWhen(item, today, t);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className="overflow-hidden"
    >
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
              setOptimisticDone(next);
              const action = next ? complete : uncomplete;
              action.mutate(item, { onError: () => setOptimisticDone(null) });
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
          {(when ?? area) && (
            <span className="max-w-full truncate text-small text-text-muted">
              {[when, area?.name].filter(Boolean).join(" · ")}
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
    </motion.li>
  );
}
