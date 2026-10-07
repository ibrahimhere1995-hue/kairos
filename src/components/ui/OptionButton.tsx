import type { ComponentProps } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** One choice inside a picker popover; the selected one shows a tick and `aria-pressed`. */
export function OptionButton({
  selected,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-body hover:bg-surface-3",
        selected && "font-semibold",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {selected && <Check aria-hidden="true" className="size-4 shrink-0 text-accent-text" />}
    </button>
  );
}
