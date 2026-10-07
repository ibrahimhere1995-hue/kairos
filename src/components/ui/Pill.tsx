import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Friendly picker trigger: icon + current value. `field` is announced before the value
 * ("Date: Tomorrow") so screen readers know what the pill controls.
 */
export function Pill({
  icon: Icon,
  field,
  children,
  className,
  iconStyle,
  ...props
}: ComponentProps<"button"> & {
  icon: LucideIcon;
  field: string;
  children: ReactNode;
  iconStyle?: CSSProperties;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface-2 px-3 text-small text-text",
        "hover:bg-surface-3 data-[state=open]:border-border-strong data-[state=open]:bg-surface-3",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" style={iconStyle} />
      <span className="sr-only">{field}: </span>
      <span>{children}</span>
    </button>
  );
}
