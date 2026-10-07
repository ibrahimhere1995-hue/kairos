import { Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/app/shell/Sidebar";
import { TopBar } from "@/app/shell/TopBar";
import { ItemEditor } from "@/features/items/editor/ItemEditor";

const MAIN_ID = "main-content";

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      {/* A button, not an anchor: "#..." would be read as a route by the hash router. */}
      <button
        type="button"
        onClick={() => document.getElementById(MAIN_ID)?.focus()}
        className="sr-only rounded-md bg-surface px-4 py-2 shadow-lg focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
      >
        {t("app.skipToContent")}
      </button>
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main id={MAIN_ID} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto outline-none">
          <div className="mx-auto max-w-(--content-max-width) p-8">
            <Outlet />
          </div>
        </main>
      </div>
      <ItemEditor />
    </div>
  );
}
