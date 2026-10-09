import { useEffect } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePaletteStore } from "@/features/search/paletteStore";
import { isMac } from "@/lib/platform";

/** The top bar's search box: opens the search and command palette (also Ctrl/⌘+K anywhere). */
export function SearchButton() {
  const { t } = useTranslation();
  const openPalette = usePaletteStore((s) => s.openPalette);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette]);

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-keyshortcuts="Control+K Meta+K"
      className="flex h-10 w-full max-w-md min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-text-muted hover:bg-surface-3"
    >
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{t("topbar.search")}</span>
      <kbd className="ml-auto shrink-0 rounded-sm border border-border bg-surface px-1.5 font-sans text-caption">
        {isMac() ? "⌘ K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
