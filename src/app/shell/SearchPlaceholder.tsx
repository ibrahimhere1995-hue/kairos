import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isMac } from "@/lib/platform";

/** Looks like the search bar; becomes the real search + command palette in P2-T09. */
export function SearchPlaceholder() {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled
      title={t("topbar.searchSoon")}
      className="flex h-10 w-full max-w-md min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-text-muted disabled:cursor-default"
    >
      <Search aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{t("topbar.search")}</span>
      <kbd className="ml-auto shrink-0 rounded-sm border border-border bg-surface px-1.5 font-sans text-caption">
        {isMac() ? "⌘ K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
