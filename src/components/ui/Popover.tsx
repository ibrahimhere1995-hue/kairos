import type { ReactElement, ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

/** Small floating picker anchored to a trigger (pills in the item editor). */
export function Popover({
  open,
  onOpenChange,
  trigger,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  /** Accessible name for the popup. */
  label: string;
  children: ReactNode;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          aria-label={label}
          align="start"
          sideOffset={6}
          className="z-50 flex w-72 flex-col gap-2 rounded-md border border-border bg-surface p-3 text-text shadow-lg"
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
