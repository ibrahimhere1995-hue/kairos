import { Link, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

/** Sidebar link: icon + label; when the sidebar is collapsed the label moves into a tooltip. */
export function NavItem({
  to,
  icon: Icon,
  label,
  collapsed,
}: {
  to: LinkProps["to"];
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
}) {
  return (
    <li>
      <Tooltip label={label} side="right" disabled={!collapsed}>
        <Link
          to={to}
          activeOptions={{ exact: to === "/" }}
          className={cn(
            "flex h-10 items-center gap-3 rounded-md px-3 text-body text-text-muted",
            "hover:bg-surface-3 hover:text-text",
            "data-[status=active]:bg-surface data-[status=active]:font-semibold data-[status=active]:text-text data-[status=active]:shadow-sm",
            collapsed && "justify-center px-0",
          )}
        >
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
        </Link>
      </Tooltip>
    </li>
  );
}
