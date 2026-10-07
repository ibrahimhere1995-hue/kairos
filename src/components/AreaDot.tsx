import { areaColor } from "@/lib/api/areas";
import { cn } from "@/lib/utils";

/** Small coloured dot for a life area (DESIGN_SYSTEM §3.3). Decorative: always pair with a label. */
export function AreaDot({ color, className }: { color: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: areaColor(color) }}
    />
  );
}
