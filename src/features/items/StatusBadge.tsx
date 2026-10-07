import {
  CircleCheck,
  CircleDot,
  CircleMinus,
  Clock,
  History,
  Inbox,
  RotateCcw,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ItemStatus } from "@/lib/status/status";
import { cn } from "@/lib/utils";

/** DESIGN_SYSTEM §3.4: status is always colour + icon + label, never colour alone. */
const STATUS: Record<ItemStatus, { icon: LucideIcon; className: string; key: string }> = {
  ongoing: { icon: CircleDot, className: "text-status-now", key: "status.now" },
  dueToday: { icon: Sun, className: "text-status-today", key: "status.today" },
  upcoming: { icon: Clock, className: "text-status-upcoming", key: "status.upcoming" },
  missed: { icon: RotateCcw, className: "text-status-slipped", key: "status.slipped" },
  past: { icon: History, className: "text-status-past", key: "status.past" },
  done: { icon: CircleCheck, className: "text-status-done", key: "status.done" },
  skipped: { icon: CircleMinus, className: "text-status-skipped", key: "status.skipped" },
  unscheduled: { icon: Inbox, className: "text-text-subtle", key: "status.unscheduled" },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const { t } = useTranslation();
  const { icon: Icon, className, key } = STATUS[status];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-caption text-text-muted">
      <Icon
        aria-hidden="true"
        className={cn("size-4", className, status === "ongoing" && "now-pulse")}
      />
      {t(key)}
    </span>
  );
}
