import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Never a blank screen: a friendly line and one clear action (DESIGN_SYSTEM §2.6, §9). */
export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="fade-in-late flex flex-col items-center gap-4 rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
      <Icon aria-hidden="true" className="size-10 text-accent-text" />
      <p className="max-w-md font-display text-h1">{message}</p>
      {action}
    </div>
  );
}
