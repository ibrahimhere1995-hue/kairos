import { CornerDownLeft, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { optionId, type PaletteEntry, type PaletteSection } from "@/features/search/paletteEntries";
import { itemWhen } from "@/features/items/itemMeta";
import { cn } from "@/lib/utils";

/** The listbox: commands, then results grouped by status, or the "Create it" offer. */
export function PaletteResults({
  sections,
  active,
  today,
  onHover,
  onPick,
}: {
  sections: PaletteSection[];
  active: number;
  today: string;
  onHover: (index: number) => void;
  onPick: (entry: PaletteEntry) => void;
}) {
  const { t } = useTranslation();
  // Index of each section's first option in the flat list (arrow keys move through it).
  const starts = sections.map((_, s) =>
    sections.slice(0, s).reduce((sum, section) => sum + section.entries.length, 0),
  );

  return (
    <ul
      id="palette-listbox"
      role="listbox"
      aria-label={t("palette.title")}
      className="flex flex-col gap-0.5"
    >
      {sections.map((section, s) => (
        <li key={s} role="presentation" className="flex flex-col gap-0.5">
          {section.heading && (
            <p
              role="presentation"
              className="px-3 pt-3 pb-1 text-caption text-text-muted uppercase"
            >
              {t(section.heading)}
            </p>
          )}
          <ul role="presentation" className="flex flex-col gap-0.5">
            {section.entries.map((entry, e) => {
              const i = (starts[s] ?? 0) + e;
              const selected = i === active;
              return (
                <li
                  key={i}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => onHover(i)}
                  onClick={() => onPick(entry)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-body",
                    selected && "bg-surface-3",
                  )}
                >
                  <EntryContent entry={entry} today={today} />
                  {selected && (
                    <CornerDownLeft
                      aria-hidden="true"
                      className="ml-auto size-4 shrink-0 text-text-subtle"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function EntryContent({ entry, today }: { entry: PaletteEntry; today: string }) {
  const { t } = useTranslation();
  if (entry.kind === "command") return <span className="truncate">{entry.command.label}</span>;
  if (entry.kind === "create") {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <Plus aria-hidden="true" className="size-4 shrink-0 text-accent-text" />
        <span className="truncate">
          {t("palette.create")}: “{entry.text}”
        </span>
      </span>
    );
  }
  const { item, matchedIn } = entry.hit;
  const where = matchedIn === "title" ? null : t(`palette.matchedIn.${matchedIn}`);
  const meta = [itemWhen(item, today, t), where].filter(Boolean).join(" · ");
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{item.title}</span>
      {meta && <span className="truncate text-small text-text-muted">{meta}</span>}
    </span>
  );
}
