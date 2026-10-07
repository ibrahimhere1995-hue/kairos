import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SearchPlaceholder } from "@/app/shell/SearchPlaceholder";
import { ThemeToggle } from "@/app/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";

export function TopBar() {
  const { t } = useTranslation();

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-4">
      <span className="w-(--sidebar-width) shrink-0 pl-2 font-display text-h1 text-text">
        {t("app.name")}
      </span>
      <SearchPlaceholder />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Opens the item editor once it exists (P1-T07). */}
        <Button size="lg" disabled>
          <Plus aria-hidden="true" />
          {t("topbar.addTask")}
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
