import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SearchPlaceholder } from "@/app/shell/SearchPlaceholder";
import { ThemeToggle } from "@/app/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { useEditorStore } from "@/features/items/editorStore";

export function TopBar() {
  const { t } = useTranslation();
  const openNew = useEditorStore((state) => state.openNew);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-4">
      <span className="w-(--sidebar-width) shrink-0 pl-2 font-display text-h1 text-text">
        {t("app.name")}
      </span>
      <SearchPlaceholder />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button size="lg" onClick={() => openNew()}>
          <Plus aria-hidden="true" />
          {t("topbar.addTask")}
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
