import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

type IconButtonProps = Omit<ButtonProps, "children" | "size" | "aria-label"> & {
  label: string;
  icon: LucideIcon;
  tooltipSide?: "top" | "right" | "bottom" | "left";
};

/** Icon-only button for dense toolbars: always has a tooltip and an accessible name (DESIGN_SYSTEM §2.2). */
export function IconButton({
  label,
  icon: Icon,
  tooltipSide,
  variant = "ghost",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <Button variant={variant} size="icon" aria-label={label} {...props}>
        <Icon aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
