import type { ReactElement } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export const TooltipProvider = TooltipPrimitive.Provider;

/** Wraps a single focusable child; shows `label` on hover and keyboard focus. */
export function Tooltip({
  label,
  side = "bottom",
  disabled = false,
  children,
}: {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
  children: ReactElement;
}) {
  if (disabled) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-sm bg-text px-2 py-1 text-caption text-bg shadow-md"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
