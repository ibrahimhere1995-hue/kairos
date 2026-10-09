import type { LucideIcon } from "lucide-react";
import { useEditorStore } from "@/features/items/editorStore";
import { AreaDot } from "@/components/AreaDot";
import type { Area } from "@/types/Area";
import type { Item } from "@/types/Item";

/** A short list of the week's items; each opens in the editor. */
export function WeekItemList({
  id,
  title,
  icon: Icon,
  iconClassName,
  items,
  empty,
  areas,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  items: Item[];
  empty: string;
  areas: Map<string, Area>;
}) {
  const openItem = useEditorStore((s) => s.openItem);
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4"
    >
      <h2 id={id} className="inline-flex items-center gap-2 text-h3">
        <Icon aria-hidden="true" className={`size-5 ${iconClassName}`} />
        {title} <span className="text-text-muted">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-small text-text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openItem(item.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body hover:bg-surface-2"
              >
                <AreaDot color={item.areaId ? (areas.get(item.areaId)?.color ?? null) : null} />
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
