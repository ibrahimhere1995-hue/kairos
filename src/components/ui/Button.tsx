import type { ComponentProps } from "react";
import { buttonVariants, type ButtonVariantProps } from "@/components/ui/buttonVariants";
import { cn } from "@/lib/utils";

export type ButtonProps = ComponentProps<"button"> & ButtonVariantProps;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
