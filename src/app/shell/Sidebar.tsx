import {
  CalendarDays,
  Inbox,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sunrise,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavItem } from "@/app/shell/NavItem";
import { useUiStore } from "@/app/uiStore";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";

// Life areas join the sidebar once they come from the database (P1-T04/T05);
// Goals and Habits arrive in Phase 3.
export function Sidebar() {
  const { t } = useTranslation();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <nav
      aria-label={t("nav.label")}
      className={cn(
        "flex shrink-0 flex-col gap-2 border-r border-border bg-surface-2 p-3",
        "transition-[width] duration-(--dur-base) ease-(--ease-out) motion-reduce:transition-none",
        collapsed ? "w-(--sidebar-rail-width)" : "w-(--sidebar-width)",
      )}
    >
      <ul className="flex flex-col gap-1">
        <NavItem to="/" icon={Sunrise} label={t("nav.myDay")} collapsed={collapsed} />
        <NavItem
          to="/calendar"
          icon={CalendarDays}
          label={t("nav.calendar")}
          collapsed={collapsed}
        />
        <NavItem to="/inbox" icon={Inbox} label={t("nav.inbox")} collapsed={collapsed} />
      </ul>

      <ul className="mt-auto flex flex-col gap-1">
        {import.meta.env.DEV && (
          <NavItem
            to="/dev/styleguide"
            icon={Palette}
            label={t("nav.styleguide")}
            collapsed={collapsed}
          />
        )}
        <NavItem to="/trash" icon={Trash2} label={t("nav.trash")} collapsed={collapsed} />
        <NavItem to="/settings" icon={Settings} label={t("nav.settings")} collapsed={collapsed} />
      </ul>

      <div className={cn("flex", collapsed ? "justify-center" : "justify-end")}>
        <IconButton
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={t(collapsed ? "nav.expand" : "nav.collapse")}
          tooltipSide="right"
          aria-expanded={!collapsed}
          onClick={toggleSidebar}
        />
      </div>
    </nav>
  );
}
