import { useDeferredValue, useMemo, useState, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { captureToItemInput } from "@/features/capture/captureInput";
import { useActiveAreas, useCreateItem } from "@/features/items/api";
import { useEditorStore } from "@/features/items/editorStore";
import {
  groupHits,
  optionId,
  type PaletteEntry,
  type PaletteSection,
} from "@/features/search/paletteEntries";
import { usePaletteStore } from "@/features/search/paletteStore";
import { PaletteResults } from "@/features/search/PaletteResults";
import { usePaletteCommands } from "@/features/search/usePaletteCommands";
import { searchApi } from "@/lib/api/search";
import { getDayContext } from "@/lib/dates/dayContext";
import { parseCapture } from "@/lib/nlp/parseCapture";

/** Most commands listed while also showing search results. */
const COMMANDS_WITH_RESULTS = 4;

/**
 * Ctrl/⌘+K (PRD R9): search titles, notes, steps and areas, grouped by status; also a command
 * palette. Arrow keys move, Enter opens, Esc closes. Nothing found → offer to create it.
 */
export function CommandPalette() {
  const { t } = useTranslation();
  const { open, closePalette } = usePaletteStore();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const deferred = useDeferredValue(query.trim());
  const ctx = getDayContext();
  const commands = usePaletteCommands(query);
  const openItem = useEditorStore((s) => s.openItem);
  const create = useCreateItem();
  const { data: areas = [] } = useActiveAreas();

  const results = useQuery({
    queryKey: ["search", deferred],
    queryFn: () => searchApi.search(deferred),
    enabled: open && deferred !== "",
    placeholderData: (previous) => previous,
  });
  const hits = useMemo(() => (deferred ? (results.data ?? []) : []), [deferred, results.data]);

  const sections = useMemo<PaletteSection[]>(() => {
    const shownCommands = hits.length > 0 ? commands.slice(0, COMMANDS_WITH_RESULTS) : commands;
    const list: PaletteSection[] = [];
    if (shownCommands.length > 0) {
      list.push({
        heading: "palette.commands",
        entries: shownCommands.map((command) => ({ kind: "command", command })),
      });
    }
    for (const { group, hits: inGroup } of groupHits(hits, ctx)) {
      list.push({
        heading: `palette.groups.${group}`,
        entries: inGroup.map((hit) => ({ kind: "hit", hit })),
      });
    }
    if (deferred && hits.length === 0 && !results.isFetching) {
      list.push({ heading: null, entries: [{ kind: "create", text: deferred }] });
    }
    return list;
    // ctx is recomputed each render; the day only matters for grouping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands, hits, deferred, results.isFetching]);

  const entries = sections.flatMap((s) => s.entries);
  const current = Math.min(active, Math.max(0, entries.length - 1));

  const close = () => {
    closePalette();
    setQuery("");
    setActive(0);
  };
  const pick = (entry: PaletteEntry) => {
    close();
    if (entry.kind === "command") entry.command.run();
    else if (entry.kind === "hit") openItem(entry.hit.item.id);
    else
      create.mutate(
        captureToItemInput(parseCapture(entry.text, { now: new Date(), areas }), ctx.today),
      );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = entries.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: current >= last ? 0 : current + 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key] ?? 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = entries[current];
      if (entry) pick(entry);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-text/20" />
        <Dialog.Content
          aria-describedby="palette-hint"
          className="capture-in fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[40rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface text-text shadow-lg"
        >
          <Dialog.Title className="sr-only">{t("palette.title")}</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
            <input
              role="combobox"
              aria-expanded
              aria-controls="palette-listbox"
              aria-activedescendant={entries.length > 0 ? optionId(current) : undefined}
              aria-autocomplete="list"
              aria-label={t("palette.inputLabel")}
              placeholder={t("topbar.search")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-14 min-w-0 flex-1 bg-transparent text-h3 outline-none placeholder:text-text-subtle"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-busy={results.isFetching}>
            {deferred && hits.length === 0 && !results.isFetching && (
              <p className="px-3 py-2 text-body text-text-muted">
                {t("palette.noResults", { query: deferred })}
              </p>
            )}
            <PaletteResults
              sections={sections}
              active={current}
              today={ctx.today}
              onHover={setActive}
              onPick={pick}
            />
          </div>
          <p
            id="palette-hint"
            className="border-t border-border px-4 py-2 text-caption text-text-muted"
          >
            {t("palette.hint")}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
