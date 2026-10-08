import { useId, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import type { DashboardItem } from "@/features/dashboard/groupDashboard";
import { ItemRow } from "@/features/items/ItemRow";
import { VIRTUALIZE_AFTER, VirtualList } from "@/components/VirtualList";
import { cn } from "@/lib/utils";
import type { Area } from "@/types/Area";

/** A titled list of items on My Day. Empty sections are not shown. */
export function DashboardSection({
  title,
  icon: Icon,
  iconClassName,
  entries,
  areas,
  today,
  collapsible = false,
}: {
  title: string;
  icon: LucideIcon;
  iconClassName?: string;
  entries: DashboardItem[];
  areas: Map<string, Area>;
  today: string;
  collapsible?: boolean;
}) {
  const headingId = useId();
  const listId = useId();
  const [expanded, setExpanded] = useState(!collapsible);
  if (entries.length === 0) return null;

  const heading = (
    <>
      <Icon aria-hidden="true" className={cn("size-5", iconClassName)} />
      <span>{title}</span>
      <span className="text-small font-normal text-text-muted">{entries.length}</span>
    </>
  );

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-h2">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-2 rounded-sm"
          >
            {heading}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform duration-(--dur-fast)",
                expanded && "rotate-180",
              )}
            />
          </button>
        ) : (
          <span className="inline-flex items-center gap-2">{heading}</span>
        )}
      </h2>
      {expanded && entries.length > VIRTUALIZE_AFTER && (
        <div id={listId}>
          <VirtualList
            items={entries}
            label={title}
            rowHeightRem={4}
            heightRem={32}
            getKey={(entry) => entry.item.id}
            renderRow={({ item, status }, style) => (
              <ItemRow
                item={item}
                status={status}
                area={item.areaId ? areas.get(item.areaId) : undefined}
                today={today}
                style={style}
              />
            )}
          />
        </div>
      )}
      {expanded && entries.length <= VIRTUALIZE_AFTER && (
        <ul id={listId} className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {entries.map(({ item, status }) => (
              <ItemRow
                key={item.id}
                item={item}
                status={status}
                area={item.areaId ? areas.get(item.areaId) : undefined}
                today={today}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
